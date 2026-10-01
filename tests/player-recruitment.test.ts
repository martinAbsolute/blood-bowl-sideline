// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRoster, newTeam } from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { PlayerRecruitment } from "../src/components/player-recruitment";

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("../src/components/player-icon", () => ({ PlayerIcon: () => null }));
vi.mock("../src/components/skill-box", () => ({
  SkillList: () => null,
  TableSkills: () => null,
}));

let root: Root;
let container: HTMLDivElement;
let team: Team;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  team = newTeam("recruitment-test");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function players(count: number) {
  const positionId = getRoster(team.rosterId)!.players[0].id;
  team.players = Array.from({ length: count }, (_, index) => ({
    id: `player-${index}`,
    positionId,
    name: "",
    skills: [],
  }));
}
async function render() {
  await act(async () => {
    root.render(
      createElement(PlayerRecruitment, {
        key: `${team.uuid}:${team.rosterId}`,
        team,
        onChange: (next) => {
          team = next;
          void render();
        },
      }),
    );
  });
}
function trigger() {
  return container.querySelector<HTMLButtonElement>(
    '[data-slot="accordion-trigger"]',
  )!;
}

it("opens a roster that needs players and closes a complete roster on entry", async () => {
  players(10);
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  players(11);
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  // Missing captain or excess spending does not make recruitment necessary.
  team.staff.rerolls = 30;
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

it("keeps recruitment open while hiring the eleventh player", async () => {
  players(10);
  await render();
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="increaseQuantity"]',
      )!
      .click();
  });
  expect(team.players).toHaveLength(11);
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
});

it("respects manual collapse across edits and resets it when switching roster", async () => {
  await render();
  await act(async () => trigger().click());
  players(3);
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  team = newTeam(team.uuid, "amazon");
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
});

it("offers recruitment when World Cup stars do not satisfy the regular-player minimum", async () => {
  team.rulesetId = "world-cup-2027";
  players(10);
  team.stars = ["griff-oberwald"];
  await render();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
});
