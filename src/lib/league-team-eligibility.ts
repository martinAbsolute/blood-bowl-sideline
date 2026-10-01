import { rookieLeagueIssues } from "@/domain/league-rules";
import type { Team } from "@/domain/types";

export function canEnrollTeam(row: {
  team: Team;
  leagueExperienced?: boolean;
}) {
  return !row.leagueExperienced && rookieLeagueIssues(row.team).length === 0;
}
