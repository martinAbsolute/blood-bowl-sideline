// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { randomUUID } from "node:crypto";
import { newTeam } from "../src/domain/catalog";
import { readDrafts, readRevision } from "../src/lib/drafts";
import {
  PENDING_SAVE,
  prepareDraftSignIn,
  pendingDraftSave,
} from "../src/lib/draft-sign-in";
import { DraftSignInProvider as DraftProvider } from "../src/components/draft-sign-in-provider";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { TeamEditor } from "../src/components/team-editor";
import { LoginButton } from "../src/components/site-shell";
import { BuilderStart } from "../src/components/builder-start";
import { SharedTeam } from "../src/components/shared-team";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  save: vi.fn(),
  signIn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  replace: vi.fn(),
  query: vi.fn(),
  t: (key: string) => key,
}));
vi.mock("gt-next", () => ({
  useTranslations: () => mocks.t,
  useLocale: () => "en",
  useSetLocale: () => vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useMutation: () => mocks.save,
  useQuery: () => mocks.query(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/builder",
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) =>
    createElement("a", props, children),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.error, success: mocks.success, info: vi.fn() },
}));

let root: Root;
function DraftSignInProvider({ children }: { children?: React.ReactNode }) {
  return createElement(
    DraftProvider,
    null,
    createElement(TooltipProvider, null, children),
  );
}
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubEnv("NEXT_PUBLIC_TELEGRAM_AUTH_READY", "true");
  localStorage.clear();
  sessionStorage.clear();
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.save.mockReset().mockResolvedValue({ revision: 1 });
  mocks.signIn.mockReset().mockResolvedValue({
    redirect: new URL("https://oauth.telegram.org/auth"),
  });
  mocks.error.mockClear();
  mocks.success.mockClear();
  mocks.replace.mockClear();
  mocks.query.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("syncs rapid edits automatically with no Save button, coalescing them into one mutation", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  await act(async () => root.render(editor(team)));
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  await act(async () => add.click());
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "saving",
  );
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][0].team.players).toHaveLength(2);
  expect(mocks.save.mock.calls[0][0].expectedRevision).toBe(0);
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "savedCloud",
  );
  expect(
    Array.from(container.querySelectorAll("button")).some((button) =>
      /saveTeam|saveChanges/.test(button.textContent ?? ""),
    ),
  ).toBe(false);
});

it("queues edits made while a save is in flight and uses the server's next revision", async () => {
  vi.useFakeTimers();
  const team = newTeam(randomUUID(), "amazon");
  prepareDraftSignIn(team, 0);
  let complete!: (result: { revision: number }) => void;
  mocks.save
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ revision: 2 });
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () => root.render(editor(team)));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => complete({ revision: 1 }));
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.save.mock.calls[1][0].team.players).toHaveLength(1);
  expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(1);
  expect(readRevision(team.uuid)).toBe(2);
});

it("keeps failed automatic edits locally and retries on the next edit without a retry loop", async () => {
  vi.useFakeTimers();
  const team = newTeam(randomUUID(), "amazon");
  mocks.auth = { isAuthenticated: true, isLoading: false };
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  await act(async () => root.render(editor(team)));
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "saveStatusError",
  );
  expect(readDrafts()[0].players).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => add.click());
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.save.mock.calls[1][0].team.players).toHaveLength(2);
});

it("opens owned UUID teams directly for editing and keeps local edits when live revisions arrive", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  const initial = {
    team,
    revision: 1,
    legal: false,
    updatedAt: 1,
    canEdit: false,
  };
  const shared = () =>
    createElement(
      DraftSignInProvider,
      null,
      createElement(SharedTeam, { initial }),
    );
  await act(async () => root.render(shared()));
  expect(container.querySelector('textarea[aria-label="teamName"]')).toBeNull();
  mocks.query.mockReturnValue({ ...initial, canEdit: true });
  await act(async () => root.render(shared()));
  const name = container.querySelector('textarea[aria-label="teamName"]');
  expect(name).not.toBeNull();
  expect(container.textContent).not.toContain("editTeam");
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  mocks.query.mockReturnValue({ ...initial, canEdit: true, revision: 2 });
  await act(async () => root.render(shared()));
  expect(container.querySelector('textarea[aria-label="teamName"]')).toBe(name);
  expect(readDrafts()[0].players).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[0][0].team.players).toHaveLength(1);
  mocks.query.mockReturnValue({ ...initial, canEdit: false });
  await act(async () => root.render(shared()));
  expect(container.querySelector('textarea[aria-label="teamName"]')).toBeNull();
});

