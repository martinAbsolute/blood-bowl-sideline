// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newTeam, getRoster } from "../src/domain/catalog";
import { TeamBudget } from "../src/components/team-budget";

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string) => key,
}));

let root: Root;
let container: HTMLDivElement;
let reportIntersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "matchMedia").mockImplementation(
    () =>
      ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(floating = true) {
  await act(async () => {
    root.render(
      createElement(TeamBudget, { team: newTeam("budget-test"), floating }),
    );
  });
}
async function reportBudgetPosition(top: number) {
  await act(async () => {
    reportIntersection(
      [
        { boundingClientRect: { top }, rootBounds: { bottom: 800 } },
      ] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  });
}

it("shows the inline breakdown directly without an accordion", async () => {
  await render(false);
  expect(container.textContent).toContain("starPlayers");
  expect(container.querySelector('[data-slot="accordion-trigger"]')).toBeNull();
  expect(container.querySelector("button")).toBeNull();
});

it("switches the rendered meters and currencies with the ruleset", async () => {
  const team = newTeam("budget-test");
  team.players = [
    {
      id: "player",
      positionId: getRoster("human")!.players[0].id,
      name: "",
      skills: ["block"],
    },
  ];
  for (const [rulesetId, meters, unit] of [
    ["bb2025-default", 1, "k"],
    ["bb2025-matched-play", 2, "SP"],
    ["eurobowl-2026", 3, "k"],
    ["world-cup-2027", 2, "SPP"],
  ] as const) {
    await act(async () =>
      root.render(
        createElement(TeamBudget, {
          team: { ...team, rulesetId },
          floating: false,
        }),
      ),
    );
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars).toHaveLength(meters);
    expect(bars[meters === 1 ? 0 : 1].getAttribute("aria-valuetext")).toContain(
      unit,
    );
    expect(container.textContent).toContain("budgetPrimarySkills1");
    expect(container.textContent).toContain("budgetSecondarySkills0");
    for (const bar of bars)
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(
        Number(bar.getAttribute("aria-valuemax")),
      );
  }
});

it("expands the same drawer and progress bar, then hands off to the inline budget", async () => {
  await render();
  await reportBudgetPosition(1000);
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  const progress = popup.querySelector('[role="progressbar"]');
  const button = popup.querySelector<HTMLButtonElement>(
    ".budget-drawer-summary button",
  )!;
  expect(popup.dataset.expanded).toBe("false");
  expect(
    popup.querySelector(".budget-drawer-breakdown")!.hasAttribute("inert"),
  ).toBe(true);
  // The handle sits outside Content so the drawer primitive can claim drags.
  expect(
    popup.querySelector('[data-slot="drawer-content"] .budget-drawer-handle'),
  ).toBeNull();
  await act(async () => button.click());
  expect(document.querySelector(".mobile-budget-drawer")).toBe(popup);
  expect(popup.dataset.expanded).toBe("true");
  expect(popup.querySelector('[role="progressbar"]')).toBe(progress);
  expect(popup.querySelector('[data-slot="accordion-trigger"]')).toBeNull();
  await act(async () =>
    popup
      .querySelector<HTMLButtonElement>('button[aria-label="close"]')!
      .click(),
  );
  expect(popup.dataset.expanded).toBe("false");
  expect(popup.querySelector('[role="progressbar"]')).toBe(progress);
  await reportBudgetPosition(600);
  expect(document.querySelector(".mobile-budget-drawer")).toBeNull();
  expect(container.querySelector(".team-budget")).not.toBeNull();
});
