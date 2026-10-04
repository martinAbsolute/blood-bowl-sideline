// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getRoster,
  newTeam,
  skillName,
  starPairs,
  stars,
} from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { PlayerDialog } from "../src/components/player-dialog";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  StarPlayerIcon: () => null,
}));
vi.mock("../src/components/skill-box", () => ({
  SkillBox: ({ id, onRemove }: { id: string; onRemove?: () => void }) =>
    createElement(
      "span",
      null,
      id,
      onRemove &&
        createElement(
          "button",
          { "aria-label": "removeSkill · " + skillName(id), onClick: onRemove },
          "×",
        ),
    ),
  SkillList: ({ ids }: { ids: string[] }) =>
    createElement("span", null, ids.join(", ")),
}));

let root: Root;
let container: HTMLDivElement;
let team: Team;
let selected: string;
let readOnly: boolean;
const onClose = vi.fn();
const onChange = vi.fn((next: Team) => {
  team = next;
});
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  team = newTeam(crypto.randomUUID(), "human");
  selected = crypto.randomUUID();
  team.players = [
    {
      id: selected,
      positionId: getRoster("human")!.players[0].id,
      name: "",
      skills: [],
    },
  ];
  readOnly = false;
  onClose.mockClear();
  onChange.mockClear();
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
        selected,
        readOnly,
        onClose,
        onChange,
      }),
    ),
  );
}
function button(label: string, scope: ParentNode = document) {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find(
    (node) =>
      node.getAttribute("aria-label") === label || node.textContent === label,
  )!;
}
async function click(label: string, scope: ParentNode = document) {
  await act(async () => button(label, scope).click());
}
function confirmation() {
  return Array.from(document.querySelectorAll('[role="dialog"]')).at(-1)!;
}
async function rename(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="playerName"]',
  )!;
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

it("stages name and skills, previews costs, and applies both only on Save", async () => {
  await render();
  expect(button("playerModal.save").disabled).toBe(true);
  await rename("  Captain Example  ");
  await click("addSkill · Block");
  expect(onChange).not.toHaveBeenCalled();
  expect(team.players[0]).toMatchObject({ name: "", skills: [] });
  expect(
    document.querySelector(".player-dialog-profile")?.textContent,
  ).toContain("80k GP");
  await click("playerModal.save");
  expect(onChange).toHaveBeenCalledOnce();
  expect(team.players[0]).toMatchObject({
    name: "Captain Example",
    skills: ["block"],
  });
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps added skills removable after filtering and recognises reverted edits", async () => {
  await render();
  await click("addSkill · Block");
  await click("skillCategories.agility");
  expect(button("addSkill · Wrestle")).toBeUndefined();
  await click("removeSkill · Block");
  expect(button("playerModal.save").disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});

it("cancels local edits without changing the team", async () => {
  await render();
  await rename("Unsaved name");
  await click("addSkill · Block");
  await click("cancel");
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("guards accidental closing, preserves edits on Keep editing, and discards explicitly", async () => {
  await render();
  await click("addSkill · Block");
  await click("playerModal.close");
  expect(confirmation().textContent).toContain("playerModal.discardHint");
  await click("playerModal.keepEditing", confirmation());
  expect(onClose).not.toHaveBeenCalled();
  expect(button("playerModal.save").disabled).toBe(false);
  await click("playerModal.close");
  await click("playerModal.discard", confirmation());
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("Enter finishes name editing without saving, and Escape restores the name without closing", async () => {
  await render();
  let input = await rename("First draft");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(onChange).not.toHaveBeenCalled();
  input = await rename("Second draft");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(input.value).toBe("First draft");
  expect(onClose).not.toHaveBeenCalled();
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
});

it("enforces the player limit against staged skills", async () => {
  team.rulesetId = "eurobowl-2026";
  team.players[0].skills = ["block", "wrestle"];
  await render();
  expect(button("addSkill · Fend").disabled).toBe(true);
  await click("removeSkill · Block");
  expect(button("addSkill · Fend").disabled).toBe(false);
  await click("addSkill · Fend");
  expect(button("addSkill · Pro").disabled).toBe(true);
  expect(team.players[0].skills).toEqual(["block", "wrestle"]);
});

it("removes an untouched player directly without an irrelevant warning", async () => {
  await render();
  await click("removePlayer");
  expect(team.players).toHaveLength(0);
  expect(onClose).toHaveBeenCalledOnce();
});

it("warns about saved customisation only when it exists", async () => {
  team.players[0].name = "Saved name";
  await render();
  await click("removePlayer");
  expect(confirmation().textContent).toContain("Saved name");
  expect(confirmation().textContent).not.toContain("teamCaptain");
  expect(confirmation().textContent).not.toContain("addedSkills");
  expect(confirmation().textContent).not.toContain("playerModal.removeUnsaved");
  await click("cancel", confirmation());
  expect(onChange).not.toHaveBeenCalled();
});

it("explains unsaved edits on removal without pretending they are saved details", async () => {
  await render();
  await click("addSkill · Block");
  await click("removePlayer");
  expect(confirmation().textContent).toContain("playerModal.removeUnsaved");
  expect(confirmation().textContent).not.toContain(
    "playerModal.savedDetailsLost",
  );
  await click("removePlayer", confirmation());
  expect(team.players).toHaveLength(0);
  expect(onChange).toHaveBeenCalledOnce();
});

it("reports actual saved skills and captain status, then clears captain on removal", async () => {
  team.players[0].skills = ["block"];
  team.captainId = selected;
  await render();
  expect(button("addSkill · Pro")).toBeUndefined();
  await click("removePlayer");
  expect(confirmation().textContent).toContain("block");
  expect(confirmation().textContent).toContain("teamCaptain");
  await click("removePlayer", confirmation());
  expect(team.players).toHaveLength(0);
  expect(team.captainId).toBeUndefined();
});

it("removes a single star through the modal", async () => {
  selected = stars.find((star) => !starPairs.flat().includes(star.id))!.id;
  team.stars = [selected];
  await render();
  expect(button("playerModal.save")).toBeUndefined();
  await click("removePlayer");
  expect(team.stars).toEqual([]);
  expect(team.players).toHaveLength(1);
});

it("explains paired stars and removes the pair together", async () => {
  selected = starPairs[0][0];
  team.stars = [...starPairs[0]];
  await render();
  await click("removePlayer");
  expect(confirmation().textContent).toContain("playerModal.removePair");
  expect(team.stars).toHaveLength(2);
  await click("removePlayer", confirmation());
  expect(team.stars).toEqual([]);
});

it("shows read-only players and stars without editing or removal controls", async () => {
  readOnly = true;
  team.players[0].skills = ["block"];
  await render();
  expect(document.querySelector('input[aria-label="playerName"]')).toBeNull();
  expect(document.querySelector(".player-skill-browser")).toBeNull();
  expect(button("removePlayer")).toBeUndefined();
  expect(button("removeSkill · Block")).toBeUndefined();
  selected = stars[0].id;
  team.stars = [selected];
  await render();
  expect(button("removePlayer")).toBeUndefined();
});
