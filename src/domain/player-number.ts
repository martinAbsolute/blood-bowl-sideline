import type { Team } from "./types";

/** Resolve legacy row numbers before sorting or changing the roster. */
export function numberedPlayers(players: Team["players"]) {
  const used = new Set(players.flatMap((player) => (player.number === undefined ? [] : [Number(player.number)])));
  let next = 1;
  return players
    .map((player) => {
      if (player.number !== undefined) return { ...player, number: player.number };
      while (used.has(next)) next++;
      const number = next++;
      used.add(number);
      return { ...player, number: String(number).padStart(2, "0") };
    })
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export function nextPlayerNumber(players: Team["players"], offset = 0) {
  const used = new Set(numberedPlayers(players).map((player) => Number(player.number)));
  let next = 1;
  while (true) {
    while (used.has(next)) next++;
    if (offset-- === 0) break;
    next++;
  }
  return String(next).padStart(2, "0");
}

export function isPlayerNumberAvailable(players: Team["players"], playerId: string, number: string) {
  return (
    /^\d{1,2}$/.test(number) &&
    !numberedPlayers(players).some((player) => player.id !== playerId && Number(player.number) === Number(number))
  );
}
