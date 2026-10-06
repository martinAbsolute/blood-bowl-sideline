/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, newTeam } from "../src/domain/catalog";
import { validateTeam } from "../src/domain/rules";
import type { Id } from "../convex/_generated/dataModel";
import { newMatchEvent } from "../src/domain/match-events";
import type { FunctionArgs } from "convex/server";

const modules = import.meta.glob("../convex/**/*.ts");

describe("shared event reports", () => {
  async function eventReport(preGameReady = true) {
    const s = await setup();
    await s.coaches[0].mutation(api.leagues.startMatch, {
      matchId: s.match._id,
    });
    const view = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    const home = s.coaches[s.entries.indexOf(view.home._id)];
    const away = s.coaches[s.entries.indexOf(view.away!._id)];
    if (preGameReady)
      await home.mutation(api.leagues.updateMatchDetails, {
        matchId: s.match._id,
        weather: 4,
        homeFanRoll: 1,
        awayFanRoll: 1,
      });
    const a = view.players.find((row) => row.entryId === view.home._id)!;
    const b = view.players.find((row) => row.entryId === view.away!._id)!;
    function event(
      patch: Partial<
        FunctionArgs<typeof api.leagues.savePlayEvent>["event"]
      > = {},
    ) {
      return {
        ...newMatchEvent(a.playerId),
        playerId: a.playerId,
        targetId: null as Id<"leaguePlayers"> | null,
        id: randomUUID(),
        ...patch,
      };
    }
    const save = (
      e: ReturnType<typeof event>,
      expectedVersion = 0,
      deleted = false,
    ) =>
      home.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: e,
        expectedVersion,
        deleted,
      });
    async function ready() {
      await save(event({ kind: "mvp" }));
      await away.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: event({ kind: "mvp", playerId: b.playerId }),
        expectedVersion: 0,
      });
      await home.mutation(api.leagues.updateMatchDetails, {
        matchId: s.match._id,
        homeFanRoll: 1,
        awayFanRoll: 1,
        homeFansRoll: 6,
        awayFansRoll: 6,
      });
      return s.t.query(api.leagues.getMatch, { matchId: s.match._id });
    }
    return { ...s, home, away, a, b, event, save, ready };
  }
  it("unlocks events for both coaches only after all shared pre-game selections, and relocks when cleared", async () => {
    const s = await eventReport(false);
    const attempt = (actor: typeof s.home) =>
      actor.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: s.event(),
        expectedVersion: 0,
      });
    for (const actor of [s.home, s.away])
      await expect(attempt(actor)).rejects.toThrow("PRE_GAME_INCOMPLETE");
    await s.home.mutation(api.leagues.updateMatchDetails, {
      matchId: s.match._id,
      homeFanRoll: 2,
      awayFanRoll: 3,
    });
    await expect(attempt(s.away)).rejects.toThrow("PRE_GAME_INCOMPLETE");
    await s.away.mutation(api.leagues.updateMatchDetails, {
      matchId: s.match._id,
      weather: 10,
    });
    await attempt(s.home);
    await attempt(s.away);
    await s.away.mutation(api.leagues.updateMatchDetails, {
      matchId: s.match._id,
      awayFanRoll: null,
    });
    await expect(attempt(s.home)).rejects.toThrow("PRE_GAME_INCOMPLETE");
    const view = await s.home.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    expect(view.playEvents).toHaveLength(2);
    await expect(
      s.home.mutation(api.leagues.confirmMatch, {
        matchId: s.match._id,
        expectedRevision: view.match.revision,
      }),
    ).rejects.toThrow("PRE_GAME_INCOMPLETE");
  });
  it("merges simultaneous coach appends, deduplicates retries and rejects stale edits", async () => {
    const s = await eventReport();
    const one = s.event(),
      two = s.event({ playerId: s.b.playerId });
    await Promise.all([
      s.save(one),
      s.away.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: two,
        expectedVersion: 0,
      }),
    ]);
    await s.save(one);
    let view = await s.t.query(api.leagues.getMatch, { matchId: s.match._id });
    expect(view.playEvents).toHaveLength(2);
    expect(view.match).toMatchObject({ scoreHome: 1, scoreAway: 1 });
    await s.save({ ...one, notes: "First edit" }, 1);
    await expect(s.save({ ...one, notes: "Stale edit" }, 1)).rejects.toThrow(
      "CONFLICT",
    );
    await s.save({ ...one, notes: "First edit" }, 2, true);
    view = await s.t.query(api.leagues.getMatch, { matchId: s.match._id });
    expect(view.match.scoreHome).toBe(0);
    expect(view.playEvents).toHaveLength(1);
  });
  it("clears confirmation on events, prevents counter bypass and locks after both coaches agree", async () => {
    const s = await eventReport();
    let view = await s.ready();
    await s.home.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
    });
    const td = s.event();
    await s.save(td);
    view = await s.t.query(api.leagues.getMatch, { matchId: s.match._id });
    expect(view.match.confirmedBy).toEqual([]);
    await expect(
      s.home.mutation(api.leagues.updateMatchDetails, {
        matchId: s.match._id,
        // @ts-expect-error Scores must come from the event ledger.
        scoreHome: 9,
      }),
    ).rejects.toThrow();
    await s.home.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
    });
    await s.away.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
    });
    await expect(s.save(s.event())).rejects.toThrow("REPORT_LOCKED");
    const career = await s.home.query(api.leagues.getCareer, {
      entryId: s.a.entryId,
    });
    expect(
      career.players.find((row) => row._id === s.a.playerId)?.sppEarned,
    ).toBe(7);
    const record = await s.t.run((ctx) =>
      ctx.db
        .query("leagueMatchEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", s.match._id))
        .first(),
    );
    expect(record?.after.playEvents).toHaveLength(3);
  });
  it("keeps SPP after recovery and atomically corrects the timeline and official career", async () => {
    const s = await eventReport();
    const injury = s.event({
      kind: "casualty",
      targetId: s.b.playerId,
      casualtyRoll: 16,
      apothecary: true,
      apothecaryRoll: 3,
    });
    await s.save(injury);
    const started = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    const otherVictim = started.players.find(
      (row) => row.entryId === s.b.entryId && row.playerId !== s.b.playerId,
    )!;
    await s.save(
      s.event({
        kind: "casualty",
        cause: "foul",
        targetId: otherVictim.playerId,
        casualtyRoll: 3,
      }),
    );
    const view = await s.ready();
    await s.home.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
    });
    await s.away.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
    });
    expect(
      (
        await s.t.query(api.leagues.getCareer, { entryId: s.b.entryId })
      ).players.find((row) => row._id === s.b.playerId)?.status,
    ).toBe("active");
    const events = view.playEvents.map((row) =>
      row.event.id === injury.id
        ? { ...row.event, apothecary: false, apothecaryRoll: null }
        : row.event,
    );
    await s.coaches[0].mutation(api.leagues.correctMatch, {
      matchId: s.match._id,
      expectedRevision: view.match.revision,
      reason: "Apothecary was not used",
      playEvents: events,
    });
    const after = await s.t.query(api.leagues.getCareer, {
      entryId: s.b.entryId,
    });
    expect(after.players.find((row) => row._id === s.b.playerId)?.status).toBe(
      "dead",
    );
    const scorer = await s.t.query(api.leagues.getCareer, {
      entryId: s.a.entryId,
    });
    expect(
      scorer.players.find((row) => row._id === s.a.playerId)?.sppEarned,
    ).toBe(6);
    expect(scorer.entry.stats.casFor).toBe(1);
    expect(
      scorer.players.find((row) => row._id === s.a.playerId)?.stats,
    ).toMatchObject({ cas: 2, sppCas: 1 });
    const history = await s.t.run((ctx) =>
      ctx.db
        .query("leagueMatchEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", s.match._id))
        .collect(),
    );
    expect(
      history.at(-1)?.before?.playEvents?.find((e) => e.id === injury.id)
        ?.apothecary,
    ).toBe(true);
    expect(
      history.at(-1)?.after.playEvents?.find((e) => e.id === injury.id)
        ?.apothecary,
    ).toBe(false);
  });
  it("rejects outsiders, foreign players and invalid injuries without partial writes", async () => {
    const s = await eventReport();
    const outsiderId = await s.t.run((ctx) =>
      ctx.db.insert("users", { name: "Outsider" }),
    );
    const outsider = s.t.withIdentity({ subject: outsiderId });
    await expect(
      outsider.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: s.event(),
        expectedVersion: 0,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      s.t.mutation(api.leagues.savePlayEvent, {
        matchId: s.match._id,
        event: s.event(),
        expectedVersion: 0,
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      s.save(
        s.event({ kind: "casualty", targetId: s.b.playerId, casualtyRoll: 14 }),
      ),
    ).rejects.toThrow("INVALID_DICE");
    const foreign = await s.t.run(async (ctx) => {
      const row = await ctx.db.get("leaguePlayers", s.a.playerId);
      const { _id, _creationTime, ...fields } = row!;
      void _id;
      void _creationTime;
      return ctx.db.insert("leaguePlayers", fields);
    });
    await expect(s.save(s.event({ playerId: foreign }))).rejects.toThrow(
      "INELIGIBLE_PLAYER",
    );
    const view = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    expect(view.playEvents).toHaveLength(0);
    expect(
      view.players.every((row) =>
        Object.values(row.stats).every((value) => value === 0),
      ),
    ).toBe(true);
  });
});

