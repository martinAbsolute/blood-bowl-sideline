import { v } from "convex/values";

export const playEventValidator = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("touchdown"),
    v.literal("completion"),
    v.literal("interception"),
    v.literal("casualty"),
    v.literal("knockout"),
    v.literal("sent-off"),
    v.literal("throw-team-mate"),
    v.literal("mvp"),
  ),
  playerId: v.id("leaguePlayers"),
  targetId: v.union(v.id("leaguePlayers"), v.null()),
  half: v.union(v.number(), v.null()),
  turn: v.union(v.number(), v.null()),
  cause: v.union(
    v.literal("block"),
    v.literal("foul"),
    v.literal("crowd"),
    v.literal("dodge"),
    v.literal("rush"),
    v.literal("special"),
    v.literal("other"),
  ),
  casualtyRoll: v.union(v.number(), v.null()),
  lastingRoll: v.union(v.number(), v.null()),
  apothecary: v.boolean(),
  apothecaryRoll: v.union(v.number(), v.null()),
  apothecaryLastingRoll: v.union(v.number(), v.null()),
  keepOriginal: v.boolean(),
  regeneration: v.union(
    v.literal("not-used"),
    v.literal("failed"),
    v.literal("succeeded"),
  ),
  superb: v.boolean(),
  notes: v.string(),
});

export const matchStatsValidator = v.object({
  td: v.number(),
  cas: v.number(),
  sppCas: v.number(),
  com: v.number(),
  int: v.number(),
  mvp: v.number(),
  fou: v.number(),
  sof: v.number(),
  superbThrows: v.number(),
  safeLandings: v.number(),
  inj: v.number(),
  dth: v.number(),
});
export const careerStatsValidator = matchStatsValidator.extend({
  mp: v.number(),
});
export const playerStatusValidator = v.union(
  v.literal("active"),
  v.literal("missing-next-game"),
  v.literal("dead"),
  v.literal("retired"),
);
export const reportStatusValidator = v.union(
  v.literal("active"),
  v.literal("missing-next-game"),
  v.literal("dead"),
);
export const advancementValidator = v.object({
  skillId: v.string(),
  access: v.union(v.literal("primary"), v.literal("secondary")),
  elite: v.boolean(),
  sppCost: v.number(),
  valueIncrease: v.number(),
});
export const reductionsValidator = v.object({
  ma: v.number(),
  st: v.number(),
  ag: v.number(),
  pa: v.number(),
  av: v.number(),
});
export const teamStatsValidator = v.object({
  pts: v.number(),
  mp: v.number(),
  w: v.number(),
  d: v.number(),
  l: v.number(),
  tdFor: v.number(),
  tdAgainst: v.number(),
  casFor: v.number(),
  casAgainst: v.number(),
  com: v.number(),
  int: v.number(),
  inj: v.number(),
  dth: v.number(),
  fou: v.number(),
  sof: v.number(),
  latest: v.array(v.union(v.literal("W"), v.literal("D"), v.literal("L"))),
});
export const playerSnapshotValidator = v.object({
  name: v.string(),
  positionId: v.string(),
  skills: v.array(v.string()),
  status: playerStatusValidator,
  sppEarned: v.number(),
  sppSpent: v.number(),
  valueIncrease: v.number(),
  stats: careerStatsValidator,
  advancements: v.array(advancementValidator),
  nigglingInjuries: v.number(),
  characteristicReductions: reductionsValidator,
  injuryNotes: v.string(),
  profile: v.object({
    ma: v.number(),
    st: v.number(),
    ag: v.string(),
    pa: v.string(),
    av: v.string(),
  }),
  baseProfile: v.object({
    ma: v.number(),
    st: v.number(),
    ag: v.string(),
    pa: v.string(),
    av: v.string(),
  }),
  sppRates: matchStatsValidator,
  baseCost: v.number(),
  positionName: v.string(),
  baseSkills: v.array(v.string()),
});
// Immutable official report revisions; rosters are captured once and remain on
// the fixture. These events retain every input needed to reverse a contribution.
export const recordedReportValidator = v.object({
  playEvents: v.array(playEventValidator),
  scoreHome: v.number(),
  scoreAway: v.number(),
  weather: v.union(v.number(), v.null()),
  homeFanRoll: v.union(v.number(), v.null()),
  awayFanRoll: v.union(v.number(), v.null()),
  homeFansRoll: v.union(v.number(), v.null()),
  awayFansRoll: v.union(v.number(), v.null()),
  homeStalled: v.boolean(),
  awayStalled: v.boolean(),
  homeWinnings: v.number(),
  awayWinnings: v.number(),
  homeDedicatedFans: v.number(),
  awayDedicatedFans: v.number(),
  players: v.array(
    v.object({
      playerId: v.id("leaguePlayers"),
      entryId: v.id("leagueTeams"),
      stats: matchStatsValidator,
      participated: v.boolean(),
      statusAfter: reportStatusValidator,
      injuryNotes: v.string(),
      casualtyRoll: v.union(v.number(), v.null()),
      lastingRoll: v.union(v.number(), v.null()),
    }),
  ),
});
