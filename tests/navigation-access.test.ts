// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppNavigation } from "../src/components/app-navigation";
import { UsersPage } from "../src/components/users-page";
import en from "../src/i18n/en.json";

const mocks = vi.hoisted(() => ({
  role: "user" as "admin" | "user",
  authenticated: true,
  pathname: "/leagues",
  directory: vi.fn(),
}));
vi.mock("gt-next", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, args?: Record<string, string>) => {
    let text = en[key as keyof typeof en] as string;
    for (const [name, value] of Object.entries(args ?? {}))
      text = text.replace(`{${name}}`, value);
    return text;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: false,
  }),
  useQuery: () => (mocks.authenticated ? { role: mocks.role } : null),
  usePaginatedQuery: () => mocks.directory(),
}));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.role = "user";
  mocks.authenticated = true;
  mocks.directory.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("hides Users for regular users, highlights the active route, and disables Tournaments", async () => {
  await act(async () => root.render(createElement(AppNavigation)));
  expect(
    Array.from(container.querySelectorAll("a")).map((link) =>
      link.getAttribute("href"),
    ),
  ).toEqual(["/teams", "/rosters", "/leagues"]);
  expect(
    container.querySelector('[aria-current="page"]')?.getAttribute("href"),
  ).toBe("/leagues");
  expect(container.querySelector("button")?.disabled).toBe(true);
});

it("includes the Users navigation entry for admins and closes navigation on selection", async () => {
  const onNavigate = vi.fn();
  await act(async () =>
    root.render(createElement(AppNavigation, { admin: true, onNavigate })),
  );
  const link = container.querySelector<HTMLAnchorElement>('a[href="/users"]')!;
  expect(link.textContent).toBe("Users");
  await act(async () => link.click());
  expect(onNavigate).toHaveBeenCalledOnce();
});

it("does not request the directory for anonymous or regular users", async () => {
  for (const authenticated of [false, true]) {
    mocks.authenticated = authenticated;
    await act(async () => root.render(createElement(UsersPage)));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      en.adminOnly,
    );
    expect(mocks.directory).not.toHaveBeenCalled();
  }
});

it("loads further directory pages only on request and preserves the button while loading", async () => {
  mocks.role = "admin";
  const loadMore = vi.fn();
  const page = { results: [], status: "CanLoadMore", loadMore };
  mocks.directory.mockReturnValue(page);
  await act(async () => root.render(createElement(UsersPage)));
  expect(loadMore).not.toHaveBeenCalled();
  const button = container.querySelector<HTMLButtonElement>("button")!;
  expect(button.textContent).toBe(en.loadMore);
  await act(async () => button.click());
  expect(loadMore).toHaveBeenCalledExactlyOnceWith(30);
  mocks.directory.mockReturnValue({ ...page, status: "LoadingMore" });
  await act(async () => root.render(createElement(UsersPage)));
  expect(container.querySelector("button")).toBe(button);
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
});

it("renders a read-only admin directory in online/last-seen order and removes it on demotion", async () => {
  mocks.role = "admin";
  const profile = { role: "user", image: null, email: null, joinedAt: 1 };
  mocks.directory.mockReturnValue({
    results: [
      {
        ...profile,
        id: "old",
        name: "Old coach",
        online: false,
        lastSeenAt: 10,
      },
      {
        ...profile,
        id: "recent",
        name: "Recent coach",
        online: false,
        lastSeenAt: 100,
      },
      {
        ...profile,
        id: "online",
        name: "Online coach",
        online: true,
        lastSeenAt: null,
      },
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
  });
  await act(async () => root.render(createElement(UsersPage)));
  expect(
    Array.from(container.querySelectorAll("li")).map(
      (row) => row.querySelector("p")?.textContent,
    ),
  ).toEqual(["Online coach", "Recent coach", "Old coach"]);
  expect(container.querySelector('[role="switch"], input, button')).toBeNull();
  mocks.role = "user";
  await act(async () => root.render(createElement(UsersPage)));
  expect(container.querySelector("li")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    en.adminOnly,
  );
});
