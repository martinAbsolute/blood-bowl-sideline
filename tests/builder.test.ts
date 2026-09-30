import { describe, expect, it } from "vitest";
import { newTeam } from "../src/domain/catalog";
import { hasTeamProgress, resetTeamRoster } from "../src/lib/builder";

const uuid = "b28c095a-8ffb-4803-b97f-b8df413ed384";
describe("switching team type", () => {
  it("only requires a warning when switching would discard progress", () => {
    const empty = newTeam(uuid);
    expect(hasTeamProgress(empty)).toBe(false);
    expect(hasTeamProgress({ ...empty, rulesetId: "eurobowl-2026" })).toBe(
      false,
    );
    for (const update of [
      { name: "My team" },
      { coach: "Coach" },
      { notes: "Game plan" },
      { staff: { ...empty.staff, rerolls: 1 } },
      { inducements: { bribes: 1 } },
      { stars: ["akhorne"] },
      {
        players: [
          { id: uuid, positionId: "human-lineman", name: "", skills: [] },
        ],
      },
      { favouredOf: "Nurgle" as const },
    ])
      expect(hasTeamProgress({ ...empty, ...update })).toBe(true);
  });
  it("resets purchases, player skills, captain and personal details while preserving the ruleset", () => {
    const team = {
      ...newTeam(uuid),
      name: "Old team",
      coach: "Coach",
      notes: "Notes",
      rulesetId: "eurobowl-2026" as const,
      captainId: uuid,
      players: [
        {
          id: uuid,
          positionId: "human-lineman",
          name: "Captain",
          skills: ["block"],
        },
      ],
      stars: ["akhorne"],
      inducements: { bribes: 1 },
      staff: { ...newTeam(uuid).staff, rerolls: 2 },
    };
    expect(resetTeamRoster(team, "goblin")).toEqual({
      ...newTeam(uuid, "goblin"),
      rulesetId: team.rulesetId,
    });
    const newUuid = "a64d2f78-0c09-41ec-bf40-e3ad14c5fb1a";
    expect(resetTeamRoster(team, "goblin", newUuid).uuid).toBe(newUuid);
    expect(team.uuid).toBe(uuid);
    expect(team.players).toHaveLength(1);
  });
});
