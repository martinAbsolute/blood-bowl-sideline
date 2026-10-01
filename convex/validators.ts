import { v } from "convex/values";
import { RULES_VERSION } from "../src/domain/types";
export const teamValidator = v.object({
  schemaVersion: v.literal(1),
  rulesVersion: v.literal(RULES_VERSION),
  uuid: v.string(),
  name: v.string(),
  rosterId: v.string(),
  rulesetId: v.union(
    v.literal("bb2025-default"),
    v.literal("bb2025-matched-play"),
    v.literal("eurobowl-2026"),
    v.literal("world-cup-2027"),
  ),
  favouredOf: v.union(
    v.literal("Undivided"),
    v.literal("Khorne"),
    v.literal("Nurgle"),
    v.literal("Slaanesh"),
    v.literal("Tzeentch"),
    v.literal("Hashut"),
  ),
  norseLeague: v.union(
    v.literal("Old World Classic"),
    v.literal("Chaos Clash"),
  ),
  players: v.array(
    v.object({
      id: v.string(),
      positionId: v.string(),
      name: v.string(),
      skills: v.array(v.string()),
    }),
  ),
  stars: v.array(v.string()),
  staff: v.object({
    rerolls: v.number(),
    apothecary: v.number(),
    assistantCoaches: v.number(),
    cheerleaders: v.number(),
    dedicatedFans: v.number(),
  }),
  inducements: v.record(v.string(), v.number()),
  notes: v.string(),
  captainId: v.optional(v.string()),
});
export const publicTeam = v.object({
  team: teamValidator,
  revision: v.number(),
  legal: v.boolean(),
  updatedAt: v.number(),
  canEdit: v.boolean(),
});
