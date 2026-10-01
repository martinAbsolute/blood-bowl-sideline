import { v } from "convex/values";

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
export const playerChangeValidator = v.object({
  playerId: v.id("leaguePlayers"),
  stats: matchStatsValidator,
  statusAfter: v.optional(reportStatusValidator),
  injuryNotes: v.optional(v.string()),
  casualtyRoll: v.optional(v.union(v.number(), v.null())),
  lastingRoll: v.optional(v.union(v.number(), v.null())),
});
