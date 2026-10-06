"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "gt-next";
import { CircleHelp } from "lucide-react";
import { RosterExplorer } from "./roster-explorer";
import type { RulesetId } from "@/domain/types";
import { RosterRulesetPicker } from "./roster-ruleset-picker";
import { getRuleset } from "@/domain/catalog";
import { rosterChoices, sharedRosterBudget } from "@/lib/roster-ruleset";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

export function TeamCatalog({
  rulesetId = "bb2025-default",
}: {
  rulesetId?: RulesetId;
}) {
  return <Catalog key={rulesetId} rulesetId={rulesetId} />;
}

function Catalog({ rulesetId }: { rulesetId: RulesetId }) {
  const t = useTranslations();
  const rules = getRuleset(rulesetId);
  const sharedBudget = sharedRosterBudget(rulesetId);
  const tiers = [...new Set(rosterChoices(rulesetId).map(({ tier }) => tier))]
    .filter((tier) => tier > 0)
    .sort((a, b) => a - b);
  const [hiddenTiers, setHiddenTiers] = useState<Set<number>>(() => new Set());
  const revealTier = useCallback((tier: number) => {
    setHiddenTiers((current) => {
      if (!current.has(tier)) return current;
      const next = new Set(current);
      next.delete(tier);
      return next;
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
                  aria-pressed={!hiddenTiers.has(tier)}
                  onClick={() =>
                    setHiddenTiers((current) => {
                      const next = new Set(current);
                      if (next.has(tier)) next.delete(tier);
                      else next.add(tier);
                      return next;
                    })
                  }
                  className={
                    "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring " +
                    (hiddenTiers.has(tier)
                      ? "border-border text-muted-foreground hover:bg-secondary"
                      : "border-primary/30 bg-primary/10 text-primary")
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
              <Popover>
                <PopoverTrigger
                  aria-label={t("ruleset")}
                  className="mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CircleHelp className="size-4" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="max-w-[calc(100vw-2rem)] text-xs"
                >
                  <PopoverTitle>{rules.name}</PopoverTitle>
                  {sharedBudget !== undefined && (
                    <p>
                      {t("treasury")}: {sharedBudget / 1000}k GP
                    </p>
                  )}
                  <p>
                    {t("players")}: {rules.minPlayers}–{rules.maxPlayers}
                  </p>
                  {rules.sevens && <p>{t("referenceSpecialists")}: 0–4</p>}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
      <RosterExplorer
        rulesetId={rulesetId}
        hiddenTiers={hiddenTiers}
        onRevealTier={revealTier}
      />
    </div>
  );
}
