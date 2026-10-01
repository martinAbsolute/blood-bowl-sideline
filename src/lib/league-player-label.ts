/** Preserve canonical query order before a statistics table sorts its rows. */
export function leaguePlayerNumbers(
  players: readonly { id: string; entryId: string }[],
) {
  const counts = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const player of players) {
    const number = (counts.get(player.entryId) ?? 0) + 1;
    counts.set(player.entryId, number);
    numbers.set(player.id, number);
  }
  return numbers;
}

/** A frozen match roster keeps its own numbering after later roster changes. */
export function snapshotPlayerNumber(
  sourcePlayerId: string,
  players: readonly { id: string }[] | undefined,
  fallback: number,
) {
  const index =
    players?.findIndex((player) => player.id === sourcePlayerId) ?? -1;
  return index >= 0 ? index + 1 : fallback;
}

export function leaguePlayerLabel(
  name: string,
  position: string,
  number: number,
) {
  return name.trim() || `#${number} ${position}`;
}
