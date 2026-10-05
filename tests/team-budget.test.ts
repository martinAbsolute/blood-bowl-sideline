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
  expect(container.textContent).toContain("treasury");
  expect(container.textContent).not.toContain("starPlayers");
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
    expect(container.textContent).toContain("addedSkillsCount");
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
  const header = popup.querySelector(".budget-drawer-summary")!;
  const headerContent = header.innerHTML;
  const breakdown = popup.querySelector(".budget-drawer-breakdown");
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
  expect(popup.querySelector(".budget-drawer-breakdown")).toBe(breakdown);
  expect(header.innerHTML).toBe(
    headerContent.replace('aria-expanded="false"', 'aria-expanded="true"'),
  );
  expect(popup.querySelector('[data-slot="accordion-trigger"]')).toBeNull();
  await act(async () => button.click());
  expect(popup.dataset.expanded).toBe("false");
  expect(popup.querySelector('[role="progressbar"]')).toBe(progress);
  expect(header.innerHTML).toBe(headerContent);
  await reportBudgetPosition(600);
  expect(document.querySelector(".mobile-budget-drawer")).toBeNull();
  expect(container.querySelector(".team-budget")).not.toBeNull();
});

it("reports an exceeded treasury once and keeps the collapsed meter structure unchanged", async () => {
  const team = newTeam("budget-test");
  team.players = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i}`,
    positionId: "human-0",
    name: "",
    skills: [],
  }));
  team.staff.rerolls = 4;
  await act(async () => root.render(createElement(TeamBudget, { team })));
  await reportBudgetPosition(1000);
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  const summary = popup.querySelector(".budget-overview")!;
  const elementCount = summary.querySelectorAll("*").length;
  expect(summary.textContent).toContain("1,000k / 1,000k");
  expect(summary.textContent).not.toContain("treasuryLeft");
  await act(async () =>
    root.render(
      createElement(TeamBudget, {
        team: { ...team, staff: { ...team.staff, assistantCoaches: 1 } },
      }),
    ),
  );
  expect(document.querySelector(".mobile-budget-drawer")).toBe(popup);
  expect(popup.dataset.expanded).toBe("false");
  expect(summary.querySelectorAll("*")).toHaveLength(elementCount);
  expect(summary.textContent).toContain("treasuryOver");
  expect(container.textContent?.match(/treasuryOver/g)).toHaveLength(1);
  expect(container.querySelector('[aria-label="budgetIssues"]')).toBeNull();
});

it("surfaces skill-only overspending in the closed drawer", async () => {
  const team = newTeam("budget-test");
  team.rulesetId = "bb2025-matched-play";
  team.players = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`,
    positionId: "human-0",
    name: "",
    skills: ["block"],
  }));
  await act(async () => root.render(createElement(TeamBudget, { team })));
  await reportBudgetPosition(1000);
  const popup = document.querySelector(".mobile-budget-drawer")!;
  expect(
    popup
      .querySelector(".budget-overview [data-budget-meter]")
      ?.getAttribute("data-budget-meter"),
  ).toBe("skills");
  expect(popup.querySelector(".budget-overview")?.textContent).toContain(
    "treasuryOver",
  );
  const header = popup.querySelector(".budget-overview")!;
  const headerContent = header.innerHTML;
  await act(async () =>
    popup
      .querySelector<HTMLButtonElement>(".budget-drawer-summary button")!
      .click(),
  );
  expect(header.innerHTML).toBe(headerContent);
  expect(
    Array.from(popup.querySelectorAll("[data-budget-meter]"), (meter) =>
      meter.getAttribute("data-budget-meter"),
    ),
  ).toEqual(["skills", "team"]);
});

it("opens Flowing Funds help from the drawer header without nesting buttons or toggling the drawer", async () => {
  const team = newTeam("budget-test");
  team.rulesetId = "eurobowl-2026";
  team.players = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i}`,
    positionId: "human-0",
    name: "",
    skills: [],
  }));
  team.staff = {
    ...team.staff,
    rerolls: 4,
    apothecary: 1,
    assistantCoaches: 4,
  };
  await act(async () => root.render(createElement(TeamBudget, { team })));
  await reportBudgetPosition(1000);
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  expect(popup.querySelector("button button")).toBeNull();
  expect(popup.textContent).not.toContain("flowingHint");
  const toggle = popup.querySelector<HTMLButtonElement>(
    '.budget-drawer-summary button[aria-label="budgetBreakdown"]',
  )!;
  await act(async () => toggle.click());
  const help = popup.querySelector<HTMLButtonElement>(
    '.budget-drawer-summary button[aria-label="explainRule"]',
  )!;
  expect(help).not.toBeNull();
  await act(async () => help.click());
  expect(popup.dataset.expanded).toBe("true");
  expect(
    Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) =>
      dialog.textContent?.includes("flowingHint"),
    ),
  ).toBe(true);
});

it("shows readiness in an empty default drawer and updates warnings as the team changes", async () => {
  const team = newTeam(crypto.randomUUID());
  await act(async () => root.render(createElement(TeamBudget, { team })));
  await reportBudgetPosition(1000);
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  const breakdown = popup.querySelector(".budget-drawer-breakdown")!;
  await act(async () =>
    popup
      .querySelector<HTMLButtonElement>(".budget-drawer-summary button")!
      .click(),
  );
  expect(breakdown.hasAttribute("inert")).toBe(false);
  expect(breakdown.textContent).toContain("workInProgress");
  expect(breakdown.textContent).toContain("issues.minPlayers");
  const ready = {
    ...team,
    players: Array.from({ length: 11 }, () => ({
      id: crypto.randomUUID(),
      positionId: "human-0",
      name: "",
      skills: [],
    })),
  };
  ready.captainId = ready.players[0].id;
  await act(async () =>
    root.render(createElement(TeamBudget, { team: ready })),
  );
  expect(breakdown.textContent).toContain("legalText");
  expect(breakdown.textContent).not.toContain("workInProgress");
  expect(breakdown.textContent).not.toContain("issues.minPlayers");
  await act(async () =>
    root.render(
      createElement(TeamBudget, {
        team: {
          ...ready,
          players: ready.players.map((player, i) => ({
            ...player,
            skills: i === 0 ? ["block"] : [],
          })),
        },
      }),
    ),
  );
  expect(breakdown.textContent).toContain("leagueUi.rookieEligibility");
  expect(breakdown.textContent).toContain("leagueUi.rookieIssues.rookieSkills");
  await act(async () =>
    root.render(
      createElement(TeamBudget, {
        team: { ...ready, rulesetId: "bb2025-matched-play" },
      }),
    ),
  );
  expect(breakdown.textContent).toContain("squadNotice");
});
