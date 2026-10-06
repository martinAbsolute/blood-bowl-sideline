import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { currentUser, requireUser } from "./roles";
import { teamLeagueState } from "./teamLeagueState";
import { playEventValidator } from "./leagueValidators";
import { projectMatchEvents } from "../src/domain/match-events";
import { isPreGameComplete } from "../src/domain/match-pregame";
import { getRoster, getRuleset } from "../src/domain/catalog";
import { RULES_VERSION } from "../src/domain/types";
import {
  advancementChoices,
  advancementCost,
  advancementValue,
  applyCharacteristicReductions,
  calculateSpp,
  calculateWinnings,
  casualtyOutcome,
  emptyPlayerStats,
  expensiveMistake,
  leagueAdvancementCosts,
  leagueCurrentTeamValue,
  leagueTeamValue,
  DEFAULT_LEAGUE_TREASURY,
  rookieLeagueIssues,
  roundRobin,
  startingTreasury,
  updatedDedicatedFans,
} from "../src/domain/league-rules";

const MAX_ENTRIES = 16;
const MAX_PLAYERS = 256;
const MAX_MATCHES = (MAX_ENTRIES * (MAX_ENTRIES - 1)) / 2 + MAX_ENTRIES;
type Stats = ReturnType<typeof emptyPlayerStats>;
type Ctx = QueryCtx | MutationCtx;
const nullId = v.union(v.id("users"), v.null());
const zeroReductions = () => ({ ma: 0, st: 0, ag: 0, pa: 0, av: 0 });
const emptyEconomy = () => ({
  homeFanRoll: null,
  awayFanRoll: null,
  homeStalled: false,
  awayStalled: false,
  homeFansRoll: null,
  awayFansRoll: null,
  homeMistakeRoll: null,
  awayMistakeRoll: null,
  homeMinorRoll: null,
  awayMinorRoll: null,
  homeStashRolls: null,
  awayStashRolls: null,
  homeTreasuryBefore: null,
  awayTreasuryBefore: null,
});
function playerUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

function integer(value: number, min = 0, max = 1000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new ConvexError("INVALID_INPUT");
}
function revision(actual: number, expected: number) {
  integer(expected, 0, Number.MAX_SAFE_INTEGER);
  if (actual !== expected) throw new ConvexError("CONFLICT");
}
function text(value: string, max: number, required = false) {
  const clean = value.trim();
  if (clean.length > max || (required && !clean))
    throw new ConvexError("INVALID_INPUT");
  return clean;
}
function checkedStats(stats: Stats) {
  for (const value of Object.values(stats)) integer(value, 0, 100);
  if (stats.sppCas > stats.cas || stats.mvp > 1 || stats.dth > 1)
    throw new ConvexError("INVALID_STATS");
  return stats;
}
function capturedSpp(row: Doc<"leagueMatchPlayers">) {
  return (Object.keys(row.stats) as (keyof Stats)[]).reduce(
    (total, key) => total + row.stats[key] * row.snapshot.sppRates[key],
    0,
  );
}
function zeroTeamStats(): Doc<"leagueTeams">["stats"] {
  return {
    pts: 0,
    mp: 0,
    w: 0,
    d: 0,
    l: 0,
    tdFor: 0,
    tdAgainst: 0,
    casFor: 0,
    casAgainst: 0,
    com: 0,
    int: 0,
    inj: 0,
    dth: 0,
    fou: 0,
    sof: 0,
    latest: [],
  };
}
function fixtureResult(
  match: Doc<"leagueMatches">,
  entryId: Id<"leagueTeams">,
): "W" | "D" | "L" {
  const home = match.homeEntryId === entryId;
  if (match.administrativeResult === "draw") return "D";
  if (match.administrativeResult === "home-win") return home ? "W" : "L";
  if (match.administrativeResult === "away-win") return home ? "L" : "W";
  const scored = home ? match.scoreHome : match.scoreAway,
    conceded = home ? match.scoreAway : match.scoreHome;
  return scored > conceded ? "W" : scored === conceded ? "D" : "L";
}
async function leagueDoc(ctx: Ctx, id: Id<"leagues">) {
  const league = await ctx.db.get("leagues", id);
  if (!league) throw new ConvexError("NOT_FOUND");
  return league;
}
async function entryDoc(ctx: Ctx, id: Id<"leagueTeams">) {
  const entry = await ctx.db.get("leagueTeams", id);
  if (!entry) throw new ConvexError("NOT_FOUND");
  return entry;
}
async function matchDoc(ctx: Ctx, id: Id<"leagueMatches">) {
  const match = await ctx.db.get("leagueMatches", id);
  if (!match) throw new ConvexError("NOT_FOUND");
  return match;
}
async function entryPlayers(ctx: Ctx, entryId: Id<"leagueTeams">) {
  return ctx.db
    .query("leaguePlayers")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .take(MAX_PLAYERS);
}
async function matchPlayers(ctx: Ctx, matchId: Id<"leagueMatches">) {
  return ctx.db
    .query("leagueMatchPlayers")
    .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
    .take(64);
}
async function playEvents(ctx: Ctx, matchId: Id<"leagueMatches">) {
  const events = await ctx.db
    .query("leaguePlayEvents")
    .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
    .take(513);
  if (events.length > 512) throw new ConvexError("EVENT_LIMIT");
  return events;
}
function projectEvents(
  rows: Doc<"leagueMatchPlayers">[],
  events: Doc<"leaguePlayEvents">["event"][],
  homeId: Id<"leagueTeams">,
) {
  try {
    return projectMatchEvents(rows, events, homeId);
  } catch (error) {
    throw new ConvexError(
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "INVALID_DICE",
    );
  }
}
async function persistEventRows(
  ctx: MutationCtx,
  rows: Doc<"leagueMatchPlayers">[],
) {
  for (const row of rows)
    await ctx.db.patch("leagueMatchPlayers", row._id, {
      stats: row.stats,
      statusAfter: row.statusAfter,
      injuryNotes: row.injuryNotes,
      casualtyRoll: row.casualtyRoll,
      lastingRoll: row.lastingRoll,
    });
}

/** Independent appends merge; edits compare the event version, never overwrite another coach's edit. */
export const savePlayEvent = mutation({
  args: {
    matchId: v.id("leagueMatches"),
    event: playEventValidator,
    expectedVersion: v.number(),
    deleted: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (
    ctx,
    { matchId, event, expectedVersion, deleted = false },
  ) => {
    const { user, match } = await editableMatch(ctx, matchId);
    if (!isPreGameComplete(match)) throw new ConvexError("PRE_GAME_INCOMPLETE");
    integer(expectedVersion, 0, Number.MAX_SAFE_INTEGER);
    const ledger = await playEvents(ctx, matchId);
    const previous = ledger.find((row) => row.event.id === event.id);
    // A retry of an accepted operation is harmless, including after a lost response.
    if (
      previous &&
      previous.version === expectedVersion + 1 &&
      previous.deleted === deleted &&
      JSON.stringify(previous.event) === JSON.stringify(event)
    )
      return previous.version;
    if (
      (previous?.version ?? 0) !== expectedVersion ||
      (previous?.deleted && !deleted)
    )
      throw new ConvexError("CONFLICT");
    if ((!previous && deleted) || (!previous && ledger.length >= 512))
      throw new ConvexError("EVENT_LIMIT");
    const active = ledger
      .filter((row) => !row.deleted && !(deleted && row.event.id === event.id))
      .map((row) => (row.event.id === event.id ? event : row.event));
    if (!previous && !deleted) active.push(event);
    const projection = projectEvents(
      await matchPlayers(ctx, matchId),
      active,
      match.homeEntryId,
    );
    const value = {
      matchId,
      event,
      version: expectedVersion + 1,
      deleted,
      actorId: user._id,
      actorName: user.name ?? "Coach",
    };
    if (previous) await ctx.db.replace("leaguePlayEvents", previous._id, value);
    else await ctx.db.insert("leaguePlayEvents", value);
    await persistEventRows(ctx, projection.players);
    await ctx.db.patch("leagueMatches", matchId, {
      scoreHome: projection.scoreHome,
      scoreAway: projection.scoreAway,
      revision: match.revision + 1,
      confirmedBy: [],
    });
    await auditEvent(
      ctx,
      match.leagueId,
      user,
      "play-event-edited",
      {
        previous: previous?.event ?? null,
        event,
        deleted,
        revision: match.revision + 1,
      },
      { matchId },
    );
    return value.version;
  },
});
async function leagueEntries(ctx: Ctx, leagueId: Id<"leagues">) {
  return ctx.db
    .query("leagueTeams")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .take(MAX_ENTRIES);
}
async function commissioner(ctx: Ctx, league: Doc<"leagues">) {
  const user = await requireUser(ctx);
  if (league.ownerId !== user._id) throw new ConvexError("FORBIDDEN");
  return user;
}
async function auditEvent(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  actor: Doc<"users">,
  kind: string,
  details: unknown,
  options: {
    entryId?: Id<"leagueTeams">;
    matchId?: Id<"leagueMatches">;
    reason?: string;
  } = {},
) {
  await ctx.db.insert("leagueAudit", {
    leagueId,
    actorId: actor._id,
    actorName: actor.name ?? "Coach",
    kind,
    details: JSON.stringify(details),
    reason: options.reason ?? "",
    ...(options.entryId ? { entryId: options.entryId } : {}),
    ...(options.matchId ? { matchId: options.matchId } : {}),
  });
}
async function editableMatch(
  ctx: MutationCtx,
  matchId: Id<"leagueMatches">,
  expected?: number,
) {
  const user = await requireUser(ctx);
  const match = await matchDoc(ctx, matchId);
  const league = await leagueDoc(ctx, match.leagueId);
  const home = await entryDoc(ctx, match.homeEntryId);
  const away = match.awayEntryId
    ? await entryDoc(ctx, match.awayEntryId)
    : null;
  if (
    user.role !== "admin" &&
    ![home.coachId, away?.coachId, league.ownerId].includes(user._id)
  )
    throw new ConvexError("FORBIDDEN");
  if (match.status !== "in-progress") throw new ConvexError("REPORT_LOCKED");
  if (expected !== undefined) revision(match.revision, expected);
  return { user, match, league, home, away };
}
async function editableCareer(
  ctx: MutationCtx,
  entryId: Id<"leagueTeams">,
  expected: number,
) {
  const user = await requireUser(ctx);
  const entry = await entryDoc(ctx, entryId);
  const league = await leagueDoc(ctx, entry.leagueId);
  if (entry.coachId !== user._id && league.ownerId !== user._id)
    throw new ConvexError("FORBIDDEN");
  if (entry.withdrawn && league.ownerId !== user._id)
    throw new ConvexError("ENTRY_WITHDRAWN");
  if (entry.activeMatchId) throw new ConvexError("MATCH_IN_PROGRESS");
  revision(entry.revision, expected);
  return { user, entry, league };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("leagues")),
  handler: async (ctx, { paginationOpts }) => {
    integer(paginationOpts.numItems, 1, 30);
    return ctx.db
      .query("leagues")
      .withIndex("by_creation_time")
      .order("desc")
      .paginate(paginationOpts);
  },
});
export const create = mutation({
  args: {
    name: v.string(),
    startAt: v.number(),
    roundDays: v.optional(v.number()),
    startingTreasury: v.optional(v.number()),
  },
  returns: v.id("leagues"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    integer(args.startAt, 0, Number.MAX_SAFE_INTEGER);
    const startingTreasury = args.startingTreasury ?? DEFAULT_LEAGUE_TREASURY;
    integer(startingTreasury, 100_000, 10_000_000);
    if (startingTreasury % 5000) throw new ConvexError("INVALID_TREASURY");
    const roundDays = args.roundDays ?? 14;
    integer(roundDays, 1, 365);
    const id = await ctx.db.insert("leagues", {
      name: text(args.name, 100, true),
      ownerId: user._id,
      commissionerName: user.name ?? "Commissioner",
      status: "registration",
      rulesVersion: `${RULES_VERSION}/league-bb2025-faq-2026-05-v1`,
      startAt: args.startAt,
      roundDays,
      startingTreasury,
      activeRound: null,
      updatedAt: Date.now(),
    });
    await auditEvent(ctx, id, user, "league-created", {
      name: args.name,
      startAt: args.startAt,
      roundDays,
      startingTreasury,
    });
    return id;
  },
});

