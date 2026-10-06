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
  storeRevision,
  normalizeStoredDrafts,
  readDraftRevision,
  DRAFTS_KEY,
} from "../src/lib/drafts";
import { saveCloudDraft } from "../src/lib/cloud-save";
import { DRAFT_EDITOR_RELEASED } from "../src/lib/draft-lock";
import {
  DraftSyncProvider,
  useDraftSync,
} from "../src/components/draft-sync-provider";
import { TeamName } from "../src/components/team-name";
import { CreateTeamButton } from "../src/components/create-team-button";
import { TeamLibrary } from "../src/components/team-library";
import { libraryMatches } from "../src/lib/team-library";
import { TEAM_NAME_MAX_LENGTH } from "../src/domain/team-name";
import { duplicateTeam } from "../src/lib/duplicate-team";
import { teamSchema } from "../src/domain/types";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getFunctionName } from "convex/server";

const mocks = vi.hoisted(() => ({
  authenticated: false,
  account: null as string | null,
  save: vi.fn(),
  push: vi.fn(),
  query: vi.fn(),
  selectedTeam: null as { leagueLocked: boolean } | null | undefined,
  results: [] as { team: ReturnType<typeof newTeam>; leagueLocked?: boolean }[],
  archivedResults: [] as { team: ReturnType<typeof newTeam> }[],
  activeStatus: "Exhausted" as "Exhausted" | "LoadingFirstPage",
  archivedStatus: "Exhausted" as "Exhausted" | "LoadingFirstPage",
  libraryQueries: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: false,
  }),
  useConvex: () => ({ query: mocks.query }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "teams:getByUuid"
      ? mocks.selectedTeam
      : mocks.account
        ? { id: mocks.account, name: "Telegram Coach" }
        : null,
  useMutation: () =>
    Object.assign(mocks.save, { withOptimisticUpdate: () => mocks.save }),
  usePaginatedQuery: (_ref: unknown, args: { archived: boolean } | "skip") => ({
    results:
      (mocks.libraryQueries(args),
      args !== "skip" && args.archived ? mocks.archivedResults : mocks.results),
    status:
      args !== "skip" && args.archived
        ? mocks.archivedStatus
        : mocks.activeStatus,
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
  mocks.archivedResults = [];
  mocks.activeStatus = "Exhausted";
  mocks.archivedStatus = "Exhausted";
  mocks.libraryQueries.mockClear();
  mocks.selectedTeam = null;
  mocks.query.mockReset().mockResolvedValue(null);
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
it("does not rebase a recovery snapshot written by another tab during an upload", async () => {
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
    expectedRevision: 0,
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
it("never lets an older editor roll back an acknowledged revision", () => {
  const uuid = randomUUID();
  storeRevision(uuid, 3);
  storeRevision(uuid, 0);
  storeRevision(uuid, 2);
  expect(readRevision(uuid)).toBe(3);
});

it("serializes saves with the acknowledged revision even when revision storage fails", async () => {
  const team = newTeam(randomUUID());
  let complete!: (result: { revision: number }) => void;
  mocks.save
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ revision: 2 });
  const storage = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  try {
    const first = saveCloudDraft(team, 0, mocks.save);
    const next = saveCloudDraft({ ...team, name: "Newer edit" }, 0, mocks.save);
    complete({ revision: 1 });
    await first;
    await next;
    expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(1);
  } finally {
    storage.mockRestore();
  }
});

it("acknowledges the same draft regardless of object property order", async () => {
  const initial = newTeam(randomUUID(), "black-orc");
  const { name, ...fields } = initial;
  const team = { ...fields, name: `Renamed ${name}` };
  storeDraft(team);
  await saveCloudDraft(team, 0, mocks.save);
  expect(readDrafts()).toEqual([]);
});
it("syncs a renamed guest Black Orc team through sign-in and subsequent edits against the real save handler", async () => {
  const backend = convexTest(schema, import.meta.glob("../convex/**/*.ts"));
  const userId = await backend.run((ctx) =>
    ctx.db.insert("users", { name: "Coach" }),
  );
  const coach = backend.withIdentity({ subject: userId });
  mocks.save.mockImplementation((args) => coach.mutation(api.teams.save, args));
  const { name, ...fields } = newTeam(randomUUID(), "black-orc");
  const team = { ...fields, name: `Renamed ${name}` };
  storeDraft(team);
  await act(async () => root.render(renderSync()));
  await tick();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.authenticated = true;
  mocks.account = userId;
  await act(async () => root.render(renderSync()));
  await tick();
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => {
    await mocks.save.mock.results[0].value;
  });
  expect(readDrafts()).toEqual([]);
  expect(readRevision(team.uuid)).toBe(1);
  // The editor advances only from its own acknowledged save.
  storeRevision(team.uuid, 0);
  const edited = { ...team, name: "Next Black Orc name" };
  await act(async () => storeDraft(edited, userId, 1));
  await tick();
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(2);
  await act(async () => {
    await mocks.save.mock.results[1].value;
  });
  expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(1);
  expect(readDrafts()).toEqual([]);
  expect(
    await coach.query(api.teams.getByUuid, { uuid: team.uuid }),
  ).toMatchObject({ team: edited, revision: 2 });
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
it("keeps settled team cards visible while a new search loads", async () => {
  const first = { ...newTeam(randomUUID()), name: "First team" };
  const second = { ...newTeam(randomUUID()), name: "Second team" };
  mocks.authenticated = true;
  mocks.account = "account-a";
  mocks.results = [{ team: first }];
  const view = () =>
    createElement(DraftSyncProvider, null, createElement(TeamLibrary));
  await act(async () => root.render(view()));
  await tick();
  expect(container.textContent).toContain("First team");

  mocks.activeStatus = "LoadingFirstPage";
  mocks.results = [];
  await act(async () => root.render(view()));
  expect(container.textContent).toContain("First team");
  expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();

  mocks.activeStatus = "Exhausted";
  mocks.results = [{ team: second }];
  await act(async () => root.render(view()));
  expect(container.textContent).toContain("Second team");
  expect(container.textContent).not.toContain("First team");
});
it("matches team names and ruleset prefixes without ignoring combined filters", () => {
  const team = { ...newTeam(randomUUID(), "goblin"), name: "Олександр" };
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
it("limits name edits without helper text and keeps maximum-length copies valid", async () => {
  let value = "Orcs";
  const render = () =>
    root.render(
      createElement(TeamName, {
        value,
        placeholder: "Untitled",
        label: "Name",
        onChange: (next: string) => {
          value = next;
          render();
        },
      }),
    );
  await act(async () => render());
  const name = container.querySelector("input")!;
  expect(name.maxLength).toBe(TEAM_NAME_MAX_LENGTH);
  await act(async () => name.focus());
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(name, "W".repeat(TEAM_NAME_MAX_LENGTH + 1));
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(value).toHaveLength(TEAM_NAME_MAX_LENGTH);
  expect(container.textContent).not.toContain("40/40");
  await act(async () => name.blur());
  expect(name.hasAttribute("aria-describedby")).toBe(false);
  const team = { ...newTeam(randomUUID()), name: value };
  storeDraft(team);
  expect(readDrafts()[0].name).toBe(value);
  for (const suffix of ["Copy", "Копія"]) {
    const copy = duplicateTeam(team, suffix);
    expect(copy.name).toHaveLength(TEAM_NAME_MAX_LENGTH);
    expect(copy.name.endsWith(` (${suffix})`)).toBe(true);
    expect(teamSchema.safeParse(copy).success).toBe(true);
  }
});

it("finishes name editing with Enter, restores it with Escape, and stays single-line", async () => {
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
  const name = container.querySelector("input")!;
  await act(async () => {
    name.focus();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(name, "Changed\nname");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(value).toBe("Changedname");
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
  const team = { ...newTeam(randomUUID()), name: "Typing " };
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

it("keeps queued cloud work protected after leaving the editor, and stops warning when acknowledged", async () => {
  mocks.authenticated = true;
  mocks.account = "account-a";
  const team = newTeam(randomUUID());
  storeDraft(team, mocks.account);
  let complete!: (result: { revision: number }) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => root.render(renderSync()));
  function protectedByBrowser() {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }
  expect(protectedByBrowser()).toBe(true);
  await tick();
  expect(protectedByBrowser()).toBe(true);
  await act(async () => complete({ revision: 1 }));
  expect(protectedByBrowser()).toBe(false);
});

it.each(["Enter", "blur"])(
  "selects the whole name on focus and restores an empty edit on %s",
  async (finish) => {
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
    const name = container.querySelector("input")!;
    await act(async () => name.focus());
    expect(name.selectionStart).toBe(0);
    expect(name.selectionEnd).toBe(value.length);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(name, "");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(name.value).toBe("");
    expect(name.placeholder).toBe("");
    expect(value).toBe("Original team");
    expect(change).not.toHaveBeenCalled();
    await act(async () => {
      if (finish === "Enter")
        name.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      else name.blur();
    });
    expect(name.value).toBe("Original team");
    expect(change).not.toHaveBeenCalled();
  },
);

it("restores the focus-time name when a changed name is cleared to whitespace", async () => {
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
  const name = container.querySelector("input")!;
  await act(async () => name.focus());
  const input = (next: string) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(name, next);
    name.dispatchEvent(new Event("input", { bubbles: true }));
  };
  await act(async () => input("Changed name"));
  expect(value).toBe("Changed name");
  await act(async () => input("   "));
  expect(name.value).toBe("   ");
  expect(value).toBe("Changed name");
  await act(async () => name.blur());
  expect(value).toBe("Original team");
  expect(name.value).toBe("Original team");
  expect(change.mock.calls.map(([next]) => next)).toEqual([
    "Changed name",
    "Original team",
  ]);
});

it("removes obsolete fields from local draft data while retaining roster selections", () => {
  const team = newTeam(randomUUID(), "goblin");
  team.staff.rerolls = 2;
  localStorage.setItem(
    DRAFTS_KEY,
    JSON.stringify([{ ...team, coach: "Obsolete private name" }]),
  );
  normalizeStoredDrafts();
  expect(readDrafts()).toEqual([team]);
  expect(JSON.parse(localStorage.getItem(DRAFTS_KEY)!)).toEqual([
    { ...team, baseRevision: 0, draftOwner: null },
  ]);
});

it("binds recovery to its exact base and owner even when another tab acknowledges a newer revision", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team, "account-a", 2);
  storeRevision(team.uuid, 9);
  normalizeStoredDrafts();
  expect(readDraftRevision(team.uuid)).toBe(2);
  expect(draftAccount(team.uuid)).toBe("account-a");
  await saveCloudDraft(team, 2, mocks.save);
  expect(mocks.save).toHaveBeenCalledWith({ team, expectedRevision: 2 });
});

it("updates a focused idle name field from the cloud without writing its old buffer back", async () => {
  const change = vi.fn();
  const render = (value: string) =>
    createElement(TeamName, {
      value,
      onChange: change,
      placeholder: "Untitled",
      label: "Name",
    });
  await act(async () => root.render(render("Original")));
  const name = container.querySelector("input")!;
  await act(async () => name.focus());
  await act(async () => root.render(render("Other tab")));
  expect(name.value).toBe("Other tab");
  await act(async () => name.blur());
  expect(change).not.toHaveBeenCalled();
});

it("does not turn cloud success into failure when recovery cleanup is blocked", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team, "account-a", 2);
  const blocked = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    await expect(saveCloudDraft(team, 2, mocks.save)).resolves.toEqual({
      revision: 1,
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  } finally {
    blocked.mockRestore();
  }
});

it("lets a signed-in coach discard a failed recovery draft and reveal the cloud team", async () => {
  const team = newTeam(randomUUID());
  storeDraft({ ...team, name: "Failed recovery" }, "account-a", 1);
  mocks.authenticated = true;
  mocks.account = "account-a";
  mocks.results = [{ team }];
  mocks.save.mockRejectedValue(new Error("CONFLICT"));
  await act(async () =>
    root.render(
      createElement(DraftSyncProvider, null, createElement(TeamLibrary)),
    ),
  );
  await tick();
  const discard = container.querySelector<HTMLButtonElement>(
    'button[aria-label="discardDraft Failed recovery"]',
  )!;
  expect(discard).not.toBeNull();
  await act(async () => discard.click());
  expect(readDrafts()).toHaveLength(1);
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  expect(readDrafts()).toEqual([]);
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(
    container.querySelector('button[aria-label^="archive "]'),
  ).not.toBeNull();
  await tick();
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

it("loads the archive only when expanded and provides restore and confirmed permanent deletion without team links", async () => {
  const team = { ...newTeam(randomUUID()), name: "Archived team" };
  mocks.authenticated = true;
  mocks.archivedResults = [{ team }];
  await act(async () => root.render(createElement(TeamLibrary)));
  expect(mocks.libraryQueries.mock.calls.some(([args]) => args.archived)).toBe(
    false,
  );
  const toggle = container.querySelector<HTMLButtonElement>(
    '[aria-controls="team-archive"]',
  )!;
  await act(async () => toggle.click());
  expect(mocks.libraryQueries.mock.calls.some(([args]) => args.archived)).toBe(
    true,
  );
  const archive = container.querySelector("#team-archive")!;
  expect(archive.querySelector("article a")).toBeNull();
  expect(
    archive.querySelector("article footer [role='status']")?.textContent,
  ).toBe("archived");
  expect(archive.querySelector("article span.rounded-full")?.textContent).toBe(
    "draft",
  );
  expect(
    archive
      .querySelector("article footer .ml-auto")
      ?.querySelectorAll("button"),
  ).toHaveLength(2);
  expect(
    Array.from(archive.querySelectorAll("article footer button")).map(
      (button) => button.getAttribute("aria-label"),
    ),
  ).toEqual(["restore Archived team", "deletePermanently Archived team"]);
  await act(async () =>
    archive
      .querySelector<HTMLButtonElement>('[aria-label="restore Archived team"]')!
      .click(),
  );
  expect(mocks.save).toHaveBeenLastCalledWith({
    uuid: team.uuid,
    archived: false,
  });
  mocks.save.mockClear();
  await act(async () =>
    archive
      .querySelector<HTMLButtonElement>(
        '[aria-label="deletePermanently Archived team"]',
      )!
      .click(),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("confirmPermanentDeleteTeamHint");
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ uuid: team.uuid });
  await act(async () => toggle.click());
  expect(container.querySelector("#team-archive")).toBeNull();
});

it("requires confirmation to archive and leaves the team unchanged on cancel", async () => {
  const team = { ...newTeam(randomUUID()), name: "Archive me" };
  mocks.authenticated = true;
  mocks.results = [{ team }];
  await act(async () => root.render(createElement(TeamLibrary)));
  const archive = container.querySelector<HTMLButtonElement>(
    'button[aria-label="archive Archive me"]',
  )!;
  await act(async () => archive.click());
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-cancel"]')!
      .click(),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => archive.click());
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    uuid: team.uuid,
    archived: true,
  });
});

it("disables archive for league-locked cloud teams and hides their recovery delete action", async () => {
  const team = { ...newTeam(randomUUID()), name: "League team" };
  storeDraft({ ...team, name: "Old draft" });
  mocks.authenticated = true;
  mocks.results = [{ team, leagueLocked: true }];
  await act(async () => root.render(createElement(TeamLibrary)));
  expect(
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="archive League team"]',
    )!.disabled,
  ).toBe(true);
  expect(
    container.querySelector('button[aria-label^="discardDraft"]'),
  ).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps a guest draft when deletion is cancelled", async () => {
  const team = { ...newTeam(randomUUID()), name: "Keep me" };
  storeDraft(team);
  await act(async () => root.render(createElement(TeamLibrary)));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-label="remove Keep me"]')!
      .click(),
  );
  expect(readDrafts()).toHaveLength(1);
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-cancel"]')!
      .click(),
  );
  expect(readDrafts()).toHaveLength(1);
});

