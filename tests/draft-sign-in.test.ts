// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { randomUUID } from "node:crypto";
import { ConvexError } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { getRoster, newTeam } from "../src/domain/catalog";
import {
  readDrafts,
  readRevision,
  readDraftRevision,
  storeDraft,
  storeRevision,
} from "../src/lib/drafts";
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
import { TeamPage } from "../src/components/team-page";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  connected: true,
  save: vi.fn(),
  signIn: vi.fn(),
  isTelegramConfigured: vi.fn(),
  toast: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
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
  useConvexConnectionState: () => ({ isWebSocketConnected: mocks.connected }),
  useMutation: () =>
    Object.assign(mocks.save, { withOptimisticUpdate: () => mocks.save }),
  useQuery: (query: FunctionReference<"query">) =>
    getFunctionName(query) === "leagues:listTeamCareers" ? [] : mocks.query(),
  useAction: () => mocks.isTelegramConfigured,
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  usePathname: () => "/builder",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) =>
    createElement("a", props, children),
}));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toast },
}));

let root: Root;
it("recognizes production conflicts from structured error data despite a redacted message", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const error = new ConvexError("CONFLICT");
  error.message = "[Request ID: test] Server Error";
  mocks.save.mockRejectedValueOnce(error);
  await act(async () => root.render(editor()));
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.toast).not.toHaveBeenCalled();
  expect(readDrafts()).toHaveLength(1);
  expect(
    Array.from(container.querySelectorAll("button")).some(
      (b) => b.textContent === "retry",
    ),
  ).toBe(false);
});
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
  mocks.isTelegramConfigured.mockReset().mockResolvedValue(true);
  localStorage.clear();
  sessionStorage.clear();
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.connected = true;
  mocks.save.mockReset().mockResolvedValue({ revision: 1 });
  mocks.signIn.mockReset().mockResolvedValue({
    redirect: new URL("https://oauth.telegram.org/auth"),
  });
  mocks.toast.mockClear();
  mocks.replace.mockClear();
  mocks.push.mockClear();
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
  expect(container.querySelector('input[aria-label="teamName"]')).toBeNull();
  mocks.query.mockReturnValue({ ...initial, canEdit: true });
  await act(async () => root.render(shared()));
  const name = container.querySelector('input[aria-label="teamName"]');
  expect(name).not.toBeNull();
  expect(container.textContent).not.toContain("editTeam");
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  mocks.query.mockReturnValue({ ...initial, canEdit: true, revision: 2 });
  await act(async () => root.render(shared()));
  expect(container.querySelector('input[aria-label="teamName"]')).toBe(name);
  expect(readDrafts()[0].players).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[0][0].team.players).toHaveLength(1);
  mocks.query.mockReturnValue({ ...initial, canEdit: false });
  await act(async () => root.render(shared()));
  expect(container.querySelector('input[aria-label="teamName"]')).toBeNull();
});

