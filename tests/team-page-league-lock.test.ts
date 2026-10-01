// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { newTeam } from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { TeamPage } from "../src/components/team-page";

const state = vi.hoisted(() => ({
  live: undefined as
    | undefined
    | {
        team: Team;
        revision: number;
        canEdit: boolean;
        leagueLocked: boolean;
        leagueExperienced: boolean;
      },
  draft: null as Team | null,
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => state.live,
}));
vi.mock("../src/lib/drafts", () => ({
  draftAccount: () => "coach",
  draftSnapshot: () => JSON.stringify(state.draft),
  parseDrafts: () => (state.draft ? [state.draft] : []),
  subscribeDrafts: () => () => {},
}));
vi.mock("../src/components/draft-sync-provider", () => ({
  useDraftSync: () => ({ ready: true, account: "coach" }),
}));
vi.mock("../src/components/team-league-links", () => ({
  TeamLeagueLinks: () => null,
}));
vi.mock("../src/components/workspace-loading", () => ({
  WorkspaceLoading: () => createElement("p", null, "Loading"),
}));
vi.mock("../src/components/team-editor", () => ({
  TeamEditor: ({ initial, readOnly }: { initial: Team; readOnly: boolean }) =>
    createElement("button", { disabled: readOnly }, initial.name),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  state.live = undefined;
  state.draft = null;
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("waits for the server lock and never lets a local recovery draft unlock or replace a participating team", async () => {
  const team = newTeam(randomUUID());
  team.name = "Official Humans";
  state.draft = { ...team, name: "Unsaved rename" };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid })),
  );
  expect(container.querySelector("button")).toBeNull();
  state.live = {
    team,
    revision: 8,
    canEdit: false,
    leagueLocked: true,
    leagueExperienced: true,
  };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid })),
  );
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    true,
  );
  expect(container.textContent).toContain(team.name);
  expect(container.textContent).not.toContain(state.draft.name);
  expect(container.textContent).toContain("leagueUi.builderLockedHint");
});

it("permits planning after participation ends while showing that the team remains experienced", async () => {
  const team = newTeam(randomUUID());
  state.live = {
    team,
    revision: 8,
    canEdit: true,
    leagueLocked: false,
    leagueExperienced: true,
  };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid })),
  );
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    false,
  );
  expect(container.textContent).toContain("leagueUi.experiencedTeamHint");
});
