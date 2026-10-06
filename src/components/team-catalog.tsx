"use client";
import { useTranslations } from "gt-next";
import { RosterExplorer } from "./roster-explorer";
import type { RulesetId } from "@/domain/types";
import { RosterRulesetPicker } from "./roster-ruleset-picker";
import { getRuleset } from "@/domain/catalog";
import { sharedRosterBudget } from "@/lib/roster-ruleset";
export function TeamCatalog({
  rulesetId = "bb2025-default",
}: {
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  const rules = getRuleset(rulesetId);
  const sharedBudget = sharedRosterBudget(rulesetId);
  return (
    <div className="page-width py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-heading">{t("rosters")}</h1>
        <RosterRulesetPicker rulesetId={rulesetId} />
      </div>
      <div className="mb-5 space-y-2 rounded-lg border bg-secondary/30 p-4 text-sm">
        <p>{t("rosterSelectionHelp")}</p>
        <p className="text-xs text-muted-foreground">
          {t("rosterSharedRules")}: {t("players")} {rules.minPlayers}–
          {rules.maxPlayers}
          {sharedBudget !== undefined && (
            <>
              {" "}
              · {t("rosterStartingBudget")} {sharedBudget / 1000}k GP
            </>
          )}
          {rules.sevens && <> · {t("referenceSpecialists")} 0–4</>}
        </p>
      </div>
      <RosterExplorer key={rulesetId} rulesetId={rulesetId} />
    </div>
  );
}