function rookie(name = "Rookie") {
  const team = newTeam(randomUUID());
  team.name = name;
  team.players = Array.from({ length: 11 }, (_, i) => ({
    id: randomUUID(),
    positionId: getRoster("human")!.players[0].id,
    name: `${name} ${i + 1}`,
    skills: [],
  }));
  team.captainId = team.players[0].id;
  return team;
}
async function setup(count = 2) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const coaches = [];
    for (let i = 0; i < count; i++)
      coaches.push(await ctx.db.insert("users", { name: `Coach ${i}` }));
    const outsider = await ctx.db.insert("users", {
      name: "Global admin",
      role: "admin",
    });
    return { coaches, outsider };
  });
  const coaches = ids.coaches.map((id) => t.withIdentity({ subject: id }));
  const admin = t.withIdentity({ subject: ids.outsider });
  const leagueId = await coaches[0].mutation(api.leagues.create, {
    name: "Season 1",
    startAt: Date.UTC(2026, 9, 11),
    roundDays: 14,
  });
  const entries: Id<"leagueTeams">[] = [],
    teams = [];
  for (let i = 0; i < count; i++) {
    const team = rookie(`Team ${i}`);
    await coaches[i].mutation(api.teams.save, { team, expectedRevision: 0 });
    entries.push(
      await coaches[i].mutation(api.leagues.register, {
        leagueId,
        teamUuid: team.uuid,
      }),
    );
    teams.push(team);
  }
  await coaches[0].mutation(api.leagues.launch, { leagueId });
  const detail = await t.query(api.leagues.get, { leagueId });
  const match = detail.matches.find((m) => m.status === "scheduled")!;
  return { t, ids, coaches, admin, leagueId, entries, teams, match };
}

it("links a commissioner only when a Telegram username is available", async () => {
  const s = await setup();
  expect(
    (await s.t.query(api.leagues.get, { leagueId: s.leagueId }))
      .commissionerUsername,
  ).toBeNull();
  await s.t.run((ctx) =>
    ctx.db.patch("users", s.ids.coaches[0], { telegramUsername: "coach_one" }),
  );
  expect(
    (await s.t.query(api.leagues.get, { leagueId: s.leagueId }))
      .commissionerUsername,
  ).toBe("coach_one");
});

describe("league team renames", () => {
  it("publishes a commissioner's rename to the team page, library and league career together", async () => {
    const s = await setup();
    const team = s.teams[1];
    const name = "Commissioner Corrected Humans";
    const before = await s.t.query(api.teams.getByUuid, { uuid: team.uuid });
    await s.t.run(async (ctx) => {
      const entry = await ctx.db.get("leagueTeams", s.entries[1]);
      await ctx.db.patch("leagueTeams", entry!._id, {
        team: {
          ...entry!.team,
          staff: { ...entry!.team.staff, dedicatedFans: 3 },
        },
      });
    });

    await s.coaches[0].mutation(api.leagues.renameTeam, {
      entryId: s.entries[1],
      name: `  ${name}  `,
      expectedRevision: 1,
    });

    const saved = await s.t.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(saved).toMatchObject({
      team: { ...team, name },
      revision: before!.revision + 1,
      canEdit: false,
      leagueLocked: true,
    });
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(before!.updatedAt);
    const library = await s.coaches[1].query(api.teams.listMine, {
      archived: false,
      paginationOpts: { numItems: 30, cursor: null },
    });
    expect(library.page[0]?.team.name).toBe(name);
    const career = await s.coaches[1].query(api.leagues.getCareer, {
      entryId: s.entries[1],
    });
    expect(career.entry.team.name).toBe(name);
    expect(career.entry.revision).toBe(2);
    expect(career.history[0]).toMatchObject({ action: "team-renamed" });
    const source = await s.t.run((ctx) =>
      ctx.db.get("teams", career.entry.teamId),
    );
    expect(source!.ownerId).toBe(s.ids.coaches[1]);
    expect(source!.searchText).toContain(name);
    expect(source!.searchText).not.toContain(team.name);
    // Renaming identity must preserve the distinct builder and career rosters.
    expect(saved!.team.staff.dedicatedFans).toBe(team.staff.dedicatedFans);
    expect(career.entry.team.staff.dedicatedFans).toBe(3);
  });

  it("leaves both names intact when authorization, revision or name checks reject a rename", async () => {
    const s = await setup();
    const entryId = s.entries[0];
    const before = await s.t.query(api.teams.getByUuid, {
      uuid: s.teams[0].uuid,
    });
    for (const [actor, name, expectedRevision, error] of [
      [s.coaches[1], "Unauthorized", 1, "FORBIDDEN"],
      [s.coaches[0], "Stale", 0, "CONFLICT"],
      [s.coaches[0], s.teams[1].name, 1, "DUPLICATE_TEAM_NAME"],
    ] as const) {
      await expect(
        actor.mutation(api.leagues.renameTeam, {
          entryId,
          name,
          expectedRevision,
        }),
      ).rejects.toThrow(error);
      expect(
        await s.t.query(api.teams.getByUuid, { uuid: s.teams[0].uuid }),
      ).toEqual(before);
      const career = await s.coaches[0].query(api.leagues.getCareer, {
        entryId,
      });
      expect(career.entry.team.name).toBe(s.teams[0].name);
      expect(career.entry.revision).toBe(1);
    }
  });
});