it("disables confirmation while checking league status and when a team becomes locked", async () => {
  const team = { ...newTeam(randomUUID()), name: "Pending draft" };
  storeDraft(team);
  mocks.authenticated = true;
  mocks.selectedTeam = undefined;
  await act(async () => root.render(createElement(TeamLibrary)));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="discardDraft Pending draft"]',
      )!
      .click(),
  );
  expect(
    document.querySelector<HTMLButtonElement>(
      '[data-slot="alert-dialog-action"]',
    )!.disabled,
  ).toBe(true);
  mocks.selectedTeam = { leagueLocked: true };
  await act(async () => root.render(createElement(TeamLibrary)));
  expect(
    document.querySelector<HTMLButtonElement>(
      '[data-slot="alert-dialog-action"]',
    )!.disabled,
  ).toBe(true);
  expect(document.body.textContent).toContain("teamRemovalLocked");
  expect(readDrafts()).toHaveLength(1);
});

it("rechecks league status before deleting a draft absent from the current library results", async () => {
  const team = { ...newTeam(randomUUID()), name: "Late lock" };
  storeDraft(team);
  mocks.authenticated = true;
  mocks.query.mockResolvedValue({ leagueLocked: true });
  await act(async () => root.render(createElement(TeamLibrary)));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="discardDraft Late lock"]',
      )!
      .click(),
  );
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  expect(mocks.query).toHaveBeenCalledWith(api.teams.getByUuid, {
    uuid: team.uuid,
  });
  expect(readDrafts()).toHaveLength(1);
});

