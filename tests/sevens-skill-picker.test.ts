// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRoster, newTeam, skillName } from "../src/domain/catalog";
import { PlayerSkillPicker } from "../src/components/player-skill-picker";
import type { Team } from "../src/domain/types";

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    key + (values ? JSON.stringify(values) : ""),
}));
vi.mock("../src/components/skill-box", () => ({
  SkillBox: ({ id }: { id: string }) =>
    createElement("span", null, skillName(id)),
}));

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onChange.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function team(rosterId = "human") {
  const value = newTeam(crypto.randomUUID(), rosterId);
  value.rulesetId = "kyiv-seven-sins-sevens";
  value.players = Array.from({ length: 7 }, () => ({
    id: crypto.randomUUID(),
    positionId: getRoster(rosterId)!.players[0].id,
    name: "",
    skills: [] as string[],
  }));
  value.veteranId = value.players[0].id;
  if (getRoster(rosterId)!.specialRules.includes("Team Captain"))
    value.captainId = value.players[0].id;
  return value;
}
async function render(value: Team, selected: string[] = [], index = 1) {
  const player = value.players[index];
  const position = getRoster(value.rosterId)!.players.find(
    (position) => position.id === player.positionId,
  )!;
  await act(async () =>
    root.render(
      createElement(PlayerSkillPicker, {
        team: value,
        playerId: player.id,
        position,
        selected,
        max: 1,
        captain: value.captainId === player.id,
        onChange,
      }),
    ),
  );
}
const rows = () =>
  [...container.querySelectorAll("[data-skill-row]")].map((row) =>
    row.getAttribute("data-skill-row"),
  );

it("explains the tier-1 empty state without a locked skill wall", async () => {
  await render(team("amazon"));
  expect(container.textContent).toContain("playerModal.sevensTierOne");
  expect(container.textContent).not.toContain("playerModal.sevensSlots");
  expect(container.textContent).not.toContain("playerModal.sevensSecondary");
  expect(rows()).toEqual([]);
  expect(container.querySelector("input")).toBeNull();
});

it("directs tier-2 captains to another player and preserves removable illegal additions", async () => {
  const value = team();
  await render(value, ["block"], 0);
  expect(container.textContent).toContain("playerModal.sevensCaptain");
  expect(container.textContent).not.toContain("playerModal.sevensSlots");
  expect(container.textContent).not.toContain("playerModal.sevensSecondary");
  expect(rows()).toEqual(["block"]);
  const remove = container.querySelector<HTMLButtonElement>(
    '[aria-label="removeSkill · Block"]',
  )!;
  await act(async () => remove.click());
  expect(onChange).toHaveBeenCalledWith([]);
});

it("shows primary options without SP prices and hides banned Leader and forbidden secondary skills", async () => {
  await render(team());
  expect(container.textContent).toContain(
    'playerModal.sevensSlots{"remaining":1,"total":1}',
  );
  expect(container.textContent).not.toContain("playerModal.sevensSecondary");
  expect(rows()).toContain("block");
  expect(rows()).not.toContain("leader");
  expect(rows()).not.toContain("dodge");
  expect(container.textContent).not.toContain("1 sp");
  expect(container.textContent).toContain("primary");
});

it("explains exhausted team slots and offers no further additions", async () => {
  const value = team();
  value.players[2].skills = ["block"];
  await render(value);
  expect(container.textContent).toContain("playerModal.sevensFull");
  expect(container.textContent).not.toContain("playerModal.sevensSlots");
  expect(container.textContent).not.toContain("playerModal.sevensSecondary");
  expect(rows()).toEqual([]);
});

it("allows one secondary or its primary replacement and hides second secondary choices", async () => {
  const value = team("chaos-chosen");
  await render(value);
  expect(rows()).toContain("dodge");
  expect(rows()).toContain("block");
  value.players[2].skills = ["dodge"];
  await render(value);
  expect(container.textContent).toContain(
    'playerModal.sevensSecondary{"remaining":0,"total":1}',
  );
  expect(rows()).not.toContain("dodge");
  expect(rows()).toContain("block");
});

it("keeps banned, inaccessible and unknown imported skills removable", async () => {
  await render(team(), ["leader", "unknown-imported-skill", "pro"]);
  expect(rows()).toContain("leader");
  expect(rows()).toContain("unknown-imported-skill");
  const remove = container.querySelector<HTMLButtonElement>(
    '[aria-label="removeSkill · Leader"]',
  )!;
  await act(async () => remove.click());
  expect(onChange).toHaveBeenCalledWith(["pro", "unknown-imported-skill"]);
});

it("retains the reset action when a filter contains no permitted skills", async () => {
  await render(team());
  const strength = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent === "skillCategories.strength")!;
  await act(async () => strength.click());
  expect(rows()).toEqual([]);
  const reset = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent === "playerModal.showAllSkills")!;
  expect(reset).toBeTruthy();
  await act(async () => reset.click());
  expect(rows()).toContain("block");
});

it("keeps ordinary preset prices and Leader choices", async () => {
  const value = team();
  value.rulesetId = "bb2025-default";
  delete value.veteranId;
  value.players[1].positionId = getRoster("human")!.players.find((position) =>
    position.position.includes("Thrower"),
  )!.id;
  await render(value);
  expect(rows()).toContain("leader");
  expect(container.textContent).toContain("k GP");
  expect(container.textContent).not.toContain("playerModal.sevensSlots");
});

it("uses SP and permits Leader for standard Sevens without Kyiv tier restrictions", async () => {
  const value = team();
  value.rulesetId = "bb2025-sevens";
  value.players[1].positionId = getRoster("human")!.players.find((position) =>
    position.position.includes("Thrower"),
  )!.id;
  await render(value);
  expect(rows()).toContain("leader");
  expect(container.textContent).toContain("1 sp");
  expect(container.textContent).not.toContain("playerModal.sevensTierOne");
  expect(container.textContent).not.toContain("playerModal.sevensSlots");
});
