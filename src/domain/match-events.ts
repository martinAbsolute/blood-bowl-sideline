import {
  casualtyOutcome,
  emptyPlayerStats,
  type PlayerMatchStats,
} from "./league-rules";

export const matchEventKinds = [
  "touchdown",
  "completion",
  "interception",
  "casualty",
  "knockout",
  "sent-off",
  "throw-team-mate",
  "mvp",
] as const;
export type MatchEventKind = (typeof matchEventKinds)[number];
export const casualtyCauses = [
  "block",
  "foul",
  "crowd",
  "dodge",
  "rush",
  "special",
  "other",
] as const;
export interface MatchEvent {
  id: string;
  kind: MatchEventKind;
  playerId: string;
  targetId: string | null;
  half: number | null;
  turn: number | null;
  cause: (typeof casualtyCauses)[number];
  casualtyRoll: number | null;
  lastingRoll: number | null;
  apothecary: boolean;
  apothecaryRoll: number | null;
  apothecaryLastingRoll: number | null;
  keepOriginal: boolean;
  regeneration: "not-used" | "failed" | "succeeded";
  superb: boolean;
  notes: string;
}
export interface EventPlayer {
  playerId: string;
  entryId: string;
  participated: boolean;
  stats: PlayerMatchStats;
  statusAfter: "active" | "missing-next-game" | "dead";
  casualtyRoll: number | null;
  lastingRoll: number | null;
  injuryNotes: string;
}
export function newMatchEvent(playerId = ""): MatchEvent {
  return {
    id: "",
    kind: "touchdown",
    playerId,
    targetId: null,
    half: null,
    turn: null,
    cause: "block",
    casualtyRoll: null,
    lastingRoll: null,
    apothecary: false,
    apothecaryRoll: null,
    apothecaryLastingRoll: null,
    keepOriginal: false,
    regeneration: "not-used",
    superb: false,
    notes: "",
  };
}

export function resolvedCasualty(event: MatchEvent) {
  const roll =
    event.apothecary && !event.keepOriginal
      ? event.apothecaryRoll
      : event.casualtyRoll;
  const lasting =
    event.apothecary && !event.keepOriginal
      ? event.apothecaryLastingRoll
      : event.lastingRoll;
  if (roll === null) throw new Error("EVENT_CASUALTY_REQUIRED");
  const outcome = casualtyOutcome(roll, lasting ?? undefined);
  const recovered =
    event.regeneration === "succeeded" ||
    (event.apothecary && outcome.result === "badly-hurt");
  return { roll, lasting, outcome, recovered };
}

/** Stable insertion order for un-timed reports; optional half/turn puts late entries in play order. */
export function sortMatchEvents<T extends MatchEvent>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => {
    const order = (event: MatchEvent) =>
      event.kind === "mvp"
        ? 1000
        : event.half === null
          ? 999
          : event.half * 20 + (event.turn ?? 19);
    return order(a) - order(b);
  });
}

