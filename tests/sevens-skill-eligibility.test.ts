import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRoster, newTeam } from "../src/domain/catalog";
import { isLineman, validateTeam } from "../src/domain/rules";
import { skillCompatible } from "../src/domain/skill-eligibility";
import type { RulesetId } from "../src/domain/types";

function draft(rosterId: string, rulesetId: RulesetId = "bb2025-sevens") {
  const team = newTeam(randomUUID(), rosterId);
  const roster = getRoster(rosterId)!;
  team.rulesetId = rulesetId;
  team.players = Array.from(
    { length: rulesetId === "bb2025-default" ? 11 : 7 },
    () => ({
      id: randomUUID(),
      positionId: roster.players.find(isLineman)!.id,
      name: "",
      skills: [] as string[],
    }),
  );
  if (rulesetId !== "bb2025-default") team.veteranId = team.players[0].id;
  if (roster.specialRules.includes("Team Captain"))
    team.captainId = team.players[0].id;
  return team;
}

describe("skill prerequisites and incompatible combinations in drafts", () => {
  it.each([
    "bb2025-sevens",
    "kyiv-seven-sins-sevens",
    "bb2025-default",
  ] as const)(
    "rejects a strength skill without its required trait under %s",
    (rulesetId) => {
      const team = draft("chaos-chosen", rulesetId);
      team.players[1].skills = ["bullseye"];
      expect(validateTeam(team).issues).toContainEqual({
        code: "skillCompatibility",
        values: {
          player: getRoster("chaos-chosen")!.players.find(isLineman)!.position,
          skill: "Bullseye",
        },
      });
    },
  );

  it("rejects conflicts with a starting skill even when only one advancement was bought", () => {
    const team = draft("khorne");
    team.players[1].skills = ["grab"];
    const codes = validateTeam(team).issues.map((issue) => issue.code);
    expect(codes).toContain("skillCompatibility");
    expect(codes).not.toContain("maxSkills");
    expect(codes).not.toContain("skillBudget");
  });

  it("checks conflicts between additions regardless of their saved order", () => {
    const team = draft("human", "bb2025-default");
    for (const pair of [
      ["frenzy", "grab"],
      ["grab", "frenzy"],
    ]) {
      team.players[1].skills = pair;
      expect(
        validateTeam(team).issues.filter(
          (issue) => issue.code === "skillCompatibility",
        ),
      ).toHaveLength(2);
    }
  });

  it("allows Bullseye on an actual thrower of team-mates", () => {
    const team = draft("ogre");
    team.players[1].positionId = getRoster("ogre")!.players.find((p) =>
      p.skills.includes("throw_team_mate"),
    )!.id;
    team.players[1].skills = ["bullseye"];
    expect(validateTeam(team).issues).toEqual([]);
  });

  it.each([
    ["saboteur", "secret_weapon"],
    ["lethal_flight", "right_stuff"],
    ["bullseye", "throw_team_mate"],
    ["strong_arm", "throw_team_mate"],
    ["violent_innovator", "bombardier"],
  ])("requires the appropriate trait for %s", (skill, trait) => {
    expect(skillCompatible(skill, ["block"])).toBe(false);
    expect(skillCompatible(skill, [trait])).toBe(true);
  });

  it.each(["grab", "hit_and_run", "multiple_block"])(
    "makes Frenzy and %s mutually exclusive",
    (skill) => {
      expect(skillCompatible(skill, ["frenzy"])).toBe(false);
      expect(skillCompatible("frenzy", [skill])).toBe(false);
    },
  );

  it("enforces Pogo and Ball & Chain restrictions without banning Pro and Leader", () => {
    expect(skillCompatible("leap", ["pogo"])).toBe(false);
    expect(skillCompatible("steady_footing", ["ball_and_chain"])).toBe(false);
    expect(skillCompatible("violent_innovator", ["ball_and_chain"])).toBe(true);
    expect(skillCompatible("pro", ["leader"])).toBe(true);
    expect(skillCompatible("leader", ["pro"])).toBe(true);
  });
});
