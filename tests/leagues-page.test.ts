// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LeaguesPage } from "../src/components/leagues-page";

const state = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue("new-league"),
  push: vi.fn(),
}));
vi.mock("gt-next", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => state.create,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));
vi.mock("../src/components/site-shell", () => ({ LoginButton: () => null }));

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("creates a league directly with today's date and the selected treasury", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  await act(async () => root.render(createElement(LeaguesPage)));
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).not.toContain("leagueUx.createReview");
  const date = new Date();
  expect(dialog.textContent).toContain(
    date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replaceAll("/", "."),
  );
  const name = dialog.querySelector<HTMLInputElement>(
    'input[maxlength="100"]',
  )!;
  const treasury = dialog.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  expect(treasury.value).toBe("1000000");
  await act(async () => {
    setter.call(name, "Kyiv autumn league");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(treasury, "1200000");
    treasury.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    dialog
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(state.create).toHaveBeenCalledExactlyOnceWith({
    name: "Kyiv autumn league",
    startAt: expect.any(Number),
    roundDays: 14,
    startingTreasury: 1_200_000,
  });
  expect(state.push).toHaveBeenCalledWith("/leagues/manage/new-league");
});