type PlayEvent = FunctionArgs<typeof api.leagues.savePlayEvent>["event"];
function play(
  playerId: Id<"leaguePlayers">,
  patch: Partial<PlayEvent> = {},
): PlayEvent {
  return {
    ...newMatchEvent(playerId),
    id: randomUUID(),
    playerId,
    targetId: null,
    ...patch,
  };
}
async function record(
  actor: Awaited<ReturnType<typeof setup>>["coaches"][number],
  matchId: Id<"leagueMatches">,
  event: PlayEvent,
) {
  await actor.mutation(api.leagues.savePlayEvent, {
    matchId,
    event,
    expectedVersion: 0,
  });
  return (await actor.query(api.leagues.getMatch, { matchId })).match.revision;
}
function touchdowns(
  report: Awaited<ReturnType<typeof readyReport>>,
  count: number,
) {
  return [
    ...report.view.playEvents
      .map((row) => row.event)
      .filter((event) => event.kind !== "touchdown"),
    ...Array.from({ length: count }, () => play(report.scorer.playerId)),
  ];
}
async function readyReport(
  s: Awaited<ReturnType<typeof setup>>,
  matchId = s.match._id,
) {
  const details = await s.t.query(api.leagues.getMatch, { matchId });
  const homeIndex = s.entries.indexOf(details.home._id),
    awayIndex = s.entries.indexOf(details.away!._id);
  const home = s.coaches[homeIndex],
    away = s.coaches[awayIndex];
  await home.mutation(api.leagues.startMatch, { matchId });
  await home.mutation(api.leagues.updateMatchDetails, {
    matchId,
    weather: 4,
    homeFanRoll: 1,
    awayFanRoll: 1,
  });
  let view = await s.t.query(api.leagues.getMatch, { matchId });
  const scorer = view.players.find(
    (p) => p.entryId === view.home._id && p.participated,
  )!;
  const otherMvp = view.players.find(
    (p) => p.entryId === view.away!._id && p.participated,
  )!;
  await record(home, matchId, play(scorer.playerId));
  await record(home, matchId, play(scorer.playerId, { kind: "mvp" }));
  await record(away, matchId, play(otherMvp.playerId, { kind: "mvp" }));
  const revision = await home.mutation(api.leagues.updateMatchDetails, {
    matchId,
    homeFanRoll: 1,
    awayFanRoll: 1,
    homeFansRoll: 6,
    awayFansRoll: 6,
  });
  view = await s.t.query(api.leagues.getMatch, { matchId });
  return { home, away, scorer, otherMvp, revision, view, matchId };
}
async function finalize(s: Awaited<ReturnType<typeof setup>>) {
  const report = await readyReport(s);
  expect(
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    }),
  ).toMatchObject({ completed: false });
  expect(
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    }),
  ).toMatchObject({ completed: true });
  return report;
}

