"use client";

import { useTranslations } from "gt-next";
import { getRoster, getRuleset } from "@/domain/catalog";
import { summarize } from "@/domain/rules";
import type { Team } from "@/domain/types";

const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;

export function BudgetOverview({
  team,
  compact = false,
}: {
  team: Team;
  compact?: boolean;
}) {
  const t = useTranslations();
  const totals = summarize(team);
  return (
    <span
      className={
        compact ? "budget-overview budget-compact" : "budget-overview block p-4"
      }
    >
      <span className="budget-caption block text-xs font-medium text-muted-foreground">
        {t("summary")}
      </span>
      <span className="budget-value mt-4 flex items-end justify-between">
        <span className="budget-spent display-font text-2xl">
          {gold(totals.teamGold)}
        </span>
        <span className="budget-limit pb-1 font-mono text-xs text-muted-foreground">
          / {gold(totals.budget.teamBudget)} GP
        </span>
      </span>
      <span
        className="budget-progress mt-4 block h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={t("spent")}
        aria-valuemin={0}
        aria-valuemax={totals.budget.teamBudget}
        aria-valuenow={Math.min(totals.teamGold, totals.budget.teamBudget)}
        aria-valuetext={`${gold(totals.teamGold)} / ${gold(totals.budget.teamBudget)} GP`}
      >
        <span
          className={`block h-full transition-[width] motion-reduce:transition-none ${totals.remaining < 0 ? "bg-orange-600" : "bg-primary/60"}`}
          style={{
            width: `${Math.min(100, (totals.teamGold / totals.budget.teamBudget) * 100)}%`,
          }}
        />
      </span>
      {!compact && (
        <span className="mt-3 flex justify-between text-xs">
          <span className="text-muted-foreground">{t("remaining")}</span>
          <span className="font-mono">{gold(totals.remaining)} GP</span>
        </span>
      )}
    </span>
  );
}

export function BudgetBreakdown({ team }: { team: Team }) {
  const t = useTranslations();
  const totals = summarize(team);
  const rules = getRuleset(team.rulesetId);
  const roster = getRoster(team.rosterId)!;
  return (
    <div className="space-y-3">
      {[
        [t("players"), totals.players],
        [t("staff"), totals.staff],
        [t("starPlayers"), totals.starGold],
        [t("inducements"), totals.inducements],
      ].map(([label, n]) => (
        <div className="flex justify-between" key={label}>
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">{gold(n as number)}</span>
        </div>
      ))}
      {rules.id !== "bb2025-default" && (
        <div className="border-t pt-3">
          <div className="flex justify-between font-semibold">
            <span>{t("skillAllowance")}</span>
            <span className="font-mono">
              {rules.skillCurrency ? totals.skills : gold(totals.skills)} /{" "}
              {rules.skillCurrency
                ? totals.budget.skillGold
                : gold(totals.budget.skillGold)}{" "}
              {rules.skillCurrency === "spp"
                ? "SPP"
                : rules.skillCurrency === "sp"
                  ? "SP"
                  : "GP"}
            </span>
          </div>
          {totals.starTax > 0 && (
            <p className="mt-2 text-muted-foreground">
              {t("starPlayers")}:{" "}
              {rules.skillCurrency ? totals.starTax : gold(totals.starTax)}{" "}
              {rules.skillCurrency?.toUpperCase() ?? "GP"}
            </p>
          )}
        </div>
      )}
      {rules.id === "eurobowl-2026" && (
        <div className="border-t pt-3">
          <div className="flex justify-between">
            <span>{t("flowingFunds")}</span>
            <span className="font-mono">
              {gold(totals.fundsUsed)} / {gold(totals.budget.flowingFunds)}
            </span>
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {t("flowingHint")}
          </p>
        </div>
      )}
      <div className="flex justify-between border-t pt-3">
        <span>{t("tier")}</span>
        <span>{totals.tier || roster.tier}</span>
      </div>
    </div>
  );
}
