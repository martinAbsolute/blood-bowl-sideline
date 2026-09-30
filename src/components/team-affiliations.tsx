"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "gt-next";
import { affiliation } from "@/domain/rules";
import {
  leagueName,
  leagueSlug,
  specialRuleKey,
} from "@/domain/team-reference";
import type { Roster, Team } from "@/domain/types";
import { RuleHelp } from "./rule-help";

export function LeagueLinks({ names }: { names: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1.5">
      {names.map((name) => (
        <Link
          key={name}
          href={`/leagues/${leagueSlug(name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-0.5 underline decoration-border underline-offset-4 hover:decoration-current"
        >
          {leagueName(name)}
          <ArrowUpRight
            aria-hidden="true"
            className="size-3 shrink-0 self-center text-muted-foreground"
          />
        </Link>
      ))}
    </span>
  );
}

export function SpecialRules({ names }: { names: string[] }) {
  const t = useTranslations();
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1.5">
      {names.map((name) => (
        <RuleHelp
          key={name}
          title={name}
          description={t(`teamSpecialRules.${specialRuleKey(name)}`)}
          fullDescription
          className="underline decoration-dotted underline-offset-4"
        >
          {name}
        </RuleHelp>
      ))}
    </span>
  );
}

export function TeamAffiliations({
  roster,
  team,
}: {
  roster: Roster;
  team?: Team;
}) {
  const t = useTranslations();
  const names =
    team && roster.id === "norse" ? [team.norseLeague] : roster.leagues;
  const rules = team
    ? roster.specialRules.flatMap((name) => {
        if (
          name.startsWith("Favoured of") ||
          name.startsWith("If Chaos Clash")
        ) {
          const chosen = affiliation(team);
          return chosen ? [chosen] : [];
        }
        return [name];
      })
    : roster.specialRules;
  return (
    <div className="space-y-3 text-xs leading-relaxed">
      <div>
        <p className="mb-1 text-muted-foreground">{t("leagues")}</p>
        <LeagueLinks names={names} />
      </div>
      {rules.length > 0 && (
        <div>
          <p className="mb-1 text-muted-foreground">{t("specialRules")}</p>
          <SpecialRules names={rules} />
        </div>
      )}
    </div>
  );
}
