import { randomUUID } from "node:crypto";
import { Window } from "happy-dom";
import { afterEach, expect, it, vi } from "vitest";
import { newTeam } from "../src/domain/catalog";
import { api } from "../convex/_generated/api";
import { GET } from "../src/app/teams/[slug]/roster/route";
import { prefersTeamJsonLd } from "../src/lib/team-representation";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: query }));
afterEach(() => query.mockReset());

const uuid = "11111111-1111-4111-8111-111111111111";
const team = newTeam(uuid, "orc");
team.name = "Newbie </script> Orcs & Київ";
team.players = [
  {
    id: randomUUID(),
    name: '<img src=x onerror="alert(1)">',
    positionId: "orc-3",
    skills: ["guard"],
  },
];
team.staff.rerolls = 2;
const saved = {
  team,
  revision: 4,
  updatedAt: Date.UTC(2026, 9, 9),
  legal: false,
  canEdit: false,
  leagueLocked: false,
  leagueExperienced: false,
};
const get = (slug = uuid) =>
  GET(new Request(`https://sideline.example/teams/${slug}/roster`), {
    params: Promise.resolve({ slug }),
  });

it("returns visible semantic roster text even after scripts are removed, with no JavaScript", async () => {
  query.mockResolvedValue(saved);
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  const window = new Window({
    settings: { disableJavaScriptEvaluation: true },
  });
  try {
    window.document.write(await response.text());
    window.document
      .querySelectorAll("script")
      .forEach((script) => script.remove());
    expect(window.document.querySelector("h1")?.textContent).toBe(team.name);
    const table = window.document.querySelector("table")!;
    expect(table.closest("[hidden]")).toBeNull();
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(table.textContent).toContain("Guard");
    expect(table.textContent).toContain("Movement allowance");
    expect(table.textContent).toContain("115,000 gold pieces");
    expect(table.textContent).toContain(team.players[0].name);
    expect(window.document.querySelector("img")).toBeNull();
    const text = window.document.body.textContent;
    expect(text).toContain("Team re-rolls2; 120,000 gold pieces");
    expect(text).toContain(
      "Treasury budgetRuleset allowance1,000,000 gold piecesUsed235,000 gold piecesRemaining765,000 gold pieces",
    );
    expect(text).not.toContain("Loading");
    expect(query).toHaveBeenCalledExactlyOnceWith(api.teams.getByUuid, {
      uuid,
    });
  } finally {
    await window.happyDOM.close();
  }
});

it("does not claim a ruleset allowance is the league's treasury", async () => {
  query.mockResolvedValue({ ...saved, draftLeagueId: "league-id" });
  const html = await (await get()).text();
  expect(html).not.toContain("Treasury budget");
  expect(html).toContain("League-specific treasury allowances");
  expect(html).not.toContain("league-id");
});

it("includes tournament skill allowances and shared funds in readable HTML", async () => {
  query.mockResolvedValue({
    ...saved,
    team: { ...team, rulesetId: "eurobowl-2026" },
  });
  const window = new Window({
    settings: { disableJavaScriptEvaluation: true },
  });
  try {
    window.document.write(await (await get()).text());
    window.document
      .querySelectorAll("script")
      .forEach((script) => script.remove());
    const text = window.document.body.textContent;
    expect(text).toContain("Skills budget");
    expect(text).toContain("Flowing Funds budget");
    expect(text).toContain(
      "Overspending this base allowance draws from the shared Flowing Funds reserve.",
    );
    expect(
      window.document
        .querySelector('a[href*="/rosters/orc"]')
        ?.getAttribute("href"),
    ).toContain("ruleset=eurobowl-2026");
  } finally {
    await window.happyDOM.close();
  }
});

it("offers the same snapshot as negotiated JSON-LD, with explicit media type and cache variation", async () => {
  query.mockResolvedValue(saved);
  const html = await (await get()).text();
  const embedded = JSON.parse(
    html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
  );
  const jsonResponse = await GET(
    new Request(`https://sideline.example/teams/${uuid}/roster`, {
      headers: {
        accept: "application/ld+json",
        "user-agent": "UnknownReader/1.0",
      },
    }),
    { params: Promise.resolve({ slug: uuid }) },
  );
  expect(jsonResponse.headers.get("content-type")).toBe(
    "application/ld+json; charset=utf-8",
  );
  expect(jsonResponse.headers.get("vary")).toBe("Accept, User-Agent");
  expect(await jsonResponse.json()).toEqual(embedded);
});

it.each([
  ["application/ld+json", true],
  ["text/html, application/ld+json;q=0.5", false],
  ["application/ld+json;q=0", false],
  ["application/ld+json;q=0.5, */*;q=1", false],
  ["application/ld+json;q=1, text/*;q=0.5", true],
  ["application/ld+json;q=invalid", false],
  ["text/html, */*", false],
  ["*/*", false],
])("respects explicit HTTP representation preference: %s", (accept, jsonLd) => {
  expect(prefersTeamJsonLd(accept)).toBe(jsonLd);
});

it("returns 404 for missing/archived or invalid teams, and 503 for an unavailable backend", async () => {
  query.mockResolvedValue(null);
  expect((await get()).status).toBe(404);
  query.mockClear();
  expect((await get("invalid")).status).toBe(404);
  expect(query).not.toHaveBeenCalled();
  query.mockRejectedValue(new Error("Backend offline"));
  const response = await get();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("Loading");
});