export const deleteLeague = mutation({
  args: { leagueId: v.id("leagues"), confirmationName: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, confirmationName }) => {
    const league = await leagueDoc(ctx, leagueId);
    await commissioner(ctx, league);
    if (confirmationName !== league.name)
      throw new ConvexError("LEAGUE_NAME_MISMATCH");
    const entries = await leagueEntries(ctx, leagueId);
    const teamIds = [...new Set(entries.map((entry) => entry.teamId))];
    await ctx.scheduler.runAfter(0, internal.leagueDeletion.sweep, {
      leagueId,
      teamIds,
    });
    await ctx.db.delete("leagues", leagueId);
    return null;
  },
});

const standingValidator = v.object({
  entryId: v.id("leagueTeams"),
  teamName: v.string(),
  coachName: v.string(),
  pts: v.number(),
  mp: v.number(),
  w: v.number(),
  d: v.number(),
  l: v.number(),
  latest: v.array(v.string()),
  tdFor: v.number(),
  tdAgainst: v.number(),
  tdDiff: v.number(),
  casFor: v.number(),
  casAgainst: v.number(),
  casDiff: v.number(),
  com: v.number(),
  int: v.number(),
  inj: v.number(),
  dth: v.number(),
  fou: v.number(),
  sof: v.number(),
  bhz: v.number(),
  sbr: v.number(),
  cu: v.number(),
  winDrawPercent: v.number(),
});
const playerStandingValidator = v.object({
  playerId: v.id("leaguePlayers"),
  entryId: v.id("leagueTeams"),
  name: v.string(),
  teamName: v.string(),
  coachName: v.string(),
  positionId: v.string(),
  status: schema.tables.leaguePlayers.validator.fields.status,
  sppEarned: v.number(),
  sppSpent: v.number(),
  stats: schema.tables.leaguePlayers.validator.fields.stats,
});
export const get = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    league: schema.doc("leagues"),
    commissionerUsername: v.union(v.string(), v.null()),
    entries: v.array(schema.doc("leagueTeams")),
    rounds: v.array(schema.doc("leagueRounds")),
    matches: v.array(schema.doc("leagueMatches")),
    standings: v.array(standingValidator),
    playerStats: v.array(playerStandingValidator),
    canCommission: v.boolean(),
    canRegister: v.boolean(),
    viewerId: nullId,
  }),
  handler: async (ctx, { leagueId }) => {
    const league = await leagueDoc(ctx, leagueId);
    const owner = await ctx.db.get("users", league.ownerId);
    const user = await currentUser(ctx);
    const entries = await leagueEntries(ctx, leagueId);
    const rounds = await ctx.db
      .query("leagueRounds")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(MAX_ENTRIES);
    const matches = await ctx.db
      .query("leagueMatches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(MAX_MATCHES);
    const players = await ctx.db
      .query("leaguePlayers")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(MAX_ENTRIES * MAX_PLAYERS);
    const entryById = new Map(entries.map((e) => [e._id, e]));
    const roundById = new Map(rounds.map((r) => [r._id, r]));
    const standings = entries
      .map((entry) => {
        let bhz = 0,
          sbr = 0,
          cu = 0,
          runningPoints = 0;
        const results = matches.filter(
          (m) =>
            m.status === "completed" &&
            (m.homeEntryId === entry._id || m.awayEntryId === entry._id),
        );
        for (const match of results) {
          const home = match.homeEntryId === entry._id;
          const opponent = entryById.get(
            home ? match.awayEntryId! : match.homeEntryId,
          );
          const result = fixtureResult(match, entry._id);
          bhz += opponent?.stats.pts ?? 0;
          sbr +=
            (opponent?.stats.pts ?? 0) *
            (result === "W" ? 1 : result === "D" ? 0.5 : 0);
        }
        for (const round of [...rounds].sort((a, b) => a.number - b.number)) {
          if (
            round.status !== "completed" &&
            !results.some((m) => m.roundId === round._id)
          )
            continue;
          for (const match of results)
            if (roundById.get(match.roundId)?.number === round.number) {
              const result = fixtureResult(match, entry._id);
              runningPoints += result === "W" ? 3 : result === "D" ? 1 : 0;
            }
          cu += runningPoints;
        }
        return {
          entryId: entry._id,
          teamName: entry.team.name,
          coachName: entry.coachName,
          ...entry.stats,
          tdDiff: entry.stats.tdFor - entry.stats.tdAgainst,
          casDiff: entry.stats.casFor - entry.stats.casAgainst,
          bhz,
          sbr,
          cu,
          winDrawPercent: entry.stats.mp
            ? (entry.stats.w + entry.stats.d * 0.5) / entry.stats.mp
            : 0,
        };
      })
      .sort(
        (a, b) =>
          b.pts - a.pts ||
          b.tdDiff - a.tdDiff ||
          b.casDiff - a.casDiff ||
          a.teamName.localeCompare(b.teamName),
      );
    return {
      league,
      commissionerUsername: owner?.telegramUsername ?? null,
      entries,
      rounds,
      matches,
      standings,
      playerStats: players.map((p) => ({
        playerId: p._id,
        entryId: p.entryId,
        name: p.name,
        teamName: entryById.get(p.entryId)?.team.name ?? "",
        coachName: entryById.get(p.entryId)?.coachName ?? "",
        positionId: p.positionId,
        status: p.status,
        sppEarned: p.sppEarned,
        sppSpent: p.sppSpent,
        stats: p.stats,
      })),
      canCommission: league.ownerId === user?._id,
      canRegister:
        !!user &&
        league.status === "registration" &&
        !entries.some((e) => e.coachId === user._id),
      viewerId: user?._id ?? null,
    };
  },
});

export const register = mutation({
  args: { leagueId: v.id("leagues"), teamUuid: v.string() },
  returns: v.id("leagueTeams"),
  handler: async (ctx, { leagueId, teamUuid }) => {
    const user = await requireUser(ctx);
    const league = await leagueDoc(ctx, leagueId);
    if (league.status !== "registration")
      throw new ConvexError("REGISTRATION_CLOSED");
    const existing = await ctx.db
      .query("leagueTeams")
      .withIndex("by_leagueId_and_coachId", (q) =>
        q.eq("leagueId", leagueId).eq("coachId", user._id),
      )
      .unique();
    if (existing) throw new ConvexError("ALREADY_REGISTERED");
    if ((await leagueEntries(ctx, leagueId)).length >= MAX_ENTRIES)
      throw new ConvexError("LEAGUE_FULL");
    const source = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", teamUuid))
      .unique();
    if (!source || source.ownerId !== user._id || source.archived)
      throw new ConvexError("FORBIDDEN");
    if ((await teamLeagueState(ctx, source)).leagueExperienced)
      throw new ConvexError("TEAM_EXPERIENCED");
    const issues = rookieLeagueIssues(source.team, league.startingTreasury);
    if (issues.length)
      throw new ConvexError({ code: "INVALID_ROOKIE", issues });
    const team = {
      ...source.team,
      staff: {
        ...source.team.staff,
        dedicatedFans: source.team.staff.dedicatedFans + 1,
      },
    };
    const entryId = await ctx.db.insert("leagueTeams", {
      leagueId,
      teamId: source._id,
      coachId: user._id,
      coachName: user.name ?? "Coach",
      team,
      sourceRevision: source.revision,
      revision: 1,
      treasury: startingTreasury(source.team, league.startingTreasury),
      stats: zeroTeamStats(),
      firstPlayedAt: null,
      activeMatchId: null,
      latestMatchId: null,
      postGamePending: false,
      blockedPositionIds: [],
      hiringClosed: false,
      withdrawn: false,
    });
    await ctx.db.patch("teams", source._id, { leagueExperienced: true });
    for (const player of team.players)
      await ctx.db.insert("leaguePlayers", {
        leagueId,
        entryId,
        sourcePlayerId: player.id,
        name: player.name,
        positionId: player.positionId,
        skills: [],
        temporary: false,
        hiredAfterMatchId: null,
        sppEarned: 0,
        sppSpent: 0,
        valueIncrease: 0,
        status: "active",
        injuryNotes: "",
        nigglingInjuries: 0,
        characteristicReductions: zeroReductions(),
        advancements: [],
        stats: { ...emptyPlayerStats(), mp: 0 },
      });
    await auditEvent(
      ctx,
      leagueId,
      user,
      "team-registered",
      { teamUuid, sourceRevision: source.revision },
      { entryId },
    );
    return entryId;
  },
});

export const launch = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const league = await leagueDoc(ctx, leagueId),
      user = await commissioner(ctx, league);
    if (league.status !== "registration")
      throw new ConvexError("ALREADY_LAUNCHED");
    const entries = (await leagueEntries(ctx, leagueId)).filter(
      (e) => !e.withdrawn,
    );
    if (entries.length < 2) throw new ConvexError("NOT_ENOUGH_TEAMS");
    const rounds = roundRobin(entries.map((e) => e._id));
    for (let index = 0; index < rounds.length; index++) {
      const opensAt = league.startAt + index * league.roundDays * 86_400_000;
      const roundId = await ctx.db.insert("leagueRounds", {
        leagueId,
        number: index + 1,
        opensAt,
        deadlineAt: opensAt + league.roundDays * 86_400_000,
        status: index === 0 ? "open" : "pending",
      });
      for (const fixture of rounds[index])
        await ctx.db.insert("leagueMatches", {
          leagueId,
          roundId,
          homeEntryId: fixture.home as Id<"leagueTeams">,
          awayEntryId: fixture.away as Id<"leagueTeams"> | null,
          status: fixture.away ? "scheduled" : "bye",
          administrativeResult: null,
          revision: 0,
          scoreHome: 0,
          scoreAway: 0,
          confirmedBy: [],
          startedAt: null,
          completedAt: null,
          homeSnapshot: null,
          awaySnapshot: null,
          homeCareerRevision: null,
          awayCareerRevision: null,
          homeWinnings: 0,
          awayWinnings: 0,
          correctionCount: 0,
          ...emptyEconomy(),
        });
    }
    await ctx.db.patch("leagues", leagueId, {
      status: "active",
      activeRound: 1,
      updatedAt: Date.now(),
    });
    await auditEvent(ctx, leagueId, user, "fixtures-generated", {
      entries: entries.map((e) => e._id),
      rounds: rounds.length,
    });
    return null;
  },
});
export const openRound = mutation({
  args: { roundId: v.id("leagueRounds") },
  returns: v.null(),
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("leagueRounds", roundId);
    if (!round) throw new ConvexError("NOT_FOUND");
    const league = await leagueDoc(ctx, round.leagueId),
      user = await commissioner(ctx, league);
    if (round.status !== "pending" || league.status !== "active")
      throw new ConvexError("ROUND_NOT_AVAILABLE");
    const previous = await ctx.db
      .query("leagueRounds")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
      .take(MAX_ENTRIES);
    if (
      previous.some((r) => r.number < round.number && r.status !== "completed")
    )
      throw new ConvexError("PREVIOUS_ROUND_INCOMPLETE");
    await ctx.db.patch("leagueRounds", roundId, {
      status: "open",
      opensAt: Date.now(),
    });
    await ctx.db.patch("leagues", league._id, {
      activeRound: round.number,
      updatedAt: Date.now(),
    });
    await auditEvent(ctx, league._id, user, "round-opened", {
      round: round.number,
    });
    return null;
  },
});
export const extendRound = mutation({
  args: { roundId: v.id("leagueRounds"), deadlineAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { roundId, deadlineAt }) => {
    const round = await ctx.db.get("leagueRounds", roundId);
    if (!round) throw new ConvexError("NOT_FOUND");
    const league = await leagueDoc(ctx, round.leagueId),
      user = await commissioner(ctx, league);
    integer(deadlineAt, 0, Number.MAX_SAFE_INTEGER);
    if (deadlineAt <= round.deadlineAt || round.status === "completed")
      throw new ConvexError("INVALID_DEADLINE");
    await ctx.db.patch("leagueRounds", roundId, { deadlineAt });
    await auditEvent(ctx, league._id, user, "round-deadline-extended", {
      round: round.number,
      from: round.deadlineAt,
      to: deadlineAt,
    });
    return null;
  },
});

