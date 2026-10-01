"use client";

import { useTranslations } from "gt-next";
import { rookieLeagueIssues } from "@/domain/league-rules";
import { validateTeam } from "@/domain/rules";
import type { Team } from "@/domain/types";

const rookieCodes = new Set([
  "leagueRuleset",
  "rookieSkills",
  "rookieStars",
  "rookieInducements",
  "rookieFans",
]);

export function LeagueTeamIssues({
  team,
  leagueExperienced = false,
}: {
  team: Team;
  leagueExperienced?: boolean;
}) {
  const t = useTranslations();
  const issues = rookieLeagueIssues(team);
  const validation = validateTeam(team);
  return issues.length || leagueExperienced ? (
    <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      {leagueExperienced && <li>{t("leagueUi.experiencedTeamHint")}</li>}
      {issues.map((code) => (
        <li key={code}>
          {t(
            rookieCodes.has(code)
              ? `leagueUi.rookieIssues.${code}`
              : `issues.${code}`,
            validation.issues.find((issue) => issue.code === code)?.values,
          )}
        </li>
      ))}
    </ul>
  ) : null;
}
