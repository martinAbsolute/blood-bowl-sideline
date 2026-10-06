// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { TeamCatalog } from "../src/components/team-catalog";
import { rosterChoices, sharedRosterBudget } from "../src/lib/roster-ruleset";
import { rulesets } from "../src/domain/catalog";
import type { RulesetId } from "../src/domain/types";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/roster-ruleset-picker", () => ({
  RosterRulesetPicker: () => null,
}));
vi.mock("../src/components/create-team-button", () => ({
  CreateTeamButton: () => null,
}));
vi.mock("../src/components/player-icon", () => ({ RosterIcon: () => null }));
vi.mock("../src/components/roster-reference", () => ({
  RosterFacts: () => null,
  RosterTable: () => null,
}));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/rosters");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(rulesetId: RulesetId) {
  await act(async () => root.render(createElement(TeamCatalog, { rulesetId })));
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.startsWith(label),
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

it("offers only the selected ruleset's tiers and resets selection when ruleset changes", async () => {
  await render("world-cup-2027");
  await click("tier 3");
  expect(
    [...container.querySelectorAll("section")].map((item) => item.id),
  ).toEqual(
    rosterChoices("world-cup-2027")
      .filter((item) => item.tier === 3)
      .map((item) => item.roster.id),
  );
  await render("kyiv-seven-sins-sevens");
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(container.querySelectorAll("section")).toHaveLength(
    rosterChoices("kyiv-seven-sins-sevens").length,
  );
  await render("bb2025-default");
  expect(container.querySelector("fieldset")).toBeNull();
  expect(container.querySelector("[aria-pressed]")).toBeNull();
  expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
});

it("combines search and tier filtering and recovers from no matches", async () => {
  await render("kyiv-seven-sins-sevens");
  await click("tier 1");
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "human");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll("section")).toHaveLength(0);
  expect(container.textContent).toContain("noResults");
  await click("tier 2");
  expect(
    [...container.querySelectorAll("section")].map((item) => item.id),
  ).toEqual(["human"]);
});

it("includes only eligible rosters and recognizes shared budgets for every ruleset", () => {
  for (const rules of rulesets) {
    const choices = rosterChoices(rules.id);
    expect(
      choices.every(
        ({ roster }) => !rules.excludedRosters?.includes(roster.id),
      ),
    ).toBe(true);
    const budgets = new Set(choices.map(({ budget }) => budget.teamBudget));
    expect(sharedRosterBudget(rules.id)).toBe(
      budgets.size === 1 ? [...budgets][0] : undefined,
    );
  }
});

it("opens stats on demand and preserves the tier when using the roster index", async () => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  await render("kyiv-seven-sins-sevens");
  await click("tier 2");
  // Browsers do not fire hashchange for replaceState; happy-dom does.
  const replace = vi
    .spyOn(window.history, "replaceState")
    .mockImplementation(() => {});
  const link = container.querySelector<HTMLAnchorElement>(
    'nav a[href="#human"]',
  )!;
  await act(async () => link.click());
  expect(replace).toHaveBeenCalledWith(window.history.state, "", "#human");
  expect(
    container.querySelector('[aria-pressed="true"]')?.textContent,
  ).toContain("tier 2");
  expect(
    container
      .querySelector("#roster-content-human")
      ?.classList.contains("hidden"),
  ).toBe(false);
  const toggle = container.querySelector<HTMLButtonElement>(
    '#human button[aria-controls="roster-content-human"]',
  )!;
  await act(async () => toggle.click());
  expect(
    container
      .querySelector("#roster-content-human")
      ?.classList.contains("hidden"),
  ).toBe(true);
  vi.restoreAllMocks();
});

it("reveals an incoming roster anchor even when filtered out", async () => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  await render("kyiv-seven-sins-sevens");
  await click("tier 1");
  expect(container.querySelector("#human")).toBeNull();
  await act(async () => {
    window.history.replaceState(null, "", "#human");
    window.dispatchEvent(new Event("hashchange"));
  });
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(
    container
      .querySelector("#roster-content-human")
      ?.classList.contains("hidden"),
  ).toBe(false);
  vi.restoreAllMocks();
});

it("keeps shared rules behind the non-standard ruleset help button", async () => {
  await render("kyiv-seven-sins-sevens");
  expect(document.body.textContent).not.toContain("650k GP");
  const trigger = container.querySelector<HTMLButtonElement>(
    'button[aria-haspopup="dialog"]',
  )!;
  expect(trigger).not.toBeNull();
  await act(async () => trigger.click());
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
    "650k GP",
  );
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
    "7–11",
  );
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
    "rerolls: 100k GP",
  );
});

it("starts with neutral badges, combines selected tiers, and shows all when the last is cleared", async () => {
  await render("world-cup-2027");
  const choices = rosterChoices("world-cup-2027");
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(container.querySelectorAll("section")).toHaveLength(choices.length);
  await click("tier 1");
  await click("tier 2");
  expect(
    [...container.querySelectorAll("section")].map((item) => item.id),
  ).toEqual(
    choices
      .filter(({ tier }) => tier === 1 || tier === 2)
      .map(({ roster }) => roster.id),
  );
  await click("tier 1");
  expect(container.querySelectorAll("section")).toHaveLength(
    choices.filter(({ tier }) => tier === 2).length,
  );
  await click("tier 2");
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(container.querySelectorAll("section")).toHaveLength(choices.length);
});
