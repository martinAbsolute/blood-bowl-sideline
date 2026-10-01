import { z } from "zod";

export const RULES_VERSION = "bb2025-2026-09-30";
export const rulesetIds = [
  "bb2025-default",
  "bb2025-matched-play",
  "eurobowl-2026",
  "world-cup-2027",
] as const;
export type RulesetId = (typeof rulesetIds)[number];
const count = (max: number) => z.number().int().min(0).max(max);
export const teamSchema = z
  .object({
    schemaVersion: z.literal(1),
    rulesVersion: z.literal(RULES_VERSION),
    uuid: z.uuid(),
    name: z.string().trim().min(1).max(80),
    rosterId: z.string().max(60),
    rulesetId: z.enum(rulesetIds),
    favouredOf: z.enum([
      "Undivided",
      "Khorne",
      "Nurgle",
      "Slaanesh",
      "Tzeentch",
      "Hashut",
    ]),
    norseLeague: z.enum(["Old World Classic", "Chaos Clash"]),
    players: z
      .array(
        z
          .object({
            id: z.uuid(),
            positionId: z.string().max(100),
            name: z.string().trim().max(80),
            skills: z.array(z.string().max(60)).max(6),
          })
          .strict(),
      )
      .max(16),
    stars: z.array(z.string().max(100)).max(4),
    staff: z
      .object({
        rerolls: count(8),
        apothecary: count(1),
        assistantCoaches: count(6),
        cheerleaders: count(6),
        dedicatedFans: count(6),
      })
      .strict(),
    inducements: z
      .record(z.string().max(100), count(8))
      .refine((x) => Object.keys(x).length <= 20),
    notes: z.string().max(2000),
    captainId: z.uuid().optional(),
  })
  .strict();
export type Team = z.infer<typeof teamSchema>;
export interface Position {
  id: string;
  position: string;
  qty: string;
  cost: number;
  ma: number;
  st: number;
  ag: string;
  pa: string;
  av: string;
  skills: string[];
  primarySkills: string[];
  secondarySkills: string[];
}
export interface Roster {
  id: string;
  name: string;
  leagues: string[];
  specialRules: string[];
  tier: number;
  players: Position[];
  rerolls: { cost: number; max: number };
  apothecary: boolean;
  bigGuyMax?: number;
}
export interface Skill {
  id: string;
  name: string;
  category: string;
  isElite: boolean;
}
export interface Star {
  id: string;
  name: string;
  cost: number;
  ma: number;
  st: number;
  ag: string;
  pa: string;
  av: string;
  skills: string[];
  playsFor: string[];
  playerType: string;
}
export interface Inducement {
  id: string;
  name: string;
  cost: number;
  max: string;
  availability: string;
  specialCosts?: { specialRule: string; cost: number; max?: string }[];
}
export interface Ruleset {
  id: RulesetId;
  name: string;
  skillCurrency?: "sp" | "spp";
  tiers: Record<string, string[]>;
  tierBudgets: Record<
    string,
    { teamBudget: number; skillGold: number; flowingFunds: number }
  >;
  skillCosts: {
    primaryNonElite: number;
    primaryElite: number;
    secondaryNonElite: number;
    secondaryElite: number;
    secondPrimaryNonElite?: number;
    secondPrimaryElite?: number;
    secondSecondaryNonElite?: number;
    secondSecondaryElite?: number;
    stackCosts: { cost: number }[];
  };
  maxAdvancementsPerPlayer: number;
  maxSecondaryPerTeam: number;
  maxSecondaryByTier?: Record<string, number>;
  maxStackPerTeam: number;
  maxElitePerTeam?: number;
  teamOverrides?: Record<
    string,
    {
      maxStackPlayers?: number;
      maxSkillsPerPlayer?: number;
      canHireStarPlayers?: boolean;
    }
  >;
  starPlayerTierRules: Record<
    string,
    {
      maxVeterans: number;
      maxLegends: number;
      canMix: boolean;
      veteranSkillGoldCost: number;
      legendSkillGoldCost: number;
    }
  >;
  bannedStarPlayers: string[];
  veteranStarPlayers: string[];
  legendStarPlayers: string[];
  allowedInducements: string[];
  starPlayerTax?: { maxCost: number; sppCost: number }[];
  minPlayers: number;
  maxPlayers: number;
  starPlayerBlocksAdvancements: boolean;
}
