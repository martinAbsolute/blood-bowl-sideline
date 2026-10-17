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
import { PLAYER_NAME_MAX_LENGTH } from "../src/domain/player-name";
import type { Team } from "../src/domain/types";
import { PlayerDialog } from "../src/components/player-dialog";
import { generatePlayerName } from "../src/lib/player-name-generator";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const { formats, timeZone } = await import("../src/i18n/config");
  return {
    ...actual,
    useFormatter: () =>
      actual.createFormatter({ locale: "en", formats, timeZone }),
    useTranslations: () => (key: string) => key,
  };
});
vi.mock("../src/lib/player-name-generator", () => ({
  generatePlayerName: vi.fn(),
}));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  StarPlayerIcon: () => null,
}));
vi.mock("../src/components/skill-box", () => ({
  VeteranSkill: () => createElement("span", null, "sevensVeteran"),
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
  vi.mocked(generatePlayerName).mockReset().mockReturnValue("Brave Bell");
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
async function rename(value: string, label = "playerName") {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
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

it("rejects overlapping numbers and saves a number change in numeric roster order", async () => {
  team.players.push({
    id: crypto.randomUUID(),
    positionId: team.players[0].positionId,
    name: "Teammate",
    skills: [],
  });
  await render();
  const input = await rename("2", "playerModal.number");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(button("playerModal.save").disabled).toBe(true);
  await rename("02", "playerModal.number");
  expect(button("playerModal.save").disabled).toBe(true);
  await rename("", "playerModal.number");
  expect(button("playerModal.save").disabled).toBe(true);
  await rename("9", "playerModal.number");
  expect(onChange).not.toHaveBeenCalled();
  await click("playerModal.save");
  expect(team.players.map((player) => player.number)).toEqual(["02", "9"]);
  expect(team.players[1].id).toBe(selected);
});

it("restores the previous player number on Escape", async () => {
  await render();
  const input = await rename("09", "playerModal.number");
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  expect(input.value).toBe("01");
  expect(button("playerModal.save").disabled).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
});

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

it("generates and rerolls draft names, applies only the final name on Save", async () => {
  team.players[0].name = "Original name";
  vi.mocked(generatePlayerName)
    .mockReturnValueOnce("Brave Bell")
    .mockReturnValueOnce("Happy Hopper");
  await render();
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="playerName"]',
  )!;
  await click("playerModal.randomizeName");
  expect(input.value).toBe("Brave Bell");
  await click("playerModal.randomizeName");
  expect(input.value).toBe("Happy Hopper");
  expect(team.players[0].name).toBe("Original name");
  expect(onChange).not.toHaveBeenCalled();
  await click("playerModal.save");
  expect(team.players[0].name).toBe("Happy Hopper");
  expect(onChange).toHaveBeenCalledOnce();
});

it("keeps generated names editable and discards them on Cancel", async () => {
  await render();
  await click("playerModal.randomizeName");
  await rename("Edited generated name");
  await click("cancel");
  expect(team.players[0].name).toBe("");
  expect(onChange).not.toHaveBeenCalled();
});

it("keeps the empty editor compact when focus moves to the generator", async () => {
  await render();
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="playerName"]',
  )!;
  await act(async () => input.focus());
  await act(async () => button("playerModal.randomizeName").focus());
  expect(input.placeholder).toBe("");
  await click("playerModal.randomizeName");
  expect(input.value).toBe("Brave Bell");
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
  expect(button("addSkill · Fend")).toBeUndefined();
  await click("playerModal.unavailable · Fend");
  expect(confirmation().textContent).toContain("skillLimitReached");
  await click("ok", confirmation());
  await click("removeSkill · Block");
  expect(button("addSkill · Fend").disabled).toBe(false);
  await click("addSkill · Fend");
  expect(button("addSkill · Pro")).toBeUndefined();
  expect(button("playerModal.unavailable · Pro")).toBeDefined();
  expect(team.players[0].skills).toEqual(["block", "wrestle"]);
});

it("explains star restrictions on demand without applying a blocked skill", async () => {
  team.rulesetId = "eurobowl-2026";
  team.stars = ["griff-oberwald"];
  await render();
  expect(button("addSkill · Dodge")).toBeUndefined();
  expect(
    document.querySelector(".player-skill-results")?.textContent,
  ).not.toContain("issues.starSkills");
  await click("playerModal.unavailable · Dodge");
  expect(confirmation().textContent).toContain("playerModal.starSecondaryHint");
  expect(button("playerModal.replaceSkill", confirmation())).toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
  await click("ok", confirmation());
  await click("addSkill · Block");
  expect(button("addSkill · Fend")).toBeUndefined();
  await click("playerModal.unavailable · Fend");
  expect(confirmation().textContent).toContain("playerModal.replaceSkillHint");
  await click("cancel", confirmation());
  await click("removeSkill · Block");
  expect(button("addSkill · Fend")).toBeDefined();
  expect(button("playerModal.save").disabled).toBe(true);
  expect(team.players[0].skills).toEqual([]);
});

