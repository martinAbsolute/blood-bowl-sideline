import { rulesets } from "@/domain/catalog";
import type { RulesetId } from "@/domain/types";

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
