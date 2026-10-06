"use client";
import { useSearchParams } from "next/navigation";
import type { RulesetId } from "@/domain/types";
import { rosterRuleset } from "./roster-ruleset";

/** Native history updates keep the URL and local catalog in sync without a server navigation. */
export function useRosterRuleset(initialRulesetId: RulesetId): RulesetId {
  const params = useSearchParams();
  if (!params) return initialRulesetId;
  const values = params.getAll("ruleset");
  return rosterRuleset(values.length > 1 ? values : values[0]);
}
