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
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) =>
    async (args: Record<string, unknown>) => {
      state.calls.push({ name: getFunctionName(reference), args });
    },
  useQuery: () => {
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
        venue: "",
        evidenceUrl: "",
        homeFanRoll: null,
        awayFanRoll: null,
        homeFansRoll: null,
        awayFansRoll: null,
        homeStalled: false,
        awayStalled: false,
      },
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
vi.mock("../src/components/player-icon", () => ({ PlayerIcon: () => null }));
vi.mock("../src/components/skill-box", () => ({ SkillList: () => null }));
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

it("opens an away coach's own players first and lets them inspect the opponent", async () => {
  state.viewerId = "opponent";
  const view = await setup();
  try {
    await click(button(view.container, "leagueUx.reportNextPlayers"));
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

it("requires saving or discarding before switching report sections, teams, or players and preserves stale revision protection", async () => {
  const view = await setup();
  try {
    const score = view.container.querySelector<HTMLInputElement>(
      '#report-details input[type="number"]',
    )!;
    await input(score, "2");
    expect(button(view.container, "leagueUx.reportNextPlayers").disabled).toBe(
      true,
    );
    expect(
      view.container.querySelector<HTMLButtonElement>(
        '[aria-controls="report-players"]',
      )!.disabled,
    ).toBe(true);
    await click(button(view.container, "leagueUx.reportDiscardChanges"));
    await click(button(view.container, "leagueUx.reportNextPlayers"));
    const rows = view.container.querySelectorAll<HTMLDetailsElement>(
      "#report-players details.group\\/player",
    );
    await click(rows[0].querySelector("summary")!);
    await input(
      rows[0].querySelector<HTMLInputElement>('input[type="number"]')!,
      "1",
    );
    expect(button(view.container, "Away Team").disabled).toBe(true);
    expect(button(view.container, "leagueUx.reportNextReview").disabled).toBe(
      true,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    rows[1].querySelector("summary")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    state.revision = 2;
    await view.render();
    expect(rows[0].textContent).toContain("leagueUi.staleDraft");
    expect(button(rows[0], "leagueUi.savePlayer").disabled).toBe(true);
    await click(button(view.container, "leagueUx.reportDiscardChanges"));
    expect(button(view.container, "Away Team").disabled).toBe(false);
    expect(state.calls).toHaveLength(0);
  } finally {
    await view.close();
  }
});

it("discarding staged correction details clears the parent submission payload as well as the visible draft", async () => {
  state.status = "completed";
  const view = await setup();
  try {
    await click(button(view.container, "leagueUi.correctReport"));
    const score = view.container.querySelector<HTMLInputElement>(
      '#report-details input[type="number"]',
    )!;
    await input(score, "3");
    await act(async () => {
      score
        .closest("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(score.value).toBe("3");
    await click(button(view.container, "leagueUx.reportDiscardChanges"));
    expect(score.value).toBe("0");
    await click(
      view.container.querySelector<HTMLButtonElement>(
        '[aria-controls="report-review"]',
      )!,
    );
    await input(
      view.container.querySelector<HTMLTextAreaElement>("textarea")!,
      "Correct player record",
    );
    await click(button(view.container, "leagueUi.saveCorrection"));
    const call = state.calls.find(
      (call) => call.name === "leagues:correctMatch",
    );
    expect(call?.args.scoreHome).toBe(0);
    expect(call?.args.scoreAway).toBe(0);
    expect(call?.args).not.toHaveProperty("venue");
  } finally {
    await view.close();
  }
});
