// @vitest-environment happy-dom
import {
  act,
  createElement,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { emptyPlayerStats } from "../src/domain/league-rules";
import { LeagueMatch } from "../src/components/league-match";

const state = vi.hoisted(() => ({
  status: "in-progress",
  revision: 1,
  viewerId: "coach",
  calls: [] as { name: string; args: Record<string, unknown> }[],
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const mutate = async (args: Record<string, unknown>) => {
      state.calls.push({ name: getFunctionName(reference), args });
    };
    mutate.withOptimisticUpdate = () => mutate;
    return mutate;
  },
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) === "leagues:getMatchHistory") return [];
    const home = {
      _id: "home",
      coachId: "coach",
      coachName: "Home Coach",
      team: { name: "Home Team", rosterId: "unknown" },
    };
    const away = {
      _id: "away",
      coachId: "opponent",
      coachName: "Away Coach",
      team: { name: "Away Team", rosterId: "unknown" },
    };
    return {
      league: { _id: "league", name: "League" },
      home,
      away,
      viewerId: state.viewerId,
      canEdit: true,
      canCommission: true,
      canConfirm: true,
      match: {
        _id: "match",
        status: state.status,
        revision: state.revision,
        scoreHome: 0,
        scoreAway: 0,
        confirmedBy: [],
        homeFanRoll: null,
        awayFanRoll: null,
        homeFansRoll: null,
        awayFansRoll: null,
        homeStalled: false,
        awayStalled: false,
      },
      playEvents: [],
      players: ["first", "second"].map((name) => ({
        _id: name,
        playerId: name,
        entryId: "home",
        name,
        positionId: "unknown",
        participated: true,
        stats: emptyPlayerStats(),
        statusAfter: "active",
        injuryNotes: "",
        casualtyRoll: null,
        lastingRoll: null,
        skills: [],
        snapshot: {
          positionName: "Lineman",
          baseCost: 50000,
          valueIncrease: 0,
          baseSkills: [],
          status: "active",
          profile: { ma: 6, st: 3, ag: 3, pa: 3, av: 9 },
        },
      })),
    };
  },
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  RosterIcon: () => null,
}));
vi.mock("../src/components/skill-box", () => ({
  SkillList: () => null,
  TableSkills: () => null,
}));
vi.mock("../src/components/league-help", () => ({ LeagueHelp: () => null }));
vi.mock("../src/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open
      ? createElement(
          "div",
          { role: "dialog" },
          children,
          createElement(
            "button",
            { "data-slot": "dialog-close", onClick: () => onOpenChange(false) },
            "close",
          ),
        )
      : null,
  DialogContent: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  DialogHeader: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  DialogTitle: ({ children }: { children: ReactNode }) =>
    createElement("h2", null, children),
  DialogDescription: ({ children }: { children: ReactNode }) =>
    createElement("p", null, children),
}));
vi.mock("../src/components/league-commissioner", () => ({
  CommissionerRuling: () => null,
}));
vi.mock("../src/components/ui/button", () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement("button", { type: "button", ...props }),
}));
vi.mock("../src/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) =>
    createElement("input", { ...props, onInput: props.onChange }),
}));
vi.mock("../src/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    createElement("textarea", { ...props, onInput: props.onChange }),
}));
vi.mock("../src/components/league-ui", () => ({
  LeagueBack: () => null,
  LeagueError: () => null,
  LeagueGate: () => null,
  LeagueStatus: () => null,
  DiceInput: () => null,
  LeagueSection: ({
    title,
    children,
    action,
  }: {
    title: string;
    children?: ReactNode;
    action?: ReactNode;
  }) =>
    createElement(
      "section",
      null,
      createElement("h2", null, title),
      children,
      action,
    ),
  useLeagueAction: () => ({
    busy: false,
    error: null,
    run: async (action: () => Promise<unknown>) => {
      await action();
      return true;
    },
  }),
}));

afterEach(() => {
  state.viewerId = "coach";
  state.status = "in-progress";
  state.revision = 1;
  state.calls = [];
});

