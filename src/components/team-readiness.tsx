"use client";
import { useTranslations } from "gt-next";
import { ShieldCheck } from "lucide-react";
import type { Team } from "@/domain/types";
import { getRuleset } from "@/domain/catalog";
import { validateTeam } from "@/domain/rules";
import { ReadinessCard } from "./readiness-card";
export function TeamReadiness({
  team,
  startingTreasury,
}: {
  team: Team;
  startingTreasury?: number;
}) {
  const t = useTranslations();
  const validation = validateTeam(team, startingTreasury);
  const rules = getRuleset(team.rulesetId);
  return (
    <ReadinessCard ready={validation.valid}>
      <div className="flex items-center gap-2">
        <ShieldCheck
          className={`size-5 ${validation.valid ? "text-emerald-700" : "text-muted-foreground"}`}
        />
        <h2 className="font-semibold text-sm">
          {validation.valid ? t("ready") : t("workInProgress")}
        </h2>
      </div>
      {validation.valid ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-emerald-900">
            {t("legalText")}
          </p>
        </>
      ) : (
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          {validation.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-orange-600" />
              <span>{t(`issues.${issue.code}`, issue.values)}</span>
            </li>
          ))}
        </ul>
      )}
      {rules.id !== "bb2025-default" && (
        <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
          {t("squadNotice")}
        </p>
      )}
    </ReadinessCard>
  );
}
