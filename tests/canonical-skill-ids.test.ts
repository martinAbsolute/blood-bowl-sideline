/// <reference types="vite/client" />
import { randomUUID } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, getSkill, newTeam, rosters } from "../src/domain/catalog";
import { advancementChoices } from "../src/domain/league-rules";
import { isLineman, validateTeam } from "../src/domain/rules";
import { skillCompatible } from "../src/domain/skill-eligibility";
import type { RulesetId, Team } from "../src/domain/types";

const modules = import.meta.glob("../convex/**/*.ts");

function draft(rosterId = "human", rulesetId: RulesetId = "bb2025-default") {
  const team = newTeam(randomUUID(), rosterId);
  const roster = getRoster(rosterId)!;
  team.rulesetId = rulesetId;
  team.players = Array.from(
    { length: rulesetId === "kyiv-seven-sins-sevens" ? 7 : 11 },
    () => ({
      id: randomUUID(),
      positionId: roster.players.find(isLineman)!.id,
      name: "",
      skills: [] as string[],
    }),
  );
  if (roster.specialRules.includes("Team Captain"))
    team.captainId = team.players[0].id;
  if (rulesetId === "kyiv-seven-sins-sevens")
    team.veteranId = team.players[0].id;
  return team;
}

const attempts: [string, () => Team][] = [
  [
    "starting Frenzy conflict",
    () => {
      const team = draft("khorne");
      team.players[0].skills = ["grab:1"];
      return team;
    },
  ],
  [
    "skill prerequisite",
    () => {
      const team = draft();
      team.players[1].skills = ["bullseye:1"];
      return team;
    },
  ],
  [
    "four-copy elite limit",
    () => {
      const team = draft("human", "bb2025-matched-play");
      team.players.slice(0, 5).forEach((player, index) => {
        player.skills = [`block:${index}`];
      });
      return team;
    },
  ],
  [
    "Kyiv Leader ban",
    () => {
      const team = draft("human", "kyiv-seven-sins-sevens");
      team.players[1].positionId = getRoster("human")!.players.find((p) =>
        p.primarySkills.includes("P"),
      )!.id;
      team.players[1].skills = ["leader:1"];
      return team;
    },
  ],
];

describe("canonical IDs for purchased skills", () => {
  it.each(attempts)("rejects suffixed IDs bypassing %s", (_label, makeTeam) => {
    expect(validateTeam(makeTeam()).valid).toBe(false);
  });

  it.each(attempts)(
    "rejects the same %s bypass in cloud saves",
    async (_label, makeTeam) => {
      const t = convexTest(schema, modules);
      const ownerId = await t.run((ctx) =>
        ctx.db.insert("users", { name: "Coach" }),
      );
      const owner = t.withIdentity({ subject: String(ownerId) });
      const team = makeTeam();
      await expect(
        owner.mutation(api.teams.save, { team, expectedRevision: 0 }),
      ).rejects.toThrow("INVALID_TEAM");
      expect(
        await t.query(api.teams.getByUuid, { uuid: team.uuid }),
      ).toBeNull();
    },
  );

  it("rejects suffixes as selectable candidates while retaining inherent trait parameters", () => {
    expect(skillCompatible("grab:1", ["frenzy"])).toBe(false);
    for (const position of rosters.flatMap((roster) => roster.players))
      for (const id of position.skills.filter((id) => id.includes(":")))
        expect(getSkill(id), id).toBeDefined();
    const ogre = getRoster("human")!.players.find((p) =>
      p.skills.includes("throw_team_mate"),
    )!;
    expect(ogre.skills.some((id) => id.includes(":"))).toBe(true);
    expect(skillCompatible("bullseye", ogre.skills)).toBe(true);
    const choices = advancementChoices("human", ogre.id, []);
    expect(choices.some((choice) => choice.skillId === "bullseye")).toBe(true);
    expect(choices.some((choice) => choice.skillId.includes(":"))).toBe(false);
  });
});
