import { getRoster, getSkill, skills, sortSkillIds } from "./catalog";
import { skillAccess, summarize, validateTeam } from "./rules";
import type { Position, Team } from "./types";

export type SkillAccess = "primary" | "secondary";

/** CAS and SPP-eligible CAS are separate; miscellaneous counters never imply SPP. */
export interface PlayerMatchStats {
  td: number;
  cas: number;
  sppCas: number;
  com: number;
  int: number;
  mvp: number;
  fou: number;
  sof: number;
  superbThrows: number;
  safeLandings: number;
  inj: number;
  dth: number;
}

export function emptyPlayerStats(): PlayerMatchStats {
  return {
    td: 0,
    cas: 0,
    sppCas: 0,
    com: 0,
    int: 0,
    mvp: 0,
    fou: 0,
    sof: 0,
    superbThrows: 0,
    safeLandings: 0,
    inj: 0,
    dth: 0,
  };
}

export function validatePlayerStats(stats: PlayerMatchStats): void {
  for (const key of Object.keys(
    emptyPlayerStats(),
  ) as (keyof PlayerMatchStats)[]) {
    if (!Number.isSafeInteger(stats[key]) || stats[key] < 0)
      throw new Error(`Invalid player statistic: ${key}`);
  }
  if (stats.sppCas > stats.cas)
    throw new Error("SPP-eligible casualties cannot exceed total casualties");
}

export function calculateSpp(
  rosterId: string,
  stats: PlayerMatchStats,
): number {
  const roster = getRoster(rosterId);
  if (!roster) throw new Error("Unknown roster");
  validatePlayerStats(stats);
  const brutes = roster.specialRules.includes("Brawlin' Brutes");
  return (
    stats.com +
    stats.int * 2 +
    stats.sppCas * (brutes ? 3 : 2) +
    stats.td * (brutes ? 2 : 3) +
    stats.mvp * 4 +
    stats.superbThrows +
    stats.safeLandings
  );
}

// BB2025 League Play p97; independent of exhibition and World Cup skill budgets.
export const leagueAdvancementCosts = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [10, 12, 16, 20, 24, 34],
  randomPrimary: [3, 4, 6, 8, 10, 15],
  characteristic: [14, 16, 20, 24, 28, 38],
} as const;

/** Zero-based advancement index, preserving the order in which skills were gained. */
export function advancementCost(
  advancementIndex: number,
  access: SkillAccess,
  elite: boolean,
): number {
  if (
    !Number.isInteger(advancementIndex) ||
    advancementIndex < 0 ||
    advancementIndex > 5
  )
    throw new Error("A player can have at most six advancements");
  if (!["primary", "secondary"].includes(access) || typeof elite !== "boolean")
    throw new Error("Invalid advancement");
  // Elite changes current value only; tournament elite SPP taxes do not apply.
  return leagueAdvancementCosts[access][advancementIndex];
}

export function advancementValue(access: SkillAccess, elite: boolean): number {
  if (!["primary", "secondary"].includes(access) || typeof elite !== "boolean")
    throw new Error("Invalid advancement");
  return (access === "primary" ? 20000 : 40000) + (elite ? 10000 : 0);
}

export interface AdvancementChoice {
  skillId: string;
  access: SkillAccess;
  elite: boolean;
}

