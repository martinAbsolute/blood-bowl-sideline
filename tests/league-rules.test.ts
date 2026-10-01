import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRoster, getSkill, newTeam } from "../src/domain/catalog";
import {
  advancementChoices,
  advancementCost,
  advancementValue,
  applyCharacteristicReductions,
  calculateSpp,
  calculateWinnings,
  casualtyOutcome,
  emptyPlayerStats,
  expensiveMistake,
  lastingInjury,
  leagueCurrentTeamValue,
  leagueTeamValue,
  rookieLeagueIssues,
  roundRobin,
  startingTreasury,
  updatedDedicatedFans,
  validatePlayerStats,
} from "../src/domain/league-rules";

function rookie(rosterId = "human") {
  const team = newTeam(randomUUID(), rosterId);
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: getRoster(rosterId)!.players[0].id,
    name: "",
    skills: [],
  }));
  if (getRoster(rosterId)!.specialRules.includes("Team Captain"))
    team.captainId = team.players[0].id;
  return team;
}

describe("BB2025 earned league SPP", () => {
  it("awards only eligible events, including both distinct throwing outcomes", () => {
    const stats = {
      ...emptyPlayerStats(),
      td: 2,
      cas: 5,
      sppCas: 1,
      com: 1,
      int: 1,
      mvp: 1,
      superbThrows: 1,
      safeLandings: 2,
      fou: 7,
      sof: 3,
      inj: 2,
      dth: 1,
    };
    expect(calculateSpp("human", stats)).toBe(18);
    expect(calculateSpp("black-orc", stats)).toBe(17);
    expect(calculateSpp("human", { ...emptyPlayerStats(), cas: 4 })).toBe(0);
  });

  it("rejects negative, fractional, missing, and inconsistent counters", () => {
    expect(() =>
      validatePlayerStats({ ...emptyPlayerStats(), com: -1 }),
    ).toThrow();
    expect(() =>
      validatePlayerStats({ ...emptyPlayerStats(), td: 0.5 }),
    ).toThrow();
    expect(() =>
      validatePlayerStats({ ...emptyPlayerStats(), sppCas: 1 }),
    ).toThrow();
    expect(() => calculateSpp("unknown", emptyPlayerStats())).toThrow(
      "Unknown roster",
    );
    const first = emptyPlayerStats();
    first.com = 3;
    expect(emptyPlayerStats().com).toBe(0);
  });
});

