import type { Team } from "@/domain/types";

export function duplicateTeam(team: Team, suffix: string): Team {
  const ending = ` (${suffix})`;
  const players = team.players.map((player) => ({
    ...player,
    id: crypto.randomUUID(),
    skills: [...player.skills],
  }));
  const captainIndex = team.players.findIndex((p) => p.id === team.captainId);
  return {
    ...team,
    uuid: crypto.randomUUID(),
    name: `${team.name.slice(0, 80 - ending.length)}${ending}`,
    players,
    captainId: captainIndex < 0 ? undefined : players[captainIndex].id,
    stars: [...team.stars],
    staff: { ...team.staff },
    inducements: { ...team.inducements },
  };
}