describe("league registration and fixtures", () => {
  it("locks builders for participants, including admins, and forbids a second rookie enrollment", async () => {
    const s = await setup();
    const team = s.teams[0];
    for (const [actor, isOwner] of [
      [s.coaches[0], true],
      [s.coaches[1], false],
      [s.admin, false],
      [s.t, false],
    ] as const) {
      expect(
        await actor.query(api.leagues.listTeamCareers, { teamUuid: team.uuid }),
      ).toMatchObject([{ isOwner }]);
    }
    expect(
      await s.coaches[0].query(api.teams.getByUuid, { uuid: team.uuid }),
    ).toMatchObject({
      canEdit: false,
      leagueLocked: true,
      leagueExperienced: true,
    });
    expect(
      await s.admin.query(api.teams.getByUuid, { uuid: team.uuid }),
    ).toMatchObject({ canEdit: false, leagueLocked: true });
    const listed = await s.coaches[0].query(api.teams.listMine, {
      archived: false,
      paginationOpts: { numItems: 30, cursor: null },
    });
    expect(
      listed.page.find((row) => row.team.uuid === team.uuid),
    ).toMatchObject({
      canEdit: false,
      leagueLocked: true,
      leagueExperienced: true,
    });
    for (const actor of [s.coaches[0], s.admin]) {
      await expect(
        actor.mutation(api.teams.save, {
          team: { ...team, name: "Bypass" },
          expectedRevision: 1,
        }),
      ).rejects.toThrow("TEAM_IN_LEAGUE");
      await expect(
        actor.mutation(api.teams.setArchived, {
          uuid: team.uuid,
          archived: true,
        }),
      ).rejects.toThrow("TEAM_IN_LEAGUE");
    }
    const leagueId = await s.coaches[0].mutation(api.leagues.create, {
      name: "Another league",
      startAt: 0,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.register, {
        leagueId,
        teamUuid: team.uuid,
      }),
    ).rejects.toThrow("TEAM_EXPERIENCED");
    expect(
      (await s.coaches[0].query(api.leagues.get, { leagueId })).entries,
    ).toHaveLength(0);
  });

  it.each(["withdrawn", "completed"] as const)(
    "releases the builder after %s but keeps experience permanently",
    async (ended) => {
      const s = await setup();
      const team = s.teams[0];
      if (ended === "withdrawn")
        await s.coaches[0].mutation(api.leagues.withdrawEntry, {
          entryId: s.entries[0],
          reason: "Coach leaves season",
        });
      else
        await s.t.run((ctx) =>
          ctx.db.patch("leagues", s.leagueId, { status: "completed" }),
        );
      expect(
        await s.coaches[0].query(api.teams.getByUuid, { uuid: team.uuid }),
      ).toMatchObject({
        canEdit: true,
        leagueLocked: false,
        leagueExperienced: true,
      });
      await s.coaches[0].mutation(api.teams.save, {
        team: { ...team, name: "Planning again" },
        expectedRevision: 1,
      });
      const leagueId = await s.coaches[0].mutation(api.leagues.create, {
        name: "New rookie season",
        startAt: 0,
      });
      await expect(
        s.coaches[0].mutation(api.leagues.register, {
          leagueId,
          teamUuid: team.uuid,
        }),
      ).rejects.toThrow("TEAM_EXPERIENCED");
      await s.coaches[0].mutation(api.teams.setArchived, {
        uuid: team.uuid,
        archived: true,
      });
      await s.coaches[0].mutation(api.teams.setArchived, {
        uuid: team.uuid,
        archived: false,
      });
      await expect(
        s.coaches[0].mutation(api.leagues.register, {
          leagueId,
          teamUuid: team.uuid,
        }),
      ).rejects.toThrow("TEAM_EXPERIENCED");
    },
  );

  it("protects existing enrollments without the new metadata and preserves experience on replacement", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const source = await ctx.db
        .query("teams")
        .withIndex("by_uuid", (q) => q.eq("uuid", s.teams[0].uuid))
        .unique();
      await ctx.db.patch("teams", source!._id, {
        leagueExperienced: undefined,
      });
    });
    expect(
      await s.coaches[0].query(api.teams.getByUuid, { uuid: s.teams[0].uuid }),
    ).toMatchObject({ canEdit: false, leagueExperienced: true });
    const replacement = rookie("Fresh replacement");
    await s.coaches[0].mutation(api.teams.save, {
      team: replacement,
      expectedRevision: 0,
    });
    await s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
      entryId: s.entries[0],
      teamUuid: replacement.uuid,
      expectedRevision: 1,
    });
    expect(
      await s.coaches[0].query(api.teams.getByUuid, { uuid: s.teams[0].uuid }),
    ).toMatchObject({ canEdit: true, leagueExperienced: true });
    expect(
      await s.coaches[0].query(api.teams.getByUuid, { uuid: replacement.uuid }),
    ).toMatchObject({ canEdit: false, leagueExperienced: true });
    const otherLeague = await s.coaches[0].mutation(api.leagues.create, {
      name: "Other season",
      startAt: 0,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.register, {
        leagueId: otherLeague,
        teamUuid: s.teams[0].uuid,
      }),
    ).rejects.toThrow("TEAM_EXPERIENCED");
    // The replacement endpoint must enforce experience as well as registration.
    await expect(
      s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
        entryId: s.entries[0],
        teamUuid: s.teams[0].uuid,
        expectedRevision: 2,
      }),
    ).rejects.toThrow("TEAM_EXPERIENCED");
  });
  it("rejects exhibition-legal excess fans and enrolls after the coach fixes them", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Coach" }),
    );
    const coach = t.withIdentity({ subject: userId });
    const leagueId = await coach.mutation(api.leagues.create, {
      name: "Rookie League",
      startAt: 0,
    });
    const team = rookie("League Orcs Of Hell");
    team.staff.dedicatedFans = 4;
    expect(validateTeam(team).valid).toBe(true);
    await coach.mutation(api.teams.save, { team, expectedRevision: 0 });
    await expect(
      coach.mutation(api.leagues.register, { leagueId, teamUuid: team.uuid }),
    ).rejects.toThrow("rookieFans");
    expect(
      (await coach.query(api.leagues.get, { leagueId })).entries,
    ).toHaveLength(0);
    team.staff.dedicatedFans = 2;
    await coach.mutation(api.teams.save, { team, expectedRevision: 1 });
    await coach.mutation(api.leagues.register, {
      leagueId,
      teamUuid: team.uuid,
    });
    const league = await coach.query(api.leagues.get, { leagueId });
    expect(league.entries).toHaveLength(1);
    expect(league.entries[0].team.staff.dedicatedFans).toBe(3);
    expect(
      (await coach.query(api.teams.getByUuid, { uuid: team.uuid }))?.team.staff
        .dedicatedFans,
    ).toBe(2);
  });
  it.each([
    [6, 15, 5],
    [7, 21, 7],
    [8, 28, 7],
  ])(
    "generates a complete round robin for %i coaches",
    async (count, fixtures, rounds) => {
      const s = await setup(count),
        detail = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
      expect(detail.rounds).toHaveLength(rounds);
      expect(detail.matches.filter((m) => m.awayEntryId)).toHaveLength(
        fixtures,
      );
      const pairs = detail.matches
        .filter((m) => m.awayEntryId)
        .map((m) => [m.homeEntryId, m.awayEntryId].sort().join("/"));
      expect(new Set(pairs).size).toBe(fixtures);
      for (const round of detail.rounds) {
        const playing = detail.matches
          .filter((m) => m.roundId === round._id)
          .flatMap((m) =>
            m.awayEntryId ? [m.homeEntryId, m.awayEntryId] : [m.homeEntryId],
          );
        expect(new Set(playing).size).toBe(count);
        expect(playing).toHaveLength(count);
      }
      if (count % 2)
        for (const entry of s.entries)
          expect(
            detail.matches.filter(
              (m) => m.status === "bye" && m.homeEntryId === entry,
            ),
          ).toHaveLength(1);
      await expect(
        s.coaches[0].mutation(api.leagues.launch, { leagueId: s.leagueId }),
      ).rejects.toThrow("ALREADY_LAUNCHED");
    },
  );
  it("keeps commissioner authority scoped, including a participating commissioner", async () => {
    const s = await setup();
    const detail = await s.coaches[0].query(api.leagues.get, {
      leagueId: s.leagueId,
    });
    expect(detail.canCommission).toBe(true);
    expect(detail.entries.some((e) => e.coachId === s.ids.coaches[0])).toBe(
      true,
    );
    await expect(
      s.admin.mutation(api.leagues.extendRound, {
        roundId: detail.rounds[0]._id,
        deadlineAt: detail.rounds[0].deadlineAt + 1,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      s.t.mutation(api.leagues.create, { name: "Anonymous", startAt: 0 }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      s.coaches[1].mutation(api.leagues.startMatch, { matchId: s.match._id }),
    ).resolves.toBeNull();
    await expect(
      s.admin.mutation(api.leagues.updateMatchDetails, {
        matchId: s.match._id,
        expectedRevision: 1,
      }),
    ).resolves.toBe(1);
  });
  it("permits replacement before a match, unlocking the old builder and locking the new one", async () => {
    const s = await setup(),
      replacement = rookie("Replacement");
    await s.coaches[0].mutation(api.teams.save, {
      team: replacement,
      expectedRevision: 0,
    });
    await s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
      entryId: s.entries[0],
      teamUuid: replacement.uuid,
      expectedRevision: 1,
    });
    await expect(
      s.coaches[0].mutation(api.teams.save, {
        team: { ...replacement, name: "Edited draft" },
        expectedRevision: 1,
      }),
    ).rejects.toThrow("TEAM_IN_LEAGUE");
    await expect(
      s.coaches[0].mutation(api.teams.setArchived, {
        uuid: replacement.uuid,
        archived: true,
      }),
    ).rejects.toThrow("TEAM_IN_LEAGUE");
    expect(
      await s.coaches[0].query(api.teams.getByUuid, { uuid: s.teams[0].uuid }),
    ).toMatchObject({
      canEdit: true,
      leagueLocked: false,
      leagueExperienced: true,
    });
    await s.coaches[0].mutation(api.teams.save, {
      team: { ...s.teams[0], name: "Unlocked builder" },
      expectedRevision: 1,
    });
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(career.entry.team.name).toBe("Replacement");
    await s.coaches[0].mutation(api.leagues.startMatch, {
      matchId: s.match._id,
    });
    const match = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    expect(match.match.homeSnapshot?.name).toBe("Replacement");
    expect(match.players[0].snapshot.baseCost).toBeGreaterThan(0);
    expect(match.players[0].snapshot.profile.ma).toBeGreaterThan(0);
    await expect(
      s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
        entryId: s.entries[0],
        teamUuid: s.teams[0].uuid,
        expectedRevision: career.entry.revision + 1,
      }),
    ).rejects.toThrow("MATCH_IN_PROGRESS");
  });
});

