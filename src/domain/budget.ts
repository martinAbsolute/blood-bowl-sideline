import { getRoster, getRuleset } from "./catalog";
import { skillAccess, summarize } from "./rules";
import type { Team } from "./types";

export type BudgetPool = {
  id: "team" | "skills" | "funds";
  used: number;
  limit: number;
  unit: "GP" | "SP" | "SPP" | "skills";
  shared: boolean;
};

export function budgetSummary(team: Team, startingTreasury?: number) {
  const totals = summarize(team, startingTreasury);
  const rules = getRuleset(team.rulesetId);
  const roster = getRoster(team.rosterId)!;
  const shared = rules.id === "eurobowl-2026";
  const pools: BudgetPool[] = [
    {
      id: "team",
      used: totals.teamGold,
      limit: totals.budget.teamBudget,
      unit: "GP",
      shared,
    },
  ];
  if (rules.id !== "bb2025-default") {
    pools.push({
      id: "skills",
      used: totals.skills,
      limit: totals.budget.skillGold,
      unit:
        rules.id === "kyiv-seven-sins-sevens"
          ? "skills"
          : rules.skillCurrency === "spp"
            ? "SPP"
            : rules.skillCurrency === "sp"
              ? "SP"
              : "GP",
      shared,
    });
  }
  if (shared) {
    pools.push({
      id: "funds",
      used: totals.fundsUsed,
      limit: totals.budget.flowingFunds,
      unit: "GP",
      shared: false,
    });
  }
  const counts = { primary: 0, secondary: 0 };
  for (const player of team.players) {
    const position = roster.players.find((p) => p.id === player.positionId);
    if (!position) continue;
    for (const skill of player.skills) {
      const access = skillAccess(position, skill);
      if (access) counts[access]++;
    }
  }
  return {
    totals,
    pools,
    counts,
    // Base-pool overspend is allowed while the shared reserve covers it.
    issues: pools.filter((pool) => pool.used > pool.limit && !pool.shared),
    tier: totals.tier || roster.tier,
  };
}

export type BudgetSummary = ReturnType<typeof budgetSummary>;
