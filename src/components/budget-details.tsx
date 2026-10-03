"use client";
import { useTranslations } from "gt-next";
import type { BudgetPool, BudgetSummary } from "@/domain/budget";
import { RuleInfo } from "./rule-help";

const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;
const amount = (n: number, unit: BudgetPool["unit"]) =>
  unit === "GP" ? gold(n) : `${n} ${unit}`;

function usePoolLabel() {
  const t = useTranslations();
  return (pool: BudgetPool) =>
    pool.id === "team"
      ? t("treasury")
      : pool.id === "funds"
        ? t("flowingFunds")
        : pool.unit === "GP"
          ? t("skillGold")
          : pool.unit === "SP"
            ? t("skillPoints")
            : t("spp");
}

function BudgetMeter({ pool }: { pool: BudgetPool }) {
  const t = useTranslations();
  const label = usePoolLabel()(pool);
  const excess = Math.max(0, pool.used - pool.limit);
  const tone = excess
    ? pool.shared
      ? "text-amber-700"
      : "text-destructive"
    : "text-muted-foreground";
  const status = t(
    excess
      ? pool.shared
        ? "budgetFromFunds"
        : "treasuryOver"
      : "treasuryLeft",
    { amount: amount(Math.abs(pool.limit - pool.used), pool.unit) },
  );
  const values = `${amount(pool.used, pool.unit)} / ${amount(pool.limit, pool.unit)}`;
  const progress =
    pool.limit > 0
      ? Math.min(100, (pool.used / pool.limit) * 100)
      : pool.used > 0
        ? 100
        : 0;
  return (
    <span className="budget-meter block" data-budget-meter={pool.id}>
      <span className="budget-meter-top flex items-baseline justify-between gap-2 text-xs leading-4">
        <span className="budget-meter-label flex min-w-0 items-center gap-0.5 font-medium">
          <span className="truncate">{label}</span>
          {pool.id === "funds" && (
            <RuleInfo
              title={label}
              description={t("flowingHint")}
              label={t("explainRule", { name: label })}
              className="pointer-events-auto relative z-10 -my-1 size-6 [&>svg]:size-3.5"
            />
          )}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap tabular-nums ${tone}`}
          title={excess && !pool.shared ? values : status}
        >
          {excess && !pool.shared ? status : values}
        </span>
      </span>
      <span
        className="budget-progress mt-1.5 block h-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, pool.limit)}
        aria-valuenow={Math.min(pool.used, Math.max(1, pool.limit))}
        aria-valuetext={`${values} · ${status}`}
      >
        <span
          className={`block h-full transition-[width] motion-reduce:transition-none ${excess ? (pool.shared ? "bg-amber-600" : "bg-destructive") : "bg-primary/70"}`}
          style={{ width: `${progress}%` }}
        />
      </span>
    </span>
  );
}

export function BudgetOverview({ pool }: { pool: BudgetPool }) {
  return (
    <span className="budget-overview block p-3">
      <BudgetMeter pool={pool} />
    </span>
  );
}

export function BudgetBreakdown({
  summary,
  drawerPool,
}: {
  summary: BudgetSummary;
  drawerPool?: BudgetPool;
}) {
  const t = useTranslations();
  const { totals, pools, counts } = summary;
  const skillUnit = pools.find((pool) => pool.id === "skills")?.unit ?? "GP";
  const costs: [string, number, BudgetPool["unit"]][] = [
    [t("players"), totals.players, "GP"],
    [t("starPlayers"), totals.starGold, "GP"],
    [t("budgetPlayerSkills"), totals.skills - totals.starTax, skillUnit],
    [t("budgetStarTax"), totals.starTax, skillUnit],
    [t("staff"), totals.staff, "GP"],
    [t("inducements"), totals.inducements, "GP"],
  ];
  const spent = costs.filter(([, value]) => value > 0);
  if (pools.length === 1 && spent.length === 0) return null;
  return (
    <div className="space-y-3 px-3 pb-3 text-xs">
      {pools
        .filter((pool) => pool.id !== (drawerPool ?? pools[0]).id)
        .map((pool) => (
          <BudgetMeter key={pool.id} pool={pool} />
        ))}
      {spent.length > 0 && (
        <dl className="space-y-1.5 border-t pt-3">
          {spent.map(([name, value, unit]) => (
            <div className="flex justify-between gap-3" key={name}>
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="shrink-0 tabular-nums">{amount(value, unit)}</dd>
            </div>
          ))}
          {counts.primary + counts.secondary > 0 && (
            <div className="flex justify-between gap-3 pt-1.5">
              <dt className="text-muted-foreground">{t("addedSkills")}</dt>
              <dd className="text-right tabular-nums">
                {t("addedSkillsCount", counts)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