it("shows a local draft status in the team header without claiming a cloud save", async () => {
  await act(async () => root.render(editor(newTeam(randomUUID(), "amazon"))));
  const status = container.querySelector('[role="status"]');
  expect(status?.textContent).toBe("savedInDrafts");
  expect(status?.closest("header")?.querySelector("h1 input")).not.toBeNull();
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

it("removes only the selected player's added skill from the table and saves without opening a dialog", async () => {
  const team = newTeam(randomUUID(), "human");
  const position = getRoster("human")!.players[1];
  team.players = [0, 1].map((index) => ({
    id: randomUUID(),
    positionId: position.id,
    name: `Player ${index + 1}`,
    skills: ["block", "guard"],
  }));
  team.captainId = team.players[0].id;
  await act(async () => root.render(editor(team)));
  const rows = container.querySelectorAll(".player-table tbody tr");
  expect(rows[0].querySelectorAll(".skill-removable-action")).toHaveLength(2);
  const remove = rows[0].querySelector<HTMLButtonElement>(
    'button[aria-label="removeSkill · Block"]',
  )!;
  await act(async () => remove.click());
  expect(readDrafts()[0].players[0].skills).toEqual(["guard"]);
  expect(readDrafts()[0].players[1].skills).toEqual(["block", "guard"]);
  expect(readDrafts()[0].captainId).toBe(team.captainId);
  expect(rows[0].textContent).toContain("proCaptain");
  expect(rows[0].textContent).toContain("Dodge");
  expect(rows[0].querySelectorAll(".skill-removable-action")).toHaveLength(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("keeps added skills in read-only player tables without remove buttons", async () => {
  const team = newTeam(randomUUID(), "human");
  team.players = [
    {
      id: randomUUID(),
      positionId: getRoster("human")!.players[0].id,
      name: "Player",
      skills: ["block"],
    },
  ];
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, { initial: team, readOnly: true }),
      ),
    ),
  );
  expect(container.querySelector(".player-table")?.textContent).toContain(
    "Block",
  );
  expect(container.querySelector(".skill-removable-action")).toBeNull();
});

it("assigns one Sevens veteran using eligible player checkboxes and persists its skill badge", async () => {
  const team = newTeam(randomUUID(), "human");
  team.rulesetId = "kyiv-seven-sins-sevens";
  const positions = getRoster("human")!.players;
  team.players = [0, 0, 2].map((positionIndex, index) => ({
    id: randomUUID(),
    positionId: positions[positionIndex].id,
    name: `Player ${index + 1}`,
    skills: [],
  }));
  await act(async () => root.render(editor(team)));
  const veteranHeading = Array.from(container.querySelectorAll("th")).find(
    (heading) => heading.textContent === "sevensVeteranColumn",
  );
  expect(veteranHeading?.querySelector("button > span")?.className).toContain(
    "border-b border-dotted",
  );
  expect(veteranHeading?.querySelector("svg")).toBeNull();
  const checkbox = (number: number) =>
    container.querySelector<HTMLElement>(
      `[role="checkbox"][aria-label="sevensVeteran · Player ${number}"]`,
    )!;
  expect(container.querySelector("#sevens-veteran")).toBeNull();
  expect(checkbox(3)).toBeNull();
  const toggle = async (number: number) =>
    act(async () => {
      checkbox(number)
        .closest("label")!
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click();
    });
  await toggle(1);
  expect(readDrafts()[0].veteranId).toBe(team.players[0].id);
  expect(
    checkbox(1).closest("tr")?.querySelector(".table-skills")?.textContent,
  ).toContain("sevensVeteran");
  await toggle(2);
  expect(readDrafts()[0].veteranId).toBe(team.players[1].id);
  expect(checkbox(1).getAttribute("aria-checked")).toBe("false");
  expect(checkbox(2).getAttribute("aria-checked")).toBe("true");
  await toggle(2);
  expect(readDrafts()[0].veteranId).toBeUndefined();
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, {
          initial: { ...team, veteranId: team.players[0].id },
          readOnly: true,
        }),
      ),
    ),
  );
  expect(checkbox(1).getAttribute("aria-checked")).toBe("true");
  expect(checkbox(1).getAttribute("aria-disabled")).toBe("true");
  expect(checkbox(2).getAttribute("aria-disabled")).toBe("true");
});

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
    redirectTo: `/teams/${team.uuid}`,
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
  expect(mocks.toast).not.toHaveBeenCalled();
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
  expect(mocks.toast).toHaveBeenCalledWith({
    type: "error",
    title: "teamNameRequired",
  });
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
  window.history.replaceState({}, "", `/teams/${team.uuid}?code=test-callback`);
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
  expect(container.querySelector('a[href="/rosters"]')?.textContent).toBe(
    "chooseRoster",
  );
});

function action(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === label)!;
}

it("duplicates a public team into a new guest draft without changing the source", async () => {
  const team = newTeam(randomUUID(), "orc");
  team.name = "Absolute Orcs";
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, {
          initial: team,
          revision: 1,
          readOnly: true,
        }),
      ),
    ),
  );
  expect(action("share")).toBeUndefined();
  expect(action("export")).toBeUndefined();
  await act(async () => action("duplicate").click());
  expect(readDrafts()).toEqual([]);
  expect(document.body.textContent).toContain("confirmCopyTeamHint");
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-cancel"]')!
      .click(),
  );
  expect(readDrafts()).toEqual([]);
  await act(async () => action("duplicate").click());
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  const duplicate = readDrafts()[0];
  expect(duplicate.name).toBe("Absolute Orcs (copySuffix)");
  expect(duplicate.uuid).not.toBe(team.uuid);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith(`/teams/${duplicate.uuid}`);
});

