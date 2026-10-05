// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Doc } from "../convex/_generated/dataModel";
import { newTeam } from "../src/domain/catalog";
import { LeagueEnrollment } from "../src/components/league-enrollment";
import { LeagueTeamPicker } from "../src/components/league-team-picker";

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({ revision: 1 }),
  push: vi.fn(),
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("convex/react", () => ({
  useMutation: () =>
    Object.assign(mocks.save, { withOptimisticUpdate: () => mocks.save }),
  useConvexAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("../src/components/draft-sync-provider", () => ({
  useDraftSync: () => ({ ready: true, editing: () => () => {} }),
}));
vi.mock("../src/components/player-icon", () => ({ RosterIcon: () => null }));

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
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("creates a cloud draft with league context and opens that draft in the builder", async () => {
  await act(async () =>
    root.render(
      createElement(LeagueTeamPicker, {
        teams: [],
        value: "",
        onChange: vi.fn(),
        status: "Exhausted",
        loadMore: vi.fn(),
        leagueId: "league",
      }),
    ),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  await act(async () =>
    Array.from(dialog.querySelectorAll("button"))
      .find((button) => button.textContent === "leagueUx.createForLeague")!
      .click(),
  );
  await act(async () =>
    Array.from(dialog.querySelectorAll("button"))
      .find((button) => button.textContent === "createTeam")!
      .click(),
  );
  expect(mocks.save).toHaveBeenCalledWith({
    team: expect.objectContaining({
      rosterId: "human",
      rulesetId: "bb2025-default",
    }),
    expectedRevision: 0,
    leagueId: "league",
  });
  const team = mocks.save.mock.calls[0][0].team;
  expect(mocks.push).toHaveBeenCalledWith(`/teams/${team.uuid}?league=league`);
});

it("waits for saved edits, then enrolls under the league's custom budget", async () => {
  const team = newTeam(randomUUID());
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: "human-0",
    name: "",
    skills: [],
  }));
  team.captainId = team.players[0].id;
  team.staff = {
    ...team.staff,
    rerolls: 8,
    apothecary: 1,
    assistantCoaches: 1,
  };
  const league = {
    _id: "league",
    name: "Kyiv league",
    startingTreasury: 1_200_000,
  } as Doc<"leagues">;
  await act(async () =>
    root.render(
      createElement(LeagueEnrollment, {
        league,
        team,
        pending: true,
        canRegister: true,
      }),
    ),
  );
  let button = container.querySelector<HTMLButtonElement>("button")!;
  expect(button.disabled).toBe(true);
  await act(async () =>
    root.render(
      createElement(LeagueEnrollment, {
        league,
        team,
        pending: false,
        canRegister: true,
      }),
    ),
  );
  button = container.querySelector<HTMLButtonElement>("button")!;
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(mocks.save).toHaveBeenCalledWith({
    leagueId: "league",
    teamUuid: team.uuid,
  });
  expect(mocks.push).toHaveBeenCalledWith("/leagues/manage/league");
});
