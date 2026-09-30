// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { newTeam } from "../src/domain/catalog";
import {
  readDrafts,
  storeDraft,
  draftAccount,
  readRevision,
} from "../src/lib/drafts";
import { saveCloudDraft } from "../src/lib/cloud-save";
import {
  DraftSyncProvider,
  useDraftSync,
} from "../src/components/draft-sync-provider";
import { TeamName } from "../src/components/team-name";
import { CreateTeamButton } from "../src/components/create-team-button";
import { TeamLibrary } from "../src/components/team-library";
import { libraryMatches } from "../src/lib/team-library";

const mocks = vi.hoisted(() => ({
  authenticated: false,
  account: null as string | null,
  save: vi.fn(),
  push: vi.fn(),
  results: [] as { team: ReturnType<typeof newTeam> }[],
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: false,
  }),
  useQuery: () =>
    mocks.account ? { id: mocks.account, name: "Telegram Coach" } : null,
  useMutation: () => mocks.save,
  usePaginatedQuery: () => ({
    results: mocks.results,
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));
vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    prefetch?: boolean;
  }) => {
    void _prefetch;
    return createElement("a", props, children);
  },
}));
vi.mock("../src/components/site-shell", () => ({
  LoginButton: () => createElement("button", null, "signIn"),
}));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  mocks.authenticated = false;
  mocks.account = null;
  mocks.results = [];
  mocks.push.mockReset();
  mocks.save.mockReset().mockResolvedValue({ revision: 1 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function Status() {
  const sync = useDraftSync();
  return createElement(
    "button",
    { onClick: sync.retry },
    `failed:${sync.failed.size}`,
  );
}
function renderSync() {
  return createElement(
    StrictMode,
    null,
    createElement(DraftSyncProvider, null, createElement(Status)),
  );
}
async function tick() {
  await act(async () => vi.advanceTimersByTimeAsync(60));
}

it("uploads every guest draft after sign-in, including incomplete rosters, and clears acknowledged local copies", async () => {
  const teams = [
    newTeam(randomUUID(), "goblin"),
    newTeam(randomUUID(), "dwarf"),
  ];
  teams.forEach((team) => storeDraft(team));
  await act(async () => root.render(renderSync()));
  await tick();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.authenticated = true;
  mocks.account = "account-a";
  await act(async () => root.render(renderSync()));
  await tick();
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.save.mock.calls.map(([args]) => args.team.uuid).sort()).toEqual(
    teams.map((team) => team.uuid).sort(),
  );
  expect(readDrafts()).toEqual([]);
  expect(teams.map((team) => readRevision(team.uuid))).toEqual([1, 1]);
});
it("keeps failed work, continues uploading other drafts, and retries only on request", async () => {
  const first = newTeam(randomUUID()),
    second = newTeam(randomUUID());
  storeDraft(second);
  storeDraft(first);
  mocks.authenticated = true;
  mocks.account = "account-a";
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  await act(async () => root.render(renderSync()));
  await tick();
  await tick();
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(readDrafts()).toEqual([first]);
  expect(container.textContent).toBe("failed:1");
  expect(draftAccount(first.uuid)).toBe("account-a");
  await act(async () => container.querySelector("button")!.click());
  await tick();
  expect(readDrafts()).toEqual([]);
  expect(container.textContent).toBe("failed:0");
});
it("never uploads another account's recovery work when signing in or switching accounts", async () => {
  const privateTeam = newTeam(randomUUID()),
    guest = newTeam(randomUUID());
  storeDraft(privateTeam, "account-a");
  storeDraft(guest);
  mocks.authenticated = true;
  mocks.account = "account-b";
  await act(async () => root.render(renderSync()));
  await tick();
  await tick();
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team: guest,
    expectedRevision: 0,
  });
  expect(readDrafts()).toEqual([privateTeam]);
  mocks.account = "account-a";
  await act(async () => root.render(renderSync()));
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(readDrafts()).toEqual([]);
});
it("preserves a newer edit while an upload is in flight and syncs it with the returned revision", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team);
  let complete!: (result: { revision: number }) => void;
  mocks.save
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ revision: 2 });
  mocks.authenticated = true;
  mocks.account = "account-a";
  await act(async () => root.render(renderSync()));
  await tick();
  const changed = { ...team, name: "Latest edit" };
  await act(async () => storeDraft(changed, "account-a"));
  await act(async () => complete({ revision: 1 }));
  expect(readDrafts()).toEqual([changed]);
  await tick();
  expect(mocks.save.mock.calls[1][0]).toEqual({
    team: changed,
    expectedRevision: 1,
  });
  expect(readDrafts()).toEqual([]);
});
it("deduplicates overlapping library/editor uploads and serializes a different snapshot", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team);
  let complete!: (result: { revision: number }) => void;
  mocks.save
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ revision: 2 });
  const first = saveCloudDraft(team, 0, mocks.save),
    same = saveCloudDraft(team, 0, mocks.save);
  expect(first).toBe(same);
  const changed = { ...team, name: "Newer" };
  storeDraft(changed);
  const next = saveCloudDraft(changed, 0, mocks.save);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  complete({ revision: 1 });
  await first;
  await next;
  expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(1);
  expect(readDrafts()).toEqual([]);
});
it("shows one card per team when a local recovery copy overlaps a cloud team", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team, "account-a");
  mocks.authenticated = true;
  mocks.account = "account-a";
  mocks.results = [{ team }];
  await act(async () =>
    root.render(
      createElement(DraftSyncProvider, null, createElement(TeamLibrary)),
    ),
  );
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(container.querySelector("article a")?.getAttribute("href")).toBe(
    `/teams/${team.uuid}`,
  );
  await tick();
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(container.querySelector("article a")?.getAttribute("href")).toBe(
    `/teams/${team.uuid}`,
  );
});
it("filters the guest library by search and roster and lets the coach clear an empty result", async () => {
  const goblin = { ...newTeam(randomUUID(), "goblin"), name: "Green Grinders" };
  storeDraft(goblin);
  storeDraft(newTeam(randomUUID(), "dwarf"));
  await act(async () => root.render(createElement(TeamLibrary)));
  const search = container.querySelector<HTMLInputElement>(
    'input[aria-label="searchMyTeams"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(search, "Green");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll("article")).toHaveLength(1);
  const roster = container.querySelector<HTMLSelectElement>(
    'select[aria-label="roster"]',
  )!;
  await act(async () => {
    roster.value = "dwarf";
    roster.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.textContent).toContain("noMatchingTeams");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "clearFilters")!
      .click(),
  );
  expect(container.querySelectorAll("article")).toHaveLength(2);
});
it("matches coach and ruleset prefixes without ignoring combined filters", () => {
  const team = { ...newTeam(randomUUID(), "goblin"), coach: "Олександр" };
  expect(
    libraryMatches(team, {
      search: "Олекс",
      rosterId: "goblin",
      rulesetId: team.rulesetId,
    }),
  ).toBe(true);
  expect(
    libraryMatches(team, { search: "Олекс", rosterId: "dwarf", rulesetId: "" }),
  ).toBe(false);
});
it("finishes filename editing with Enter, restores it with Escape, and normalizes pasted newlines", async () => {
  let value = "Original team";
  const change = vi.fn((next: string) => {
    value = next;
    render();
  });
  const render = () =>
    root.render(
      createElement(TeamName, {
        value,
        placeholder: "Untitled",
        label: "Name",
        onChange: change,
      }),
    );
  await act(async () => render());
  const name = container.querySelector("textarea")!;
  await act(async () => {
    name.focus();
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(name, "Changed\nname");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(value).toBe("Changed name");
  await act(async () =>
    name.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(value).toBe("Original team");
  expect(document.activeElement).not.toBe(name);
  await act(async () => {
    name.focus();
    name.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  expect(document.activeElement).not.toBe(name);
});

it("acknowledges names exactly while they are being typed, without retaining duplicate recovery cards", async () => {
  const team = { ...newTeam(randomUUID()), name: "Typing ", coach: "Coach " };
  storeDraft(team);
  expect(readDrafts()[0]).toEqual(team);
  await saveCloudDraft(team, 0, mocks.save);
  expect(readDrafts()).toEqual([]);
});

it("stores a selected roster before navigating directly to its UUID editor", async () => {
  mocks.push.mockImplementation((path: string) => {
    const draft = readDrafts()[0];
    expect(draft.rosterId).toBe("goblin");
    expect(path).toBe(`/teams/${draft.uuid}`);
  });
  await act(async () =>
    root.render(createElement(CreateTeamButton, { rosterId: "goblin" })),
  );
  await act(async () =>
    (container.querySelector("button") as HTMLButtonElement).click(),
  );
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(readDrafts()).toHaveLength(1);
});
