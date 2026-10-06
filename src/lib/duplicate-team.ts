import type { Team } from "@/domain/types";
import { TEAM_NAME_MAX_LENGTH } from "@/domain/team-name";

export function duplicateTeam(team: Team, suffix: string): Team {
  const ending = ` (${suffix})`;
  const players = team.players.map((player) => ({
    ...player,
    id: crypto.randomUUID(),
    skills: [...player.skills],
  }));
  const captainIndex = team.players.findIndex((p) => p.id === team.captainId);
  const veteranIndex = team.players.findIndex((p) => p.id === team.veteranId);
  return {
    ...team,
    uuid: crypto.randomUUID(),
    name: `${team.name.slice(0, TEAM_NAME_MAX_LENGTH - ending.length).trimEnd()}${ending}`,
    players,
    captainId: captainIndex < 0 ? undefined : players[captainIndex].id,
    veteranId: veteranIndex < 0 ? undefined : players[veteranIndex].id,
    stars: [...team.stars],
    staff: { ...team.staff },
    inducements: { ...team.inducements },
  };
}
