// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { NavigationPrewarm } from "../src/components/navigation-prewarm";
import { createNavigationPrewarmer } from "../src/lib/navigation-prewarm";
import type { ConvexReactClient } from "convex/react";

const mocks = vi.hoisted(() => ({
  prewarmQuery: vi.fn(),
  prefetch: vi.fn(),
  authenticated: false,
  loading: false,
}));
const router = { prefetch: mocks.prefetch };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("convex/react", () => ({
  useConvex: () => mocks,
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: mocks.loading,
  }),
}));

afterEach(() => {
  mocks.prewarmQuery.mockReset();
  mocks.prefetch.mockReset();
  mocks.authenticated = false;
  mocks.loading = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("warms internal team links on hover, focus and touch, deduplicates intent, and expires", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(NavigationPrewarm)));
  const link = document.createElement("a");
  link.href = "/teams/11111111-1111-4111-8111-111111111111";
  const child = document.createElement("span");
  link.append(child);
  container.append(link);
  try {
    child.dispatchEvent(new Event("pointerover", { bubbles: true }));
    link.dispatchEvent(new Event("focusin", { bubbles: true }));
    link.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(mocks.prewarmQuery).toHaveBeenCalledTimes(2);
    expect(mocks.prefetch).toHaveBeenCalledOnce();
    expect(mocks.prefetch).toHaveBeenCalledWith(link.pathname, {
      kind: "full",
      onInvalidate: expect.any(Function),
    });
    const options = mocks.prewarmQuery.mock.calls[0][0];
    expect(getFunctionName(options.query)).toBe("teams:getByUuid");
    expect(options.args.uuid).toBe("11111111-1111-4111-8111-111111111111");
    expect(options.extendSubscriptionFor).toBe(60_000);
    vi.advanceTimersByTime(60_000);
    link.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(mocks.prewarmQuery).toHaveBeenCalledTimes(4);
    link.href =
      "https://elsewhere.example/teams/22222222-2222-4222-8222-222222222222";
    link.dispatchEvent(new Event("pointerover", { bubbles: true }));
    link.href = "/leagues/manage/league-id/matches/match-id";
    link.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(mocks.prewarmQuery).toHaveBeenCalledTimes(4);
    mocks.authenticated = true;
    await act(async () => root.render(createElement(NavigationPrewarm)));
    link.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(getFunctionName(mocks.prewarmQuery.mock.calls[4][0].query)).toBe(
      "leagues:getMatch",
    );
    expect(mocks.prewarmQuery.mock.calls[4][0].args).toEqual({
      matchId: "match-id",
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("warms a team's dependent league when its live result arrives and releases the watcher", () => {
  vi.useFakeTimers();
  let update = () => {};
  const state = { result: undefined as { draftLeagueId: string } | undefined };
  const unsubscribe = vi.fn();
  const client = {
    prewarmQuery: vi.fn(),
    watchQuery: vi.fn(() => ({
      onUpdate: (callback: () => void) => {
        update = callback;
        return unsubscribe;
      },
      localQueryResult: () => state.result,
    })),
  };
  const warm = createNavigationPrewarmer(
    client as unknown as ConvexReactClient,
    vi.fn(),
  );
  warm(
    new URL("https://example.com/teams/11111111-1111-4111-8111-111111111111"),
    true,
  );
  expect(client.prewarmQuery).toHaveBeenCalledTimes(2);
  state.result = { draftLeagueId: "draft-league" };
  update();
  update();
  expect(client.prewarmQuery).toHaveBeenCalledTimes(3);
  expect(getFunctionName(client.prewarmQuery.mock.calls[2][0].query)).toBe(
    "leagues:get",
  );
  expect(client.prewarmQuery.mock.calls[2][0].args).toEqual({
    leagueId: "draft-league",
  });
  warm.dispose();
  expect(unsubscribe).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(60_000);
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("keeps team league search parameters distinct and refreshes invalidated routes", () => {
  const client = { prewarmQuery: vi.fn() };
  const prefetch = vi.fn();
  const warm = createNavigationPrewarmer(
    client as unknown as ConvexReactClient,
    prefetch,
  );
  const url = new URL(
    "https://example.com/teams/11111111-1111-4111-8111-111111111111?league=first",
  );
  warm(url, true);
  url.searchParams.set("league", "second");
  warm(url, true);
  expect(prefetch).toHaveBeenCalledTimes(2);
  expect(client.prewarmQuery.mock.calls[5][0].args).toEqual({
    leagueId: "second",
  });
  prefetch.mock.calls[1][1]();
  warm(url, true);
  expect(prefetch).toHaveBeenCalledTimes(3);
  warm.dispose();
});

it.each([
  ["/leagues/manage/season", ["leagues:get"], { leagueId: "season" }],
  [
    "/leagues/manage/season/teams/entry",
    ["leagues:getCareer"],
    { entryId: "entry" },
  ],
  [
    "/leagues/manage/season/matches/match",
    ["leagues:getMatch", "leagues:getMatchHistory"],
    { matchId: "match" },
  ],
])(
  "warms the route and its queries for %s only when authenticated",
  (path, queries, args) => {
    const client = { prewarmQuery: vi.fn() };
    const prefetch = vi.fn();
    const warm = createNavigationPrewarmer(
      client as unknown as ConvexReactClient,
      prefetch,
    );
    const url = new URL(path, "https://example.com");
    warm(url, false);
    expect(prefetch).not.toHaveBeenCalled();
    expect(client.prewarmQuery).not.toHaveBeenCalled();
    warm(url, true);
    expect(prefetch).toHaveBeenCalledWith(path, expect.any(Function));
    expect(
      client.prewarmQuery.mock.calls.map(([options]) =>
        getFunctionName(options.query),
      ),
    ).toEqual(queries);
    for (const [options] of client.prewarmQuery.mock.calls)
      expect(options.args).toEqual(args);
    warm.dispose();
  },
);
