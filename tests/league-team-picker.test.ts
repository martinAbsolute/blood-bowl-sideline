// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getRoster, newTeam } from "../src/domain/catalog";
import { LeagueTeamPicker } from "../src/components/league-team-picker";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));
vi.mock("../src/components/player-icon", () => ({ RosterIcon: () => null }));

function rookie(name: string) {
  const team = newTeam(randomUUID());
  team.name = name;
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: getRoster("human")!.players[0].id,
    name: "",
    skills: [],
  }));
  team.captainId = team.players[0].id;
  return team;
}

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows illegal teams with reasons and selects only a legal rookie", async () => {
  const eligible = rookie("Ready Humans");
  const excessiveFans = rookie("League Orcs Of Hell");
  excessiveFans.staff.dedicatedFans = 4;
  const wrongRules = rookie("Tournament Humans");
  wrongRules.rulesetId = "bb2025-matched-play";
  const incomplete = newTeam(randomUUID());
  incomplete.name = "Incomplete Humans";
  const experienced = rookie("Experienced Humans");
  const change = vi.fn();
  const loadMore = vi.fn();
  await act(async () =>
    root.render(
      createElement(LeagueTeamPicker, {
        teams: [
          ...[eligible, excessiveFans, wrongRules, incomplete].map((team) => ({
            team,
          })),
          { team: experienced, leagueExperienced: true },
        ],
        value: "",
        onChange: change,
        status: "CanLoadMore",
        loadMore,
      }),
    ),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  expect(dialog.querySelector("select")).toBeNull();
  const card = (name: string) =>
    dialog.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  expect(card(experienced.name).disabled).toBe(true);
  expect(dialog.textContent).toContain("leagueUi.experiencedTeamHint");
  expect(card(excessiveFans.name).disabled).toBe(true);
  expect(card(wrongRules.name).disabled).toBe(true);
  expect(card(incomplete.name).disabled).toBe(true);
  expect(dialog.textContent).toContain("leagueUi.rookieIssues.rookieFans");
  expect(dialog.textContent).toContain("leagueUi.rookieIssues.leagueRuleset");
  expect(dialog.textContent).toContain("issues.minPlayers");
  expect(
    dialog.querySelector(`a[href="/teams/${excessiveFans.uuid}"]`),
  ).not.toBeNull();
  await act(async () => card(excessiveFans.name).click());
  expect(change).not.toHaveBeenCalled();
  await act(async () =>
    Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "loadMore")!
      .click(),
  );
  expect(loadMore).toHaveBeenCalledOnce();
  await act(async () => card(eligible.name).click());
  expect(change).toHaveBeenCalledExactlyOnceWith(eligible.uuid);
});

it("excludes the current career team from replacement and marks the chosen card", async () => {
  const current = rookie("Current Humans");
  const replacement = rookie("Replacement Humans");
  await act(async () =>
    root.render(
      createElement(LeagueTeamPicker, {
        teams: [{ team: current }, { team: replacement }],
        value: replacement.uuid,
        excludeUuid: current.uuid,
        onChange: vi.fn(),
        status: "Exhausted",
        loadMore: vi.fn(),
      }),
    ),
  );
  expect(container.textContent).toContain(replacement.name);
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(
    dialog.querySelector(`button[aria-label="${current.name}"]`),
  ).toBeNull();
  expect(
    dialog
      .querySelector(`button[aria-label="${replacement.name}"]`)
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
});