describe("league advancement and rookie enrollment", () => {
  it("uses the six league cost levels without tournament elite SPP surcharges", () => {
    expect(
      Array.from({ length: 6 }, (_, index) =>
        advancementCost(index, "primary", false),
      ),
    ).toEqual([6, 8, 12, 16, 20, 30]);
    expect(
      Array.from({ length: 6 }, (_, index) =>
        advancementCost(index, "secondary", true),
      ),
    ).toEqual([10, 12, 16, 20, 24, 34]);
    expect(advancementCost(0, "primary", true)).toBe(6);
    expect(advancementValue("primary", true)).toBe(30000);
    expect(advancementValue("secondary", false)).toBe(40000);
    expect(advancementValue("secondary", true)).toBe(50000);
    expect(() => advancementCost(6, "primary", false)).toThrow();
  });

  it("excludes built-in skills, duplicates, traits and incompatible skill combinations", () => {
    const position = getRoster("human")!.players[0];
    const choices = advancementChoices("human", position.id, [
      "block",
      "multiple_block",
    ]);
    expect(choices.some((choice) => choice.skillId === "block")).toBe(false);
    expect(choices.some((choice) => choice.skillId === "frenzy")).toBe(false);
    expect(
      choices.every((choice) => getSkill(choice.skillId)!.category !== "trait"),
    ).toBe(true);
    expect(advancementChoices("human", position.id, [], 6)).toEqual([]);
    expect(
      advancementChoices("human", position.id, ["pro", "block"], 1).length,
    ).toBeGreaterThan(0);
    expect(() => advancementChoices("human", "unknown", [])).toThrow();
  });

  it("accepts real rookies and rejects exhibition additions and excess initial fans", () => {
    const team = rookie();
    team.staff.rerolls = 2;
    team.staff.dedicatedFans = 2;
    expect(rookieLeagueIssues(team)).toEqual([]);
    const roster = getRoster("human")!;
    expect(startingTreasury(team)).toBe(
      1000000 - 11 * roster.players[0].cost - 2 * roster.rerolls.cost - 10000,
    );
    team.players[0].skills = ["block"];
    team.stars = ["griff-oberwald"];
    team.inducements = { bribes: 1 };
    team.staff.dedicatedFans = 3;
    expect(rookieLeagueIssues(team)).toEqual(
      expect.arrayContaining([
        "rookieSkills",
        "rookieStars",
        "rookieInducements",
        "rookieFans",
      ]),
    );
    expect(() => startingTreasury(team)).toThrow();
  });

  it("enforces skill trait prerequisites and Ball & Chain incompatibilities", () => {
    const human = getRoster("human")!.players[0];
    const choices = advancementChoices("human", human.id, []);
    expect(
      choices.some((choice) =>
        [
          "bullseye",
          "strong_arm",
          "lethal_flight",
          "saboteur",
          "violent_innovator",
        ].includes(choice.skillId),
      ),
    ).toBe(false);
    const fanatic = getRoster("goblin")!.players.find((player) =>
      player.skills.includes("ball_and_chain"),
    )!;
    const fanaticChoices = advancementChoices("goblin", fanatic.id, []);
    expect(
      fanaticChoices.some((choice) =>
        ["frenzy", "multiple_block", "grab", "eye_gouge"].includes(
          choice.skillId,
        ),
      ),
    ).toBe(false);
    expect(fanaticChoices.some((choice) => choice.skillId === "saboteur")).toBe(
      true,
    );
    expect(
      fanaticChoices.some((choice) => choice.skillId === "violent_innovator"),
    ).toBe(true);
    const pogo = getRoster("goblin")!.players.find((player) =>
      player.skills.includes("pogo"),
    )!;
    expect(
      advancementChoices("goblin", pogo.id, []).some(
        (choice) => choice.skillId === "leap",
      ),
    ).toBe(false);
  });
});

describe("permanent TV and available CTV", () => {
  it("keeps MNG players in TV, omits them from CTV, and excludes fans and inducements", () => {
    const team = rookie();
    const base = getRoster("human")!.players[0].cost;
    team.staff.dedicatedFans = 2;
    team.inducements = { bribes: 1 };
    const states = [
      {
        playerId: team.players[0].id,
        valueIncrease: 30000,
        status: "missing-next-game" as const,
      },
      {
        playerId: team.players[1].id,
        valueIncrease: 20000,
        status: "dead" as const,
      },
    ];
    expect(leagueTeamValue(team, states)).toBe(10 * base + 30000);
    expect(leagueCurrentTeamValue(team, states)).toBe(9 * base);
    expect(() => leagueTeamValue(team, [states[0], states[0]])).toThrow();
  });

  it("applies Low Cost Linemen only to CTV while retaining advancement value", () => {
    const team = rookie("snotling");
    const states = [{ playerId: team.players[0].id, valueIncrease: 30000 }];
    expect(leagueTeamValue(team, states)).toBeGreaterThan(30000);
    expect(leagueCurrentTeamValue(team, states)).toBe(30000);
  });
});

