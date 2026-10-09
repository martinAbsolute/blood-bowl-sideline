// @vitest-environment happy-dom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { newTeam } from "../src/domain/catalog";
import type { Team } from "../src/domain/types";
import { TeamPage } from "../src/components/team-page";
import { getFunctionName, type FunctionReference } from "convex/server";

const state = vi.hoisted(() => ({
  live: undefined as
    | undefined
    | null
    | {
        team: Team;
        revision: number;
        canEdit: boolean;
        leagueLocked: boolean;
        leagueExperienced: boolean;
      },
  draft: null as Team | null,
  isOwner: true,
  authLoading: false,
  syncReady: true,
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: true,
    isLoading: state.authLoading,
  }),
  useQuery: (query: FunctionReference<"query">) =>
    getFunctionName(query) === "leagues:listTeamCareers"
      ? [
          {
            entryId: "entry",
            leagueId: "league",
            leagueName: "Giga League",
            isOwner: state.isOwner,
          },
        ]
      : state.live,
}));
vi.mock("../src/lib/drafts", () => ({
  draftAccount: () => "coach",
  draftSnapshot: () => JSON.stringify(state.draft),
  parseDrafts: () => (state.draft ? [state.draft] : []),
  subscribeDrafts: () => () => {},
}));
vi.mock("../src/components/draft-sync-provider", () => ({
  useDraftSync: () => ({ ready: state.syncReady, account: "coach" }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));
vi.mock("../src/components/workspace-loading", () => ({
  WorkspaceLoading: () => createElement("p", null, "Loading"),
}));
vi.mock("../src/components/team-editor", () => ({
  TeamEditor: ({
    initial,
    readOnly,
    leagueNotice,
  }: {
    initial: Team;
    readOnly: boolean;
    leagueNotice: ReactNode;
  }) => {
    // Match the real editor: the initial team is captured in component state.
    const [team] = useState(initial);
    return createElement(
      "div",
      null,
      createElement("a", { href: "/teams" }, "My teams"),
      leagueNotice,
      createElement("button", { disabled: readOnly }, team.name),
    );
  },
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
  state.isOwner = true;
  state.authLoading = false;
  state.syncReady = true;
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
  expect(container.textContent).toContain("leagueUi.builderLockedOwnerHint");
  expect(container.querySelectorAll("aside")).toHaveLength(1);
  expect(container.querySelector("a")?.textContent).toBe("My teams");
});

it("updates an already open locked team page when a commissioner renames its saved team", async () => {
  const team = newTeam(randomUUID());
  team.name = "Old Humans";
  state.draft = { ...team, name: "Stale local name" };
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
  expect(container.querySelector("button")?.textContent).toBe(team.name);

  state.live = {
    ...state.live,
    team: { ...team, name: "Commissioner Corrected Humans" },
    revision: 9,
  };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid })),
  );
  expect(container.querySelector("button")?.textContent).toBe(
    state.live.team.name,
  );
  expect(container.textContent).not.toContain(state.draft.name);
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    true,
  );
});

it("shows shared viewers where to find the current roster without telling them to manage the team", async () => {
  const team = newTeam(randomUUID());
  state.isOwner = false;
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
  expect(container.textContent).toContain("leagueUi.builderLockedViewerHint");
  expect(container.textContent).not.toContain(
    "leagueUi.builderLockedOwnerHint",
  );
  expect(container.querySelectorAll("aside")).toHaveLength(1);
  expect(container.querySelector("aside a")?.getAttribute("href")).toBe(
    "/leagues/manage/league/teams/entry",
  );
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    true,
  );
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

it("renders the saved public snapshot read-only while auth and draft recovery load, then restores local editing", async () => {
  const team = newTeam(randomUUID());
  team.name = "Saved public roster";
  const initial = {
    team,
    revision: 8,
    legal: false,
    updatedAt: Date.now(),
    favorite: undefined,
    draftLeagueId: undefined,
    canEdit: true,
    leagueLocked: false,
    leagueExperienced: false,
  };
  state.authLoading = true;
  state.syncReady = false;
  state.draft = { ...team, name: "Unsaved local recovery" };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid, initial })),
  );
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    true,
  );
  expect(container.textContent).toContain(team.name);
  expect(container.textContent).not.toContain(state.draft.name);

  state.authLoading = false;
  state.syncReady = true;
  state.live = initial;
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid, initial })),
  );
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    false,
  );
  expect(container.textContent).toContain(state.draft.name);
  expect(container.textContent).not.toContain(team.name);
});

it("drops the server preview when the live team disappears and replaces it with a newer locked revision", async () => {
  const team = newTeam(randomUUID());
  team.name = "Saved public roster";
  const initial = {
    team,
    revision: 8,
    legal: false,
    updatedAt: Date.now(),
    favorite: undefined,
    draftLeagueId: undefined,
    canEdit: false,
    leagueLocked: true,
    leagueExperienced: true,
  };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid, initial })),
  );
  expect(container.textContent).toContain(team.name);
  state.live = {
    ...initial,
    revision: 9,
    team: { ...team, name: "New locked roster" },
  };
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid, initial })),
  );
  expect(container.textContent).toContain("New locked roster");
  expect(container.textContent).not.toContain(team.name);
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
    true,
  );
  state.live = null;
  await act(async () =>
    root.render(createElement(TeamPage, { uuid: team.uuid, initial })),
  );
  expect(container.textContent).not.toContain(team.name);
  expect(container.textContent).not.toContain("New locked roster");
  expect(container.querySelector("button")).toBeNull();
});
