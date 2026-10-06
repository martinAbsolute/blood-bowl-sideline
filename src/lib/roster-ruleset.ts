import { getRuleset, newTeam, rosters, rulesets } from "@/domain/catalog";
import { budgetFor, tierFor } from "@/domain/rules";
import type { RulesetId } from "@/domain/types";

/** Use the same tier and budget resolution as the team builder. */
export function rosterChoices(rulesetId: RulesetId) {
  const rules = getRuleset(rulesetId);
  return rosters
    .filter((roster) => !rules.excludedRosters?.includes(roster.id))
    .map((roster) => {
      const team = { ...newTeam("", roster.id), rulesetId };
      return { roster, tier: tierFor(team), budget: budgetFor(team) };
    });
}

export function sharedRosterBudget(rulesetId: RulesetId) {
  const budgets = new Set(
    rosterChoices(rulesetId).map(({ budget }) => budget.teamBudget),
  );
  return budgets.size === 1 ? [...budgets][0] : undefined;
}

export function rosterRuleset(value: string | string[] | undefined): RulesetId {
  return rulesets.find((rules) => rules.id === value)?.id ?? "bb2025-default";
}

export function rosterReferenceHref(
  rosterId: string | undefined,
  rulesetId: RulesetId,
) {
  const path = rosterId ? `/rosters/${rosterId}` : "/rosters";
  return rulesetId === "bb2025-default" ? path : `${path}?ruleset=${rulesetId}`;
}
