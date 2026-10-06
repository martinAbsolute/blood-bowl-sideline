import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InitialLoading } from "../src/components/initial-loading";
import { LoadingLayout, ShellLoading } from "../src/components/loading-layouts";

const route = vi.hoisted(() => ({ pathname: "/teams" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("provider-free loading boundaries", () => {
  it.each([
    ["/teams", "library"],
    ["/rosters", "catalog"],
    ["/leagues", "leagues"],
    ["/leagues/manage/season", "league"],
    ["/leagues/manage/season/matches/match", "league-match"],
    ["/leagues/manage/season/teams/team", "league-career"],
    ["/users", "users"],
  ])(
    "renders skeletons before providers resolve at %s",
    (pathname, variant) => {
      route.pathname = pathname;
      const html = renderToStaticMarkup(createElement(InitialLoading));
      expect(html).toContain(`data-loading-layout="${variant}"`);
      expect(html).toContain('data-slot="skeleton"');
      expect(html).toContain('role="status"');
      expect(html).toContain('class="sr-only">Loading…</span>');
      expect(html).not.toContain(
        '<p class="text-sm text-muted-foreground">Loading',
      );
    },
  );

  it("renders the team editor skeleton without translations or draft providers", () => {
    route.pathname = "/teams/example";
    const html = renderToStaticMarkup(createElement(InitialLoading));
    expect(html).toContain("team-builder");
    expect(html).toContain("team-header");
    expect(html).toContain('data-slot="skeleton"');
  });

  it("keeps skeleton content in both the generic and outer shell fallbacks", () => {
    const page = renderToStaticMarkup(
      createElement(LoadingLayout, { label: "Loading…" }),
    );
    const shell = renderToStaticMarkup(createElement(ShellLoading));
    expect(page).toContain('data-slot="skeleton"');
    expect(shell).toContain('data-loading-layout="library"');
  });
});
