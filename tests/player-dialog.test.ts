// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRoster, newTeam } from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { PlayerDialog } from "../src/components/player-dialog";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  StarPlayerIcon: () => null,
}));
vi.mock("../src/components/skill-box", () => ({
  SkillBox: ({ id }: { id: string }) => createElement("span", null, id),
  SkillList: ({ ids }: { ids: string[] }) =>
    createElement("span", null, ids.join(", ")),
}));

let root: Root;
let container: HTMLDivElement;
let team: Team;
let readOnly: boolean;
const onClose = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  team = newTeam(crypto.randomUUID(), "human");
  team.players = [
    {
      id: crypto.randomUUID(),
      positionId: getRoster("human")!.players[0].id,
      name: "Test player",
      skills: [],
    },
  ];
  readOnly = false;
  onClose.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(PlayerDialog, {
        team,
        selected: team.players[0]?.id ?? "removed",
        readOnly,
        onClose,
        onChange: (next) => {
          team = next;
          void render();
        },
      }),
    ),
  );
}
function button(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find(
    (node) =>
      node.getAttribute("aria-label") === label || node.textContent === label,
  )!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}

it("adds skills, keeps them removable when the category changes, and updates cost", async () => {
  await render();
  await click("addSkill · Block");
  expect(team.players[0].skills).toEqual(["block"]);
  expect(
    document.querySelector(".player-dialog-profile")?.textContent,
  ).toContain("80k GP");
  await click("skillCategories.agility");
  expect(button("addSkill · Wrestle")).toBeUndefined();
  await click("removeSkill · Block");
  expect(team.players[0].skills).toEqual([]);
});

it("enforces the player limit while allowing existing skills to be removed", async () => {
  team.rulesetId = "eurobowl-2026";
  team.players[0].skills = ["block", "wrestle"];
  await render();
  expect(button("addSkill · Fend").disabled).toBe(true);
  expect(
    document.querySelector(".player-skill-toolbar")?.textContent,
  ).toContain("skillLimitReached");
  await click("removeSkill · Block");
  expect(button("addSkill · Fend").disabled).toBe(false);
});

it("requires confirmation to remove a player and clears their captain assignment", async () => {
  team.captainId = team.players[0].id;
  await render();
  expect(button("addSkill · Pro")).toBeUndefined();
  await click("removePlayer");
  expect(team.players).toHaveLength(1);
  await click("cancel");
  expect(onClose).not.toHaveBeenCalled();
  await click("removePlayer");
  const dialogs = document.querySelectorAll('[role="dialog"]');
  const confirmation = dialogs[dialogs.length - 1];
  const confirm = Array.from(
    confirmation.querySelectorAll<HTMLButtonElement>("button"),
  ).find((node) => node.textContent === "removePlayer")!;
  await act(async () => confirm.click());
  expect(team.players).toHaveLength(0);
  expect(team.captainId).toBeUndefined();
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows a read-only player without editing or removal controls", async () => {
  readOnly = true;
  team.players[0].skills = ["block"];
  await render();
  expect(document.querySelector<HTMLInputElement>("input")?.readOnly).toBe(
    true,
  );
  expect(document.querySelector(".player-skill-browser")).toBeNull();
  expect(button("removePlayer")).toBeUndefined();
  expect(button("removeSkill · Block")).toBeUndefined();
});
