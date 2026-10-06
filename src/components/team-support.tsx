"use client";

import { useTranslations } from "gt-next";
import { inducements } from "@/domain/catalog";
import { inducementInfo, staffInfo, isSevens } from "@/domain/rules";
import type { Team } from "@/domain/types";
import { QuantityStepper } from "./quantity-stepper";
import { RuleInfo } from "./rule-help";
import { Switch } from "./ui/switch";

const gold = (value: number) => `${(value / 1000).toLocaleString("en")}k`;

function SupportItem({
  label,
  description,
  value,
  max,
  cost,
  onChange,
  readOnly,
  toggle = false,
  longRule = false,
}: {
  label: string;
  description: string;
  value: number;
  max: number;
  cost: number;
  onChange: (value: number) => void;
  readOnly: boolean;
  toggle?: boolean;
  longRule?: boolean;
}) {
  const t = useTranslations();
  const meta =
    max === 0
      ? t("supportUnavailable")
      : `${gold(cost)} ${t("each")} · ${t("maxQuantity", { max })}`;
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${value > 0 ? "border-primary/25 bg-primary/5" : "bg-card"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="min-w-0 text-sm font-semibold leading-5">{label}</p>
          <RuleInfo
            title={label}
            description={description}
            meta={meta}
            skillPreview={longRule}
            label={t("explainRule", { name: label })}
            className="no-print -my-1 size-6 [&>svg]:size-3.5"
          />
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
          {meta}
        </p>
      </div>
      {readOnly ? (
        <output
          aria-label={`${label}: ${value}/${max}`}
          className="min-w-6 text-center font-mono text-sm font-semibold tabular-nums"
        >
          {value}
        </output>
      ) : toggle ? (
        <Switch
          checked={value > 0}
          disabled={max === 0 && value === 0}
          onCheckedChange={(checked) => onChange(checked ? 1 : 0)}
          aria-label={label}
          className="mx-1"
        />
      ) : (
        <QuantityStepper
          label={label}
          value={value}
          max={max}
          showMax={false}
          onDecrease={() => onChange(value - 1)}
          onIncrease={() => onChange(value + 1)}
        />
      )}
    </li>
  );
}

export function TeamSupport({
  team,
  onChange,
  readOnly = false,
}: {
  team: Team;
  onChange: (team: Team) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const staff = staffInfo(team);
  const staffItems = (Object.keys(staff) as (keyof Team["staff"])[]).map(
    (key) => ({ key, ...staff[key] }),
  );
  const eligible = inducements.filter(
    (item) =>
      inducementInfo(team, item).allowed ||
      (team.inducements[item.id] ?? 0) > 0,
  );
  const staffCost = staffItems.reduce(
    (sum, item) => sum + item.cost * team.staff[item.key],
    0,
  );
  const inducementCost = eligible.reduce(
    (sum, item) =>
      sum + inducementInfo(team, item).cost * (team.inducements[item.id] ?? 0),
    0,
  );
  return (
    <div className="grid items-start gap-4 @min-[780px]:grid-cols-2">
      <section aria-labelledby="sideline-staff-title" className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id="sideline-staff-title" className="section-title">
            {t("staff")}
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {gold(staffCost)} GP
          </span>
        </div>
        <ul className="space-y-1.5">
          {staffItems.map(({ key, cost, max }) => (
            <SupportItem
              key={key}
              label={t(
                team.rulesetId === "kyiv-seven-sins-sevens" &&
                  key === "dedicatedFans"
                  ? "sevensDedicatedFans"
                  : key,
              )}
              description={t(
                isSevens(team) && key === "apothecary"
                  ? "sevensApothecaryHelp"
                  : isSevens(team) && key === "dedicatedFans"
                    ? team.rulesetId === "bb2025-sevens"
                      ? "sevensMatchedFansHelp"
                      : "sevensFansHelp"
                    : `staffDescriptions.${key}`,
              )}
              value={team.staff[key]}
              max={max}
              cost={cost}
              toggle={key === "apothecary"}
              readOnly={readOnly}
              onChange={(value) =>
                onChange({ ...team, staff: { ...team.staff, [key]: value } })
              }
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="inducements-title" className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id="inducements-title" className="section-title">
            {t("inducements")}
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {gold(inducementCost)} GP
          </span>
        </div>
        {eligible.length ? (
          <ul className="space-y-1.5">
            {eligible.map((item) => {
              const info = inducementInfo(team, item);
              return (
                <SupportItem
                  key={item.id}
                  label={item.name}
                  description={t(
                    isSevens(team) && item.id === "prayers-to-nuffle"
                      ? "sevensPrayersHelp"
                      : isSevens(team) && item.id === "wandering-apothecary"
                        ? "sevensApothecaryHelp"
                        : `inducementDescriptions.${item.id}`,
                  )}
                  value={team.inducements[item.id] ?? 0}
                  max={info.allowed ? info.max : 0}
                  cost={info.cost}
                  readOnly={readOnly}
                  longRule
                  onChange={(value) =>
                    onChange({
                      ...team,
                      inducements: { ...team.inducements, [item.id]: value },
                    })
                  }
                />
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
            {t("noInducements")}
          </p>
        )}
      </section>
    </div>
  );
}
