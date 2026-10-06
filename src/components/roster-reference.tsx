"use client";
import { useTranslations } from "gt-next";
import { SkillList } from "./skill-box";
import { PositionName } from "./position-name";
import type { Roster, RulesetId } from "@/domain/types";
import { getRuleset, newTeam } from "@/domain/catalog";
import {
  budgetFor,
  isLineman,
  isSevens,
  staffInfo,
  tierFor,
} from "@/domain/rules";
import { PlayerIcon } from "./player-icon";
import { TeamAffiliations } from "./team-affiliations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function RosterTable({
  roster,
  rulesetId = "bb2025-default",
}: {
  roster: Roster;
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  const rules = getRuleset(rulesetId);
  return (
    <Table
      className="reference-table min-w-[856px] table-fixed"
      aria-label={roster.name}
    >
      <colgroup>
        <col className="w-52" />
        <col className="w-16" />
        {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
          <col key={stat} className="w-8" />
        ))}
        <col />
        <col className="w-16" />
        <col className="w-20" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>{t("position")}</TableHead>
          <TableHead className="text-right">{t("cost")}</TableHead>
          {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
            <TableHead key={stat} className="text-center">
              {stat}
            </TableHead>
          ))}
          <TableHead>{t("builtInSkills")}</TableHead>
          <TableHead className="text-center">{t("primary")}</TableHead>
          <TableHead className="text-center">{t("secondary")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roster.players.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <PlayerIcon positionId={p.id} className="size-8" />
                <div className="whitespace-normal">
                  <p className="font-medium">
                    <PositionName position={p.position} />
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    0–
                    {Math.min(
                      Number(p.qty.split("-")[1]),
                      rules.maxPlayers,
                      rules.sevens && !isLineman(p) ? 4 : Infinity,
                    )}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right font-mono">
              {p.cost / 1000}k
            </TableCell>
            {[p.ma, p.st, p.ag, p.pa, p.av].map((stat, i) => (
              <TableCell key={i} className="text-center font-mono">
                {stat}
              </TableCell>
            ))}
            <TableCell className="whitespace-normal text-muted-foreground">
              <SkillList ids={p.skills} />
            </TableCell>
            <TableCell className="text-center font-mono">
              {p.primarySkills.join("") || "—"}
            </TableCell>
            <TableCell className="text-center font-mono">
              {p.secondarySkills.join("") || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RosterFacts({
  roster,
  rulesetId = "bb2025-default",
}: {
  roster: Roster;
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  const team = {
    ...newTeam("00000000-0000-4000-8000-000000000000", roster.id),
    rulesetId,
  };
  const rules = getRuleset(rulesetId);
  const staff = staffInfo(team);
  const tier = tierFor(team);
  const budget = budgetFor(team);
  if (rules.excludedRosters?.includes(roster.id))
    return (
      <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">
        {t("rosterUnavailable")}
      </p>
    );
  return (
    <div className="space-y-1.5 border-t px-3 py-2.5 text-xs">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p>
          <span className="font-medium">{t("rerolls")}:</span> 0–
          {staff.rerolls.max} · {staff.rerolls.cost / 1000}k GP
        </p>
        <p>
          <span className="font-medium">{t("apothecary")}:</span>{" "}
          {t(roster.apothecary ? "yes" : "no")}
          {roster.apothecary && ` · ${staff.apothecary.cost / 1000}k GP`}
        </p>
        <p>
          <span className="font-medium">{t("players")}:</span>{" "}
          {rules.minPlayers}–{rules.maxPlayers}
        </p>
        <p>
          <span className="font-medium">{t("treasury")}:</span>{" "}
          {budget.teamBudget / 1000}k GP
        </p>
        {tier > 0 && (
          <p>
            <span className="font-medium">{t("tier")}:</span> {tier}
          </p>
        )}
        {rules.id === "kyiv-seven-sins-sevens" ? (
          <p>
            <span className="font-medium">{t("skillAllowance")}:</span>{" "}
            {t("primary")}{" "}
            {budget.skillGold - (rules.maxSecondaryByTier?.[tier] ?? 0)}
            {(rules.maxSecondaryByTier?.[tier] ?? 0) > 0 && (
              <>
                {" "}
                · {t("referenceFlexibleSkill")}{" "}
                {rules.maxSecondaryByTier?.[tier]}
              </>
            )}
          </p>
        ) : (
          <p>
            <span className="font-medium">
              {t(
                rules.skillCurrency === "spp"
                  ? "spp"
                  : rules.skillCurrency === "sp"
                    ? "skillPoints"
                    : "skillGold",
              )}
              :
            </span>{" "}
            {rules.skillCurrency
              ? budget.skillGold
              : `${budget.skillGold / 1000}k GP`}
          </p>
        )}
        {isSevens(team) && (
          <p>
            <span className="font-medium">{t("referenceSpecialists")}:</span>{" "}
            0–4
          </p>
        )}
        {roster.bigGuyMax !== undefined && (
          <p>
            <span className="font-medium">{t("bigGuyLimit")}:</span>{" "}
            {roster.bigGuyMax}
          </p>
        )}
      </div>
      <TeamAffiliations roster={roster} />
    </div>
  );
}
