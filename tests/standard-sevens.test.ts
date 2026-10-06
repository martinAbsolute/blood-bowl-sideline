import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRoster, getRuleset, newTeam, stars } from "../src/domain/catalog";
import {
  budgetFor,
  dedicatedFansBase,
  isLineman,
  staffInfo,
  starEligible,
  tierFor,
  validateTeam,
} from "../src/domain/rules";
import type { Team } from "../src/domain/types";

function draft(rosterId = "human"): Team {
  const team = newTeam(randomUUID(), rosterId);
  team.rulesetId = "bb2025-sevens";
  team.players = Array.from({ length: 7 }, () => ({
    id: randomUUID(),
    positionId: getRoster(rosterId)!.players.find(isLineman)!.id,
    name: "",
    skills: [],
  }));
  team.veteranId = team.players[0].id;
  if (getRoster(rosterId)!.specialRules.includes("Team Captain"))
    team.captainId = team.players[0].id;
  return team;
}
const codes = (team: Team) => validateTeam(team).issues.map((i) => i.code);
describe("Blood Bowl Sevens 2025 matched play", () => {
  it("uses its distinct tiers, 600k treasury and one SP per tier", () => {
    for (const [tier, ids] of Object.entries(
      getRuleset("bb2025-sevens").tiers,
    )) {
      for (const id of ids) {
        const team = draft(id);
        expect(tierFor(team)).toBe(Number(tier));
        expect(budgetFor(team)).toMatchObject({
          teamBudget: 600000,
          skillGold: Number(tier),
        });
      }
    }
    expect(tierFor(draft("human"))).toBe(1);
    expect(tierFor(draft("halfling"))).toBe(3);
    expect(codes(draft("slann"))).toContain("unsupportedRoster");
  });
  it("allows a captain primary, Leader and Pro but charges secondary skills two SP", () => {
    const team = draft();
    team.players[0].skills = ["block"];
    expect(codes(team)).toEqual([]);
    team.players[1].positionId = getRoster("human")!.players.find((p) =>
      p.primarySkills.includes("P"),
    )!.id;
    team.players[0].skills = [];
    team.players[1].skills = ["leader"];
    expect(codes(team)).toEqual([]);
    team.players[1].skills = [];
    team.players[2].skills = ["pro"];
    expect(codes(team)).toEqual([]);
    team.players[2].skills = ["dodge"];
    expect(codes(team)).toContain("skillBudget");
  });
  it("caps elite skills, secondary purchases and stacking independently", () => {
    const team = draft("orc");
    team.players[1].skills = ["dodge"];
    team.players[2].skills = ["dodge"];
    expect(codes(team)).toContain("secondaryLimit");
    team.players[1].skills = ["block", "wrestle"];
    expect(codes(team)).toContain("maxSkills");
    expect(getRuleset(team.rulesetId).maxElitePerTeam).toBe(2);
  });
  it("starts with zero fans, allows five purchases, shares Sevens prices and excludes stars", () => {
    const team = draft("halfling");
    expect(dedicatedFansBase(team)).toBe(0);
    expect(staffInfo(team)).toMatchObject({
      rerolls: { cost: 100000 },
      apothecary: { cost: 80000 },
      dedicatedFans: { cost: 20000, max: 5 },
    });
    team.staff.dedicatedFans = 5;
    expect(codes(team)).not.toContain("sevensFans");
    expect(stars.some((star) => starEligible(team, star))).toBe(false);
    team.rulesetId = "kyiv-seven-sins-sevens";
    expect(dedicatedFansBase(team)).toBe(1);
    expect(codes(team)).toContain("sevensFans");
  });
});
