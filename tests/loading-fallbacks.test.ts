import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InitialLoading } from "../src/components/initial-loading";
import { LoadingLayout, ShellLoading } from "../src/components/loading-layouts";
import { newTeam } from "../src/domain/catalog";

const route = vi.hoisted(() => ({
  pathname: "/teams",
  search: "",
  pendingPath: false,
  pendingSearch: false,
}));
const pending = new Promise(() => {});
vi.mock("next/navigation", () => ({
  usePathname: () => {
    if (route.pendingPath) throw pending;
    return route.pathname;
  },
  useSearchParams: () => {
    if (route.pendingSearch) throw pending;
    return new URLSearchParams(route.search);
  },
}));
beforeEach(() => {
  route.pathname = "/teams";
  route.search = "";
  route.pendingPath = false;
  route.pendingSearch = false;
});

describe("provider-free loading boundaries", () => {
  it.each([
    ["/teams", "library"],
    ["/", "library"],
    ["/my-teams", "library"],
    ["/builder", "catalog"],
    ["/team/human", "reference"],
    ["/missing", "page"],
    ["/rosters", "catalog"],
    ["/rosters/human", "reference"],
    ["/leagues", "leagues"],
    ["/leagues/old-world-classic", "league-reference"],
    ["/leagues/manage/season", "league"],
    ["/leagues/manage", "league"],
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
    expect(shell).toContain('data-loading-layout="page"');
    expect(shell).not.toContain('data-loading-layout="library"');
  });

  it("does not guess My Teams when the pathname suspends during partial prefetching", () => {
    route.pendingPath = true;
    const html = renderToStaticMarkup(createElement(InitialLoading));
    expect(html).toContain('data-loading-layout="page"');
    expect(html).not.toContain('data-loading-layout="library"');
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });

  it.each([
    ["../src/app/rosters/loading", "catalog"],
    ["../src/app/rosters/[slug]/loading", "reference"],
    ["../src/app/leagues/manage/loading", "league"],
    [
      "../src/app/leagues/manage/[leagueId]/matches/[matchId]/loading",
      "league-match",
    ],
    [
      "../src/app/leagues/manage/[leagueId]/teams/[entryId]/loading",
      "league-career",
    ],
    ["../src/app/users/loading", "users"],
    ["../src/app/leagues/loading", "leagues"],
    ["../src/app/leagues/[league]/loading", "league-reference"],
    ["../src/app/teams/loading", "library"],
  ])(
    "keeps %s destination-specific even before URL hooks resolve",
    async (path, variant) => {
      const { default: Loading } = await import(path);
      route.pendingPath = true;
      route.pendingSearch = true;
      const html = renderToStaticMarkup(createElement(Loading));
      expect(html).toContain(`data-loading-layout="${variant}"`);
      expect(html.match(/data-loading-layout=/g)).toHaveLength(1);
      expect(html.match(/role="status"/g)).toHaveLength(1);
    },
  );

  it("keeps the roster fallback while search parameters are pending", () => {
    route.pathname = "/rosters";
    route.pendingSearch = true;
    const html = renderToStaticMarkup(createElement(InitialLoading));
    expect(html).toContain('data-loading-layout="catalog"');
    expect(html).not.toContain('data-loading-layout="library"');
    expect(html.match(/data-loading-layout=/g)).toHaveLength(1);
  });

  it.each(["roster=human", "draft=example", "new=1"])(
    "uses the editor for legacy roster entry %s",
    (search) => {
      route.pathname = "/rosters";
      route.search = search;
      expect(renderToStaticMarkup(createElement(InitialLoading))).toContain(
        'data-loading-layout="editor"',
      );
    },
  );

  it("matches the Sevens roster detail's single support column", () => {
    route.pathname = "/rosters/human";
    route.search = "ruleset=kyiv-seven-sins-sevens";
    const html = renderToStaticMarkup(createElement(InitialLoading));
    expect(html).toContain('data-loading-layout="reference"');
    expect(html).toContain("sm:max-w-lg");
    expect(html).not.toContain("xl:grid-cols-[300px_minmax(0,1fr)]");
  });

  it("aligns the catalog loading header and shows its static filters", () => {
    const html = renderToStaticMarkup(
      createElement(LoadingLayout, {
        variant: "catalog",
        label: "Loading…",
      }),
    );
    expect(html).toContain("mb-5 gap-4");
    expect(html).toContain("catalog-layout");
    expect(html).toContain(
      "flex max-w-full flex-wrap items-end gap-x-4 gap-y-2",
    );
    expect(html).toContain("sm:h-9");
  });

  it("renders recovered draft geometry without mounting editor controls or providers", () => {
    const team = { ...newTeam("local-draft", "human"), name: "Recovered team" };
    const html = renderToStaticMarkup(
      createElement(LoadingLayout, {
        variant: "editor",
        label: "Loading…",
        team,
      }),
    );
    expect(html).toContain("Recovered team");
    expect(html).toContain("budget-grid");
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toMatch(/<(button|select|input)\b/);
    expect(html).not.toContain('role="dialog"');
  });
});
