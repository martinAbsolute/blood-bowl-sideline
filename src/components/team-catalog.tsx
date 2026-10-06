"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "gt-next";
import { RosterExplorer } from "./roster-explorer";
import type { RulesetId } from "@/domain/types";
import { RosterRulesetPicker } from "./roster-ruleset-picker";
import { getRuleset, newTeam } from "@/domain/catalog";
import { staffInfo } from "@/domain/rules";
import { rosterChoices, sharedRosterBudget } from "@/lib/roster-ruleset";
import { RuleInfo } from "./rule-help";
import { useRosterRuleset } from "@/lib/use-roster-ruleset";

export function TeamCatalog({
  rulesetId = "bb2025-default",
}: {
  rulesetId?: RulesetId;
}) {
  const activeRulesetId = useRosterRuleset(rulesetId);
  return <Catalog rulesetId={activeRulesetId} />;
}

function Catalog({ rulesetId }: { rulesetId: RulesetId }) {
  const t = useTranslations();
  const rules = getRuleset(rulesetId);
  const sharedBudget = sharedRosterBudget(rulesetId);
  const staff = staffInfo({ ...newTeam(""), rulesetId });
  const tiers = [...new Set(rosterChoices(rulesetId).map(({ tier }) => tier))]
    .filter((tier) => tier > 0)
    .sort((a, b) => a - b);
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(
    () => new Set(),
  );
  const [previousRulesetId, setPreviousRulesetId] = useState(rulesetId);
  if (previousRulesetId !== rulesetId) {
    setPreviousRulesetId(rulesetId);
    setSelectedTiers(new Set());
  }
  const revealTier = useCallback((tier: number) => {
    setSelectedTiers((current) => {
      if (current.size === 0 || current.has(tier)) return current;
      return new Set();
    });
  }, []);
  return (
    <div className="page-width py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-heading">{t("rosters")}</h1>
        <div className="no-print flex max-w-full flex-wrap items-end gap-x-4 gap-y-2">
          {tiers.length > 0 && (
            <div
              role="group"
              aria-label={t("tier")}
              className="flex flex-wrap items-center gap-1 pb-1"
            >
              {tiers.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={selectedTiers.has(tier)}
                  onClick={() =>
                    setSelectedTiers((current) => {
                      const next = new Set(current);
                      if (next.has(tier)) next.delete(tier);
                      else next.add(tier);
                      return next;
                    })
                  }
                  className={
                    "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring " +
                    (selectedTiers.has(tier)
                      ? "border-border bg-secondary text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary/50")
                  }
                >
                  {t("tier")} {tier}
                </button>
              ))}
            </div>
          )}
          <div className="flex min-w-0 items-end gap-1">
            <RosterRulesetPicker rulesetId={rulesetId} />
            {rulesetId !== "bb2025-default" && (
              <RuleInfo
                title={rules.name}
                className="mb-0.5"
                description={[
                  ...(sharedBudget !== undefined
                    ? [t("treasury") + ": " + sharedBudget / 1000 + "k GP"]
                    : []),
                  t("players") +
                    ": " +
                    rules.minPlayers +
                    "–" +
                    rules.maxPlayers,
                  ...(rules.sevens
                    ? [
                        t("referenceSpecialists") + ": 0–4",
                        t("rerolls") +
                          ": " +
                          staff.rerolls.cost / 1000 +
                          "k GP",
                      ]
                    : []),
                ].join("\n\n")}
              />
            )}
          </div>
        </div>
      </div>
      <RosterExplorer
        rulesetId={rulesetId}
        selectedTiers={selectedTiers}
        onRevealTier={revealTier}
      />
    </div>
  );
}
