"use client";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { inducements, newTeam, stars } from "@/domain/catalog";
import { SkillList } from "./skill-box";
import { RuleHelp } from "./rule-help";
import { inducementInfo, starEligible } from "@/domain/rules";
import type { Roster, RulesetId } from "@/domain/types";
import { RosterRulesetPicker } from "./roster-ruleset-picker";
import { rosterReferenceHref } from "@/lib/roster-ruleset";
import { useRosterRuleset } from "@/lib/use-roster-ruleset";
import { isSevens } from "@/domain/rules";
import { CreateTeamButton } from "./create-team-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { RosterIcon, StarPlayerIcon } from "./player-icon";
import { RosterFacts, RosterTable } from "./roster-reference";

const referenceOnlyInducements = [
  { id: "mercenary-players", name: "Mercenary Players", max: 3, cost: null },
  { id: "star-players-inducement", name: "Star Players", max: 2, cost: null },
];

export function TeamReference({
  roster,
  rulesetId: initialRulesetId = "bb2025-default",
}: {
  roster: Roster;
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  const rulesetId = useRosterRuleset(initialRulesetId);
  const team = newTeam("00000000-0000-4000-8000-000000000000", roster.id);
  team.rulesetId = rulesetId;
  const eligible = inducements.flatMap((i) => {
    const info = inducementInfo(team, i);
    return info.allowed ? [{ ...i, ...info }] : [];
  });
  const eligibleStars = stars.filter((s) => starEligible(team, s));
  const referenceInducements = [
    ...eligible.filter((item) => item.id !== "wizard-sports-wizard"),
    ...referenceOnlyInducements.filter(
      (item) =>
        team.rulesetId === "bb2025-default" &&
        (item.id !== "star-players-inducement" || eligibleStars.length),
    ),
    ...eligible.filter((item) => item.id === "wizard-sports-wizard"),
  ];
  return (
    <div className="page-width space-y-5 py-6">
      <Link
        href={rosterReferenceHref(undefined, rulesetId)}
        className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:underline sm:min-h-0"
      >
        <ArrowLeft className="size-3.5" />
        {t("allRosters")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RosterIcon rosterId={roster.id} />
          <div>
            <p className="eyebrow">BB2025</p>
            <h1 className="display-font text-3xl">{roster.name}</h1>
          </div>
        </div>
        <CreateTeamButton
          size="sm"
          rosterId={roster.id}
          rulesetId={rulesetId}
          className="h-11 sm:h-9"
        />
      </div>
      <RosterRulesetPicker rulesetId={rulesetId} />
      <section className="overflow-hidden rounded-lg border bg-card">
        <RosterTable roster={roster} rulesetId={rulesetId} />
        <RosterFacts roster={roster} rulesetId={rulesetId} />
      </section>
      <div
        className={`grid items-start gap-5 ${eligibleStars.length || !isSevens(team) ? "xl:grid-cols-[300px_minmax(0,1fr)]" : "sm:max-w-lg"}`}
      >
        <section className="overflow-hidden rounded-lg border bg-card">
          <h2 className="border-b bg-secondary/40 px-3 py-2 text-base font-semibold">
            {t("inducements")}
          </h2>
          <Table className="reference-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("inducements")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referenceInducements.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-normal">
                    <RuleHelp
                      title={i.name}
                      description={t(
                        isSevens(team) && i.id === "prayers-to-nuffle"
                          ? "sevensPrayersHelp"
                          : isSevens(team) && i.id === "wandering-apothecary"
                            ? "sevensApothecaryHelp"
                            : `inducementDescriptions.${i.id}`,
                      )}
                      skillPreview
                      className="underline decoration-dotted underline-offset-4"
                    >
                      {i.name}
                    </RuleHelp>
                    <p className="text-[11px] text-muted-foreground">
                      0–{i.max}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {i.cost === null ? t("priceVaries") : `${i.cost / 1000}k`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        {(eligibleStars.length > 0 || !isSevens(team)) && (
          <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
            <h2 className="border-b bg-secondary/40 px-3 py-2 text-base font-semibold">
              {t("starPlayers")}
            </h2>
            <Table className="reference-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">{t("player")}</TableHead>
                  <TableHead>{t("cost")}</TableHead>
                  {["MA", "ST", "AG", "PA", "AV"].map((s) => (
                    <TableHead key={s} className="text-center">
                      {s}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-60">
                    {t("builtInSkills")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleStars.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StarPlayerIcon starId={s.id} className="size-8" />
                        <span className="whitespace-normal font-medium">
                          {s.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.cost / 1000}k
                    </TableCell>
                    {[s.ma, s.st, s.ag, s.pa, s.av].map((stat, i) => (
                      <TableCell key={i} className="text-center font-mono">
                        {stat}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-normal text-muted-foreground">
                      <SkillList ids={s.skills} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!eligibleStars.length && (
              <p className="p-3 text-xs text-muted-foreground">
                {t("noStars")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