describe("one shared revision and atomic match finalization", () => {
  it("invalidates both approvals on edits and awards progression exactly once", async () => {
    const s = await setup(),
      report = await readyReport(s);
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    });
    const receiver = report.view.players.find(
      (row) =>
        row.entryId === report.otherMvp.entryId &&
        row.playerId !== report.otherMvp.playerId,
    )!;
    const next = await record(
      report.away,
      report.matchId,
      play(report.otherMvp.playerId, {
        kind: "completion",
        targetId: receiver.playerId,
      }),
    );
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: report.matchId })).match
        .confirmedBy,
    ).toEqual([]);
    await expect(
      report.home.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: report.revision,
      }),
    ).rejects.toThrow("CONFLICT");
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: next,
    });
    const results = await Promise.all([
      report.away.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: next,
      }),
      report.away.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: next,
      }),
    ]);
    expect(results.every((r) => r.completed)).toBe(true);
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const scorer = career.players.find(
      (p) => p._id === report.scorer.playerId,
    )!;
    expect(scorer.sppEarned).toBe(7);
    expect(scorer.stats.mp).toBe(1);
    expect(career.entry.stats).toMatchObject({ mp: 1, pts: 3, tdFor: 1 });
    expect(career.entry.postGamePending).toBe(true);
    expect(career.entry.treasury).toBe(490000);
    expect(career.entry.team.staff.dedicatedFans).toBe(2);
    await expect(
      report.home.mutation(api.leagues.updateMatchDetails, {
        matchId: report.matchId,
        expectedRevision: next,
      }),
    ).rejects.toThrow("REPORT_LOCKED");
    const standings = (
      await s.t.query(api.leagues.get, { leagueId: s.leagueId })
    ).standings;
    expect(standings[0]).toMatchObject({ pts: 3, winDrawPercent: 1, cu: 3 });
  });
  it("rejects forged statistics and incomplete confirmations without partial awards", async () => {
    const s = await setup();
    await s.coaches[0].mutation(api.leagues.startMatch, {
      matchId: s.match._id,
    });
    await s.coaches[0].mutation(api.leagues.updateMatchDetails, {
      matchId: s.match._id,
      weather: 4,
      homeFanRoll: 1,
      awayFanRoll: 1,
    });
    const report = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    await expect(
      record(
        s.coaches[0],
        s.match._id,
        play(report.players[0].playerId, { kind: "completion" }),
      ),
    ).rejects.toThrow("EVENT_TARGET_REQUIRED");
    await expect(
      record(
        s.coaches[0],
        s.match._id,
        play(report.players[0].playerId, {
          kind: "casualty",
          casualtyRoll: 99,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      s.coaches[0].mutation(api.leagues.confirmMatch, {
        matchId: s.match._id,
        expectedRevision: report.match.revision,
      }),
    ).rejects.toThrow("ONE_MVP_PER_TEAM_REQUIRED");
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(career.entry.stats.mp).toBe(0);
    expect(career.players.every((p) => p.sppEarned === 0)).toBe(true);
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: s.match._id })).match
        .confirmedBy,
    ).toEqual([]);
  });
  it("replays a commissioner correction atomically but protects later spent SPP", async () => {
    const s = await setup(),
      report = await finalize(s);
    await expect(
      report.away.mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        reason: "Incorrect touchdown",
        expectedRevision: report.revision,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      report.home.mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        reason: "Incomplete corrected timeline",
        expectedRevision: report.revision,
        playEvents: [],
      }),
    ).rejects.toThrow("ONE_MVP_PER_TEAM_REQUIRED");
    const next = await s.coaches[0].mutation(api.leagues.correctMatch, {
      matchId: report.matchId,
      reason: "Corrected scorer sheet",
      expectedRevision: report.revision,
      playEvents: touchdowns(report, 2),
    });
    const career = await s.t.query(api.leagues.getCareer, {
        entryId: report.view.home._id,
      }),
      player = career.players.find((p) => p._id === report.scorer.playerId)!;
    expect(player.sppEarned).toBe(10);
    expect(player.stats.mp).toBe(1);
    expect(career.entry.treasury).toBe(500000);
    expect(career.entry.stats).toMatchObject({ mp: 1, pts: 3, tdFor: 2 });
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: report.matchId })).match
        .homeSnapshot,
    ).toEqual(report.view.match.homeSnapshot);
    const choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        reason: "Late correction",
        expectedRevision: next,
        playEvents: touchdowns(report, 0),
      }),
    ).rejects.toThrow("SPENT_SPP_CONFLICT");
    expect(
      (
        await s.t.query(api.leagues.getCareer, { entryId: career.entry._id })
      ).players.find((p) => p._id === player._id)?.sppSpent,
    ).toBe(6);
    const metadataRevision = await s.coaches[0].mutation(
      api.leagues.correctMatch,
      {
        matchId: report.matchId,
        weather: 11,
        reason: "Metadata correction",
        expectedRevision: next,
        homeFanRoll: 1,
        awayFanRoll: 1,
        homeFansRoll: 6,
        awayFansRoll: 6,
        homeStalled: false,
        awayStalled: false,
      },
    );
    expect(metadataRevision).toBe(next + 1);
    const afterMetadata = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(afterMetadata.entry.treasury).toBe(career.entry.treasury);
    expect(
      afterMetadata.players.find((p) => p._id === player._id)?.sppSpent,
    ).toBe(6);
    const audit = await s.t.query(api.leagues.audit, {
      leagueId: s.leagueId,
      paginationOpts: { cursor: null, numItems: 30 },
    });
    expect(
      audit.page.some(
        (row) =>
          row.action === "match-corrected" &&
          row.reason === "Corrected scorer sheet",
      ),
    ).toBe(true);
  });
});

