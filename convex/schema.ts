import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { teamValidator } from "./validators";
import { v } from "convex/values";
import { roleValidator } from "./roles";
import {
  advancementValidator,
  careerStatsValidator,
  matchStatsValidator,
  playerSnapshotValidator,
  playerStatusValidator,
  reductionsValidator,
  reportStatusValidator,
  recordedReportValidator,
  teamStatsValidator,
  playEventValidator,
} from "./leagueValidators";

export default defineSchema({
  ...authTables,
  // Keep only the removed UUID so stale device drafts cannot recreate deleted teams.
  deletedTeams: defineTable({ uuid: v.string() }).index("by_uuid", ["uuid"]),
  devAuthAccounts: defineTable({
    identifier: v.union(v.literal("coach-a"), v.literal("coach-b")),
    userId: v.id("users"),
  }).index("by_identifier", ["identifier"]),
  users: defineTable({
    ...authTables.users.validator.fields,
    role: v.optional(roleValidator),
    telegramUsername: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  leagues: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    commissionerName: v.string(),
    status: v.union(
      v.literal("registration"),
      v.literal("active"),
      v.literal("completed"),
    ),
    rulesVersion: v.string(),
    startAt: v.number(),
    roundDays: v.number(),
    startingTreasury: v.optional(v.number()),
    activeRound: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_ownerId", ["ownerId"]),
  leagueTeams: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    coachId: v.id("users"),
    coachName: v.string(),
    team: teamValidator,
    sourceRevision: v.number(),
    revision: v.number(),
    treasury: v.number(),
    stats: teamStatsValidator,
    postGamePending: v.boolean(),
    blockedPositionIds: v.array(v.string()),
    hiringClosed: v.boolean(),
    withdrawn: v.boolean(),
    firstPlayedAt: v.union(v.number(), v.null()),
    activeMatchId: v.union(v.id("leagueMatches"), v.null()),
    latestMatchId: v.union(v.id("leagueMatches"), v.null()),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_and_coachId", ["leagueId", "coachId"])
    .index("by_teamId", ["teamId"])
    .index("by_coachId", ["coachId"]),
  leaguePlayers: defineTable({
    leagueId: v.id("leagues"),
    entryId: v.id("leagueTeams"),
    sourcePlayerId: v.string(),
    name: v.string(),
    positionId: v.string(),
    skills: v.array(v.string()),
    temporary: v.boolean(),
    hiredAfterMatchId: v.union(v.id("leagueMatches"), v.null()),
    sppEarned: v.number(),
    sppSpent: v.number(),
    valueIncrease: v.number(),
    status: playerStatusValidator,
    injuryNotes: v.string(),
    nigglingInjuries: v.number(),
    characteristicReductions: reductionsValidator,
    advancements: v.array(advancementValidator),
    stats: careerStatsValidator,
  })
    .index("by_entryId", ["entryId"])
    .index("by_leagueId", ["leagueId"]),
  leagueRounds: defineTable({
    leagueId: v.id("leagues"),
    number: v.number(),
    opensAt: v.number(),
    deadlineAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("open"),
      v.literal("completed"),
    ),
  }).index("by_leagueId", ["leagueId"]),
  leagueMatches: defineTable({
    leagueId: v.id("leagues"),
    roundId: v.id("leagueRounds"),
    homeEntryId: v.id("leagueTeams"),
    awayEntryId: v.union(v.id("leagueTeams"), v.null()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("bye"),
      v.literal("void"),
    ),
    administrativeResult: v.union(
      v.literal("home-win"),
      v.literal("away-win"),
      v.literal("draw"),
      v.literal("void"),
      v.null(),
    ),
    revision: v.number(),
    scoreHome: v.number(),
    scoreAway: v.number(),
    weather: v.optional(v.union(v.number(), v.null())),
    homeDedicatedFans: v.optional(v.number()),
    awayDedicatedFans: v.optional(v.number()),
    confirmedBy: v.array(v.id("users")),
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    recordedOrder: v.optional(v.number()),
    homeSnapshot: v.union(teamValidator, v.null()),
    awaySnapshot: v.union(teamValidator, v.null()),
    homeCareerRevision: v.union(v.number(), v.null()),
    awayCareerRevision: v.union(v.number(), v.null()),
    homeWinnings: v.number(),
    awayWinnings: v.number(),
    homeFanRoll: v.union(v.number(), v.null()),
    awayFanRoll: v.union(v.number(), v.null()),
    homeStalled: v.boolean(),
    awayStalled: v.boolean(),
    homeFansRoll: v.union(v.number(), v.null()),
    awayFansRoll: v.union(v.number(), v.null()),
    homeMistakeRoll: v.union(v.number(), v.null()),
    awayMistakeRoll: v.union(v.number(), v.null()),
    homeMinorRoll: v.union(v.number(), v.null()),
    awayMinorRoll: v.union(v.number(), v.null()),
    homeStashRolls: v.union(v.array(v.number()), v.null()),
    awayStashRolls: v.union(v.array(v.number()), v.null()),
    homeTreasuryBefore: v.union(v.number(), v.null()),
    awayTreasuryBefore: v.union(v.number(), v.null()),
    correctionCount: v.number(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_roundId", ["roundId"]),
  leagueMatchPlayers: defineTable({
    matchId: v.id("leagueMatches"),
    playerId: v.id("leaguePlayers"),
    entryId: v.id("leagueTeams"),
    temporary: v.boolean(),
    sourcePlayerId: v.string(),
    name: v.string(),
    positionId: v.string(),
    skills: v.array(v.string()),
    snapshot: playerSnapshotValidator,
    stats: matchStatsValidator,
    participated: v.boolean(),
    statusAfter: reportStatusValidator,
    injuryNotes: v.string(),
    casualtyRoll: v.union(v.number(), v.null()),
    lastingRoll: v.union(v.number(), v.null()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_playerId", ["playerId"])
    .index("by_matchId_and_playerId", ["matchId", "playerId"]),
  leaguePlayEvents: defineTable({
    matchId: v.id("leagueMatches"),
    event: playEventValidator,
    version: v.number(),
    deleted: v.boolean(),
    actorId: v.id("users"),
    actorName: v.string(),
  })
    .index("by_matchId", ["matchId"])
    .index("by_matchId_and_event_id", ["matchId", "event.id"]),
  leagueMatchEvents: defineTable({
    leagueId: v.id("leagues"),
    matchId: v.id("leagueMatches"),
    revision: v.number(),
    actorId: v.id("users"),
    actorName: v.string(),
    kind: v.union(
      v.literal("recorded"),
      v.literal("corrected"),
      v.literal("replayed"),
    ),
    reason: v.string(),
    before: v.union(recordedReportValidator, v.null()),
    after: recordedReportValidator,
  }).index("by_matchId", ["matchId"]),
  leagueAudit: defineTable({
    leagueId: v.id("leagues"),
    entryId: v.optional(v.id("leagueTeams")),
    matchId: v.optional(v.id("leagueMatches")),
    actorId: v.id("users"),
    actorName: v.string(),
    kind: v.string(),
    reason: v.string(),
    details: v.string(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_entryId", ["entryId"])
    .index("by_matchId", ["matchId"]),
  teams: defineTable({
    draftLeagueId: v.optional(v.id("leagues")),
    leagueExperienced: v.optional(v.boolean()),
    ownerId: v.id("users"),
    uuid: v.string(),
    team: teamValidator,
    revision: v.number(),
    legal: v.boolean(),
    updatedAt: v.number(),
    archived: v.boolean(),
    searchText: v.optional(v.string()),
  })
    .index("by_uuid", ["uuid"])
    .index("by_draftLeagueId", ["draftLeagueId"])
    .index("by_ownerId_and_archived", ["ownerId", "archived"])
    .index("by_owner_archive_roster", ["ownerId", "archived", "team.rosterId"])
    .index("by_owner_archive_ruleset", [
      "ownerId",
      "archived",
      "team.rulesetId",
    ])
    .index("by_owner_archive_roster_ruleset", [
      "ownerId",
      "archived",
      "team.rosterId",
      "team.rulesetId",
    ])
    .searchIndex("search_library", {
      searchField: "searchText",
      filterFields: ["ownerId", "archived", "team.rosterId", "team.rulesetId"],
    }),
});