it("replaces an existing primary skill locally and applies the replacement only on Save", async () => {
  team.rulesetId = "eurobowl-2026";
  team.stars = ["griff-oberwald"];
  team.players[0].skills = ["block"];
  await render();
  await click("playerModal.unavailable · Fend");
  await click("playerModal.replaceSkill", confirmation());
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(button("removeSkill · Fend")).toBeDefined();
  expect(button("removeSkill · Block")).toBeUndefined();
  await vi.waitFor(() =>
    expect(document.activeElement?.closest(".player-dialog")).not.toBeNull(),
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(team.players[0].skills).toEqual(["block"]);
  await click("playerModal.save");
  expect(team.players[0].skills).toEqual(["fend"]);
  expect(onChange).toHaveBeenCalledOnce();
});

it("discards a staged skill replacement when the player modal is cancelled", async () => {
  team.rulesetId = "eurobowl-2026";
  team.stars = ["griff-oberwald"];
  team.players[0].skills = ["block"];
  await render();
  await click("playerModal.unavailable · Fend");
  await click("playerModal.replaceSkill", confirmation());
  await click("cancel");
  expect(team.players[0].skills).toEqual(["block"]);
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
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

it("shows the Sevens veteran ability and clears the designation on player removal", async () => {
  team.rulesetId = "kyiv-seven-sins-sevens";
  team.veteranId = selected;
  await render();
  expect(
    document.querySelector(".player-dialog-profile")?.textContent,
  ).toContain("sevensVeteran");
  expect(
    document.querySelector(".player-dialog-profile")?.textContent,
  ).not.toContain("sevensVeteranHelp");
  await click("removePlayer");
  expect(confirmation().textContent).toContain("sevensVeteran");
  await click("removePlayer", confirmation());
  expect(team.players).toHaveLength(0);
  expect(team.veteranId).toBeUndefined();
});

it("shows no Sevens skill spend and gives a Tier 2 captain zero added-skill slots", async () => {
  team.rulesetId = "kyiv-seven-sins-sevens";
  team.captainId = selected;
  await render();
  expect(
    document.querySelector(".player-dialog-profile")?.textContent,
  ).not.toContain("playerModal.skillSpend");
  expect(document.querySelector(".player-dialog")?.textContent).toContain(
    "0/0",
  );
  expect(button("addSkill · Block")).toBeUndefined();
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
  expect(button("playerModal.randomizeName")).toBeUndefined();
  expect(document.querySelector(".player-skill-browser")).toBeNull();
  expect(button("removePlayer")).toBeUndefined();
  expect(button("removeSkill · Block")).toBeUndefined();
  selected = stars[0].id;
  team.stars = [selected];
  await render();
  expect(button("removePlayer")).toBeUndefined();
});

it("labels the name-edit tooltip and focuses the name field from its pencil", async () => {
  team.players[0].name = "Captain";
  await render();
  const edit = button("playerModal.editName");
  // happy-dom does not track keyboard focus visibility for tooltip triggers.
  const matches = edit.matches.bind(edit);
  const focusVisible = vi
    .spyOn(edit, "matches")
    .mockImplementation(
      (selector) => selector === ":focus-visible" || matches(selector),
    );
  await act(async () => edit.focus());
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-slot="tooltip-content"]')?.textContent,
    ).toContain("playerModal.editName"),
  );
  focusVisible.mockRestore();
  await act(async () => edit.click());
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="playerName"]',
  )!;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe("Captain".length);
});

it("limits new names in the modal and generated names to the shared maximum", async () => {
  await render();
  const input = await rename("A".repeat(PLAYER_NAME_MAX_LENGTH + 1));
  expect(input.maxLength).toBe(PLAYER_NAME_MAX_LENGTH);
  expect(input.value).toHaveLength(PLAYER_NAME_MAX_LENGTH);
  vi.mocked(generatePlayerName).mockReturnValue(
    "B".repeat(PLAYER_NAME_MAX_LENGTH + 1),
  );
  await click("playerModal.randomizeName");
  expect(input.value).toBe("B".repeat(PLAYER_NAME_MAX_LENGTH));
});