it("shows a local draft status beside the editable title without claiming a cloud save", async () => {
  await act(async () => root.render(editor(newTeam(randomUUID(), "amazon"))));
  const status = container.querySelector('[role="status"]');
  expect(status?.textContent).toBe("savedInDrafts");
  expect(status?.parentElement?.querySelector("h1 textarea")).not.toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("persists a ruleset change before navigation can interrupt post-render effects", async () => {
  await act(async () => root.render(editor(newTeam(randomUUID(), "amazon"))));
  const ruleset = container.querySelector<HTMLSelectElement>("aside select")!;
  await act(async () => {
    ruleset.value = "eurobowl-2026";
    ruleset.dispatchEvent(new Event("change", { bubbles: true }));
    expect(readDrafts()[0].rulesetId).toBe("eurobowl-2026");
  });
});
function editor(team = newTeam(randomUUID())) {
  return createElement(
    StrictMode,
    null,
    createElement(
      DraftSignInProvider,
      null,
      createElement(LoginButton),
      createElement(TeamEditor, { initial: team }),
    ),
  );
}

it("header login preserves the exact draft; returning saves the entire unfinished roster only after authenticated", async () => {
  const team = newTeam(randomUUID(), "dwarf");
  team.name = "Mid-draft coach";
  team.notes = "Keep these tactics";
  team.rulesetId = "eurobowl-2026";
  team.staff.rerolls = 2;
  team.players.push({
    id: randomUUID(),
    positionId: "dwarf-0",
    name: "Player",
    skills: [],
  });
  // Use a known catalog position rather than trusting test-only identifiers.
  const { getRoster } = await import("../src/domain/catalog");
  team.players[0].positionId = getRoster("dwarf")!.players[0].id;
  await act(async () => root.render(editor(team)));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-label="signIn"]')!
      .click(),
  );
  expect(mocks.signIn).toHaveBeenCalledWith("telegram", {
    redirectTo: `/builder?draft=${team.uuid}`,
  });
  expect(readDrafts()).toEqual([team]);
  expect(pendingDraftSave(team.uuid)?.revision).toBe(0);
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  root = createRoot(container);
  mocks.auth = { isAuthenticated: false, isLoading: true };
  await act(async () => root.render(editor(readDrafts()[0])));
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () => root.render(editor(readDrafts()[0])));
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team,
    expectedRevision: 0,
  });
  expect(readRevision(team.uuid)).toBe(1);
  expect(sessionStorage.getItem(PENDING_SAVE)).toBeNull();
  expect(readDrafts()).toEqual([]);
  await act(async () => root.render(editor(team)));
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

it("preserves the draft and pending save on rejection without repeatedly retrying", async () => {
  const team = newTeam(randomUUID());
  prepareDraftSignIn(team, 2);
  mocks.save.mockRejectedValue(new Error("CONFLICT"));
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () => root.render(editor(team)));
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team,
    expectedRevision: 2,
  });
  expect(mocks.error).toHaveBeenCalledWith("conflict");
  expect(readDrafts()).toEqual([team]);
  expect(pendingDraftSave(team.uuid)).not.toBeNull();
  await act(async () => root.render(editor(team)));
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

it("keeps a nameless local draft through login, asking for a name before the account save", async () => {
  const team = newTeam(randomUUID());
  team.name = "";
  prepareDraftSignIn(team, 0);
  expect(readDrafts()).toEqual([team]);
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () => root.render(editor(readDrafts()[0])));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("teamNameRequired");
});

it("never uploads an unrelated draft or a read-only public team", async () => {
  prepareDraftSignIn(newTeam(randomUUID()), 0);
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID());
  await act(async () => root.render(editor(team)));
  expect(mocks.save).not.toHaveBeenCalled();
  prepareDraftSignIn(team, 0);
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, { initial: team, readOnly: true }),
      ),
    ),
  );
  expect(mocks.save).not.toHaveBeenCalled();
});

it("does not erase the callback code while the builder mounts", async () => {
  const team = newTeam(randomUUID());
  prepareDraftSignIn(team, 0);
  window.history.replaceState(
    {},
    "",
    `/builder?draft=${team.uuid}&code=test-callback`,
  );
  mocks.auth = { isAuthenticated: false, isLoading: true };
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(BuilderStart, { draft: team.uuid, fresh: false }),
      ),
    ),
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(window.location.search).toContain("code=test-callback");
});

it("a new device opens an empty builder without creating a phantom draft", async () => {
  window.history.replaceState({}, "", "/builder");
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(BuilderStart, { fresh: false }),
      ),
    ),
  );
  expect(readDrafts()).toEqual([]);
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(container.querySelector('a[href="/teams"]')?.textContent).toBe(
    "chooseRoster",
  );
});