export function advancementChoices(
  rosterId: string,
  positionId: string,
  existingSkills: string[],
  advancementCount?: number,
): AdvancementChoice[] {
  const roster = getRoster(rosterId);
  const position = roster?.players.find((item) => item.id === positionId);
  if (!position) throw new Error("Unknown roster position");
  if (advancementCount !== undefined) {
    integerInRange(advancementCount, 0, 6, "advancement count");
    if (advancementCount === 6) return [];
  }
  const known = new Set(
    [...position.skills, ...existingSkills].map((id) => id.split(":")[0]),
  );
  return sortSkillIds(skills.map((skill) => skill.id)).flatMap((skillId) => {
    const access = skillAccess(position, skillId);
    const skill = getSkill(skillId)!;
    const incompatible =
      (skillId === "frenzy" &&
        ["grab", "hit_and_run", "multiple_block"].some((id) =>
          known.has(id),
        )) ||
      (["grab", "hit_and_run", "multiple_block"].includes(skillId) &&
        known.has("frenzy")) ||
      (skillId === "saboteur" && !known.has("secret_weapon")) ||
      (skillId === "lethal_flight" && !known.has("right_stuff")) ||
      (["bullseye", "strong_arm"].includes(skillId) &&
        !known.has("throw_team_mate")) ||
      (skillId === "leap" && known.has("pogo")) ||
      (skillId === "violent_innovator" &&
        ![
          "ball_and_chain",
          "bombardier",
          "breathe_fire",
          "chainsaw",
          "hypnotic_gaze",
          "kick_team_mate",
          "projectile_vomit",
          "stab",
        ].some((id) => known.has(id))) ||
      (known.has("ball_and_chain") &&
        [
          "diving_tackle",
          "eye_gouge",
          "frenzy",
          "grab",
          "hit_and_run",
          "leap",
          "multiple_block",
          "on_the_ball",
          "shadowing",
          "steady_footing",
        ].includes(skillId));
    return access &&
      skill.category !== "trait" &&
      !known.has(skillId) &&
      !incompatible
      ? [{ skillId, access, elite: skill.isElite }]
      : [];
  });
}

/** A league rookie must not import exhibition skills or permanent match inducements. */
export function rookieLeagueIssues(team: Team): string[] {
  const issues = validateTeam(team).issues.map((issue) => issue.code);
  if (team.rulesetId !== "bb2025-default") issues.push("leagueRuleset");
  if (team.players.some((player) => player.skills.length))
    issues.push("rookieSkills");
  if (team.stars.length) issues.push("rookieStars");
  if (Object.values(team.inducements).some((count) => count > 0))
    issues.push("rookieInducements");
  // The builder stores purchased increments; the initial free characteristic is 1.
  if (team.staff.dedicatedFans > 2) issues.push("rookieFans");
  return [...new Set(issues)];
}

export function startingTreasury(team: Team): number {
  if (rookieLeagueIssues(team).length)
    throw new Error("A legal rookie roster is required");
  return summarize(team).remaining;
}

export interface LeaguePlayerValueState {
  playerId: string;
  valueIncrease: number;
  status?: "active" | "missing-next-game" | "dead" | "retired";
}

/** Permanent Team Value includes injured roster members, but excludes departed players.
 * Dedicated Fans, treasury and match-only inducements are not part of this total.
 */
export function leagueTeamValue(
  team: Team,
  playerStates: ReadonlyArray<LeaguePlayerValueState>,
): number {
  const roster = getRoster(team.rosterId);
  if (!roster) throw new Error("Unknown roster");
  const states = new Map<string, LeaguePlayerValueState>();
  for (const state of playerStates) {
    if (states.has(state.playerId))
      throw new Error("Duplicate player value state");
    if (!Number.isSafeInteger(state.valueIncrease) || state.valueIncrease < 0)
      throw new Error("Invalid player value increase");
    states.set(state.playerId, state);
  }
  const playerValue = team.players.reduce((total, player) => {
    const position = roster.players.find(
      (item) => item.id === player.positionId,
    );
    if (!position) throw new Error("Unknown roster position");
    const state = states.get(player.id);
    if (state?.status === "dead" || state?.status === "retired") return total;
    return total + position.cost + (state?.valueIncrease ?? 0);
  }, 0);
  return (
    playerValue +
    team.staff.rerolls * roster.rerolls.cost +
    team.staff.apothecary * 50000 +
    (team.staff.assistantCoaches + team.staff.cheerleaders) * 10000
  );
}

