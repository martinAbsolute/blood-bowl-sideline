// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LeagueWorkspace } from "../src/components/league-workspace";

const state = vi.hoisted(() => ({
  commissioner: false,
  participant: false,
  postgame: false,
  withdrawn: false,
  view: "overview",
  seasonStatus: "" as string,
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ view: state.view }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
  useQuery: () => ({
    viewerId: "viewer",
    canCommission: state.commissioner,
    canRegister:
      !state.participant &&
      (!state.seasonStatus || state.seasonStatus === "registration"),
    league: {
      _id: "league",
      name: "Autumn League",
      status:
        state.seasonStatus || (state.participant ? "active" : "registration"),
      startAt: 1,
      roundDays: 14,
    },
    entries: state.participant
      ? [
          {
            _id: "mine",
            coachId: "viewer",
            coachName: "My Coach",
            withdrawn: state.withdrawn,
            postGamePending: state.postgame,
            team: { name: "My League Team", rosterId: "human" },
          },
        ]
      : [],
    rounds: [{ _id: "round", status: "open", number: 1, deadlineAt: 1 }],
    matches: state.participant
      ? [
          {
            _id: "match",
            roundId: "round",
            homeEntryId: "mine",
            awayEntryId: "away",
            status: "in-progress",
            confirmedBy: [],
          },
        ]
      : [],
    standings: [],
    playerStats: [],
  }),
}));
vi.mock("../src/components/player-icon", () => ({ RosterIcon: () => null }));
vi.mock("../src/components/league-commissioner", () => ({
  CommissionerWithdrawal: () => null,
}));
vi.mock("../src/components/league-ui", () => ({
  LeagueBack: () => null,
  LeagueError: () => null,
  LeagueGate: () => null,
  LeagueHistory: () => null,
  LeagueStatTable: () => null,
  LeagueStatus: () => null,
  leagueDate: () => "1 Oct",
  localDateInput: () => "2026-10-01T12:00",
  LeagueSection: ({
    title,
    children,
    action,
  }: {
    title: ReactNode;
    children: ReactNode;
    action?: ReactNode;
  }) =>
    createElement(
      "section",
      null,
      createElement("h2", null, title),
      action,
      children,
    ),
  useLeagueAction: () => ({ busy: false, error: "", run: vi.fn() }),
}));

afterEach(() => {
  Object.assign(state, {
    commissioner: false,
    participant: false,
    postgame: false,
    withdrawn: false,
    view: "overview",
    seasonStatus: "",
  });
});

async function render(check: (container: HTMLElement) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(createElement(LeagueWorkspace, { leagueId: "league" })),
    );
    check(container);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
}

it("puts team registration first for a newcomer without commissioner tasks", async () => {
  await render((container) => {
    expect(container.querySelector("h2")?.textContent).toBe(
      "leagueUi.registerTeam",
    );
    expect(container.textContent).not.toContain("leagueUx.commissionerDesk");
    expect(container.textContent).toContain("leagueUi.chooseTeam");
    expect(container.querySelector('a[href="/rosters"]')).toBeNull();
  });
});

it("gives a non-playing commissioner setup tasks and optional team registration", async () => {
  state.commissioner = true;
  await render((container) => {
    expect(container.textContent).toContain("leagueUx.inviteMinimum");
    expect(container.textContent).toContain("leagueUi.registerTeam");
    expect(container.textContent).not.toContain("leagueUx.yourTeam");
  });
});

it("keeps both coach and commissioner actions for a participating commissioner", async () => {
  Object.assign(state, { commissioner: true, participant: true });
  await render((container) => {
    expect(container.textContent).toContain("leagueUx.coachCommissioner");
    expect(container.textContent).toContain("leagueUx.commissionerDesk");
    expect(
      container.querySelector('a[href$="/matches/match"]')?.textContent,
    ).toContain("leagueUx.continueReport");
    expect(container.querySelector('a[href$="/teams/mine"]')).not.toBeNull();
  });
});

it("prioritizes postgame over starting another match", async () => {
  Object.assign(state, { participant: true, postgame: true });
  await render((container) => {
    expect(
      container.querySelector('a[href$="/teams/mine"]')?.textContent,
    ).toContain("leagueUx.finishPostgame");
    expect(container.textContent).not.toContain("leagueUx.continueReport");
  });
});

it("does not offer a withdrawn coach a next-match action", async () => {
  Object.assign(state, { participant: true, withdrawn: true });
  await render((container) => {
    expect(container.textContent).toContain("leagueUi.status.withdrawn");
    expect(container.textContent).not.toContain("leagueUx.continueReport");
  });
});

it("does not expose commissioner controls through a manually selected view", async () => {
  state.view = "manage";
  await render((container) => {
    expect(container.textContent).toContain("leagueUi.registerTeam");
    expect(container.textContent).not.toContain("leagueUx.commissionerDesk");
    expect(container.textContent).not.toContain("leagueUi.launchPhase");
  });
});

it("explains the spectator view once registration closes", async () => {
  state.seasonStatus = "active";
  await render((container) => {
    expect(container.textContent).toContain("leagueUx.spectatorView");
    expect(container.textContent).toContain("leagueUx.followSeasonHint");
    expect(container.textContent).not.toContain("leagueUi.registerTeam");
    expect(container.textContent).not.toContain("leagueUx.commissionerDesk");
  });
});

it("offers final standings and career history after a completed season", async () => {
  Object.assign(state, { participant: true, seasonStatus: "completed" });
  await render((container) => {
    expect(container.textContent).toContain("leagueUx.seasonComplete");
    expect(container.textContent).toContain("leagueUx.finalStandings");
    expect(
      container.querySelector('a[href$="/teams/mine"]')?.textContent,
    ).toContain("leagueUx.viewCareer");
    expect(container.textContent).not.toContain("leagueUx.continueReport");
  });
});

it("keeps unfinished postgame reachable after the final match", async () => {
  Object.assign(state, {
    participant: true,
    postgame: true,
    seasonStatus: "completed",
  });
  await render((container) => {
    expect(
      container.querySelector('a[href$="/teams/mine"]')?.textContent,
    ).toContain("leagueUx.finishPostgame");
    expect(container.textContent).not.toContain("leagueUx.continueReport");
  });
});