export const getMatch = query({
  args: { matchId: v.id("leagueMatches") },
  returns: v.object({
    match: schema.doc("leagueMatches"),
    league: schema.doc("leagues"),
    home: schema.doc("leagueTeams"),
    away: v.union(schema.doc("leagueTeams"), v.null()),
    players: v.array(schema.doc("leagueMatchPlayers")),
    playEvents: v.array(schema.doc("leaguePlayEvents")),
    canEdit: v.boolean(),
    canConfirm: v.boolean(),
    canCommission: v.boolean(),
    viewerId: nullId,
  }),
  handler: async (ctx, { matchId }) => {
    const match = await matchDoc(ctx, matchId),
      league = await leagueDoc(ctx, match.leagueId),
      home = await entryDoc(ctx, match.homeEntryId);
    const away = match.awayEntryId
      ? await entryDoc(ctx, match.awayEntryId)
      : null;
    const user = await currentUser(ctx),
      isCoach =
        !!user && (home.coachId === user._id || away?.coachId === user._id),
      canCommission =
        !!user && (league.ownerId === user._id || user.role === "admin");
    return {
      match,
      league,
      home,
      away,
      players: await matchPlayers(ctx, matchId),
      playEvents: (await playEvents(ctx, matchId)).filter(
        (row) => !row.deleted,
      ),
      canEdit:
        (isCoach || canCommission) &&
        (match.status === "scheduled" || match.status === "in-progress"),
      canConfirm:
        isCoach &&
        match.status === "in-progress" &&
        !match.confirmedBy.includes(user!._id),
      canCommission,
      viewerId: user?._id ?? null,
    };
  },
});

export const getMatchHistory = query({
  args: { matchId: v.id("leagueMatches") },
  returns: v.array(
    v.object({
      id: v.id("leagueMatchEvents"),
      revision: v.number(),
      kind: schema.tables.leagueMatchEvents.validator.fields.kind,
      actorName: v.string(),
      reason: v.string(),
      scoreHome: v.number(),
      scoreAway: v.number(),
    }),
  ),
  handler: async (ctx, { matchId }) => {
    await matchDoc(ctx, matchId);
    return (
      await ctx.db
        .query("leagueMatchEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
        .order("desc")
        .take(20)
    ).map((event) => ({
      id: event._id,
      revision: event.revision,
      kind: event.kind,
      actorName: event.actorName,
      reason: event.reason,
      scoreHome: event.after.scoreHome,
      scoreAway: event.after.scoreAway,
    }));
  },
});

export const startMatch = mutation({
  args: {
    matchId: v.id("leagueMatches"),
  },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const user = await requireUser(ctx),
      match = await matchDoc(ctx, matchId),
      league = await leagueDoc(ctx, match.leagueId);
    const home = await entryDoc(ctx, match.homeEntryId),
      away = match.awayEntryId ? await entryDoc(ctx, match.awayEntryId) : null;
    if (
      !away ||
      (user.role !== "admin" &&
        ![home.coachId, away.coachId, league.ownerId].includes(user._id))
    )
      throw new ConvexError("FORBIDDEN");
    if (home.withdrawn || away.withdrawn)
      throw new ConvexError("ENTRY_WITHDRAWN");
    if (match.status === "in-progress") return null;
    if (match.status !== "scheduled") throw new ConvexError("REPORT_LOCKED");
    const round = await ctx.db.get("leagueRounds", match.roundId);
    if (round?.status !== "open") throw new ConvexError("ROUND_NOT_OPEN");
    if (home.activeMatchId || away.activeMatchId)
      throw new ConvexError("MATCH_IN_PROGRESS");
    if (home.postGamePending || away.postGamePending)
      throw new ConvexError("POSTGAME_INCOMPLETE");
    const snapshots = new Map<Id<"leagueTeams">, Doc<"leagueTeams">["team"]>();
    for (const entry of [home, away]) {
      let players = await entryPlayers(ctx, entry._id);
      const roster = getRoster(entry.team.rosterId)!;
      if (
        roster.specialRules.includes("Team Captain") &&
        (!entry.team.captainId ||
          !players.some(
            (p) =>
              !p.temporary &&
              p.sourcePlayerId === entry.team.captainId &&
              p.status !== "dead" &&
              p.status !== "retired",
          ))
      )
        throw new ConvexError("CAPTAIN_REQUIRED");
      const available = players.filter(
        (p) => !p.temporary && p.status === "active",
      );
      const position = getRoster(entry.team.rosterId)!.players.find(
        (p) => Number(p.qty.split("-")[1]) >= 12,
      );
      if (available.length < 11 && !position)
        throw new ConvexError("JOURNEYMAN_POSITION_UNAVAILABLE");
      for (let count = available.length; count < 11; count++) {
        if (players.length + 11 - available.length > MAX_PLAYERS)
          throw new ConvexError("CAREER_PLAYER_LIMIT");
        await ctx.db.insert("leaguePlayers", {
          leagueId: entry.leagueId,
          entryId: entry._id,
          sourcePlayerId: playerUuid(),
          name: "Journeyman",
          positionId: position!.id,
          skills: ["loner:4+"],
          temporary: true,
          hiredAfterMatchId: null,
          sppEarned: 0,
          sppSpent: 0,
          valueIncrease: 0,
          status: "active",
          injuryNotes: "",
          nigglingInjuries: 0,
          characteristicReductions: zeroReductions(),
          advancements: [],
          stats: { ...emptyPlayerStats(), mp: 0 },
        });
      }
      players = await entryPlayers(ctx, entry._id);
      const temporaryPlayers = players.filter(
        (p) => p.temporary && p.status === "active",
      );
      snapshots.set(entry._id, {
        ...entry.team,
        players: [
          ...entry.team.players,
          ...temporaryPlayers.map((p) => ({
            id: p.sourcePlayerId,
            positionId: p.positionId,
            name: p.name,
            skills: p.skills,
          })),
        ],
      });
      for (const player of players) {
        if (player.status === "dead" || player.status === "retired") continue;
        const position = roster.players.find(
          (p) => p.id === player.positionId,
        )!;
        const skills = [
          ...player.skills,
          ...(entry.team.captainId === player.sourcePlayerId ? ["pro"] : []),
        ];
        const sppRates = emptyPlayerStats();
        for (const key of Object.keys(sppRates) as (keyof Stats)[])
          sppRates[key] = calculateSpp(entry.team.rosterId, {
            ...emptyPlayerStats(),
            [key]: 1,
            ...(key === "sppCas" ? { cas: 1 } : {}),
          });
        await ctx.db.insert("leagueMatchPlayers", {
          matchId,
          playerId: player._id,
          entryId: entry._id,
          temporary: player.temporary,
          sourcePlayerId: player.sourcePlayerId,
          name: player.name,
          positionId: player.positionId,
          skills,
          snapshot: {
            name: player.name,
            positionId: player.positionId,
            skills: player.skills,
            status: player.status,
            sppEarned: player.sppEarned,
            sppSpent: player.sppSpent,
            valueIncrease: player.valueIncrease,
            stats: player.stats,
            advancements: player.advancements,
            nigglingInjuries: player.nigglingInjuries,
            characteristicReductions: player.characteristicReductions,
            injuryNotes: player.injuryNotes,
            profile: applyCharacteristicReductions(
              position,
              player.characteristicReductions,
            ),
            baseProfile: {
              ma: position.ma,
              st: position.st,
              ag: position.ag,
              pa: position.pa,
              av: position.av,
            },
            sppRates,
            baseCost: position.cost,
            positionName: position.position,
            baseSkills: position.skills,
          },
          stats: emptyPlayerStats(),
          participated: player.status === "active",
          statusAfter: "active",
          injuryNotes: "",
          casualtyRoll: null,
          lastingRoll: null,
        });
      }
      await ctx.db.patch("leagueTeams", entry._id, {
        activeMatchId: matchId,
        revision: entry.revision + 1,
      });
    }
    await ctx.db.patch("leagueMatches", matchId, {
      status: "in-progress",
      revision: match.revision + 1,
      startedAt: Date.now(),
      homeSnapshot: snapshots.get(home._id)!,
      awaySnapshot: snapshots.get(away._id)!,
      homeTreasuryBefore: home.treasury,
      awayTreasuryBefore: away.treasury,
    });
    await auditEvent(
      ctx,
      league._id,
      user,
      "match-started",
      {
        revision: match.revision + 1,
        homeRoster: home.team,
        awayRoster: away.team,
      },
      { matchId },
    );
    return null;
  },
});

const economyArgs = {
  homeFanRoll: v.optional(v.union(v.number(), v.null())),
  awayFanRoll: v.optional(v.union(v.number(), v.null())),
  homeStalled: v.optional(v.boolean()),
  awayStalled: v.optional(v.boolean()),
  homeFansRoll: v.optional(v.union(v.number(), v.null())),
  awayFansRoll: v.optional(v.union(v.number(), v.null())),
  homeMistakeRoll: v.optional(v.union(v.number(), v.null())),
  awayMistakeRoll: v.optional(v.union(v.number(), v.null())),
  homeMinorRoll: v.optional(v.union(v.number(), v.null())),
  awayMinorRoll: v.optional(v.union(v.number(), v.null())),
  homeStashRolls: v.optional(v.union(v.array(v.number()), v.null())),
  awayStashRolls: v.optional(v.union(v.array(v.number()), v.null())),
};
type EconomyChanges = Partial<
  Pick<Doc<"leagueMatches">, keyof typeof economyArgs>
>;
function economyPatch(match: Doc<"leagueMatches">, args: EconomyChanges) {
  const patch: EconomyChanges = {};
  for (const key of Object.keys(economyArgs) as (keyof EconomyChanges)[]) {
    const value = args[key];
    if (value === undefined) continue;
    if (key.endsWith("Stalled")) {
      if (typeof value !== "boolean") throw new ConvexError("INVALID_INPUT");
    } else if (Array.isArray(value)) {
      if (value.length !== 2) throw new ConvexError("INVALID_DICE");
      value.forEach((roll) => integer(roll, 1, 6));
    } else if (value !== null) {
      if (typeof value !== "number") throw new ConvexError("INVALID_DICE");
      integer(
        value,
        1,
        key.endsWith("FanRoll") || key.endsWith("MinorRoll") ? 3 : 6,
      );
    }
    Object.assign(patch, { [key]: value });
  }
  return { ...match, ...patch };
}
function matchEconomy(
  match: Doc<"leagueMatches">,
  home: Doc<"leagueTeams">,
  away: Doc<"leagueTeams">,
) {
  integer(match.homeFanRoll!, 1, 3);
  integer(match.awayFanRoll!, 1, 3);
  const attendance =
    (match.homeDedicatedFans ?? match.homeSnapshot!.staff.dedicatedFans) +
    match.homeFanRoll! +
    (match.awayDedicatedFans ?? match.awaySnapshot!.staff.dedicatedFans) +
    match.awayFanRoll!;
  const side = (entry: Doc<"leagueTeams">, isHome: boolean) => {
    const score = isHome ? match.scoreHome : match.scoreAway,
      opponent = isHome ? match.scoreAway : match.scoreHome;
    const prefix = isHome ? "home" : "away";
    const snapshot = isHome ? match.homeSnapshot! : match.awaySnapshot!;
    const winnings = calculateWinnings(
      attendance,
      score,
      match[`${prefix}Stalled`],
    );
    if (score !== opponent) integer(match[`${prefix}FansRoll`]!, 1, 6);
    const fans = updatedDedicatedFans(
      (isHome ? match.homeDedicatedFans : match.awayDedicatedFans) ??
        snapshot.staff.dedicatedFans,
      score > opponent ? "win" : score === opponent ? "draw" : "loss",
      match[`${prefix}FansRoll`] ?? undefined,
    );
    const before = match[`${prefix}TreasuryBefore`] ?? entry.treasury;
    return { winnings, fans, treasury: before + winnings };
  };
  return { home: side(home, true), away: side(away, false) };
}

