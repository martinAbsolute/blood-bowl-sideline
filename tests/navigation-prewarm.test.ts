// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { NavigationPrewarm } from "../src/components/navigation-prewarm";

const mocks = vi.hoisted(() => ({
  prewarmQuery: vi.fn(),
  authenticated: false,
  loading: false,
}));
vi.mock("convex/react", () => ({
  useConvex: () => mocks,
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: mocks.loading,
  }),
}));

afterEach(() => {
  mocks.prewarmQuery.mockReset();
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
    expect(mocks.prewarmQuery).toHaveBeenCalledOnce();
    const options = mocks.prewarmQuery.mock.calls[0][0];
    expect(getFunctionName(options.query)).toBe("teams:getByUuid");
    expect(options.args.uuid).toBe("11111111-1111-4111-8111-111111111111");
    expect(options.extendSubscriptionFor).toBe(15_000);
    vi.advanceTimersByTime(15_000);
    link.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(mocks.prewarmQuery).toHaveBeenCalledTimes(2);
    link.href =
      "https://elsewhere.example/teams/22222222-2222-4222-8222-222222222222";
    link.dispatchEvent(new Event("pointerover", { bubbles: true }));
    link.href = "/leagues/manage/league-id/matches/match-id";
    link.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(mocks.prewarmQuery).toHaveBeenCalledTimes(2);
    mocks.authenticated = true;
    await act(async () => root.render(createElement(NavigationPrewarm)));
    link.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(getFunctionName(mocks.prewarmQuery.mock.calls[2][0].query)).toBe(
      "leagues:getMatch",
    );
    expect(mocks.prewarmQuery.mock.calls[2][0].args).toEqual({
      matchId: "match-id",
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
