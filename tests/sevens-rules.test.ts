import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getRoster,
  inducements,
  newTeam,
  rosters,
  skills,
  stars,
} from "../src/domain/catalog";
import {
  budgetFor,
  inducementInfo,
  isLineman,
  playerMovement,
  skillAccess,
  staffInfo,
  starEligible,
  summarize,
  tierFor,
  validateTeam,
} from "../src/domain/rules";
import type { Position, Team } from "../src/domain/types";

const preset = "kyiv-seven-sins-sevens" as const;
const tiers = [
  [
    "amazon",
    "dark-elf",
    "high-elf",
    "lizardmen",
    "norse",
    "old-world-alliance",
    "skaven",
    "slann",
    "underworld-denizens",
    "wood-elf",
    "vampire",
  ],
  [
    "bretonnian",
    "elven-union",
    "human",
    "imperial-nobility",
    "necromantic-horror",
    "orc",
    "shambling-undead",
    "tomb-kings",
  ],
  [
    "black-orc",
    "chaos-chosen",
    "chaos-dwarf",
    "chaos-renegade",
    "dwarf",
    "khorne",
    "nurgle",
  ],
  ["gnome", "goblin", "halfling", "ogre", "snotling"],
];
function team(rosterId = "human", count = 7): Team {
  const result = newTeam(randomUUID(), rosterId);
  result.rulesetId = preset;
  const roster = getRoster(rosterId)!;
  const lineman = roster.players.find(isLineman)!;
  result.players = Array.from({ length: count }, () => ({
    id: randomUUID(),
    positionId: lineman.id,
    name: "",
    skills: [],
  }));
  result.veteranId = result.players[0]?.id;
  if (roster.specialRules.includes("Team Captain"))
    result.captainId = result.players[0]?.id;
  return result;
}
const codes = (value: Team) =>
  validateTeam(value).issues.map(({ code }) => code);
function advancement(position: Position, access: "primary" | "secondary") {
  return skills.find(
    (skill) =>
      skill.id !== "leader" &&
      skill.id !== "pro" &&
      skillAccess(position, skill.id) === access &&
      !position.skills.includes(skill.id),
  )!.id;
}