export const updateMatchDetails = mutation({
  args: {
    matchId: v.id("leagueMatches"),
    weather: v.optional(v.union(v.number(), v.null())),
    expectedRevision: v.optional(v.number()),
    ...economyArgs,
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { match, user } = await editableMatch(
      ctx,
      args.matchId,
      args.expectedRevision,
    );
    if (args.weather !== undefined && args.weather !== null)
      integer(args.weather, 2, 12);
    const nextEconomy = economyPatch(match, args);
    const financialPatch = Object.fromEntries(
      Object.keys(economyArgs).map((key) => [
        key,
        nextEconomy[key as keyof typeof economyArgs],
      ]),
    );
    const patch = {
      ...(args.weather !== undefined ? { weather: args.weather } : {}),
      ...financialPatch,
      revision: match.revision + 1,
      confirmedBy: [],
    };
    if (
      Object.entries(patch).every(
        ([key, value]) =>
          key === "revision" ||
          key === "confirmedBy" ||
          JSON.stringify(value) ===
            JSON.stringify(match[key as keyof typeof match]),
      )
    )
      return match.revision;
    await ctx.db.patch("leagueMatches", args.matchId, patch);
    await auditEvent(
      ctx,
      match.leagueId,
      user,
      "report-details-edited",
      {
        previous: {
          scoreHome: match.scoreHome,
          scoreAway: match.scoreAway,
          homeWinnings: match.homeWinnings,
          awayWinnings: match.awayWinnings,
        },
        next: patch,
      },
      { matchId: match._id },
    );
    return match.revision + 1;
  },
});

function sumRows(rows: Doc<"leagueMatchPlayers">[]) {
  const stats = emptyPlayerStats();
  for (const row of rows)
    for (const key of Object.keys(stats) as (keyof Stats)[])
      stats[key] += row.stats[key];
  return stats;
}
function resultStats(
  score: number,
  against: number,
  own: Stats,
  opponent: Stats,
): Doc<"leagueTeams">["stats"] {
  const result = score > against ? "W" : score === against ? "D" : "L";
  return {
    pts: result === "W" ? 3 : result === "D" ? 1 : 0,
    mp: 1,
    w: result === "W" ? 1 : 0,
    d: result === "D" ? 1 : 0,
    l: result === "L" ? 1 : 0,
    tdFor: score,
    tdAgainst: against,
    casFor: own.sppCas,
    casAgainst: opponent.sppCas,
    com: own.com,
    int: own.int,
    inj: own.inj,
    dth: own.dth,
    fou: own.fou,
    sof: own.sof,
    latest: [result],
  };
}
function updateTotals(
  current: Doc<"leagueTeams">["stats"],
  add: Doc<"leagueTeams">["stats"],
  subtract?: Doc<"leagueTeams">["stats"],
) {
  const next = { ...current, latest: [...current.latest] };
  for (const key of Object.keys(current) as (keyof typeof current)[]) {
    if (key === "latest") continue;
    next[key] = current[key] + add[key] - (subtract?.[key] ?? 0);
  }
  return next;
}
function validateReport(
  match: Doc<"leagueMatches">,
  rows: Doc<"leagueMatchPlayers">[],
) {
  if (!isPreGameComplete(match)) throw new ConvexError("PRE_GAME_INCOMPLETE");
  const home = rows.filter((r) => r.entryId === match.homeEntryId),
    away = rows.filter((r) => r.entryId === match.awayEntryId);
  for (const row of rows) {
    checkedStats(row.stats);
    if (!row.participated && Object.values(row.stats).some(Boolean))
      throw new ConvexError("INELIGIBLE_PLAYER");
    if ((row.statusAfter === "dead") !== (row.stats.dth === 1))
      throw new ConvexError("INVALID_DEATH_REPORT");
  }
  const homeStats = sumRows(home),
    awayStats = sumRows(away);
  if (homeStats.td !== match.scoreHome || awayStats.td !== match.scoreAway)
    throw new ConvexError("TOUCHDOWN_TOTAL_MISMATCH");
  if (homeStats.mvp !== 1 || awayStats.mvp !== 1)
    throw new ConvexError("ONE_MVP_PER_TEAM_REQUIRED");
  return { homeStats, awayStats };
}
function rosterFromPlayers(
  entry: Doc<"leagueTeams">,
  players: Doc<"leaguePlayers">[],
) {
  return {
    ...entry.team,
    players: players
      .filter(
        (p) => !p.temporary && p.status !== "dead" && p.status !== "retired",
      )
      .map((p) => ({
        id: p.sourcePlayerId,
        positionId: p.positionId,
        name: p.name,
        skills: p.skills,
      })),
  };
}
async function finishRound(ctx: MutationCtx, match: Doc<"leagueMatches">) {
  const fixtures = await ctx.db
    .query("leagueMatches")
    .withIndex("by_roundId", (q) => q.eq("roundId", match.roundId))
    .take(MAX_ENTRIES / 2);
  if (
    fixtures.some(
      (m) =>
        m.status !== "completed" && m.status !== "bye" && m.status !== "void",
    )
  )
    return;
  await ctx.db.patch("leagueRounds", match.roundId, { status: "completed" });
  const rounds = await ctx.db
    .query("leagueRounds")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", match.leagueId))
    .take(MAX_ENTRIES);
  if (rounds.every((r) => r.status === "completed" || r._id === match.roundId))
    await ctx.db.patch("leagues", match.leagueId, {
      status: "completed",
      updatedAt: Date.now(),
    });
}

function recordedReport(
  match: Doc<"leagueMatches">,
  rows: Doc<"leagueMatchPlayers">[],
) {
  return {
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    weather: match.weather ?? null,
    homeFanRoll: match.homeFanRoll,
    awayFanRoll: match.awayFanRoll,
    homeFansRoll: match.homeFansRoll,
    awayFansRoll: match.awayFansRoll,
    homeStalled: match.homeStalled,
    awayStalled: match.awayStalled,
    homeWinnings: match.homeWinnings,
    awayWinnings: match.awayWinnings,
    homeDedicatedFans:
      match.homeDedicatedFans ?? match.homeSnapshot!.staff.dedicatedFans,
    awayDedicatedFans:
      match.awayDedicatedFans ?? match.awaySnapshot!.staff.dedicatedFans,
    players: rows.map((row) => ({
      playerId: row.playerId,
      entryId: row.entryId,
      stats: row.stats,
      participated: row.participated,
      statusAfter: row.statusAfter,
      injuryNotes: row.injuryNotes,
      casualtyRoll: row.casualtyRoll,
      lastingRoll: row.lastingRoll,
    })),
  };
}
async function recordReportEvent(
  ctx: MutationCtx,
  actor: Doc<"users">,
  kind: Doc<"leagueMatchEvents">["kind"],
  next: Doc<"leagueMatches">,
  rows: Doc<"leagueMatchPlayers">[],
  reason = "",
  previous: Doc<"leagueMatches"> | null = null,
  previousRows = rows,
  previousPlayEvents?: Doc<"leaguePlayEvents">["event"][],
) {
  const events = (await playEvents(ctx, next._id))
    .filter((row) => !row.deleted)
    .map((row) => row.event);
  return ctx.db.insert("leagueMatchEvents", {
    leagueId: next.leagueId,
    matchId: next._id,
    revision: next.revision,
    actorId: actor._id,
    actorName: actor.name ?? "Coach",
    kind,
    reason,
    before: previous
      ? {
          ...recordedReport(previous, previousRows),
          playEvents: previousPlayEvents ?? events,
        }
      : null,
    after: {
      ...recordedReport(next, rows),
      playEvents: events,
    },
  });
}

export const confirmMatch = mutation({
  args: { matchId: v.id("leagueMatches"), expectedRevision: v.number() },
  returns: v.object({ completed: v.boolean(), revision: v.number() }),
  handler: async (ctx, { matchId, expectedRevision }) => {
    const user = await requireUser(ctx),
      match = await matchDoc(ctx, matchId);
    const home = await entryDoc(ctx, match.homeEntryId),
      away = match.awayEntryId ? await entryDoc(ctx, match.awayEntryId) : null;
    if (!away || (user._id !== home.coachId && user._id !== away.coachId))
      throw new ConvexError("FORBIDDEN");
    revision(match.revision, expectedRevision);
    if (match.status === "completed")
      return { completed: true, revision: match.revision };
    if (match.status !== "in-progress")
      throw new ConvexError("REPORT_NOT_STARTED");
    const rows = await matchPlayers(ctx, matchId),
      totals = validateReport(match, rows),
      economy = matchEconomy(match, home, away);
    if (match.confirmedBy.includes(user._id))
      return { completed: false, revision: match.revision };
    const confirmedBy = [...match.confirmedBy, user._id];
    if (
      !confirmedBy.includes(home.coachId) ||
      !confirmedBy.includes(away.coachId)
    ) {
      await ctx.db.patch("leagueMatches", matchId, { confirmedBy });
      await auditEvent(
        ctx,
        match.leagueId,
        user,
        "report-confirmed",
        { revision: match.revision },
        { matchId },
      );
      return { completed: false, revision: match.revision };
    }
    for (const row of rows) {
      const player = await ctx.db.get("leaguePlayers", row.playerId);
      if (!player || player.entryId !== row.entryId)
        throw new ConvexError("INVALID_PLAYER");
      const stats = {
        ...player.stats,
        mp: player.stats.mp + (row.participated ? 1 : 0),
      };
      for (const key of Object.keys(row.stats) as (keyof Stats)[])
        stats[key] += row.stats[key];
      const reductions = { ...player.characteristicReductions };
      const casualty =
        row.casualtyRoll === null
          ? null
          : casualtyOutcome(row.casualtyRoll, row.lastingRoll ?? undefined);
      if (casualty?.characteristicReduction) {
        const before = applyCharacteristicReductions(
            row.snapshot.baseProfile,
            reductions,
          ),
          proposed = {
            ...reductions,
            [casualty.characteristicReduction]:
              reductions[casualty.characteristicReduction] + 1,
          },
          after = applyCharacteristicReductions(
            row.snapshot.baseProfile,
            proposed,
          );
        if (
          before[casualty.characteristicReduction] !==
          after[casualty.characteristicReduction]
        )
          reductions[casualty.characteristicReduction] += 1;
      }
      await ctx.db.patch("leaguePlayers", player._id, {
        stats,
        sppEarned: player.sppEarned + capturedSpp(row),
        status:
          player.temporary && row.statusAfter !== "dead"
            ? "retired"
            : row.statusAfter,
        injuryNotes: row.injuryNotes || player.injuryNotes,
        characteristicReductions: reductions,
        nigglingInjuries:
          player.nigglingInjuries + (casualty?.nigglingInjuries ?? 0),
      });
    }
    const now = Date.now();
    for (const [entry, own, opponent, scored, against, finances] of [
      [
        home,
        totals.homeStats,
        totals.awayStats,
        match.scoreHome,
        match.scoreAway,
        economy.home,
      ],
      [
        away,
        totals.awayStats,
        totals.homeStats,
        match.scoreAway,
        match.scoreHome,
        economy.away,
      ],
    ] as const) {
      const added = resultStats(scored, against, own, opponent),
        stats = updateTotals(entry.stats, added);
      stats.latest = [...entry.stats.latest, added.latest[0]].slice(-5);
      const players = await entryPlayers(ctx, entry._id);
      const team = rosterFromPlayers(entry, players);
      team.staff = { ...team.staff, dedicatedFans: finances.fans };
      if (team.captainId && !team.players.some((p) => p.id === team.captainId))
        delete team.captainId;
      await ctx.db.patch("leagueTeams", entry._id, {
        stats,
        treasury: finances.treasury,
        team,
        firstPlayedAt: entry.firstPlayedAt ?? now,
        activeMatchId: null,
        latestMatchId: matchId,
        revision: entry.revision + 1,
        postGamePending: true,
        blockedPositionIds: [],
        hiringClosed: false,
      });
      await auditEvent(
        ctx,
        entry.leagueId,
        user,
        "match-progression-applied",
        {
          matchId,
          scored,
          conceded: against,
          winnings: finances.winnings,
          dedicatedFans: finances.fans,
          treasuryBefore: entry.treasury,
          treasuryAfter: finances.treasury,
        },
        { entryId: entry._id, matchId },
      );
    }
    await ctx.db.patch("leagueMatches", matchId, {
      status: "completed",
      confirmedBy,
      completedAt: now,
      homeCareerRevision: home.revision + 1,
      awayCareerRevision: away.revision + 1,
      homeWinnings: economy.home.winnings,
      awayWinnings: economy.away.winnings,
    });
    await auditEvent(
      ctx,
      match.leagueId,
      user,
      "match-finalized",
      {
        revision: match.revision,
        confirmedBy,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
        players: rows.map((r) => ({
          playerId: r.playerId,
          stats: r.stats,
          statusAfter: r.statusAfter,
        })),
        economy,
      },
      { matchId },
    );
    const eventId = await recordReportEvent(
      ctx,
      user,
      "recorded",
      {
        ...match,
        homeWinnings: economy.home.winnings,
        awayWinnings: economy.away.winnings,
      },
      rows,
    );
    const recorded = await ctx.db.get("leagueMatchEvents", eventId);
    await ctx.db.patch("leagueMatches", matchId, {
      recordedOrder: recorded!._creationTime,
    });
    await finishRound(ctx, match);
    return { completed: true, revision: match.revision };
  },
});