describe("BB2025 post-game rules", () => {
  it("applies reductions in the correct direction and respects minima and absent PA", () => {
    const profile = { ma: 6, st: 3, ag: "3+", pa: "4+", av: "9+" };
    expect(
      applyCharacteristicReductions(profile, {
        ma: 1,
        st: 1,
        ag: 1,
        pa: 1,
        av: 1,
      }),
    ).toEqual({ ma: 5, st: 2, ag: "4+", pa: "5+", av: "8+" });
    expect(
      applyCharacteristicReductions(profile, {
        ma: 9,
        st: 9,
        ag: 9,
        pa: 9,
        av: 9,
      }),
    ).toEqual({ ma: 1, st: 1, ag: "6+", pa: "6+", av: "3+" });
    expect(
      applyCharacteristicReductions({ ...profile, pa: "-" }, { pa: 1 }).pa,
    ).toBe("-");
    expect(profile.ma).toBe(6);
    expect(() => applyCharacteristicReductions(profile, { st: -1 })).toThrow();
    expect(() =>
      applyCharacteristicReductions({ ...profile, ag: "7+" }, {}),
    ).toThrow();
  });

  it("allows half attendance to produce 5,000 GP increments", () => {
    expect(calculateWinnings(7, 2, false)).toBe(65000);
    expect(calculateWinnings(7, 2, true)).toBe(55000);
    expect(() => calculateWinnings(0, 2, false)).toThrow();
  });

  it("changes fans using the correct roll comparison and bounded characteristic", () => {
    expect(updatedDedicatedFans(3, "win", 3)).toBe(4);
    expect(updatedDedicatedFans(3, "loss", 3)).toBe(3);
    expect(updatedDedicatedFans(3, "loss", 2)).toBe(2);
    expect(updatedDedicatedFans(7, "win", 6)).toBe(7);
    expect(updatedDedicatedFans(1, "loss", 1)).toBe(1);
    expect(updatedDedicatedFans(4, "draw")).toBe(4);
    expect(() => updatedDedicatedFans(3, "win")).toThrow();
  });

  it("handles expensive-mistake thresholds, half rounding, D3 loss and emergency stash", () => {
    expect(expensiveMistake(95000)).toEqual({
      kind: "none",
      treasury: 95000,
      lost: 0,
    });
    expect(expensiveMistake(100000, 2).kind).toBe("crisis-averted");
    expect(expensiveMistake(200000, 2, 3)).toEqual({
      kind: "minor-incident",
      treasury: 170000,
      lost: 30000,
    });
    expect(expensiveMistake(315000, 1)).toEqual({
      kind: "major-incident",
      treasury: 155000,
      lost: 160000,
    });
    expect(expensiveMistake(500000, 1, undefined, [2, 4])).toEqual({
      kind: "catastrophe",
      treasury: 60000,
      lost: 440000,
    });
    expect(expensiveMistake(600000, 6, 1).kind).toBe("minor-incident");
    expect(() => expensiveMistake(500000, 1)).toThrow();
  });

  it("maps lasting injuries and separates temporary, niggling, permanent and fatal outcomes", () => {
    expect(
      Array.from({ length: 6 }, (_, index) => lastingInjury(index + 1)),
    ).toEqual(["av", "av", "ma", "pa", "ag", "st"]);
    expect(casualtyOutcome(8)).toMatchObject({
      result: "badly-hurt",
      missNextGame: false,
      nigglingInjuries: 0,
    });
    expect(casualtyOutcome(9)).toMatchObject({
      result: "seriously-hurt",
      missNextGame: true,
    });
    expect(casualtyOutcome(12)).toMatchObject({
      result: "serious-injury",
      nigglingInjuries: 1,
    });
    expect(casualtyOutcome(13, 5)).toMatchObject({
      result: "lasting-injury",
      characteristicReduction: "ag",
      missNextGame: true,
    });
    expect(casualtyOutcome(17)).toMatchObject({ result: "dead", dead: true });
    expect(() => casualtyOutcome(14)).toThrow();
  });
});

describe("single round-robin fixtures", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9])(
    "pairs every opponent exactly once for %i entries and distributes byes evenly",
    (count) => {
      const entries = Array.from({ length: count }, (_, index) =>
        String(index + 1),
      );
      const rounds = roundRobin(entries);
      expect(rounds).toHaveLength(count % 2 ? count : count - 1);
      const opponents = new Set<string>();
      const byes = new Map<string, number>();
      for (const round of rounds) {
        const participants: string[] = [];
        for (const pair of round) {
          participants.push(pair.home);
          if (pair.away) {
            participants.push(pair.away);
            const key = [pair.home, pair.away].sort().join(":");
            expect(opponents.has(key)).toBe(false);
            opponents.add(key);
          } else byes.set(pair.home, (byes.get(pair.home) ?? 0) + 1);
        }
        expect(new Set(participants).size).toBe(count);
      }
      expect(opponents.size).toBe((count * (count - 1)) / 2);
      if (count % 2)
        for (const entry of entries) expect(byes.get(entry)).toBe(1);
      expect(entries).toEqual(
        Array.from({ length: count }, (_, index) => String(index + 1)),
      );
    },
  );

  it("rejects duplicate identifiers and produces no fixture for fewer than two teams", () => {
    expect(() => roundRobin(["a", "a"])).toThrow();
    expect(roundRobin(["a"])).toEqual([]);
    expect(roundRobin([])).toEqual([]);
  });
});