/** The event ledger is the only writer of score, SPP inputs and injury projections. */
export function projectMatchEvents<T extends EventPlayer>(
  players: readonly T[],
  events: readonly MatchEvent[],
  homeId: string,
) {
  if (
    events.length > 256 ||
    new Set(events.map((event) => event.id)).size !== events.length
  )
    throw new Error("EVENT_LIMIT");
  const rows = players.map((row) => ({
    ...row,
    stats: emptyPlayerStats(),
    statusAfter: "active" as EventPlayer["statusAfter"],
    casualtyRoll: null as number | null,
    lastingRoll: null as number | null,
    injuryNotes: "",
  }));
  const byId = new Map(rows.map((row) => [row.playerId, row]));
  const mvpTeams = new Set<string>();
  const injured = new Set<string>();
  for (const event of sortMatchEvents(events)) {
    if (!event.id || event.id.length > 100 || event.notes.length > 500)
      throw new Error("INVALID_INPUT");
    if (
      (event.half !== null && ![1, 2, 3].includes(event.half)) ||
      (event.turn !== null &&
        (event.half === null ||
          !Number.isInteger(event.turn) ||
          event.turn < 1 ||
          event.turn > 8))
    )
      throw new Error("INVALID_INPUT");
    const player = byId.get(event.playerId);
    const target = event.targetId ? byId.get(event.targetId) : undefined;
    if (
      !player?.participated ||
      (event.targetId && !target?.participated) ||
      target === player
    )
      throw new Error("INELIGIBLE_PLAYER");
    const linked =
      ["completion", "throw-team-mate", "interception"].includes(event.kind) ||
      (event.kind === "casualty" &&
        ["block", "foul", "special"].includes(event.cause));
    if (linked && !target) throw new Error("EVENT_TARGET_REQUIRED");
    if (
      target &&
      ["completion", "throw-team-mate"].includes(event.kind) &&
      player.entryId !== target.entryId
    )
      throw new Error("EVENT_TEAM_MISMATCH");
    if (
      target &&
      (event.kind === "interception" || event.kind === "casualty") &&
      player.entryId === target.entryId
    )
      throw new Error("EVENT_TEAM_MISMATCH");
    if (!linked && event.targetId !== null) throw new Error("INVALID_INPUT");
    if (
      event.kind !== "casualty" &&
      (event.casualtyRoll !== null ||
        event.lastingRoll !== null ||
        event.apothecaryRoll !== null ||
        event.apothecaryLastingRoll !== null ||
        event.regeneration !== "not-used" ||
        event.keepOriginal)
    )
      throw new Error("INVALID_INPUT");
    if (event.apothecary && !["casualty", "knockout"].includes(event.kind))
      throw new Error("INVALID_INPUT");
    if (event.superb && event.kind !== "throw-team-mate")
      throw new Error("INVALID_INPUT");
    switch (event.kind) {
      case "touchdown":
        player.stats.td++;
        break;
      case "completion":
        player.stats.com++;
        break;
      case "interception":
        player.stats.int++;
        break;
      case "mvp":
        if (mvpTeams.has(player.entryId))
          throw new Error("ONE_MVP_PER_TEAM_REQUIRED");
        mvpTeams.add(player.entryId);
        player.stats.mvp++;
        break;
      case "throw-team-mate":
        if (event.superb) player.stats.superbThrows++;
        target!.stats.safeLandings++;
        break;
      case "casualty": {
        if (event.casualtyRoll === null)
          throw new Error("EVENT_CASUALTY_REQUIRED");
        casualtyOutcome(event.casualtyRoll, event.lastingRoll ?? undefined);
        if (event.apothecary) {
          if (event.apothecaryRoll === null)
            throw new Error("EVENT_APOTHECARY_REQUIRED");
          casualtyOutcome(
            event.apothecaryRoll,
            event.apothecaryLastingRoll ?? undefined,
          );
        } else if (
          event.apothecaryRoll !== null ||
          event.apothecaryLastingRoll !== null ||
          event.keepOriginal
        )
          throw new Error("INVALID_INPUT");
        const victim = target ?? player;
        victim.stats.inj++;
        if (target) {
          player.stats.cas++;
          if (event.cause === "block") player.stats.sppCas++;
        }
        const resolved = resolvedCasualty(event);
        if (!resolved.recovered) {
          // A player removed as a casualty cannot suffer another until recovered.
          if (injured.has(victim.playerId))
            throw new Error("EVENT_DUPLICATE_INJURY");
          injured.add(victim.playerId);
          victim.casualtyRoll = resolved.roll;
          victim.lastingRoll = resolved.lasting;
          victim.statusAfter = resolved.outcome.dead
            ? "dead"
            : resolved.outcome.missNextGame
              ? "missing-next-game"
              : "active";
          victim.stats.dth = resolved.outcome.dead ? 1 : 0;
          victim.injuryNotes = event.notes;
        }
        break;
      }
      // Removals matter to the match timeline, but never generate SPP or permanent injuries.
      case "knockout":
        break;
      case "sent-off":
        player.stats.sof++;
        break;
      default:
        throw new Error("INVALID_INPUT");
    }
  }
  return {
    players: rows,
    scoreHome: rows
      .filter((row) => row.entryId === homeId)
      .reduce((sum, row) => sum + row.stats.td, 0),
    scoreAway: rows
      .filter((row) => row.entryId !== homeId)
      .reduce((sum, row) => sum + row.stats.td, 0),
  };
}