const auditViewValidator = v.object({
  id: v.id("leagueAudit"),
  _id: v.id("leagueAudit"),
  action: v.string(),
  createdAt: v.number(),
  actorName: v.string(),
  reason: v.string(),
  details: v.string(),
});
function auditView(row: Doc<"leagueAudit">) {
  return {
    id: row._id,
    _id: row._id,
    action: row.kind,
    createdAt: row._creationTime,
    actorName: row.actorName,
    reason: row.reason,
    details: row.details,
  };
}
const careerPlayerValidator = schema.doc("leaguePlayers").extend({
  availableAdvancements: v.array(
    v.object({
      skillId: v.string(),
      cost: v.number(),
      valueIncrease: v.number(),
    }),
  ),
  canHireJourneyman: v.boolean(),
  canUndoAdvancement: v.boolean(),
  effectiveStats: v.object({
    ma: v.number(),
    st: v.number(),
    ag: v.string(),
    pa: v.string(),
    av: v.string(),
  }),
});
export const getCareer = query({
  args: { entryId: v.id("leagueTeams") },
  returns: v.object({
    entry: schema.doc("leagueTeams"),
    league: schema.doc("leagues"),
    players: v.array(careerPlayerValidator),
    canManage: v.boolean(),
    canCommission: v.boolean(),
    history: v.array(auditViewValidator),
    teamValue: v.number(),
    currentTeamValue: v.number(),
  }),
  handler: async (ctx, { entryId }) => {
    const entry = await entryDoc(ctx, entryId),
      league = await leagueDoc(ctx, entry.leagueId),
      user = await currentUser(ctx);
    const players = await entryPlayers(ctx, entryId);
    const latestRows = entry.latestMatchId
      ? await matchPlayers(ctx, entry.latestMatchId)
      : [];
    const history = await ctx.db
      .query("leagueAudit")
      .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
      .order("desc")
      .take(50);
    const values = players.map((p) => ({
      playerId: p.sourcePlayerId,
      valueIncrease: p.valueIncrease,
      status: p.status,
    }));
    return {
      entry,
      league,
      players: players.map((p) => {
        const position = getRoster(entry.team.rosterId)!.players.find(
          (position) => position.id === p.positionId,
        )!;
        const existing = [
          ...p.skills,
          ...(entry.team.captainId === p.sourcePlayerId ? ["pro"] : []),
        ];
        const choices =
          entry.postGamePending &&
          p.status !== "dead" &&
          (p.status !== "retired" || p.temporary) &&
          (!p.temporary || latestRows.some((row) => row.playerId === p._id)) &&
          p.hiredAfterMatchId !== entry.latestMatchId &&
          !entry.activeMatchId
            ? advancementChoices(
                entry.team.rosterId,
                p.positionId,
                existing,
                p.advancements.length,
              )
                .map((choice) => ({
                  skillId: choice.skillId,
                  cost: advancementCost(
                    p.advancements.length,
                    choice.access,
                    choice.elite,
                  ),
                  valueIncrease: advancementValue(choice.access, choice.elite),
                }))
                .filter((choice) => choice.cost <= p.sppEarned - p.sppSpent)
            : [];
        const latestRow = latestRows.find((row) => row.playerId === p._id);
        return {
          ...p,
          availableAdvancements: choices,
          canHireJourneyman:
            p.temporary &&
            p.status !== "dead" &&
            entry.postGamePending &&
            !!latestRow,
          canUndoAdvancement:
            league.ownerId === user?._id &&
            entry.postGamePending &&
            !entry.activeMatchId &&
            p.hiredAfterMatchId !== entry.latestMatchId &&
            !!latestRow &&
            p.advancements.length > latestRow.snapshot.advancements.length,
          effectiveStats: applyCharacteristicReductions(
            position,
            p.characteristicReductions,
          ),
        };
      }),
      canManage:
        !!user &&
        ((entry.coachId === user._id && !entry.withdrawn) ||
          league.ownerId === user._id) &&
        !entry.activeMatchId,
      canCommission: league.ownerId === user?._id,
      history: history.map(auditView),
      teamValue: leagueTeamValue(entry.team, values),
      currentTeamValue: leagueCurrentTeamValue(
        {
          ...entry.team,
          players: [
            ...entry.team.players,
            ...players
              .filter((p) => p.temporary && p.status === "active")
              .map((p) => ({
                id: p.sourcePlayerId,
                positionId: p.positionId,
                name: p.name,
                skills: p.skills,
              })),
          ],
        },
        values,
      ),
    };
  },
});

export const advancePlayer = mutation({
  args: {
    playerId: v.id("leaguePlayers"),
    skillId: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { playerId, skillId, expectedRevision }) => {
    const player = await ctx.db.get("leaguePlayers", playerId);
    if (!player) throw new ConvexError("NOT_FOUND");
    const { entry, user } = await editableCareer(
      ctx,
      player.entryId,
      expectedRevision,
    );
    if (
      !entry.postGamePending ||
      player.status === "dead" ||
      (player.status === "retired" && !player.temporary) ||
      player.hiredAfterMatchId === entry.latestMatchId
    )
      throw new ConvexError("ADVANCEMENT_UNAVAILABLE");
    if (
      player.temporary &&
      (!entry.latestMatchId ||
        !(await ctx.db
          .query("leagueMatchPlayers")
          .withIndex("by_matchId_and_playerId", (q) =>
            q.eq("matchId", entry.latestMatchId!).eq("playerId", playerId),
          )
          .unique()))
    )
      throw new ConvexError("JOURNEYMAN_UNAVAILABLE");
    const existing = [
      ...player.skills,
      ...(entry.team.captainId === player.sourcePlayerId ? ["pro"] : []),
    ];
    const choice = advancementChoices(
      entry.team.rosterId,
      player.positionId,
      existing,
      player.advancements.length,
    ).find((choice) => choice.skillId === skillId);
    if (!choice) throw new ConvexError("ILLEGAL_ADVANCEMENT");
    const cost = advancementCost(
        player.advancements.length,
        choice.access,
        choice.elite,
      ),
      value = advancementValue(choice.access, choice.elite);
    if (player.sppEarned - player.sppSpent < cost)
      throw new ConvexError("INSUFFICIENT_SPP");
    const skills = [...player.skills, skillId];
    await ctx.db.patch("leaguePlayers", playerId, {
      skills,
      sppSpent: player.sppSpent + cost,
      valueIncrease: player.valueIncrease + value,
      advancements: [
        ...player.advancements,
        { ...choice, sppCost: cost, valueIncrease: value },
      ],
    });
    await ctx.db.patch("leagueTeams", entry._id, {
      revision: entry.revision + 1,
      team: {
        ...entry.team,
        players: entry.team.players.map((p) =>
          p.id === player.sourcePlayerId ? { ...p, skills } : p,
        ),
      },
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "player-advanced",
      {
        playerId,
        skillId,
        sppBefore: player.sppEarned - player.sppSpent,
        cost,
        valueIncrease: value,
      },
      { entryId: entry._id },
    );
    return null;
  },
});

function checkHire(
  entry: Doc<"leagueTeams">,
  players: Doc<"leaguePlayers">[],
  positionId: string,
) {
  const roster = getRoster(entry.team.rosterId)!,
    position = roster.players.find((p) => p.id === positionId);
  if (!position) throw new ConvexError("INVALID_POSITION");
  if (entry.blockedPositionIds.includes(positionId))
    throw new ConvexError("POSITION_REHIRE_AFTER_NEXT_MATCH");
  const employed = players.filter(
    (p) => !p.temporary && p.status !== "dead" && p.status !== "retired",
  );
  if (
    employed.length >= 16 ||
    employed.filter((p) => p.positionId === positionId).length >=
      Number(position.qty.split("-")[1])
  )
    throw new ConvexError("ROSTER_LIMIT");
  if (
    position.position.includes("Big Guy") &&
    roster.bigGuyMax !== undefined &&
    employed.filter((p) =>
      roster.players
        .find((x) => x.id === p.positionId)
        ?.position.includes("Big Guy"),
    ).length >= roster.bigGuyMax
  )
    throw new ConvexError("ROSTER_LIMIT");
  if (players.length >= MAX_PLAYERS)
    throw new ConvexError("CAREER_PLAYER_LIMIT");
  if (entry.treasury < position.cost)
    throw new ConvexError("INSUFFICIENT_TREASURY");
  return position;
}
export const hirePlayer = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    positionId: v.string(),
    name: v.optional(v.string()),
    expectedRevision: v.number(),
  },
  returns: v.id("leaguePlayers"),
  handler: async (ctx, { entryId, positionId, name, expectedRevision }) => {
    const { entry, user } = await editableCareer(
      ctx,
      entryId,
      expectedRevision,
    );
    if (!entry.postGamePending) throw new ConvexError("POSTGAME_REQUIRED");
    if (entry.hiringClosed) throw new ConvexError("HIRING_MUST_PRECEDE_FIRING");
    const players = await entryPlayers(ctx, entryId),
      position = checkHire(entry, players, positionId),
      sourcePlayerId = playerUuid(),
      playerName = text(name ?? "", 80);
    const playerId = await ctx.db.insert("leaguePlayers", {
      leagueId: entry.leagueId,
      entryId,
      sourcePlayerId,
      name: playerName,
      positionId,
      skills: [],
      temporary: false,
      hiredAfterMatchId: entry.latestMatchId,
      sppEarned: 0,
      sppSpent: 0,
      valueIncrease: 0,
      status: "active",
      injuryNotes: "",
      nigglingInjuries: 0,
      characteristicReductions: zeroReductions(),
      advancements: [],
      stats: { ...emptyPlayerStats(), mp: 0 },
    });
    const team = {
      ...entry.team,
      players: [
        ...entry.team.players,
        { id: sourcePlayerId, positionId, name: playerName, skills: [] },
      ],
    };
    await ctx.db.patch("leagueTeams", entryId, {
      treasury: entry.treasury - position.cost,
      team,
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "player-hired",
      {
        playerId,
        positionId,
        cost: position.cost,
        treasuryBefore: entry.treasury,
        treasuryAfter: entry.treasury - position.cost,
      },
      { entryId },
    );
    return playerId;
  },
});

