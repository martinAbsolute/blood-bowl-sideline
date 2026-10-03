"use client";
import { useTranslations } from "gt-next";
import { TriangleAlert } from "lucide-react";
import type { BudgetPool, BudgetSummary } from "@/domain/budget";
const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;
const amount = (n: number, unit: BudgetPool["unit"]) =>
  unit === "GP" ? gold(n) : `${n} ${unit}`;
function usePoolLabel() {
  const t = useTranslations();
  return (pool: BudgetPool) =>
    pool.id === "team"
      ? t("budget")
      : pool.id === "funds"
        ? t("flowingFunds")
        : pool.unit === "GP"
          ? t("skillGold")
          : t("skillAllowance");
}
function BudgetMeter({ pool }: { pool: BudgetPool }) {
  const t = useTranslations();
  const label = usePoolLabel()(pool);
  const excess = Math.max(0, pool.used - pool.limit);
  const tone = excess
    ? pool.shared
      ? "text-amber-700"
      : "text-destructive"
    : "text-foreground";
  const progress =
    pool.limit > 0
      ? Math.min(100, (pool.used / pool.limit) * 100)
      : pool.used > 0
        ? 100
        : 0;
  return (
    <span className="budget-meter block" data-budget-meter={pool.id}>
      <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
        <span className="font-medium">{label}</span>
        <span
          className={`budget-value whitespace-nowrap font-mono tabular-nums ${tone}`}
        >
          {amount(pool.used, pool.unit)}{" "}
          <span className="text-muted-foreground">
            / {amount(pool.limit, pool.unit)}
          </span>
        </span>
      </span>
      <span
        className="budget-progress mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, pool.limit)}
        aria-valuenow={Math.min(pool.used, Math.max(1, pool.limit))}
        aria-valuetext={`${amount(pool.used, pool.unit)} / ${amount(pool.limit, pool.unit)}`}
      >
        <span
          className={`block h-full transition-[width] motion-reduce:transition-none ${excess ? (pool.shared ? "bg-amber-600" : "bg-destructive") : "bg-primary/70"}`}
          style={{ width: `${progress}%` }}
        />
      </span>
      <span
        className={`budget-remaining mt-1.5 flex justify-between gap-2 text-[11px] ${excess ? tone : "text-muted-foreground"}`}
      >
        {excess ? (
          <span>
            {t(pool.shared ? "budgetFromFunds" : "budgetOverBy", {
              amount: amount(excess, pool.unit),
            })}
          </span>
        ) : (
          <>
            <span>{t("remaining")}</span>
            <span className="font-mono tabular-nums">
              {amount(pool.limit - pool.used, pool.unit)}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
export function BudgetOverview({ summary }: { summary: BudgetSummary }) {
  const t = useTranslations();
  return (
    <span className="budget-overview block p-3">
      <BudgetMeter pool={summary.pools[0]} />
      {summary.issues.length > 0 && (
        <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {t("budgetIssues")}
        </span>
      )}
    </span>
  );
}
export function BudgetBreakdown({ summary }: { summary: BudgetSummary }) {
  const t = useTranslations();
  const label = usePoolLabel();
  const { totals, pools, counts } = summary;
  const skillUnit = pools.find((pool) => pool.id === "skills")?.unit ?? "GP";
  const costs = [
    [t("players"), gold(totals.players)],
    [t("starPlayers"), gold(totals.starGold)],
    [
      t("budgetPlayerSkills"),
      amount(totals.skills - totals.starTax, skillUnit),
    ],
    ...(totals.starTax > 0
      ? [[t("budgetStarTax"), amount(totals.starTax, skillUnit)]]
      : []),
    [t("staff"), gold(totals.staff)],
    [t("inducements"), gold(totals.inducements)],
  ];
  return (
    <div className="space-y-4">
      {pools.slice(1).map((pool) => (
        <BudgetMeter key={pool.id} pool={pool} />
      ))}
      {pools.some((pool) => pool.id === "funds") && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("flowingHint")}
        </p>
      )}
      {summary.issues.length > 0 && (
        <div
          className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"
          aria-label={t("budgetIssues")}
        >
          <ul className="space-y-1.5">
            {summary.issues.map((pool) => (
              <li key={pool.id} className="flex gap-1.5 leading-relaxed">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {t("budgetOver", {
                    budget: label(pool),
                    amount: amount(pool.used - pool.limit, pool.unit),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        className={
          pools.length > 1 || summary.issues.length ? "border-t pt-3" : ""
        }
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">{t("budgetCosts")}</h3>
          <span className="text-[11px] text-muted-foreground">
            {t("tier")} {summary.tier}
          </span>
        </div>
        <dl className="space-y-2">
          {costs.map(([name, value]) => (
            <div className="flex justify-between gap-3" key={name}>
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="shrink-0 font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-3 space-y-2 border-t pt-3">
          {[
            [t("budgetPrimarySkills"), counts.primary],
            [t("budgetSecondarySkills"), counts.secondary],
          ].map(([name, value]) => (
            <div className="flex justify-between gap-3" key={name}>
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
