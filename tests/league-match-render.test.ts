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
    await click(button(view.container, "leagueUx.reportNextGame"));
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

it("syncs fields immediately and lets coaches switch steps, teams and rows during edits", async () => {
  const view = await setup();
  try {
    const venue = view.container.querySelector<HTMLInputElement>(
      "#report-pre-game input",
    )!;
    await input(venue, "Table 3 ");
    expect(state.calls[0]).toEqual({
      name: "leagues:updateMatchDetails",
      args: { matchId: "match", venue: "Table 3 " },
    });
    await click(button(view.container, "leagueUx.reportNextGame"));
    const rows = view.container.querySelectorAll<HTMLDetailsElement>(
      "#report-game details.group\\/player",
    );
    await click(rows[0].querySelector("summary")!);
    await input(
      rows[0].querySelector<HTMLInputElement>('input[type="number"]')!,
      "1",
    );
    expect(state.calls[1]).toEqual({
      name: "leagues:patchMatchPlayer",
      args: { matchId: "match", playerId: "first", stats: { td: 1 } },
    });
    expect(button(view.container, "Away Team").disabled).toBe(false);
    expect(button(view.container, "leagueUx.reportNextPostGame").disabled).toBe(
      false,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    rows[1].querySelector("summary")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    state.revision = 2;
    await view.render();
    expect(rows[0].textContent).not.toContain("leagueUi.staleDraft");
    expect(view.container.textContent).not.toContain("leagueUi.savePlayer");
    expect(view.container.textContent).not.toContain("leagueUi.saveDetails");
    await click(button(view.container, "leagueUx.reportNextPostGame"));
    await input(
      view.container.querySelector<HTMLInputElement>(
        '#report-post-game input[type="number"]',
      )!,
      "2",
    );
    expect(state.calls[2]).toEqual({
      name: "leagues:updateMatchDetails",
      args: { matchId: "match", scoreHome: 2 },
    });
  } finally {
    await view.close();
  }
});

it("stages a completed report correction, can cancel it and protects against a newer recorded revision", async () => {
  state.status = "completed";
  const view = await setup();
  try {
    await click(button(view.container, "leagueUi.correctReport"));
    const score = view.container.querySelector<HTMLInputElement>(
      '#report-post-game input[type="number"]',
    )!;
    await input(score, "3");
    expect(score.value).toBe("3");
    expect(state.calls).toHaveLength(0);
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
    expect(score.value).toBe("0");
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