describe("Kyiv Seven Sins Sevens", () => {
  it("assigns every roster its organiser tier, 650k budget, and 0/1/2/3 skills", () => {
    expect(tiers.flat().toSorted()).toEqual(
      rosters.map(({ id }) => id).toSorted(),
    );
    tiers.forEach((ids, index) =>
      ids.forEach((id) => {
        const value = team(id);
        expect(tierFor(value), id).toBe(index + 1);
        expect(budgetFor(value)).toEqual({
          teamBudget: 650000,
          skillGold: index,
          flowingFunds: 0,
        });
      }),
    );
  });

  it("accepts 7 and 11 players and rejects both roster-size boundaries", () => {
    expect(validateTeam(team()).valid).toBe(true);
    expect(validateTeam(team("human", 11)).valid).toBe(true);
    expect(codes(team("human", 6))).toContain("minPlayers");
    expect(codes(team("human", 12))).toContain("maxPlayers");
  });

  it("allows four specialists while preserving individual position caps", () => {
    const value = team();
    const specialists = getRoster("human")!.players.filter(
      (position) => !isLineman(position),
    );
    const choices = specialists.flatMap((position) =>
      Array.from(
        { length: Number(position.qty.split("-")[1]) },
        () => position,
      ),
    );
    choices.slice(0, 4).forEach((position, index) => {
      value.players[index + 1].positionId = position.id;
    });
    expect(codes(value)).not.toContain("specialists");
    value.players[5].positionId = choices[4].id;
    expect(codes(value)).toContain("specialists");
    const limited = specialists.find((position) => position.qty === "0-2")!;
    value.players.slice(1, 4).forEach((player) => {
      player.positionId = limited.id;
    });
    expect(codes(value)).toContain("positionLimit");
  });

  it("requires one existing Lineman Veteran, reduces only their MA, and charges no gold", () => {
    const value = team();
    const position = getRoster("human")!.players.find(
      (position) => position.id === value.players[0].positionId,
    )!;
    const gold = summarize(value).teamGold;
    expect(playerMovement(value, value.players[0].id, position)).toBe(
      position.ma - 1,
    );
    expect(playerMovement(value, value.players[1].id, position)).toBe(
      position.ma,
    );
    delete value.veteranId;
    expect(codes(value)).toContain("veteran");
    expect(summarize(value).teamGold).toBe(gold);
    value.veteranId = randomUUID();
    expect(codes(value)).toContain("veteran");
    value.veteranId = value.players[1].id;
    value.players[1].positionId = getRoster("human")!.players.find(
      (position) => !isLineman(position),
    )!.id;
    expect(codes(value)).toContain("veteran");
  });

  it("allows Captain and Veteran on the same player but blocks tier-2 captain advancements", () => {
    const value = team();
    expect(value.captainId).toBe(value.veteranId);
    expect(validateTeam(value).valid).toBe(true);
    value.players[0].skills = ["block"];
    expect(codes(value)).toContain("captainSkills");
    value.players[0].skills = [];
    value.players[1].skills = ["block"];
    expect(validateTeam(value).valid).toBe(true);
  });

  it.each(["amazon", "human", "chaos-chosen", "halfling"])(
    "caps total skills and supports secondary-to-primary replacement for %s",
    (id) => {
      const value = team(id);
      const position = getRoster(id)!.players.find(
        (position) => position.id === value.players[1].positionId,
      )!;
      const allowance = tierFor(value) - 1;
      for (let index = 1; index <= allowance; index++)
        value.players[index].skills = [advancement(position, "primary")];
      expect(codes(value)).not.toContain("skillBudget");
      expect(summarize(value).skills).toBe(allowance);
      if (allowance >= 2) {
        value.players[allowance].skills = [advancement(position, "secondary")];
        expect(codes(value)).not.toContain("secondaryLimit");
        expect(summarize(value).skills).toBe(allowance);
        value.players[1].skills = [advancement(position, "secondary")];
        expect(codes(value)).toContain("secondaryLimit");
      } else {
        value.players[1].skills = [advancement(position, "secondary")];
        expect(codes(value)).toContain("secondaryLimit");
      }
      value.players[allowance + 1].skills = [advancement(position, "primary")];
      expect(codes(value)).toContain("skillBudget");
    },
  );

  it("rejects Leader, stacked skills, and every star", () => {
    const value = team();
    value.players[1].skills = ["leader"];
    expect(codes(value)).toContain("leaderBanned");
    value.players[1].skills = ["block", "tackle"];
    expect(codes(value)).toContain("maxSkills");
    expect(codes(value)).toContain("stackLimit");
    expect(stars.every((star) => !starEligible(value, star))).toBe(true);
    value.stars = [stars[0].id];
    expect(codes(value)).toContain("starEligibility");
  });

  it("ignores Insignificant during Sevens drafting", () => {
    const value = team("underworld-denizens");
    const insignificant = getRoster(value.rosterId)!.players.find((position) =>
      position.skills.includes("insignificant"),
    )!;
    value.players.slice(0, 4).forEach((player) => {
      player.positionId = insignificant.id;
    });
    expect(codes(value)).not.toContain("insignificant");
    delete value.veteranId;
    value.rulesetId = "bb2025-default";
    expect(codes(value)).toContain("insignificant");
  });

  it("uses Sevens staff prices and limits and enforces 650k", () => {
    const value = team();
    expect(staffInfo(value)).toMatchObject({
      rerolls: { cost: 100000 },
      apothecary: { cost: 80000, max: 1 },
      assistantCoaches: { cost: 20000, max: 3 },
      cheerleaders: { cost: 20000, max: 3 },
      dedicatedFans: { cost: 20000, max: 4 },
    });
    for (const roster of rosters)
      expect(staffInfo(team(roster.id)).rerolls.cost).toBe(100000);
    value.staff = {
      rerolls: 2,
      apothecary: 1,
      assistantCoaches: 1,
      cheerleaders: 1,
      dedicatedFans: 0,
    };
    expect(summarize(value).staff).toBe(320000);
    expect(codes(value)).toContain("budget");
    value.staff.assistantCoaches = 4;
    expect(codes(value)).toContain("sevensStaff");
    value.staff.assistantCoaches = 0;
    value.staff.cheerleaders = 4;
    expect(codes(value)).toContain("sevensStaff");
  });

  it("includes one free Dedicated Fan and permits four additional fans at 20k", () => {
    const value = team();
    const before = summarize(value).teamGold;
    expect(value.staff.dedicatedFans).toBe(0);
    value.staff.dedicatedFans = 4;
    expect(summarize(value).teamGold).toBe(before + 80000);
    expect(validateTeam(value).valid).toBe(true);
    value.staff.dedicatedFans = 5;
    expect(codes(value)).toContain("sevensFans");
  });

  it("uses Spike! 22 inducement fees, caps, and eligibility", () => {
    const value = team();
    const expected: Record<string, [number, number]> = {
      "temp-agency-cheerleaders": [15000, 2],
      "part-time-assistant-coaches": [15000, 2],
      "blitzers-best-kegs": [50000, 2],
      "prayers-to-nuffle": [5000, 2],
      "extra-team-training": [125000, 6],
      bribes: [100000, 2],
      "wandering-apothecary": [100000, 1],
      "mortuary-assistant": [100000, 1],
      "plague-doctor": [100000, 1],
      "halfling-master-chef": [300000, 1],
      "desperate-measures": [50000, 5],
    };
    for (const [id, [cost, max]] of Object.entries(expected))
      expect(
        inducementInfo(
          value,
          inducements.find((item) => item.id === id)!,
        ),
      ).toMatchObject({ cost, max });
    const info = (rosterId: string, id: string) =>
      inducementInfo(
        team(rosterId),
        inducements.find((item) => item.id === id)!,
      );
    expect(info("goblin", "bribes")).toMatchObject({
      cost: 50000,
      max: 2,
      allowed: true,
    });
    expect(info("halfling", "halfling-master-chef")).toMatchObject({
      cost: 100000,
      allowed: true,
    });
    expect(info("gnome", "halfling-master-chef").cost).toBe(300000);
    expect(info("human", "mortuary-assistant").allowed).toBe(false);
    expect(info("shambling-undead", "mortuary-assistant").allowed).toBe(true);
    expect(info("nurgle", "plague-doctor").allowed).toBe(true);
    for (const item of inducements.filter((item) => !(item.id in expected)))
      expect(inducementInfo(value, item).allowed, item.id).toBe(false);
    value.inducements = { "desperate-measures": 6 };
    expect(codes(value)).toContain("inducementLimit");
  });

  it("preserves ordinary draft economics and rejects a stale Veteran outside Sevens", () => {
    const value = team("human", 11);
    value.rulesetId = "bb2025-default";
    const position = getRoster("human")!.players.find(
      (position) => position.id === value.players[0].positionId,
    )!;
    expect(playerMovement(value, value.players[0].id, position)).toBe(
      position.ma,
    );
    expect(codes(value)).toContain("veteranRuleset");
    delete value.veteranId;
    expect(validateTeam(value).valid).toBe(true);
    expect(budgetFor(value).teamBudget).toBe(1000000);
    expect(staffInfo(value)).toMatchObject({
      rerolls: { cost: getRoster("human")!.rerolls.cost },
      apothecary: { cost: 50000 },
      assistantCoaches: { cost: 10000, max: 6 },
      cheerleaders: { cost: 10000, max: 6 },
    });
    expect(
      inducementInfo(
        value,
        inducements.find((item) => item.id === "desperate-measures")!,
      ).allowed,
    ).toBe(false);
  });
});
