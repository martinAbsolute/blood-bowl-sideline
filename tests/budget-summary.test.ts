import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRoster, newTeam, rosters, rulesets } from "../src/domain/catalog";
import { budgetSummary } from "../src/domain/budget";
import { budgetFor } from "../src/domain/rules";

function teamWithSkills(rulesetId: ReturnType<typeof newTeam>["rulesetId"]) {
  const team = { ...newTeam(randomUUID()), rulesetId };
  team.players = [
    {
      id: randomUUID(),
      positionId: getRoster("human")!.players[0].id,
      name: "",
      skills: ["block", "dodge"],
    },
  ];
  return team;
}

describe("ruleset-aware budget presentation", () => {
  it.each([
    ["bb2025-default", ["GP"]],
    ["bb2025-matched-play", ["GP", "SP"]],
    ["eurobowl-2026", ["GP", "GP", "GP"]],
    ["world-cup-2027", ["GP", "SPP"]],
  ] as const)("uses the correct allowances for %s", (id, units) => {
    const result = budgetSummary(teamWithSkills(id));
    expect(result.pools.map((pool) => pool.unit)).toEqual(units);
    expect(result.counts).toEqual({ primary: 1, secondary: 1 });
    expect(result.pools[0].used).toBe(
      id === "bb2025-default"
        ? result.totals.players + result.totals.skills
        : result.totals.players,
    );
  });

  it("updates every allowance for every roster and ruleset tier", () => {
    for (const roster of rosters)
      for (const rules of rulesets) {
        const team = {
          ...newTeam(randomUUID(), roster.id),
          rulesetId: rules.id,
        };
        const budget = budgetFor(team);
        const result = budgetSummary(team);
        expect(result.pools[0].limit).toBe(budget.teamBudget);
        if (rules.id !== "bb2025-default")
          expect(result.pools[1].limit).toBe(budget.skillGold);
        if (rules.id === "eurobowl-2026")
          expect(result.pools[2].limit).toBe(budget.flowingFunds);
        expect(result.issues).toEqual([]);
      }
  });

  it("allows EuroBowl base overspend covered by Flowing Funds, and flags only the exceeded shared reserve", () => {
    const team = teamWithSkills("eurobowl-2026");
    team.players = Array.from({ length: 16 }, () => ({
      ...team.players[0],
      id: randomUUID(),
      skills: [],
    }));
    team.staff = {
      ...team.staff,
      rerolls: 4,
      apothecary: 1,
      assistantCoaches: 4,
    };
    const covered = budgetSummary(team);
    expect(covered.pools[0].used).toBe(1090000);
    expect(covered.pools[0].limit).toBe(1080000);
    expect(covered.pools[2].used).toBe(10000);
    expect(covered.issues).toEqual([]);
    team.staff.assistantCoaches = 6;
    team.staff.cheerleaders = 2;
    const exceeded = budgetSummary(team);
    expect(exceeded.issues.map((pool) => pool.id)).toEqual(["funds"]);
    expect(exceeded.pools[2].used - exceeded.pools[2].limit).toBe(20000);
  });

  it("counts both EuroBowl overspends without borrowing unused base allowances", () => {
    const team = teamWithSkills("eurobowl-2026");
    team.players = Array.from({ length: 16 }, () => ({
      ...team.players[0],
      id: randomUUID(),
      skills: ["block"],
    }));
    team.staff = {
      ...team.staff,
      rerolls: 4,
      apothecary: 1,
      assistantCoaches: 4,
    };
    const result = budgetSummary(team);
    expect(result.pools[2].used).toBe(
      10000 + result.pools[1].used - result.pools[1].limit,
    );
    expect(result.issues.map((pool) => pool.id)).toEqual(["funds"]);
  });

  it.each(["bb2025-matched-play", "world-cup-2027"] as const)(
    "includes star skill charges and exposes skill overspend for %s",
    (id) => {
      const team = teamWithSkills(id);
      team.stars = ["grak", "crumbleberry"];
      team.players = Array.from({ length: 16 }, () => ({
        ...team.players[0],
        id: randomUUID(),
      }));
      const result = budgetSummary(team);
      expect(result.totals.starTax).toBeGreaterThan(0);
      expect(result.pools[1].used).toBe(result.totals.skills);
      expect(result.issues.some((pool) => pool.id === "skills")).toBe(true);
    },
  );
});