it("saves a duplicate to the signed-in account and clears its exact local recovery copy", async () => {
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "orc");
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, {
          initial: team,
          revision: 1,
          readOnly: true,
        }),
      ),
    ),
  );
  await act(async () => action("duplicate").click());
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  const request = mocks.save.mock.calls[0][0];
  expect(request.team.uuid).not.toBe(team.uuid);
  expect(request.expectedRevision).toBe(0);
  expect(readDrafts()).toEqual([]);
  expect(readRevision(request.team.uuid)).toBe(1);
  expect(mocks.push).toHaveBeenCalledWith(`/teams/${request.team.uuid}`);
});

it("retains a failed duplicate as a recovery draft and reports the cloud failure", async () => {
  mocks.auth = { isAuthenticated: true, isLoading: false };
  mocks.save.mockRejectedValue(new Error("Offline"));
  const team = newTeam(randomUUID(), "orc");
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, {
          initial: team,
          revision: 1,
          readOnly: true,
        }),
      ),
    ),
  );
  await act(async () => action("duplicate").click());
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')!
      .click(),
  );
  expect(readDrafts()).toHaveLength(1);
  expect(mocks.toast).toHaveBeenCalledWith({
    type: "error",
    title: "saveFailed",
  });
  expect(mocks.push).toHaveBeenCalledWith(`/teams/${readDrafts()[0].uuid}`);
});

