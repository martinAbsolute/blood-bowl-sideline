// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LeagueCareer } from "../src/components/league-career";

const state = vi.hoisted(() => ({ revision: 1 }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => async () => null,
  usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
  useQuery: (_reference: unknown, args: { entryId?: string }) =>
    args.entryId
      ? {
          entry: {
            _id: "entry",
            revision: state.revision,
            treasury: state.revision * 5000,
            postGamePending: true,
            firstPlayedAt: 1,
            coachId: "coach",
            coachName: "Coach",
            blockedPositionIds: [],
            team: { name: "Team", rosterId: "unknown", players: [], staff: {} },
          },
          league: { _id: "league", name: "League" },
          players: [],
          history: [],
          canManage: true,
          canCommission: true,
          teamValue: 0,
          currentTeamValue: 0,
        }
      : null,
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  RosterIcon: () => null,
}));
vi.mock("../src/components/skill-box", () => ({ SkillList: () => null }));
vi.mock("../src/components/league-ui", async () => {
  const { createElement } = await import("react");
  return {
    LeagueBack: () => null,
    LeagueError: () => null,
    LeagueGate: () => null,
    LeagueHistory: () => null,
    LeagueStatTable: () => null,
    LeagueStatus: () => null,
    DiceInput: () => null,
    LeagueSection: ({
      title,
      children,
    }: {
      title: string;
      children?: import("react").ReactNode;
    }) =>
      createElement(
        "section",
        null,
        createElement("h2", null, title),
        children,
      ),
    useLeagueAction: () => ({
      busy: false,
      error: null,
      run: async () => true,
    }),
  };
});

it("retains one treasury and one postgame form across career revisions with fresh treasury", async () => {
  const warnings = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    for (const revision of [1, 2, 3, 4]) {
      state.revision = revision;
      await act(async () =>
        root.render(
          createElement(LeagueCareer, { leagueId: "league", entryId: "entry" }),
        ),
      );
      const headings = [...container.querySelectorAll("h2")].map(
        (heading) => heading.textContent,
      );
      expect(
        headings.filter((heading) => heading === "leagueUi.correctTreasury"),
      ).toHaveLength(1);
      expect(
        headings.filter((heading) => heading === "leagueUi.completePostgame"),
      ).toHaveLength(1);
      const amount = container.querySelector<HTMLInputElement>(
        'input[type="number"]',
      );
      expect(amount?.value).toBe(String(revision * 5000));
    }
    expect(
      warnings.mock.calls.filter(([message]) =>
        String(message).includes("same key"),
      ),
    ).toHaveLength(0);
  } finally {
    await act(async () => root.unmount());
    warnings.mockRestore();
    container.remove();
  }
});