export const hireJourneyman = mutation({
  args: { playerId: v.id("leaguePlayers"), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, { playerId, expectedRevision }) => {
    const player = await ctx.db.get("leaguePlayers", playerId);
    if (!player) throw new ConvexError("NOT_FOUND");
    const { entry, user } = await editableCareer(
      ctx,
      player.entryId,
      expectedRevision,
    );
    if (!player.temporary || player.status === "dead" || !entry.postGamePending)
      throw new ConvexError("JOURNEYMAN_UNAVAILABLE");
    if (
      player.advancements.length < 6 &&
      player.sppEarned - player.sppSpent >=
        leagueAdvancementCosts.characteristic[player.advancements.length]
    )
      throw new ConvexError("MANDATORY_ADVANCEMENT_REQUIRED");
    const recent = entry.latestMatchId
      ? await ctx.db
          .query("leagueMatchPlayers")
          .withIndex("by_matchId_and_playerId", (q) =>
            q.eq("matchId", entry.latestMatchId!).eq("playerId", playerId),
          )
          .unique()
      : null;
    if (!recent) throw new ConvexError("JOURNEYMAN_UNAVAILABLE");
    const players = await entryPlayers(ctx, entry._id),
      position = checkHire(entry, players, player.positionId),
      cost = position.cost + player.valueIncrease;
    if (entry.treasury < cost) throw new ConvexError("INSUFFICIENT_TREASURY");
    const skills = player.skills.filter((s) => s !== "loner:4+");
    await ctx.db.patch("leaguePlayers", playerId, {
      temporary: false,
      status: recent.statusAfter,
      skills,
      hiredAfterMatchId: entry.latestMatchId,
    });
    await ctx.db.patch("leagueTeams", entry._id, {
      team: {
        ...entry.team,
        players: [
          ...entry.team.players,
          {
            id: player.sourcePlayerId,
            positionId: player.positionId,
            name: player.name,
            skills,
          },
        ],
      },
      treasury: entry.treasury - cost,
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "journeyman-hired",
      {
        playerId,
        cost,
        sppRetained: player.sppEarned,
        treasuryBefore: entry.treasury,
        treasuryAfter: entry.treasury - cost,
      },
      { entryId: entry._id },
    );
    return null;
  },
});

export const retirePlayer = mutation({
  args: { playerId: v.id("leaguePlayers"), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, { playerId, expectedRevision }) => {
    const player = await ctx.db.get("leaguePlayers", playerId);
    if (!player) throw new ConvexError("NOT_FOUND");
    const { entry, user } = await editableCareer(
      ctx,
      player.entryId,
      expectedRevision,
    );
    if (
      !entry.postGamePending ||
      player.temporary ||
      player.status === "dead" ||
      player.status === "retired"
    )
      throw new ConvexError("PLAYER_UNAVAILABLE");
    const players = await entryPlayers(ctx, entry._id);
    if (
      players.filter(
        (p) => !p.temporary && p._id !== playerId && p.status === "active",
      ).length < 11
    )
      throw new ConvexError("MINIMUM_ROSTER");
    await ctx.db.patch("leaguePlayers", playerId, { status: "retired" });
    const team = {
      ...entry.team,
      players: entry.team.players.filter((p) => p.id !== player.sourcePlayerId),
    };
    if (team.captainId === player.sourcePlayerId) delete team.captainId;
    await ctx.db.patch("leagueTeams", entry._id, {
      team,
      revision: entry.revision + 1,
      blockedPositionIds: [
        ...new Set([...entry.blockedPositionIds, player.positionId]),
      ],
      hiringClosed: true,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "player-retired",
      { playerId, name: player.name },
      { entryId: entry._id },
    );
    return null;
  },
});

export const renamePlayer = mutation({
  args: {
    playerId: v.id("leaguePlayers"),
    name: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { playerId, name, expectedRevision }) => {
    const player = await ctx.db.get("leaguePlayers", playerId);
    if (!player) throw new ConvexError("NOT_FOUND");
    const { entry, user } = await editableCareer(
        ctx,
        player.entryId,
        expectedRevision,
      ),
      clean = text(name, 80);
    await ctx.db.patch("leaguePlayers", playerId, { name: clean });
    await ctx.db.patch("leagueTeams", entry._id, {
      team: {
        ...entry.team,
        players: entry.team.players.map((p) =>
          p.id === player.sourcePlayerId ? { ...p, name: clean } : p,
        ),
      },
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "player-renamed",
      { playerId, from: player.name, to: clean },
      { entryId: entry._id },
    );
    return null;
  },
});
export const renameTeam = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    name: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { entryId, name, expectedRevision }) => {
    const { entry, user } = await editableCareer(
        ctx,
        entryId,
        expectedRevision,
      ),
      clean = text(name, 80, true);
    const entries = await leagueEntries(ctx, entry.leagueId);
    if (
      entries.some(
        (e) =>
          e._id !== entryId &&
          e.team.name.toLowerCase() === clean.toLowerCase(),
      )
    )
      throw new ConvexError("DUPLICATE_TEAM_NAME");
    await ctx.db.patch("leagueTeams", entryId, {
      team: { ...entry.team, name: clean },
      revision: entry.revision + 1,
    });
    // The builder page and library subscribe to the source team. Keep its
    // identity in sync without replacing its roster with the career snapshot.
    const source = await ctx.db.get("teams", entry.teamId);
    if (!source) throw new ConvexError("NOT_FOUND");
    await ctx.db.patch("teams", source._id, {
      team: { ...source.team, name: clean },
      revision: source.revision + 1,
      updatedAt: Date.now(),
      searchText: [
        clean,
        getRoster(source.team.rosterId)!.name,
        getRuleset(source.team.rulesetId).name,
      ].join(" "),
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "team-renamed",
      { from: entry.team.name, to: clean },
      { entryId },
    );
    return null;
  },
});

export const completePostGame = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    expectedRevision: v.number(),
    mistakeRoll: v.optional(v.number()),
    minorRoll: v.optional(v.number()),
    stashRolls: v.optional(v.array(v.number())),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { entryId, expectedRevision, mistakeRoll, minorRoll, stashRolls },
  ) => {
    const { entry, user } = await editableCareer(
      ctx,
      entryId,
      expectedRevision,
    );
    if (!entry.postGamePending)
      throw new ConvexError("POSTGAME_ALREADY_COMPLETED");
    const players = await entryPlayers(ctx, entryId);
    if (
      players.some(
        (p) =>
          !p.temporary &&
          p.status !== "dead" &&
          p.status !== "retired" &&
          p.advancements.length < 6 &&
          p.sppEarned - p.sppSpent >=
            leagueAdvancementCosts.characteristic[p.advancements.length],
      )
    )
      throw new ConvexError("MANDATORY_ADVANCEMENT_REQUIRED");
    if (stashRolls && stashRolls.length !== 2)
      throw new ConvexError("INVALID_DICE");
    const outcome = (() => {
      try {
        return expensiveMistake(
          entry.treasury,
          mistakeRoll,
          minorRoll,
          stashRolls ? [stashRolls[0], stashRolls[1]] : undefined,
        );
      } catch {
        throw new ConvexError("INVALID_DICE");
      }
    })();
    await ctx.db.patch("leagueTeams", entryId, {
      treasury: outcome.treasury,
      postGamePending: false,
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "postgame-completed",
      {
        treasuryBefore: entry.treasury,
        ...outcome,
        mistakeRoll,
        minorRoll,
        stashRolls,
      },
      { entryId },
    );
    return null;
  },
});

export const manageStaff = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    staff: v.union(
      v.literal("rerolls"),
      v.literal("apothecary"),
      v.literal("assistantCoaches"),
      v.literal("cheerleaders"),
    ),
    change: v.number(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { entryId, staff, change, expectedRevision }) => {
    const { entry, user } = await editableCareer(
      ctx,
      entryId,
      expectedRevision,
    );
    if (!entry.postGamePending || (change !== 1 && change !== -1))
      throw new ConvexError("INVALID_INPUT");
    if (staff === "rerolls" && change === -1)
      throw new ConvexError("REROLLS_CANNOT_BE_REMOVED");
    const roster = getRoster(entry.team.rosterId)!,
      current = entry.team.staff[staff],
      next = current + change;
    const max =
      staff === "rerolls"
        ? roster.rerolls.max
        : staff === "apothecary"
          ? roster.apothecary
            ? 1
            : 0
          : 6;
    integer(next, 0, max);
    const cost =
      change === -1
        ? 0
        : staff === "rerolls"
          ? roster.rerolls.cost * 2
          : staff === "apothecary"
            ? 50000
            : 10000;
    if (entry.treasury < cost) throw new ConvexError("INSUFFICIENT_TREASURY");
    await ctx.db.patch("leagueTeams", entryId, {
      team: { ...entry.team, staff: { ...entry.team.staff, [staff]: next } },
      treasury: entry.treasury - cost,
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "staff-changed",
      {
        staff,
        from: current,
        to: next,
        cost,
        treasuryBefore: entry.treasury,
        treasuryAfter: entry.treasury - cost,
      },
      { entryId },
    );
    return null;
  },
});

export const audit = query({
  args: { leagueId: v.id("leagues"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(auditViewValidator),
  handler: async (ctx, { leagueId, paginationOpts }) => {
    await leagueDoc(ctx, leagueId);
    integer(paginationOpts.numItems, 1, 30);
    const result = await ctx.db
      .query("leagueAudit")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(auditView) };
  },
});
export const listTeamCareers = query({
  args: { teamUuid: v.string() },
  returns: v.array(
    v.object({
      entryId: v.id("leagueTeams"),
      leagueId: v.id("leagues"),
      leagueName: v.string(),
      teamName: v.string(),
      coachName: v.string(),
      isOwner: v.boolean(),
      status: schema.tables.leagues.validator.fields.status,
    }),
  ),
  handler: async (ctx, { teamUuid }) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", teamUuid))
      .unique();
    if (!team) return [];
    const viewer = await currentUser(ctx);
    const entries = await ctx.db
      .query("leagueTeams")
      .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
      .take(30);
    const result = [];
    for (const entry of entries) {
      const league = await leagueDoc(ctx, entry.leagueId);
      result.push({
        entryId: entry._id,
        leagueId: league._id,
        leagueName: league.name,
        teamName: entry.team.name,
        coachName: entry.coachName,
        isOwner: viewer?._id === team.ownerId,
        status: league.status,
      });
    }
    return result;
  },
});

export const replaceEntryTeam = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    teamUuid: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { entryId, teamUuid, expectedRevision }) => {
    const { entry, user, league } = await editableCareer(
      ctx,
      entryId,
      expectedRevision,
    );
    if (entry.firstPlayedAt || entry.postGamePending)
      throw new ConvexError("TEAM_REPLACEMENT_CLOSED");
    const source = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", teamUuid))
      .unique();
    if (!source || source.ownerId !== entry.coachId || source.archived)
      throw new ConvexError("FORBIDDEN");
    if ((await teamLeagueState(ctx, source)).leagueExperienced)
      throw new ConvexError("TEAM_EXPERIENCED");
    const issues = rookieLeagueIssues(source.team, league.startingTreasury);
    if (issues.length)
      throw new ConvexError({ code: "INVALID_ROOKIE", issues });
    const oldPlayers = await entryPlayers(ctx, entryId);
    // Preserve experience even when replacement removes the old team's career link.
    await ctx.db.patch("teams", entry.teamId, { leagueExperienced: true });
    await ctx.db.patch("teams", source._id, { leagueExperienced: true });
    for (const player of oldPlayers)
      await ctx.db.delete("leaguePlayers", player._id);
    const team = {
      ...source.team,
      staff: {
        ...source.team.staff,
        dedicatedFans: source.team.staff.dedicatedFans + 1,
      },
    };
    for (const player of team.players)
      await ctx.db.insert("leaguePlayers", {
        leagueId: entry.leagueId,
        entryId,
        sourcePlayerId: player.id,
        name: player.name,
        positionId: player.positionId,
        skills: [],
        temporary: false,
        hiredAfterMatchId: null,
        sppEarned: 0,
        sppSpent: 0,
        valueIncrease: 0,
        status: "active",
        injuryNotes: "",
        nigglingInjuries: 0,
        characteristicReductions: zeroReductions(),
        advancements: [],
        stats: { ...emptyPlayerStats(), mp: 0 },
      });
    await ctx.db.patch("leagueTeams", entryId, {
      teamId: source._id,
      sourceRevision: source.revision,
      team,
      treasury: startingTreasury(source.team, league.startingTreasury),
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "registered-team-replaced",
      {
        previousTeamId: entry.teamId,
        previousRoster: entry.team,
        nextTeamId: source._id,
        sourceRevision: source.revision,
      },
      { entryId },
    );
    return null;
  },
});

export const setCaptain = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    playerId: v.id("leaguePlayers"),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { entryId, playerId, expectedRevision }) => {
    const { entry, user } = await editableCareer(
        ctx,
        entryId,
        expectedRevision,
      ),
      player = await ctx.db.get("leaguePlayers", playerId);
    const roster = getRoster(entry.team.rosterId)!,
      position = roster.players.find((p) => p.id === player?.positionId);
    if (
      !roster.specialRules.includes("Team Captain") ||
      !player ||
      player.entryId !== entryId ||
      player.temporary ||
      player.status !== "active" ||
      !position ||
      position.position.includes("Big Guy") ||
      player.skills.includes("pro")
    )
      throw new ConvexError("INVALID_CAPTAIN");
    if (entry.team.captainId) throw new ConvexError("CAPTAIN_ALREADY_ASSIGNED");
    await ctx.db.patch("leagueTeams", entryId, {
      team: { ...entry.team, captainId: player.sourcePlayerId },
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "captain-assigned",
      { playerId },
      { entryId },
    );
    return null;
  },
});

function matchOrder(match: Doc<"leagueMatches">) {
  return match.recordedOrder ?? match.completedAt ?? match._creationTime;
}