describe("postgame roster management and administrative results", () => {
  it("lets only the commissioner reverse a new advancement before it enters another match", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const player = career.players.find(
        (p) => p._id === report.scorer.playerId,
      )!,
      choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    career = await report.home.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(
      career.players.find((p) => p._id === player._id)?.canUndoAdvancement,
    ).toBe(true);
    await expect(
      report.away.mutation(api.leagues.undoLatestAdvancement, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
        reason: "Wrong skill",
      }),
    ).rejects.toThrow("FORBIDDEN");
    await s.coaches[0].mutation(api.leagues.undoLatestAdvancement, {
      playerId: player._id,
      expectedRevision: career.entry.revision,
      reason: "Wrong skill selected",
    });
    career = await s.coaches[0].query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.players.find((p) => p._id === player._id)).toMatchObject({
      sppEarned: 7,
      sppSpent: 0,
      valueIncrease: 0,
      skills: [],
      advancements: [],
      canUndoAdvancement: false,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.undoLatestAdvancement, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
        reason: "Another undo",
      }),
    ).rejects.toThrow("ADVANCEMENT_ALREADY_CAPTURED_IN_MATCH");
  });
  it("denies foreign career actions, forged skills and stale spends without changing balances", async () => {
    const s = await setup(),
      report = await finalize(s);
    const career = await s.t.query(api.leagues.getCareer, {
        entryId: report.view.home._id,
      }),
      player = career.players.find((p) => p._id === report.scorer.playerId)!,
      choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    for (const outsider of [report.away, s.admin]) {
      await expect(
        outsider.mutation(api.leagues.advancePlayer, {
          playerId: player._id,
          skillId: choice.skillId,
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        outsider.mutation(api.leagues.hirePlayer, {
          entryId: career.entry._id,
          positionId: player.positionId,
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        outsider.mutation(api.leagues.correctCareer, {
          entryId: career.entry._id,
          treasury: 1000000,
          reason: "Forged balance",
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
    }
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "fake",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("ILLEGAL_ADVANCEMENT");
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "dodge",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("INSUFFICIENT_SPP");
    expect(
      (await s.t.query(api.leagues.getCareer, { entryId: career.entry._id }))
        .entry.revision,
    ).toBe(career.entry.revision);
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "dodge",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("CONFLICT");
    expect(
      (
        await s.t.query(api.leagues.getCareer, { entryId: career.entry._id })
      ).players.find((p) => p._id === player._id),
    ).toMatchObject({ sppEarned: 7, sppSpent: 6 });
  });
  it("enforces hiring before firing, minimum eligible roster, and permanent rerolls", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const player = career.players[1],
      position = getRoster("human")!.players[0];
    await expect(
      report.home.mutation(api.leagues.retirePlayer, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("MINIMUM_ROSTER");
    await expect(
      report.home.mutation(api.leagues.manageStaff, {
        entryId: career.entry._id,
        staff: "rerolls",
        change: -1,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("REROLLS_CANNOT_BE_REMOVED");
    await report.home.mutation(api.leagues.hirePlayer, {
      entryId: career.entry._id,
      positionId: position.id,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    await report.home.mutation(api.leagues.retirePlayer, {
      playerId: player._id,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    await expect(
      report.home.mutation(api.leagues.hirePlayer, {
        entryId: career.entry._id,
        positionId: getRoster("human")!.players[1].id,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("HIRING_MUST_PRECEDE_FIRING");
    expect(career.entry.team.players).toHaveLength(11);
  });
  it("buys players before applying expensive mistakes to the remaining treasury", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const positionId = getRoster("human")!.players[0].id;
    await report.home.mutation(api.leagues.hirePlayer, {
      entryId: career.entry._id,
      positionId,
      name: "New recruit",
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.entry.treasury).toBe(440000);
    await report.home.mutation(api.leagues.completePostGame, {
      entryId: career.entry._id,
      expectedRevision: career.entry.revision,
      mistakeRoll: 1,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.entry.treasury).toBe(220000);
    expect(career.entry.postGamePending).toBe(false);
    await expect(
      report.home.mutation(api.leagues.completePostGame, {
        entryId: career.entry._id,
        expectedRevision: career.entry.revision,
        mistakeRoll: 1,
      }),
    ).rejects.toThrow("POSTGAME_ALREADY_COMPLETED");
  });
  it("retains MNG players, adds temporary journeymen and preserves their SPP when hired", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const players = await ctx.db
        .query("leaguePlayers")
        .withIndex("by_entryId", (q) => q.eq("entryId", s.entries[0]))
        .take(16);
      await ctx.db.patch("leaguePlayers", players[1]._id, {
        status: "missing-next-game",
      });
    });
    const report = await readyReport(s),
      view = await s.t.query(api.leagues.getMatch, { matchId: s.match._id }),
      journey = view.players.find(
        (p) => p.entryId === s.entries[0] && p.temporary,
      )!;
    expect(view.players.filter((p) => p.entryId === s.entries[0])).toHaveLength(
      12,
    );
    expect(view.match.homeSnapshot!.players).toHaveLength(12);
    expect(journey.skills).toContain("loner:4+");
    const receiver = view.players.find(
      (row) =>
        row.entryId === journey.entryId &&
        row.participated &&
        row.playerId !== journey.playerId,
    )!;
    await record(
      report.home,
      s.match._id,
      play(journey.playerId, {
        kind: "completion",
        targetId: receiver.playerId,
      }),
    );
    const revision = await record(
      report.home,
      s.match._id,
      play(journey.playerId, {
        kind: "completion",
        targetId: receiver.playerId,
      }),
    );
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: revision,
    });
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: revision,
    });
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(
      career.players
        .filter((p) => !p.temporary)
        .every((p) => p.status === "active"),
    ).toBe(true);
    expect(
      career.players.find((p) => p._id === journey.playerId)?.canHireJourneyman,
    ).toBe(true);
    await report.home.mutation(api.leagues.hireJourneyman, {
      playerId: journey.playerId,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, { entryId: s.entries[0] });
    expect(
      career.players.find((p) => p._id === journey.playerId),
    ).toMatchObject({
      temporary: false,
      sppEarned: 2,
      skills: [],
      status: "active",
    });
  });
  it("adjudicates unplayed results without invented player stats and preserves records on withdrawal", async () => {
    const s = await setup(3),
      detail = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    const match = detail.matches.find((m) => m.awayEntryId)!;
    await expect(
      s.coaches[1].mutation(api.leagues.adjudicateMatch, {
        matchId: match._id,
        outcome: "home-win",
        reason: "No cooperation",
        expectedRevision: match.revision,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await s.coaches[0].mutation(api.leagues.adjudicateMatch, {
      matchId: match._id,
      outcome: "home-win",
      reason: "No cooperation",
      expectedRevision: match.revision,
    });
    let after = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    expect(
      after.entries.find((e) => e._id === match.homeEntryId)?.stats,
    ).toMatchObject({ pts: 3, mp: 1, tdFor: 0, casFor: 0 });
    expect(
      after.playerStats.every((p) => p.sppEarned === 0 && p.stats.mp === 0),
    ).toBe(true);
    expect(
      after.standings.find((e) => e.entryId === match.homeEntryId),
    ).toMatchObject({ w: 1, d: 0, latest: ["W"], winDrawPercent: 1, cu: 3 });
    await s.coaches[0].mutation(api.leagues.withdrawEntry, {
      entryId: match.homeEntryId,
      reason: "Coach withdrew",
    });
    after = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    expect(
      after.entries.find((e) => e._id === match.homeEntryId),
    ).toMatchObject({ withdrawn: true, stats: { pts: 3 } });
    expect(
      after.matches.find((m) => m._id === match._id)?.administrativeResult,
    ).toBe("home-win");
    expect(
      after.matches
        .filter(
          (m) =>
            (m.homeEntryId === match.homeEntryId ||
              m.awayEntryId === match.homeEntryId) &&
            m._id !== match._id &&
            m.awayEntryId,
        )
        .every((m) => m.status === "void"),
    ).toBe(true);
  });
  it("omits withdrawals before launching a new draw", async () => {
    const s = await setup(3),
      id = await s.coaches[0].mutation(api.leagues.create, {
        name: "New season",
        startAt: 0,
      });
    const entries = [];
    for (let i = 0; i < 3; i++) {
      const team = rookie(`New rookie ${i}`);
      await s.coaches[i].mutation(api.teams.save, {
        team,
        expectedRevision: 0,
      });
      entries.push(
        await s.coaches[i].mutation(api.leagues.register, {
          leagueId: id,
          teamUuid: team.uuid,
        }),
      );
    }
    await s.coaches[0].mutation(api.leagues.withdrawEntry, {
      entryId: entries[2],
      reason: "Unavailable",
    });
    await s.coaches[0].mutation(api.leagues.launch, { leagueId: id });
    const detail = await s.t.query(api.leagues.get, { leagueId: id });
    expect(detail.entries).toHaveLength(3);
    expect(detail.matches).toHaveLength(1);
    expect(detail.matches[0].homeEntryId).not.toBe(entries[2]);
    expect(detail.matches[0].awayEntryId).not.toBe(entries[2]);
    expect(
      (await s.coaches[2].query(api.leagues.getCareer, { entryId: entries[2] }))
        .canManage,
    ).toBe(false);
  });
});

describe("live report collaboration and immutable revisions", () => {
  it("allows a third commissioner and global admin to edit but only the two coaches to lock in", async () => {
    const s = await setup(),
      report = await readyReport(s);
    const commissionerId = await s.t.run((ctx) =>
      ctx.db.insert("users", { name: "Third commissioner" }),
    );
    const otherId = await s.t.run((ctx) =>
      ctx.db.insert("users", { name: "Unrelated coach" }),
    );
    await s.t.run((ctx) =>
      ctx.db.patch("leagues", s.leagueId, { ownerId: commissionerId }),
    );
    const commissioner = s.t.withIdentity({ subject: commissionerId }),
      outsider = s.t.withIdentity({ subject: otherId });
    for (const actor of [commissioner, s.admin]) {
      expect(
        await actor.query(api.leagues.getMatch, { matchId: report.matchId }),
      ).toMatchObject({
        canEdit: true,
        canCommission: true,
        canConfirm: false,
      });
      await actor.mutation(api.leagues.updateMatchDetails, {
        matchId: report.matchId,
        weather: actor === commissioner ? 4 : 11,
      });
      await expect(
        actor.mutation(api.leagues.confirmMatch, {
          matchId: report.matchId,
          expectedRevision: report.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
    }
    for (const actor of [outsider, s.t]) {
      await expect(
        actor.mutation(api.leagues.updateMatchDetails, {
          matchId: report.matchId,
          weather: 12,
        }),
      ).rejects.toThrow(actor === s.t ? "UNAUTHENTICATED" : "FORBIDDEN");
      await expect(
        record(actor, report.matchId, play(report.scorer.playerId)),
      ).rejects.toThrow(actor === s.t ? "UNAUTHENTICATED" : "FORBIDDEN");
    }
    const view = await s.t.query(api.leagues.getMatch, {
      matchId: report.matchId,
    });
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: view.match.revision,
    });
    expect(
      (await s.t.query(api.leagues.getCareer, { entryId: view.home._id })).entry
        .stats.mp,
    ).toBe(0);
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: view.match.revision,
    });
    expect(
      (await s.t.query(api.leagues.getCareer, { entryId: view.home._id })).entry
        .stats.mp,
    ).toBe(1);
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: report.matchId })).match
        .status,
    ).toBe("completed");
  });

  it("keeps the original event and compensates corrections after valid skills and purchases", async () => {
    const s = await setup(),
      report = await finalize(s);
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const scorer = career.players.find(
      (player) => player._id === report.scorer.playerId,
    )!;
    const choice = scorer.availableAdvancements.find(
      (choice) => choice.cost === 6,
    )!;
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: scorer._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    let updated = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    await report.home.mutation(api.leagues.manageStaff, {
      entryId: career.entry._id,
      staff: "assistantCoaches",
      change: 1,
      expectedRevision: updated.entry.revision,
    });
    updated = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    const newRevision = await s.admin.mutation(api.leagues.correctMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
      reason: "Scorer had two touchdowns",
      playEvents: touchdowns(report, 2),
    });
    const corrected = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(
      corrected.players.find((player) => player._id === scorer._id),
    ).toMatchObject({
      sppEarned: 10,
      sppSpent: 6,
      skills: [choice.skillId],
      stats: { mp: 1, td: 2 },
    });
    expect(corrected.entry.team.staff.assistantCoaches).toBe(
      updated.entry.team.staff.assistantCoaches,
    );
    expect(corrected.entry.treasury).toBe(updated.entry.treasury + 10000);
    expect(corrected.entry.stats.mp).toBe(1);
    const events = await s.t.run((ctx) =>
      ctx.db
        .query("leagueMatchEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", report.matchId))
        .collect(),
    );
    expect(events.map((event) => event.kind)).toEqual([
      "recorded",
      "corrected",
    ]);
    expect(events[0].after.scoreHome).toBe(1);
    expect(events[1]).toMatchObject({
      before: { scoreHome: 1 },
      after: { scoreHome: 2 },
      actorId: s.ids.outsider,
      reason: "Scorer had two touchdowns",
    });
    await expect(
      s.admin.mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        expectedRevision: report.revision,
        reason: "Retry old revision",
      }),
    ).rejects.toThrow("CONFLICT");
    expect(
      (
        await s.t.query(api.leagues.getMatchHistory, {
          matchId: report.matchId,
        })
      )[0].revision,
    ).toBe(newRevision);
  });

  it("reverses a recorded death without duplicating match awards and restores the captain", async () => {
    const s = await setup(),
      report = await readyReport(s);
    const revision = await record(
      report.home,
      report.matchId,
      play(report.scorer.playerId, {
        kind: "casualty",
        cause: "dodge",
        casualtyRoll: 15,
      }),
    );
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: revision,
    });
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: revision,
    });
    const before = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    expect(
      before.players.find((player) => player._id === report.scorer.playerId)
        ?.status,
    ).toBe("dead");
    expect(before.entry.team.captainId).toBeUndefined();
    await s.admin.mutation(api.leagues.correctMatch, {
      matchId: report.matchId,
      expectedRevision: revision,
      reason: "Apothecary outcome was entered incorrectly",
      playEvents: touchdowns(report, 1),
    });
    const after = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    expect(
      after.players.find((player) => player._id === report.scorer.playerId),
    ).toMatchObject({
      status: "active",
      stats: { mp: 1, td: 1, inj: 0, dth: 0 },
      sppEarned: 7,
    });
    expect(after.entry.team.captainId).toBe(
      report.view.match.homeSnapshot!.captainId,
    );
    expect(after.entry.stats).toMatchObject({ mp: 1, inj: 0, dth: 0 });
    expect(after.entry.treasury).toBe(before.entry.treasury);
  });

  it("serializes competing corrections and keeps only the winning revision", async () => {
    const s = await setup(),
      report = await finalize(s);
    const results = await Promise.allSettled(
      [4, 11].map((weather) =>
        s.admin.mutation(api.leagues.correctMatch, {
          matchId: report.matchId,
          expectedRevision: report.revision,
          weather,
          reason: "Correct weather",
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(
      rejected?.status === "rejected" && rejected.reason.message,
    ).toContain("CONFLICT");
    const events = await s.t.query(api.leagues.getMatchHistory, {
      matchId: report.matchId,
    });
    expect(events).toHaveLength(2);
    expect(events[0].revision).toBe(report.revision + 1);
    expect(
      (
        await s.t.query(api.leagues.getCareer, {
          entryId: report.view.home._id,
        })
      ).entry.stats.mp,
    ).toBe(1);
  });

  it("replays earlier results through later matches and postgame treasury events", async () => {
    const s = await setup(4),
      first = await finalize(s);
    const league = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    const other = league.matches.find(
      (match) =>
        match.roundId === first.view.match.roundId &&
        match._id !== first.matchId,
    )!;
    const second = await readyReport(s, other._id);
    await second.home.mutation(api.leagues.confirmMatch, {
      matchId: other._id,
      expectedRevision: second.revision,
    });
    await second.away.mutation(api.leagues.confirmMatch, {
      matchId: other._id,
      expectedRevision: second.revision,
    });
    for (const entryId of s.entries) {
      const career = await s.t.query(api.leagues.getCareer, { entryId });
      const actor = s.coaches[s.entries.indexOf(entryId)];
      await actor.mutation(api.leagues.completePostGame, {
        entryId,
        expectedRevision: career.entry.revision,
        mistakeRoll: 6,
      });
    }
    await s.coaches[0].mutation(api.leagues.openRound, {
      roundId: league.rounds.find((round) => round.number === 2)!._id,
    });
    const fixtures = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    const roundId = fixtures.rounds.find((round) => round.number === 2)!._id;
    const laterMatch = fixtures.matches.find(
      (match) =>
        match.roundId === roundId &&
        (match.homeEntryId === first.view.home._id ||
          match.awayEntryId === first.view.home._id),
    )!;
    const later = await readyReport(s, laterMatch._id);
    await later.home.mutation(api.leagues.confirmMatch, {
      matchId: laterMatch._id,
      expectedRevision: later.revision,
    });
    await later.away.mutation(api.leagues.confirmMatch, {
      matchId: laterMatch._id,
      expectedRevision: later.revision,
    });
    const before = await s.t.query(api.leagues.getCareer, {
      entryId: first.view.home._id,
    });
    const laterBefore = await s.t.query(api.leagues.getMatch, {
      matchId: laterMatch._id,
    });
    await s.coaches[0].mutation(api.leagues.correctMatch, {
      matchId: first.matchId,
      expectedRevision: first.revision,
      reason: "First match was actually a draw",
      playEvents: touchdowns(first, 0),
    });
    const after = await s.t.query(api.leagues.getCareer, {
      entryId: first.view.home._id,
    });
    expect(after.entry.latestMatchId).toBe(laterMatch._id);
    expect(after.entry.stats).toMatchObject({
      mp: 2,
      pts: before.entry.stats.pts - 2,
      tdFor: before.entry.stats.tdFor - 1,
    });
    expect(after.entry.treasury).toBe(before.entry.treasury - 15000);
    const laterAfter = await s.t.query(api.leagues.getMatch, {
      matchId: laterMatch._id,
    });
    expect(laterAfter.match.homeSnapshot).toEqual(
      laterBefore.match.homeSnapshot,
    );
    expect(laterAfter.match.awaySnapshot).toEqual(
      laterBefore.match.awaySnapshot,
    );
    expect(laterAfter.match.homeWinnings).toBe(
      laterBefore.match.homeWinnings - 5000,
    );
    expect(laterAfter.match.awayWinnings).toBe(
      laterBefore.match.awayWinnings - 5000,
    );
    expect(
      (
        await s.t.query(api.leagues.getMatchHistory, {
          matchId: laterMatch._id,
        })
      )[0].kind,
    ).toBe("replayed");
    const recorded = await s.t.query(api.leagues.getMatch, {
      matchId: first.matchId,
    });
    const eventsBefore = await s.t.query(api.leagues.getMatchHistory, {
      matchId: first.matchId,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.correctMatch, {
        matchId: first.matchId,
        expectedRevision: recorded.match.revision,
        reason: "Incompatible later participation",
        playEvents: [
          ...touchdowns(first, 0),
          play(first.scorer.playerId, {
            kind: "casualty",
            cause: "dodge",
            casualtyRoll: 15,
          }),
        ],
      }),
    ).rejects.toThrow("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
    expect(
      await s.t.query(api.leagues.getCareer, { entryId: first.view.home._id }),
    ).toEqual(after);
    expect(
      await s.t.query(api.leagues.getMatchHistory, { matchId: first.matchId }),
    ).toEqual(eventsBefore);
  });
});

describe("league starting treasury", () => {
  it("enforces the selected allowance on registration and replacement, including legacy leagues", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Treasury coach" }),
    );
    const coach = t.withIdentity({ subject: userId });
    const customId = await coach.mutation(api.leagues.create, {
      name: "Custom treasury",
      startAt: Date.now(),
      startingTreasury: 1_200_000,
    });
    const defaultId = await coach.mutation(api.leagues.create, {
      name: "Default treasury",
      startAt: Date.now(),
    });
    expect(
      (await coach.query(api.leagues.get, { leagueId: defaultId })).league
        .startingTreasury,
    ).toBe(1_000_000);
    await t.run((ctx) =>
      ctx.db.patch("leagues", defaultId, { startingTreasury: undefined }),
    );
    const team = rookie("Big budget rookies");
    team.staff.rerolls = 8;
    team.staff.apothecary = 1;
    team.staff.assistantCoaches = 1;
    await coach.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
      leagueId: customId,
    });
    const saved = await coach.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(saved?.draftLeagueId).toBe(customId);
    await coach.mutation(api.teams.save, {
      team: { ...team, name: "Reopened league draft" },
      expectedRevision: 1,
    });
    await expect(
      coach.mutation(api.leagues.register, {
        leagueId: defaultId,
        teamUuid: team.uuid,
      }),
    ).rejects.toThrow("INVALID_ROOKIE");
    const entryId = await coach.mutation(api.leagues.register, {
      leagueId: customId,
      teamUuid: team.uuid,
    });
    const entry = await t.run((ctx) => ctx.db.get("leagueTeams", entryId));
    expect(entry!.treasury).toBe(190_000);
    const replacement = rookie("Replacement rookies");
    replacement.staff.rerolls = 8;
    replacement.staff.apothecary = 1;
    replacement.staff.assistantCoaches = 2;
    await coach.mutation(api.teams.save, {
      team: replacement,
      expectedRevision: 0,
      leagueId: customId,
    });
    await coach.mutation(api.leagues.replaceEntryTeam, {
      entryId,
      teamUuid: replacement.uuid,
      expectedRevision: 1,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("leagueTeams", entryId)))!.treasury,
    ).toBe(180_000);
    await expect(
      coach.mutation(api.leagues.create, {
        name: "Bad budget",
        startAt: Date.now(),
        startingTreasury: 1_000_001,
      }),
    ).rejects.toThrow("INVALID_TREASURY");
  });
});
