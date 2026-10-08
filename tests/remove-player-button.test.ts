// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRoster, newTeam, starPairs } from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { RemovePlayerButton } from "../src/components/remove-player-button";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/skill-box", () => ({
  SkillList: ({ ids }: { ids: string[] }) =>
    createElement("span", null, ids.join(", ")),
}));

let root: Root;
let container: HTMLDivElement;
let team: Team;
const onChange = vi.fn();
const openPlayer = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  team = newTeam("remove-test", "human");
  team.players = [
    {
      id: "player",
      positionId: getRoster("human")!.players[1].id,
      name: "",
      skills: [],
    },
  ];
  onChange.mockClear();
  openPlayer.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(selected = "player") {
  await act(async () =>
    root.render(
      createElement(
        "div",
        { onClick: openPlayer },
        createElement(RemovePlayerButton, {
          team,
          selected,
          onChange,
        }),
      ),
    ),
  );
}
async function clickButton(scope: ParentNode, label?: string) {
  const button = Array.from(
    scope.querySelectorAll<HTMLButtonElement>("button"),
  ).find((item) => !label || item.textContent === label)!;
  await act(async () => button.click());
}
it("removes an untouched player with starting skills immediately without opening their editor", async () => {
  await render();
  await clickButton(container);
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...team, players: [] });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(openPlayer).not.toHaveBeenCalled();
});
it.each(["name", "skills", "captain", "veteran"])(
  "confirms a player with %s set and allows cancellation",
  async (detail) => {
    if (detail === "name") team.players[0].name = "Saved name";
    if (detail === "skills") team.players[0].skills = ["block"];
    if (detail === "captain") team.captainId = "player";
    if (detail === "veteran") team.veteranId = "player";
    await render();
    await clickButton(container);
    expect(onChange).not.toHaveBeenCalled();
    expect(openPlayer).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("playerModal.savedDetailsLost");
    await clickButton(dialog, "cancel");
    expect(onChange).not.toHaveBeenCalled();
    await clickButton(container);
    await clickButton(
      document.querySelector('[role="dialog"]')!,
      "removePlayer",
    );
    const removed = onChange.mock.calls[0][0] as Team;
    expect(removed.players).toEqual([]);
    expect(removed.captainId).toBeUndefined();
    expect(removed.veteranId).toBeUndefined();
    expect(openPlayer).not.toHaveBeenCalled();
  },
);
it("confirms paired stars and removes both together", async () => {
  team.stars = [...starPairs[0]];
  await render(team.stars[0]);
  await clickButton(container);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("playerModal.removePair");
  expect(onChange).not.toHaveBeenCalled();
  await clickButton(dialog, "removePlayer");
  expect(onChange.mock.calls[0][0].stars).toEqual([]);
});