async function setup() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async () => {
    await act(async () => {
      root.render(
        createElement(LeagueMatch, { leagueId: "league", matchId: "match" }),
      );
    });
  };
  await render();
  return {
    container,
    render,
    close: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
function button(container: HTMLElement, label: string) {
  const result = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((element) => element.textContent?.trim() === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}
async function input(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}

it("records an event instead of editing counters and shows the review timeline", async () => {
  const view = await setup();
  try {
    expect(view.container.textContent).not.toContain(
      "leagueUx.reportMoreStats",
    );
    expect(
      view.container.querySelector("#report-game input[role=spinbutton]"),
    ).toBeNull();
    expect(
      view.container.querySelector("#report-post-game input[role=spinbutton]"),
    ).toBeNull();
    await click(button(view.container, "matchEvents.add"));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "matchEvents.editorHint",
    );
    await act(async () =>
      document
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      name: "leagues:savePlayEvent",
      args: {
        matchId: "match",
        expectedVersion: 0,
        event: { kind: "touchdown", playerId: "first", targetId: null },
      },
    });
    expect(
      view.container.querySelector("#report-post-game")?.textContent,
    ).toContain("matchEvents.review");
  } finally {
    await view.close();
  }
});
it("keeps a new commissioner event local until the correction is applied", async () => {
  state.status = "completed";
  const view = await setup();
  try {
    await click(button(view.container, "leagueUi.correctReport"));
    await click(button(view.container, "matchEvents.add"));
    await act(async () =>
      document
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(state.calls).toHaveLength(0);
    expect(view.container.textContent).toContain(
      "matchEvents.sentences.touchdown",
    );
    await click(button(view.container, "cancel"));
    expect(view.container.textContent).not.toContain(
      "matchEvents.sentences.touchdown",
    );
  } finally {
    await view.close();
  }
});

it("opens an away coach's own players first and lets them inspect the opponent", async () => {
  state.viewerId = "opponent";
  const view = await setup();
  try {
    await click(button(view.container, "matchEvents.roster"));
    expect(
      button(view.container, "Away Team").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      button(view.container, "Home Team").getAttribute("aria-pressed"),
    ).toBe("false");
    await click(button(view.container, "Home Team"));
    expect(
      button(view.container, "Home Team").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(state.calls).toHaveLength(0);
  } finally {
    await view.close();
  }
});

it("opens builder-style player profiles and adds events from a player", async () => {
  const view = await setup();
  try {
    await click(button(view.container, "matchEvents.roster"));
    await click(button(view.container, "first"));
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("leagueUx.reportGame");
    expect(dialog.querySelector("input")).toBeNull();
    await click(button(dialog, "matchEvents.add"));
    expect(document.querySelector("form")).not.toBeNull();
    expect(state.calls).toHaveLength(0);
  } finally {
    await view.close();
  }
});

it("removes totals, venue and evidence editors from all steps", async () => {
  const view = await setup();
  try {
    expect(view.container.textContent).not.toMatch(
      /sharedHint|legacy|winningsHint|leagueUi.evidence|leagueUi.venue/,
    );
    expect(view.container.querySelector("#report-pre-game input")).toBeNull();
    expect(
      view.container.querySelector('#report-post-game input[type="url"]'),
    ).toBeNull();
    expect(
      button(view.container, "leagueUx.reportNextPostGame").getAttribute(
        "variant",
      ),
    ).toBe("default");
    expect(
      button(view.container, "leagueUx.reportPrevious").getAttribute("variant"),
    ).toBe("outline");
  } finally {
    await view.close();
  }
});

it("stages a completed report correction, can cancel it and protects against a newer recorded revision", async () => {
  state.status = "completed";
  const view = await setup();
  try {
    await click(button(view.container, "leagueUi.correctReport"));
    await click(
      view.container.querySelector<HTMLButtonElement>(
        '[aria-controls="report-post-game"]',
      )!,
    );
    await input(
      view.container.querySelector<HTMLTextAreaElement>("textarea")!,
      "Correct player record",
    );
    state.revision = 2;
    await view.render();
    expect(view.container.textContent).toContain("leagueUi.staleDraft");
    expect(button(view.container, "leagueUi.saveCorrection").disabled).toBe(
      true,
    );
    await click(button(view.container, "cancel"));
    expect(view.container.textContent).not.toContain("leagueUi.saveCorrection");
    expect(state.calls).toHaveLength(0);
  } finally {
    await view.close();
  }
});

it("disables a completed report until a commissioner explicitly begins a correction", async () => {
  state.status = "completed";
  const view = await setup();
  try {
    expect(
      view.container.querySelector<HTMLFieldSetElement>(
        "#report-pre-game fieldset",
      )!.disabled,
    ).toBe(true);
    await click(button(view.container, "leagueUi.correctReport"));
    expect(
      view.container.querySelector<HTMLFieldSetElement>(
        "#report-pre-game fieldset",
      )!.disabled,
    ).toBe(false);
  } finally {
    await view.close();
  }
});