// Rebuild injury effects from the corrected match onward. SPP/statistic changes
// are additive; replaying availability and reductions handles later recovery and
// the characteristic floors without overwriting subsequent skills or names.
async function replayPlayerCorrection(
  ctx: MutationCtx,
  old: Doc<"leagueMatchPlayers">,
  next: Doc<"leagueMatchPlayers">,
  matches: Map<Id<"leagueMatches">, Doc<"leagueMatches">>,
) {
  const player = await ctx.db.get("leaguePlayers", next.playerId);
  if (!player) throw new ConvexError("INVALID_PLAYER");
  const earned = player.sppEarned + capturedSpp(next) - capturedSpp(old);
  if (earned < player.sppSpent) throw new ConvexError("SPENT_SPP_CONFLICT");
  const stats = { ...player.stats };
  for (const key of Object.keys(next.stats) as (keyof Stats)[])
    stats[key] += next.stats[key] - old.stats[key];
  const history = await ctx.db
    .query("leagueMatchPlayers")
    .withIndex("by_playerId", (q) => q.eq("playerId", next.playerId))
    .take(MAX_MATCHES + 1);
  if (history.length > MAX_MATCHES)
    throw new ConvexError("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
  const match = matches.get(next.matchId)!;
  const rows = history
    .filter((row) => {
      const fixture = matches.get(row.matchId);
      return (
        fixture?.status === "completed" &&
        !fixture.administrativeResult &&
        (matchOrder(fixture) > matchOrder(match) || fixture._id === match._id)
      );
    })
    .sort(
      (a, b) =>
        matchOrder(matches.get(a.matchId)!) -
          matchOrder(matches.get(b.matchId)!) ||
        a._creationTime - b._creationTime,
    )
    .map((row) => (row.matchId === next.matchId ? next : row));
  let status: Doc<"leaguePlayers">["status"] = next.snapshot.status;
  let notes = next.snapshot.injuryNotes,
    niggles = next.snapshot.nigglingInjuries;
  const reductions = { ...next.snapshot.characteristicReductions };
  for (const row of rows) {
    if (
      row.matchId !== next.matchId &&
      (status === "dead" ||
        (status === "missing-next-game" && row.participated))
    )
      throw new ConvexError("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
    status = row.statusAfter;
    notes = row.injuryNotes || notes;
    if (row.casualtyRoll === null) continue;
    const outcome = casualtyOutcome(
      row.casualtyRoll,
      row.lastingRoll ?? undefined,
    );
    niggles += outcome.nigglingInjuries;
    if (outcome.characteristicReduction) {
      const key = outcome.characteristicReduction;
      const before = applyCharacteristicReductions(
        row.snapshot.baseProfile,
        reductions,
      );
      const proposed = { ...reductions, [key]: reductions[key] + 1 };
      if (
        before[key] !==
        applyCharacteristicReductions(row.snapshot.baseProfile, proposed)[key]
      )
        reductions[key] += 1;
    }
  }
  if (
    (player.status === "retired" && !player.temporary) ||
    (player.temporary && status !== "dead")
  )
    status = "retired";
  await ctx.db.patch("leaguePlayers", player._id, {
    stats,
    sppEarned: earned,
    status,
    injuryNotes: notes,
    nigglingInjuries: niggles,
    characteristicReductions: reductions,
  });
}

// Replay the treasury's subsequent match awards, purchases and recorded
// Expensive Mistakes rolls. Absolute commissioner treasury rulings stay absolute.
async function replayTreasury(
  ctx: MutationCtx,
  entry: Doc<"leagueTeams">,
  first: Doc<"leagueMatches">,
  projections: Map<Id<"leagueMatches">, Doc<"leagueMatches">>,
) {
  const events = await ctx.db
    .query("leagueAudit")
    .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
    .take(4097);
  if (events.length > 4096)
    throw new ConvexError("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
  const start = events.findIndex(
    (event) =>
      event.kind === "match-progression-applied" && event.matchId === first._id,
  );
  if (start < 0)
    throw new ConvexError("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
  let treasury = (
    first.homeEntryId === entry._id
      ? first.homeTreasuryBefore
      : first.awayTreasuryBefore
  )!;
  for (const event of events.slice(start)) {
    const details = JSON.parse(event.details) as Record<string, unknown>;
    if (event.kind === "match-progression-applied") {
      const fixture = event.matchId ? projections.get(event.matchId) : null;
      if (!fixture) throw new ConvexError("INVALID_INPUT");
      treasury +=
        fixture.homeEntryId === entry._id
          ? fixture.homeWinnings
          : fixture.awayWinnings;
    } else if (
      ["player-hired", "journeyman-hired", "staff-changed"].includes(event.kind)
    ) {
      treasury -= Number(details.cost);
    } else if (event.kind === "postgame-completed") {
      try {
        treasury = expensiveMistake(
          treasury,
          typeof details.mistakeRoll === "number"
            ? details.mistakeRoll
            : undefined,
          typeof details.minorRoll === "number" ? details.minorRoll : undefined,
          Array.isArray(details.stashRolls)
            ? [Number(details.stashRolls[0]), Number(details.stashRolls[1])]
            : undefined,
        ).treasury;
      } catch {
        throw new ConvexError(
          "DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION",
        );
      }
    } else if (event.kind === "career-treasury-corrected") {
      treasury = Number(details.treasuryAfter);
    }
    if (!Number.isSafeInteger(treasury) || treasury < 0)
      throw new ConvexError("INSUFFICIENT_TREASURY");
  }
  return treasury;
}

export const correctMatch = mutation({
  args: {
    matchId: v.id("leagueMatches"),
    reason: v.string(),
    expectedRevision: v.number(),
    playEvents: v.optional(v.array(playEventValidator)),
    weather: v.optional(v.union(v.number(), v.null())),
    ...economyArgs,
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const match = await matchDoc(ctx, args.matchId),
      league = await leagueDoc(ctx, match.leagueId),
      user = await requireUser(ctx);
    if (user.role !== "admin" && user._id !== league.ownerId)
      throw new ConvexError("FORBIDDEN");
    if (match.status !== "completed" || !match.awayEntryId)
      throw new ConvexError("REPORT_NOT_COMPLETED");
    if (match.administrativeResult)
      throw new ConvexError("USE_ADMINISTRATIVE_ADJUDICATION");
    revision(match.revision, args.expectedRevision);
    const reason = text(args.reason, 1000, true);
    if (args.weather !== undefined && args.weather !== null)
      integer(args.weather, 2, 12);
    const rows = await matchPlayers(ctx, match._id);
    const oldLedger = await playEvents(ctx, match._id);
    const previousPlayEvents = oldLedger
      .filter((row) => !row.deleted)
      .map((row) => row.event);
    const projection = projectEvents(
      rows,
      args.playEvents ?? previousPlayEvents,
      match.homeEntryId,
    );
    const nextRows = projection.players;
    const next: Doc<"leagueMatches"> = {
      ...economyPatch(match, args),
      scoreHome: projection.scoreHome,
      scoreAway: projection.scoreAway,
      ...(args.weather !== undefined ? { weather: args.weather } : {}),
      revision: match.revision + 1,
      correctionCount: match.correctionCount + 1,
    };
    validateReport(next, nextRows);
    const home = await entryDoc(ctx, match.homeEntryId),
      away = await entryDoc(ctx, match.awayEntryId);
    const affectsCareers =
      nextRows.some(
        (row, index) =>
          JSON.stringify(row.stats) !== JSON.stringify(rows[index].stats) ||
          row.statusAfter !== rows[index].statusAfter ||
          row.casualtyRoll !== rows[index].casualtyRoll ||
          row.lastingRoll !== rows[index].lastingRoll ||
          row.injuryNotes !== rows[index].injuryNotes,
      ) ||
      next.scoreHome !== match.scoreHome ||
      next.scoreAway !== match.scoreAway ||
      Object.keys(economyArgs).some(
        (key) =>
          JSON.stringify(next[key as keyof typeof economyArgs]) !==
          JSON.stringify(match[key as keyof typeof economyArgs]),
      );
    const fixtures = await ctx.db
      .query("leagueMatches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
      .take(MAX_MATCHES);
    const projections = new Map(
      fixtures.map((fixture) => [fixture._id, fixture]),
    );
    projections.set(match._id, next);
    if (affectsCareers) {
      if (home.activeMatchId || away.activeMatchId)
        throw new ConvexError(
          "DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION",
        );
      for (let index = 0; index < rows.length; index++)
        if (JSON.stringify(nextRows[index]) !== JSON.stringify(rows[index]))
          await replayPlayerCorrection(
            ctx,
            rows[index],
            nextRows[index],
            projections,
          );
      const fans = new Map<Id<"leagueTeams">, number>([
        [
          home._id,
          match.homeDedicatedFans ?? match.homeSnapshot!.staff.dedicatedFans,
        ],
        [
          away._id,
          match.awayDedicatedFans ?? match.awaySnapshot!.staff.dedicatedFans,
        ],
      ]);
      const entries = new Map(
        (await leagueEntries(ctx, league._id)).map((entry) => [
          entry._id,
          entry,
        ]),
      );
      const firstAffected = new Map<Id<"leagueTeams">, Doc<"leagueMatches">>();
      const later = fixtures
        .filter(
          (fixture) =>
            fixture.status === "completed" &&
            !fixture.administrativeResult &&
            fixture.awayEntryId &&
            matchOrder(fixture) >= matchOrder(match),
        )
        .sort(
          (a, b) =>
            matchOrder(a) - matchOrder(b) || a._creationTime - b._creationTime,
        );
      for (const original of later) {
        if (!fans.has(original.homeEntryId) && !fans.has(original.awayEntryId!))
          continue;
        const fixture = projections.get(original._id)!;
        const h = entries.get(fixture.homeEntryId)!,
          a = entries.get(fixture.awayEntryId!)!;
        if (h.activeMatchId || a.activeMatchId)
          throw new ConvexError(
            "DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION",
          );
        const replayed = {
          ...fixture,
          homeDedicatedFans:
            fans.get(h._id) ??
            fixture.homeDedicatedFans ??
            fixture.homeSnapshot!.staff.dedicatedFans,
          awayDedicatedFans:
            fans.get(a._id) ??
            fixture.awayDedicatedFans ??
            fixture.awaySnapshot!.staff.dedicatedFans,
        };
        const economy = matchEconomy(replayed, h, a);
        replayed.homeWinnings = economy.home.winnings;
        replayed.awayWinnings = economy.away.winnings;
        fans.set(h._id, economy.home.fans);
        fans.set(a._id, economy.away.fans);
        if (!firstAffected.has(h._id)) firstAffected.set(h._id, original);
        if (!firstAffected.has(a._id)) firstAffected.set(a._id, original);
        projections.set(fixture._id, replayed);
        if (fixture._id === match._id) Object.assign(next, replayed);
        else if (
          replayed.homeDedicatedFans !== original.homeDedicatedFans ||
          replayed.awayDedicatedFans !== original.awayDedicatedFans ||
          replayed.homeWinnings !== original.homeWinnings ||
          replayed.awayWinnings !== original.awayWinnings
        ) {
          replayed.revision += 1;
          await ctx.db.patch("leagueMatches", fixture._id, {
            homeDedicatedFans: replayed.homeDedicatedFans,
            awayDedicatedFans: replayed.awayDedicatedFans,
            homeWinnings: replayed.homeWinnings,
            awayWinnings: replayed.awayWinnings,
            revision: replayed.revision,
          });
          await recordReportEvent(
            ctx,
            user,
            "replayed",
            replayed,
            await matchPlayers(ctx, fixture._id),
            reason,
            original,
          );
        }
      }
      for (const [entryId, first] of firstAffected) {
        const entry = entries.get(entryId)!;
        const treasury = await replayTreasury(ctx, entry, first, projections);
        const team = rosterFromPlayers(entry, await entryPlayers(ctx, entryId));
        team.staff = { ...team.staff, dedicatedFans: fans.get(entryId)! };
        const captain =
          first.homeEntryId === entryId
            ? first.homeSnapshot?.captainId
            : first.awaySnapshot?.captainId;
        if (
          !team.captainId &&
          captain &&
          team.players.some((player) => player.id === captain)
        )
          team.captainId = captain;
        if (
          team.captainId &&
          !team.players.some((player) => player.id === team.captainId)
        )
          delete team.captainId;
        await ctx.db.patch("leagueTeams", entryId, {
          treasury,
          team,
          revision: entry.revision + 1,
        });
      }
      for (const [
        entry,
        oldOwn,
        oldOpp,
        newOwn,
        newOpp,
        oldScore,
        oldAgainst,
        newScore,
        newAgainst,
      ] of [
        [
          home,
          sumRows(rows.filter((row) => row.entryId === home._id)),
          sumRows(rows.filter((row) => row.entryId === away._id)),
          sumRows(nextRows.filter((row) => row.entryId === home._id)),
          sumRows(nextRows.filter((row) => row.entryId === away._id)),
          match.scoreHome,
          match.scoreAway,
          next.scoreHome,
          next.scoreAway,
        ],
        [
          away,
          sumRows(rows.filter((row) => row.entryId === away._id)),
          sumRows(rows.filter((row) => row.entryId === home._id)),
          sumRows(nextRows.filter((row) => row.entryId === away._id)),
          sumRows(nextRows.filter((row) => row.entryId === home._id)),
          match.scoreAway,
          match.scoreHome,
          next.scoreAway,
          next.scoreHome,
        ],
      ] as const) {
        const stats = updateTotals(
          entry.stats,
          resultStats(newScore, newAgainst, newOwn, newOpp),
          resultStats(oldScore, oldAgainst, oldOwn, oldOpp),
        );
        stats.latest = [...projections.values()]
          .filter(
            (fixture) =>
              fixture.status === "completed" &&
              (fixture.homeEntryId === entry._id ||
                fixture.awayEntryId === entry._id),
          )
          .sort(
            (a, b) =>
              matchOrder(a) - matchOrder(b) ||
              a._creationTime - b._creationTime,
          )
          .slice(-5)
          .map((fixture) => fixtureResult(fixture, entry._id));
        await ctx.db.patch("leagueTeams", entry._id, { stats });
      }
      next.homeCareerRevision = home.revision + 1;
      next.awayCareerRevision = away.revision + 1;
    }
    for (const row of nextRows)
      await ctx.db.patch("leagueMatchPlayers", row._id, {
        stats: row.stats,
        statusAfter: row.statusAfter,
        injuryNotes: row.injuryNotes,
        casualtyRoll: row.casualtyRoll,
        lastingRoll: row.lastingRoll,
      });
    const { _id, _creationTime, ...document } = next;
    void _creationTime;
    await ctx.db.patch("leagueMatches", _id, document);
    if (args.playEvents !== undefined) {
      const desired = new Map(
        args.playEvents.map((event) => [event.id, event]),
      );
      if (
        oldLedger.length +
          args.playEvents.filter(
            (event) => !oldLedger.some((row) => row.event.id === event.id),
          ).length >
        512
      )
        throw new ConvexError("EVENT_LIMIT");
      for (const row of oldLedger) {
        const event = desired.get(row.event.id);
        await ctx.db.patch("leaguePlayEvents", row._id, {
          event: event ?? row.event,
          deleted: !event,
          version: row.version + 1,
          actorId: user._id,
          actorName: user.name ?? "Commissioner",
        });
        desired.delete(row.event.id);
      }
      for (const event of desired.values())
        await ctx.db.insert("leaguePlayEvents", {
          matchId: match._id,
          event,
          deleted: false,
          version: 1,
          actorId: user._id,
          actorName: user.name ?? "Commissioner",
        });
    }
    await recordReportEvent(
      ctx,
      user,
      "corrected",
      next,
      nextRows,
      reason,
      match,
      rows,
      previousPlayEvents,
    );
    await auditEvent(
      ctx,
      league._id,
      user,
      "match-corrected",
      {
        previous: recordedReport(match, rows),
        next: recordedReport(next, nextRows),
        replayedMatchIds: [...projections.values()]
          .filter(
            (fixture) =>
              fixture.revision !==
              fixtures.find((original) => original._id === fixture._id)
                ?.revision,
          )
          .map((fixture) => fixture._id),
      },
      { matchId: match._id, reason },
    );
    return next.revision;
  },
});

export const correctCareer = mutation({
  args: {
    entryId: v.id("leagueTeams"),
    expectedRevision: v.number(),
    treasury: v.number(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { entryId, expectedRevision, treasury, reason }) => {
    const entry = await entryDoc(ctx, entryId),
      league = await leagueDoc(ctx, entry.leagueId),
      user = await commissioner(ctx, league);
    if (entry.activeMatchId) throw new ConvexError("MATCH_IN_PROGRESS");
    revision(entry.revision, expectedRevision);
    integer(treasury, 0, 100_000_000);
    if (treasury % 5000) throw new ConvexError("INVALID_TREASURY");
    const clean = text(reason, 1000, true);
    await ctx.db.patch("leagueTeams", entryId, {
      treasury,
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      league._id,
      user,
      "career-treasury-corrected",
      { treasuryBefore: entry.treasury, treasuryAfter: treasury },
      { entryId, reason: clean },
    );
    return null;
  },
});

export const undoLatestAdvancement = mutation({
  args: {
    playerId: v.id("leaguePlayers"),
    expectedRevision: v.number(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { playerId, expectedRevision, reason }) => {
    const player = await ctx.db.get("leaguePlayers", playerId);
    if (!player) throw new ConvexError("NOT_FOUND");
    const entry = await entryDoc(ctx, player.entryId),
      league = await leagueDoc(ctx, entry.leagueId),
      user = await commissioner(ctx, league),
      clean = text(reason, 1000, true);
    revision(entry.revision, expectedRevision);
    if (
      !entry.postGamePending ||
      entry.activeMatchId ||
      !entry.latestMatchId ||
      player.hiredAfterMatchId === entry.latestMatchId
    )
      throw new ConvexError("ADVANCEMENT_CORRECTION_UNAVAILABLE");
    const row = await ctx.db
      .query("leagueMatchPlayers")
      .withIndex("by_matchId_and_playerId", (q) =>
        q.eq("matchId", entry.latestMatchId!).eq("playerId", playerId),
      )
      .unique();
    if (!row || player.advancements.length <= row.snapshot.advancements.length)
      throw new ConvexError("ADVANCEMENT_ALREADY_CAPTURED_IN_MATCH");
    const advancement = player.advancements[player.advancements.length - 1],
      skills = player.skills.filter((skill) => skill !== advancement.skillId),
      sppSpent = player.sppSpent - advancement.sppCost,
      valueIncrease = player.valueIncrease - advancement.valueIncrease;
    if (sppSpent < 0 || valueIncrease < 0)
      throw new ConvexError("INVALID_ADVANCEMENT_LEDGER");
    await ctx.db.patch("leaguePlayers", playerId, {
      skills,
      sppSpent,
      valueIncrease,
      advancements: player.advancements.slice(0, -1),
    });
    await ctx.db.patch("leagueTeams", entry._id, {
      team: {
        ...entry.team,
        players: entry.team.players.map((p) =>
          p.id === player.sourcePlayerId ? { ...p, skills } : p,
        ),
      },
      revision: entry.revision + 1,
    });
    await auditEvent(
      ctx,
      entry.leagueId,
      user,
      "advancement-corrected",
      {
        playerId,
        removed: advancement,
        sppSpentBefore: player.sppSpent,
        sppSpentAfter: sppSpent,
        valueIncreaseBefore: player.valueIncrease,
        valueIncreaseAfter: valueIncrease,
      },
      { entryId: entry._id, reason: clean },
    );
    return null;
  },
});

const administrativeOutcomeValidator = v.union(
  v.literal("home-win"),
  v.literal("away-win"),
  v.literal("draw"),
  v.literal("void"),
);
function administrativeStats(
  outcome: "home-win" | "away-win" | "draw" | "void",
  isHome: boolean,
) {
  const result =
    outcome === "draw" ? "D" : (outcome === "home-win") === isHome ? "W" : "L";
  const stats = zeroTeamStats();
  if (outcome === "void") return stats;
  return {
    ...stats,
    pts: result === "W" ? 3 : result === "D" ? 1 : 0,
    mp: 1,
    w: result === "W" ? 1 : 0,
    d: result === "D" ? 1 : 0,
    l: result === "L" ? 1 : 0,
    latest: [result] as ("W" | "D" | "L")[],
  };
}
export const adjudicateMatch = mutation({
  args: {
    matchId: v.id("leagueMatches"),
    outcome: administrativeOutcomeValidator,
    reason: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { matchId, outcome, reason, expectedRevision }) => {
    const match = await matchDoc(ctx, matchId),
      league = await leagueDoc(ctx, match.leagueId),
      user = await requireUser(ctx);
    if (user.role !== "admin" && user._id !== league.ownerId)
      throw new ConvexError("FORBIDDEN");
    revision(match.revision, expectedRevision);
    const clean = text(reason, 1000, true);
    if (
      !match.awayEntryId ||
      match.status === "in-progress" ||
      (match.status === "completed" && !match.administrativeResult) ||
      match.status === "bye"
    )
      throw new ConvexError("ONLY_UNPLAYED_FIXTURES_CAN_BE_ADJUDICATED");
    const home = await entryDoc(ctx, match.homeEntryId),
      away = await entryDoc(ctx, match.awayEntryId),
      nextMatch = {
        ...match,
        status: outcome === "void" ? ("void" as const) : ("completed" as const),
        administrativeResult: outcome,
        completedAt: Date.now(),
        scoreHome: 0,
        scoreAway: 0,
      };
    const allMatches = await ctx.db
      .query("leagueMatches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
      .take(MAX_MATCHES);
    for (const entry of [home, away]) {
      const old = match.administrativeResult
        ? administrativeStats(
            match.administrativeResult,
            entry._id === home._id,
          )
        : zeroTeamStats();
      const stats = updateTotals(
        entry.stats,
        administrativeStats(outcome, entry._id === home._id),
        old,
      );
      stats.latest = allMatches
        .map((m) => (m._id === matchId ? nextMatch : m))
        .filter(
          (m) =>
            m.status === "completed" &&
            (m.homeEntryId === entry._id || m.awayEntryId === entry._id),
        )
        .sort(
          (a, b) =>
            (a.completedAt ?? 0) - (b.completedAt ?? 0) ||
            a._creationTime - b._creationTime,
        )
        .slice(-5)
        .map((m) => fixtureResult(m, entry._id));
      await ctx.db.patch("leagueTeams", entry._id, { stats });
    }
    await ctx.db.patch("leagueMatches", matchId, {
      administrativeResult: outcome,
      status: nextMatch.status,
      completedAt: nextMatch.completedAt,
      scoreHome: 0,
      scoreAway: 0,
      confirmedBy: [],
      revision: match.revision + 1,
    });
    await auditEvent(
      ctx,
      league._id,
      user,
      "unplayed-match-adjudicated",
      {
        previousOutcome: match.administrativeResult,
        outcome,
        playerProgressionApplied: false,
      },
      { matchId, reason: clean },
    );
    await finishRound(ctx, nextMatch);
    return null;
  },
});
export const withdrawEntry = mutation({
  args: { entryId: v.id("leagueTeams"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { entryId, reason }) => {
    const entry = await entryDoc(ctx, entryId),
      league = await leagueDoc(ctx, entry.leagueId),
      user = await commissioner(ctx, league),
      clean = text(reason, 1000, true);
    if (entry.activeMatchId)
      throw new ConvexError("ACTIVE_REPORT_MUST_BE_RESOLVED_FIRST");
    if (entry.withdrawn) return null;
    await ctx.db.patch("leagueTeams", entryId, { withdrawn: true });
    const matches = await ctx.db
      .query("leagueMatches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
      .take(MAX_MATCHES);
    const affected: Id<"leagueMatches">[] = [];
    for (const match of matches)
      if (
        match.status === "scheduled" &&
        (match.homeEntryId === entryId || match.awayEntryId === entryId)
      ) {
        await ctx.db.patch("leagueMatches", match._id, {
          status: "void",
          administrativeResult: "void",
          revision: match.revision + 1,
        });
        affected.push(match._id);
        await finishRound(ctx, {
          ...match,
          status: "void",
          administrativeResult: "void",
        });
      }
    await auditEvent(
      ctx,
      league._id,
      user,
      "entry-withdrawn",
      { entryId, voidedFixtures: affected, previousResultsRetained: true },
      { entryId, reason: clean },
    );
    return null;
  },
});