/** CTV excludes unavailable players and discounts Low Cost Linemen base hiring fees. */
export function leagueCurrentTeamValue(
  team: Team,
  playerStates: ReadonlyArray<LeaguePlayerValueState>,
): number {
  const total = leagueTeamValue(team, playerStates);
  const roster = getRoster(team.rosterId)!;
  const states = new Map(playerStates.map((state) => [state.playerId, state]));
  return team.players.reduce((current, player) => {
    const position = roster.players.find(
      (item) => item.id === player.positionId,
    )!;
    const state = states.get(player.id);
    if (state?.status === "dead" || state?.status === "retired") return current;
    if (state?.status === "missing-next-game")
      return current - position.cost - (state.valueIncrease ?? 0);
    if (
      roster.specialRules.includes("Low Cost Linemen") &&
      position.position.includes("Lineman")
    )
      return current - position.cost;
    return current;
  }, total);
}

function integerInRange(value: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}`);
}

export function calculateWinnings(
  fanAttendance: number,
  touchdowns: number,
  stalled: boolean,
): number {
  integerInRange(fanAttendance, 4, 20, "fan attendance");
  integerInRange(touchdowns, 0, 99, "touchdowns");
  if (typeof stalled !== "boolean") throw new Error("Invalid stalling outcome");
  return (fanAttendance / 2 + touchdowns + (stalled ? 0 : 1)) * 10000;
}

export function updatedDedicatedFans(
  current: number,
  result: "win" | "draw" | "loss",
  roll?: number,
): number {
  integerInRange(current, 1, 7, "dedicated fans");
  if (result === "draw") return current;
  if (result !== "win" && result !== "loss")
    throw new Error("Invalid match result");
  integerInRange(roll!, 1, 6, "dedicated fans D6");
  if (result === "win" && roll! >= current) return Math.min(7, current + 1);
  if (result === "loss" && roll! < current) return Math.max(1, current - 1);
  return current;
}

export type ExpensiveMistakeKind =
  | "none"
  | "crisis-averted"
  | "minor-incident"
  | "major-incident"
  | "catastrophe";
export function expensiveMistake(
  treasury: number,
  roll?: number,
  minorRoll?: number,
  stashRolls?: [number, number],
): { kind: ExpensiveMistakeKind; treasury: number; lost: number } {
  integerInRange(treasury, 0, Number.MAX_SAFE_INTEGER, "treasury");
  if (treasury % 5000)
    throw new Error("Treasury must be a multiple of 5,000 GP");
  if (treasury < 100000) return { kind: "none", treasury, lost: 0 };
  integerInRange(roll!, 1, 6, "expensive mistakes D6");
  const columns: ExpensiveMistakeKind[][] = [
    [
      "minor-incident",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
    ],
    [
      "minor-incident",
      "minor-incident",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
    ],
    [
      "major-incident",
      "minor-incident",
      "minor-incident",
      "crisis-averted",
      "crisis-averted",
      "crisis-averted",
    ],
    [
      "major-incident",
      "major-incident",
      "minor-incident",
      "minor-incident",
      "crisis-averted",
      "crisis-averted",
    ],
    [
      "catastrophe",
      "major-incident",
      "major-incident",
      "minor-incident",
      "minor-incident",
      "crisis-averted",
    ],
    [
      "catastrophe",
      "catastrophe",
      "major-incident",
      "major-incident",
      "minor-incident",
      "minor-incident",
    ],
  ];
  const kind =
    columns[Math.min(5, Math.floor(treasury / 100000) - 1)][roll! - 1];
  let remaining = treasury;
  if (kind === "minor-incident") {
    integerInRange(minorRoll!, 1, 3, "minor incident D3");
    remaining -= minorRoll! * 10000;
  } else if (kind === "major-incident")
    remaining = Math.floor(treasury / 2 / 5000) * 5000;
  else if (kind === "catastrophe") {
    if (!stashRolls) throw new Error("Catastrophe requires two stash D6 rolls");
    integerInRange(stashRolls[0], 1, 6, "stash first D6");
    integerInRange(stashRolls[1], 1, 6, "stash second D6");
    remaining = (stashRolls[0] + stashRolls[1]) * 10000;
  }
  return { kind, treasury: remaining, lost: treasury - remaining };
}

export type Characteristic = "ma" | "st" | "ag" | "pa" | "av";
export type LeaguePlayerProfile = Pick<Position, Characteristic>;

/** Injuries worsen AG/PA target numbers, but lower MA/ST/AV. A blocked
 * reduction has no permanent effect; its casualty still causes MNG.
 */
export function applyCharacteristicReductions(
  profile: LeaguePlayerProfile,
  reductions: Partial<Record<Characteristic, number>>,
): LeaguePlayerProfile {
  for (const [key, count] of Object.entries(reductions)) {
    if (!["ma", "st", "ag", "pa", "av"].includes(key))
      throw new Error("Unknown characteristic");
    integerInRange(
      count!,
      0,
      Number.MAX_SAFE_INTEGER,
      "characteristic reductions",
    );
  }
  integerInRange(profile.ma, 1, 9, "MA");
  integerInRange(profile.st, 1, 8, "ST");
  const target = (value: string, min: number, max: number, name: string) => {
    if (!/^\d+\+$/.test(value)) throw new Error(`Invalid ${name}`);
    const number = Number.parseInt(value, 10);
    integerInRange(number, min, max, name);
    return number;
  };
  const ag = target(profile.ag, 1, 6, "AG");
  const av = target(profile.av, 3, 11, "AV");
  const pa = profile.pa === "-" ? null : target(profile.pa, 1, 6, "PA");
  return {
    ma: Math.max(1, profile.ma - (reductions.ma ?? 0)),
    st: Math.max(1, profile.st - (reductions.st ?? 0)),
    ag: `${Math.min(6, ag + (reductions.ag ?? 0))}+`,
    pa: pa === null ? "-" : `${Math.min(6, pa + (reductions.pa ?? 0))}+`,
    av: `${Math.max(3, av - (reductions.av ?? 0))}+`,
  };
}

export type CasualtyResult =
  | "badly-hurt"
  | "seriously-hurt"
  | "serious-injury"
  | "lasting-injury"
  | "dead";
export interface CasualtyOutcome {
  result: CasualtyResult;
  missNextGame: boolean;
  nigglingInjuries: number;
  dead: boolean;
  characteristicReduction?: Characteristic;
}

export function lastingInjury(roll: number): Characteristic {
  integerInRange(roll, 1, 6, "lasting injury D6");
  return (["av", "av", "ma", "pa", "ag", "st"] as const)[roll - 1];
}

/** Accepts the final modified casualty roll; recovery is resolved by the coaches first. */
export function casualtyOutcome(
  modifiedRoll: number,
  lastingRoll?: number,
): CasualtyOutcome {
  integerInRange(modifiedRoll, 1, 99, "modified casualty D16");
  const result: CasualtyResult =
    modifiedRoll <= 8
      ? "badly-hurt"
      : modifiedRoll <= 10
        ? "seriously-hurt"
        : modifiedRoll <= 12
          ? "serious-injury"
          : modifiedRoll <= 14
            ? "lasting-injury"
            : "dead";
  return {
    result,
    missNextGame: result !== "badly-hurt" && result !== "dead",
    nigglingInjuries: result === "serious-injury" ? 1 : 0,
    dead: result === "dead",
    ...(result === "lasting-injury"
      ? { characteristicReduction: lastingInjury(lastingRoll!) }
      : {}),
  };
}

export interface RoundRobinPairing {
  home: string;
  away: string | null;
}

/** A single round-robin; each odd-sized entry list has one bye per round. */
export function roundRobin(entryIds: string[]): RoundRobinPairing[][] {
  if (new Set(entryIds).size !== entryIds.length || entryIds.some((id) => !id))
    throw new Error("Round-robin entries must be unique nonempty identifiers");
  if (entryIds.length < 2) return [];
  const ring: (string | null)[] = [...entryIds];
  if (ring.length % 2) ring.push(null);
  const rounds: RoundRobinPairing[][] = [];
  for (let round = 0; round < ring.length - 1; round++) {
    const pairings: RoundRobinPairing[] = [];
    for (let index = 0; index < ring.length / 2; index++) {
      const first = ring[index];
      const second = ring[ring.length - 1 - index];
      if (first === null || second === null)
        pairings.push({ home: first ?? second!, away: null });
      else
        pairings.push(
          round % 2
            ? { home: second, away: first }
            : { home: first, away: second },
        );
    }
    rounds.push(pairings);
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}
