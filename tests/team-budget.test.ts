// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newTeam, getRoster } from "../src/domain/catalog";
import { TeamBudget } from "../src/components/team-budget";

// Base UI registers CloseWatcher only on Android. Set the platform before imports.
vi.hoisted(() => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value:
      "Mozilla/5.0 (Linux; Android 14) Chrome/130.0.0.0 Mobile Safari/537.36",
  });
});

const closeWatchers = new Set<EventTarget>();

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string) => key,
}));

let root: Root;
let container: HTMLDivElement;
let reportIntersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  closeWatchers.clear();
  vi.stubGlobal(
    "CloseWatcher",
    class extends EventTarget {
      constructor() {
        super();
        closeWatchers.add(this);
      }
      destroy() {
        closeWatchers.delete(this);
      }
    },
  );
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

it("never consumes Android Back for the resting bar, and releases it after closing the expanded budget", async () => {
  await render();
  await reportBudgetPosition(1000);
  expect(closeWatchers.size).toBe(0);
  for (let i = 0; i < 2; i++) {
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>(".mobile-budget-bar button")!
        .click(),
    );
    expect(closeWatchers.size).toBe(1);
    await act(async () =>
      [...closeWatchers][0].dispatchEvent(new Event("close")),
    );
    expect(closeWatchers.size).toBe(0);
    expect(document.querySelector(".mobile-budget-bar")).not.toBeNull();
  }
});

it("opens with an upward swipe but leaves horizontal gestures alone", async () => {
  await render();
  await reportBudgetPosition(1000);
  const button = document.querySelector<HTMLButtonElement>(
    ".mobile-budget-bar button",
  )!;
  button.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) =>
    button.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        button: 0,
        pointerId: 1,
        clientX: x,
        clientY: y,
      }),
    );
  await act(async () => {
    pointer("pointerdown", 20, 700);
    pointer("pointerup", 120, 690);
  });
  expect(document.querySelector(".mobile-budget-drawer")).toBeNull();
  await act(async () => {
    pointer("pointerdown", 20, 700);
    pointer("pointerup", 20, 650);
  });
  expect(document.querySelector(".mobile-budget-drawer")).not.toBeNull();
});

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

it("shows Sevens skill slots without currency or the rules dump", async () => {
  const team = newTeam(crypto.randomUUID());
  team.rulesetId = "kyiv-seven-sins-sevens";
  await act(async () =>
    root.render(createElement(TeamBudget, { team, floating: false })),
  );
  const skillMeter = container.querySelector('[data-budget-meter="skills"]')!;
  expect(skillMeter.textContent).toContain("addedSkills");
  expect(skillMeter.textContent).toContain("0 / 1");
  expect(skillMeter.textContent).not.toContain("SP");
  expect(container.textContent).not.toContain("sevensPack");
  expect(container.textContent).not.toContain("squadNotice");
});

it("shows legal EuroBowl Orc skills normally and warns when the shared reserve is exceeded", async () => {
  const team = newTeam(crypto.randomUUID(), "orc");
  team.rulesetId = "eurobowl-2026";
  const players: [string, string[]][] = [
    ["orc-5", []],
    ["orc-4", ["block"]],
    ["orc-4", ["block"]],
    ["orc-3", ["tackle"]],
    ["orc-3", ["guard"]],
    ["orc-2", []],
    ["orc-0", ["wrestle"]],
    ...Array.from({ length: 4 }, (): [string, string[]] => ["orc-0", []]),
    ["orc-1", []],
  ];
  team.players = players.map(([positionId, skills]) => ({
    id: crypto.randomUUID(),
    positionId,
    skills,
    name: "",
  }));
  team.captainId = team.players[1].id;
  team.staff.rerolls = 3;
  team.staff.apothecary = 1;
  await act(async () =>
    root.render(createElement(TeamBudget, { team, floating: false })),
  );
  const skills = container.querySelector('[data-budget-meter="skills"]')!;
  const funds = container.querySelector('[data-budget-meter="funds"]')!;
  expect(skills.textContent).toContain("130k / 120k");
  expect(skills.querySelector('[title="budgetFromFunds"]')).not.toBeNull();
  expect(funds.textContent).toContain("10k / 10k");
  expect(container.querySelector('[class*="amber"]')).toBeNull();
  expect(container.querySelector('[class*="destructive"]')).toBeNull();

  // Spending the reserve on skills leaves none for an extra coach.
  team.staff.assistantCoaches = 1;
  await act(async () =>
    root.render(createElement(TeamBudget, { team, floating: false })),
  );
  expect(funds.textContent).toContain("treasuryOver");
  expect(funds.querySelector(".text-destructive")).not.toBeNull();
  expect(funds.querySelector(".bg-destructive")).not.toBeNull();
});