it("shares only an authenticated owner's saved team and reports clipboard denial", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const team = newTeam(randomUUID(), "orc");
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, { initial: team, revision: 1 }),
      ),
    ),
  );
  const shareButton = action("share");
  await act(async () => shareButton.click());
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/teams/${team.uuid}`,
  );
  expect(shareButton.dataset.actionState).toBe("success");
  expect(shareButton.querySelector('[role="status"]')?.textContent).toBe(
    "shareSucceeded",
  );
  expect(shareButton.disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(shareButton.dataset.actionState).toBe("idle");
  expect(shareButton.disabled).toBe(false);
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  await act(async () => shareButton.click());
  expect(shareButton.dataset.actionState).toBe("error");
  expect(shareButton.querySelector('[role="status"]')?.textContent).toBe(
    "copyFailed",
  );
  expect(action("duplicate")).toBeDefined();
});

function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

it("adopts another tab's cloud changes when idle, then edits from that exact revision", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  const live = { team, revision: 1, canEdit: true, legal: false, updatedAt: 1 };
  const page = () =>
    createElement(
      DraftSignInProvider,
      null,
      createElement(TeamPage, { uuid: team.uuid }),
    );
  mocks.query.mockReturnValue(live);
  await act(async () => root.render(page()));
  const name = container.querySelector<HTMLInputElement>(
    'input[aria-label="teamName"]',
  )!;
  mocks.query.mockReturnValue({
    ...live,
    revision: 2,
    team: { ...team, name: "Other tab" },
  });
  await act(async () => root.render(page()));
  expect(name.value).toBe("Other tab");
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="increaseQuantity"]',
      )!
      .click(),
  );
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[0][0].expectedRevision).toBe(2);
  expect(mocks.save.mock.calls[0][0].team.name).toBe("Other tab");
});

it("recovers a stale tab without a reload loop and can save again after loading the cloud version", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  storeDraft({ ...team, name: "My stale edit" }, null, 1);
  storeRevision(team.uuid, 8);
  const live = {
    team: { ...team, name: "Cloud version" },
    revision: 8,
    canEdit: true,
    legal: false,
    updatedAt: 1,
  };
  mocks.query.mockReturnValue(live);
  mocks.save.mockRejectedValueOnce(new ConvexError("CONFLICT"));
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamPage, { uuid: team.uuid }),
      ),
    ),
  );
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[0][0].expectedRevision).toBe(1);
  expect(readDraftRevision(team.uuid)).toBe(1);
  expect(container.textContent).not.toContain("conflict");
  await act(async () => action("saveStatusError").click());
  expect(document.body.textContent).toContain("conflict");
  await act(async () => action("useSavedTeam").click());
  expect(readDrafts()).toEqual([]);
  expect(
    container.querySelector<HTMLInputElement>('input[aria-label="teamName"]')!
      .value,
  ).toBe("Cloud version");
  expect(unloadPrevented()).toBe(false);
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="increaseQuantity"]',
      )!
      .click(),
  );
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(8);
});

it("keeps edits made during an in-flight save recoverable at the acknowledged base after unmount", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  let complete!: (result: { revision: number }) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => root.render(editor(team)));
  await act(async () => vi.advanceTimersByTimeAsync(450));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="increaseQuantity"]',
      )!
      .click(),
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => complete({ revision: 1 }));
  expect(readDrafts()[0].players).toHaveLength(1);
  expect(readDraftRevision(team.uuid)).toBe(1);
});

it("shows a reconnecting state for a pending cloud save without claiming it is saved", async () => {
  mocks.auth = { isAuthenticated: true, isLoading: false };
  mocks.connected = false;
  await act(async () => root.render(editor()));
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "saveReconnecting",
  );
  expect(unloadPrevented()).toBe(true);
});

it("waits for authentication to settle before mounting or uploading a guest draft", async () => {
  vi.useFakeTimers();
  const team = newTeam(randomUUID());
  storeDraft(team);
  mocks.query.mockReturnValue(null);
  mocks.auth = { isAuthenticated: false, isLoading: true };
  const page = () =>
    createElement(
      DraftSignInProvider,
      null,
      createElement(TeamPage, { uuid: team.uuid }),
    );
  await act(async () => root.render(page()));
  expect(container.querySelector('input[aria-label="teamName"]')).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () => root.render(page()));
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team,
    expectedRevision: 0,
  });
});

it("keeps the UUID editor, typing focus mounted across recovery writes and acknowledgements", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  const team = newTeam(randomUUID(), "amazon");
  const live = { team, revision: 3, canEdit: true, legal: false, updatedAt: 1 };
  mocks.query.mockReturnValue(live);
  let complete!: (result: { revision: number }) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const page = () =>
    createElement(
      DraftSignInProvider,
      null,
      createElement(TeamPage, { uuid: team.uuid }),
    );
  await act(async () => root.render(page()));
  const name = container.querySelector<HTMLInputElement>(
    'input[aria-label="teamName"]',
  )!;
  await act(async () => name.focus());
  const input = (value: string) => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(name, value);
    name.dispatchEvent(new Event("input", { bubbles: true }));
  };
  await act(async () => input("First edit"));
  expect(container.querySelector('input[aria-label="teamName"]')).toBe(name);
  expect(document.activeElement).toBe(name);
  expect(unloadPrevented()).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    team: { ...team, name: "First edit" },
    expectedRevision: 3,
  });
  await act(async () => input("Second edit"));
  await act(async () => {
    mocks.query.mockReturnValue({
      ...live,
      team: { ...team, name: "First edit" },
      revision: 4,
    });
    root.render(page());
    complete({ revision: 4 });
  });
  expect(name.value).toBe("Second edit");
  expect(document.activeElement).toBe(name);
  expect(unloadPrevented()).toBe(true);
  mocks.save.mockImplementationOnce(async ({ team }) => {
    mocks.query.mockReturnValue({ ...live, team, revision: 5 });
    return { revision: 5 };
  });
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(mocks.save.mock.calls[1][0].expectedRevision).toBe(4);
  expect(readDrafts()).toEqual([]);
  expect(container.querySelector('input[aria-label="teamName"]')).toBe(name);
  expect(document.activeElement).toBe(name);
  expect(unloadPrevented()).toBe(false);
});

it("warns on failed cloud saves and removes the unload warning after a successful retry", async () => {
  vi.useFakeTimers();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  await act(async () => root.render(editor()));
  const add = container.querySelector<HTMLButtonElement>(
    'button[aria-label="increaseQuantity"]',
  )!;
  await act(async () => add.click());
  expect(unloadPrevented()).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(450));
  expect(unloadPrevented()).toBe(true);
  await act(async () => action("saveStatusError").click());
  const retry = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === "retry",
  )!;
  await act(async () => retry.click());
  expect(unloadPrevented()).toBe(false);
});

it("does not warn when a guest draft is safely stored or a public team is read-only", async () => {
  await act(async () => root.render(editor()));
  expect(unloadPrevented()).toBe(false);
  mocks.auth = { isAuthenticated: true, isLoading: false };
  await act(async () =>
    root.render(
      createElement(
        DraftSignInProvider,
        null,
        createElement(TeamEditor, {
          initial: newTeam(randomUUID()),
          revision: 1,
          readOnly: true,
        }),
      ),
    ),
  );
  expect(unloadPrevented()).toBe(false);
});