it("creates signed-in teams directly in Convex even when local storage is blocked", async () => {
  mocks.authenticated = true;
  mocks.account = "account-a";
  const blocked = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    await act(async () =>
      root.render(createElement(CreateTeamButton, { rosterId: "goblin" })),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(
      `/teams/${mocks.save.mock.calls[0][0].team.uuid}`,
    );
  } finally {
    blocked.mockRestore();
  }
});

it("parks background uploads while another tab is editing, then resumes on release", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team, "account-a", 1);
  mocks.authenticated = true;
  mocks.account = "account-a";
  let editorOpen = true;
  const request = vi.fn(async (_name, _options, callback) =>
    callback(editorOpen ? null : { mode: "exclusive" }),
  );
  vi.stubGlobal("navigator", { locks: { request } });
  await act(async () => root.render(renderSync()));
  await tick();
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
  editorOpen = false;
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: DRAFT_EDITOR_RELEASED }),
    ),
  );
  await tick();
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team,
    expectedRevision: 1,
  });
  expect(readDrafts()).toEqual([]);
});

it("does not loop background cloud saves when acknowledged recovery cleanup fails", async () => {
  const team = newTeam(randomUUID());
  storeDraft(team, "account-a", 0);
  mocks.authenticated = true;
  mocks.account = "account-a";
  let complete!: (result: { revision: number }) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => root.render(renderSync()));
  await tick();
  const blocked = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    await act(async () => complete({ revision: 1 }));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  } finally {
    blocked.mockRestore();
  }
});

it("rejects a stale tab against Convex even after shared storage learns a newer revision", async () => {
  const backend = convexTest(schema, import.meta.glob("../convex/**/*.ts"));
  const userId = await backend.run((ctx) =>
    ctx.db.insert("users", { name: "Coach" }),
  );
  const coach = backend.withIdentity({ subject: userId });
  const team = newTeam(randomUUID());
  const save = (args: { team: typeof team; expectedRevision: number }) =>
    coach.mutation(api.teams.save, args);
  await saveCloudDraft(team, 0, save);
  const latest = { ...team, name: "Saved in tab A" };
  await saveCloudDraft(latest, 1, save);
  expect(readRevision(team.uuid)).toBe(2);
  const stale = { ...team, name: "Stale tab B" };
  storeDraft(stale, userId, 1);
  await expect(saveCloudDraft(stale, 1, save)).rejects.toThrow("CONFLICT");
  expect(
    (await coach.query(api.teams.getByUuid, { uuid: team.uuid }))?.team.name,
  ).toBe(latest.name);
  expect(readDrafts()).toEqual([stale]);
});