it("keeps the resting budget outside a dialog, opens on demand, then hands off to the inline budget", async () => {
  await render();
  await reportBudgetPosition(1000);
  const bar = document.querySelector<HTMLElement>(".mobile-budget-bar")!;
  const button = bar.querySelector<HTMLButtonElement>(
    ".budget-drawer-summary button",
  )!;
  const header = bar.querySelector(".budget-drawer-summary")!;
  const headerContent = header.innerHTML;
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector(".mobile-budget-drawer")).toBeNull();
  await act(async () => button.click());
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  expect(document.querySelector(".mobile-budget-bar")).toBeNull();
  // The handle sits outside Content so the drawer primitive can claim drags.
  expect(
    popup.querySelector('[data-slot="drawer-content"] .budget-drawer-handle'),
  ).toBeNull();
  expect(popup.dataset.expanded).toBe("true");
  expect(popup.querySelector(".budget-drawer-summary")!.innerHTML).toBe(
    headerContent.replace('aria-expanded="false"', 'aria-expanded="true"'),
  );
  expect(popup.querySelector('[data-slot="accordion-trigger"]')).toBeNull();
  await act(async () =>
    popup
      .querySelector<HTMLButtonElement>(".budget-drawer-summary button")!
      .click(),
  );
  expect(
    document.querySelector(".mobile-budget-bar .budget-drawer-summary")!
      .innerHTML,
  ).toBe(headerContent);
  await reportBudgetPosition(600);
  expect(document.querySelector(".mobile-budget-drawer")).toBeNull();
  expect(document.querySelector(".mobile-budget-bar")).toBeNull();
  expect(container.querySelector(".team-budget")).not.toBeNull();
});

it("reports an exceeded treasury and keeps the collapsed meter structure unchanged", async () => {
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
  const popup = document.querySelector<HTMLElement>(".mobile-budget-bar")!;
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
  expect(document.querySelector(".mobile-budget-bar")).toBe(popup);
  expect(summary.querySelectorAll("*")).toHaveLength(elementCount);
  expect(summary.textContent).toContain("treasuryOver");
  expect(summary.textContent?.match(/treasuryOver/g)).toHaveLength(1);
  expect(container.querySelector('[aria-label="budgetIssues"]')).toBeNull();
});

it("preserves the collapsed drawer at the limit without league-specific warnings", async () => {
  const team = newTeam(crypto.randomUUID());
  team.players = Array.from({ length: 11 }, (_, i) => ({
    id: crypto.randomUUID(),
    positionId: i === 10 ? "human-4" : "human-0",
    name: "",
    skills: [],
  }));
  team.captainId = team.players[0].id;
  team.staff.rerolls = 8;
  team.staff.dedicatedFans = 2;
  await act(async () => root.render(createElement(TeamBudget, { team })));
  await reportBudgetPosition(1000);
  const popup = document.querySelector<HTMLElement>(".mobile-budget-bar")!;
  const header = popup.querySelector(".budget-drawer-summary")!;
  const progress = header.querySelector('[role="progressbar"]');
  expect(header.textContent).toContain("995k / 1,000k");
  expect(popup.textContent).not.toContain("leagueUi.rookieIssues.rookieFans");
  for (const dedicatedFans of [3, 2]) {
    await act(async () =>
      root.render(
        createElement(TeamBudget, {
          team: { ...team, staff: { ...team.staff, dedicatedFans } },
        }),
      ),
    );
    expect(document.querySelector(".mobile-budget-bar")).toBe(popup);
    expect(popup.querySelector(".budget-drawer-summary")).toBe(header);
    expect(header.querySelector('[role="progressbar"]')).toBe(progress);
    expect(header.textContent).toContain(
      dedicatedFans === 3 ? "1,000k / 1,000k" : "995k / 1,000k",
    );
    expect(
      popup.textContent?.includes("leagueUi.rookieIssues.rookieFans"),
    ).toBe(false);
  }
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
  const popup = document.querySelector(".mobile-budget-bar")!;
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
  const drawer = document.querySelector(".mobile-budget-drawer")!;
  expect(drawer.querySelector(".budget-overview")!.innerHTML).toBe(
    headerContent,
  );
  expect(
    Array.from(drawer.querySelectorAll("[data-budget-meter]"), (meter) =>
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
  const bar = document.querySelector<HTMLElement>(".mobile-budget-bar")!;
  expect(bar.querySelector("button button")).toBeNull();
  expect(bar.textContent).not.toContain("flowingHint");
  const toggle = bar.querySelector<HTMLButtonElement>(
    '.budget-drawer-summary button[aria-label="budgetBreakdown"]',
  )!;
  await act(async () => toggle.click());
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
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
  const bar = document.querySelector<HTMLElement>(".mobile-budget-bar")!;
  await act(async () =>
    bar
      .querySelector<HTMLButtonElement>(".budget-drawer-summary button")!
      .click(),
  );
  const popup = document.querySelector<HTMLElement>(".mobile-budget-drawer")!;
  const breakdown = popup.querySelector(".budget-drawer-breakdown")!;
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
  expect(breakdown.textContent).not.toContain("leagueUi.rookieEligibility");
  expect(breakdown.textContent).not.toContain(
    "leagueUi.rookieIssues.rookieSkills",
  );
  await act(async () =>
    root.render(
      createElement(TeamBudget, {
        team: { ...ready, rulesetId: "bb2025-matched-play" },
      }),
    ),
  );
  expect(breakdown.textContent).toContain("squadNotice");
});
