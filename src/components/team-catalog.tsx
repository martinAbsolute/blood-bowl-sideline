"use client";
import { useTranslations } from "gt-next";
import { RosterExplorer } from "./roster-explorer";
import type { RulesetId } from "@/domain/types";
import { RosterRulesetPicker } from "./roster-ruleset-picker";
export function TeamCatalog({
  rulesetId = "bb2025-default",
}: {
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  return (
    <div className="page-width py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-heading">{t("rosters")}</h1>
        <RosterRulesetPicker rulesetId={rulesetId} />
      </div>
      <RosterExplorer rulesetId={rulesetId} />
    </div>
  );
}
