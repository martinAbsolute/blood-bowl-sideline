import rosterData from "./data/rosters.json";
import skillData from "./data/skills.json";
import starData from "./data/stars.json";
import inducementData from "./data/inducements.json";
import rulesetData from "./data/rulesets.json";
import {
  RULES_VERSION,
  type Team,
  type Roster,
  type Skill,
  type Star,
  type Inducement,
  type Ruleset,
} from "./types";

export const rosters = rosterData as Roster[];
export const skills = skillData as Skill[];
export const stars = starData as Star[];
export const starPairs = [
  ["grak", "crumbleberry"],
  ["dribl", "drull"],
  ["lucien-swift", "valen-swift"],
];
export function starChoices(ids: string[]) {
  return [
    ...new Set(
      ids.map((id) => starPairs.find((p) => p.includes(id))?.[0] ?? id),
    ),
  ];
}
export const inducements = inducementData as Inducement[];
export const rulesets: Ruleset[] = [
  {
    id: "bb2025-default",
    name: "BB2025 Default",
    tiers: {},
    tierBudgets: { 0: { teamBudget: 1000000, skillGold: 0, flowingFunds: 0 } },
    skillCosts: {
      primaryNonElite: 20000,
      primaryElite: 30000,
      secondaryNonElite: 40000,
      secondaryElite: 50000,
      stackCosts: [],
    },
    maxAdvancementsPerPlayer: 6,
    maxSecondaryPerTeam: 96,
    maxStackPerTeam: 16,
    starPlayerTierRules: {},
    bannedStarPlayers: [],
    veteranStarPlayers: [],
    legendStarPlayers: [],
    allowedInducements: inducements.map((i) => i.id),
    minPlayers: 11,
    maxPlayers: 16,
    starPlayerBlocksAdvancements: false,
  },
  ...(rulesetData as unknown as Ruleset[]),
];
export const categories: Record<string, string> = {
  general: "G",
  agility: "A",
  strength: "S",
  passing: "P",
  mutation: "M",
  devious: "D",
};
export const getRoster = (id: string) => rosters.find((r) => r.id === id);
export const getRuleset = (id: string) => rulesets.find((r) => r.id === id)!;
export const getSkill = (id: string) =>
  skills.find((s) => s.id === id.split(":")[0]);
export function skillName(id: string) {
  const [base, parameter] = id.split(":");
  const name = getSkill(id)?.name ?? base;
  if (!parameter) return name;
  return /\(x\+?\)/i.test(name)
    ? name.replace(/\(x\+?\)/i, `(${parameter})`)
    : `${name} (${parameter})`;
}
export function newTeam(uuid: string, rosterId = "human"): Team {
  return {
    schemaVersion: 1,
    rulesVersion: RULES_VERSION,
    uuid,
    name: "Untitled team",
    coach: "",
    rosterId,
    rulesetId: "bb2025-default",
    favouredOf: "Undivided",
    norseLeague: "Old World Classic",
    players: [],
    stars: [],
    staff: {
      rerolls: 0,
      apothecary: 0,
      assistantCoaches: 0,
      cheerleaders: 0,
      dedicatedFans: 0,
    },
    inducements: {},
    notes: "",
  };
}
