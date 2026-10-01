import { getRuleset, newTeam } from "@/domain/catalog";
import type { Team } from "@/domain/types";

export function needsPlayerRecruitment(team: Team) {
  return (
    team.players.length + team.stars.length <
      getRuleset(team.rulesetId).minPlayers ||
    (team.rulesetId === "world-cup-2027" &&
      team.stars.length > 0 &&
      team.players.length < 11)
  );
}

export function hasTeamProgress(team: Team) {
  const empty = newTeam(team.uuid, team.rosterId);
  return (
    team.name !== empty.name ||
    team.players.length > 0 ||
    team.stars.length > 0 ||
    Object.values(team.staff).some((count) => count > 0) ||
    Object.values(team.inducements).some((count) => count > 0) ||
    team.favouredOf !== empty.favouredOf ||
    team.norseLeague !== empty.norseLeague
  );
}

export function resetTeamRoster(
  team: Team,
  rosterId: string,
  uuid = team.uuid,
): Team {
  return { ...newTeam(uuid, rosterId), rulesetId: team.rulesetId };
}
