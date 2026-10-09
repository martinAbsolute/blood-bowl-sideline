import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { newTeam } from "../src/domain/catalog";
import { api } from "../convex/_generated/api";
import Page, { generateMetadata } from "../src/app/teams/[slug]/page";

const mocks = vi.hoisted(() => ({ fetchQuery: vi.fn(), connection: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.fetchQuery }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("../src/components/team-page", () => ({
  TeamPage: ({ uuid }: { uuid: string }) =>
    createElement("div", { "data-team-editor": uuid }),
}));

const uuid = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ slug: uuid });
afterEach(() => {
  mocks.fetchQuery.mockReset();
  mocks.connection.mockReset();
});

it("includes parseable JSON-LD in server HTML and preserves the editor and sharing metadata", async () => {
  const team = newTeam(uuid);
  team.name = "Reikland Reavers";
  mocks.fetchQuery.mockResolvedValue({
    team,
    revision: 2,
    updatedAt: Date.UTC(2026, 9, 9),
    legal: false,
    leagueLocked: false,
    leagueExperienced: false,
  });
  const html = renderToStaticMarkup(await Page({ params }));
  const script = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/,
  );
  expect(script).not.toBeNull();
  expect(JSON.parse(script![1]).mainEntity.teamSnapshot.name).toBe(team.name);
  expect(html).toContain(`data-team-editor="${uuid}"`);
  expect(mocks.fetchQuery).toHaveBeenCalledWith(api.teams.getByUuid, { uuid });
  expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.fetchQuery.mock.invocationCallOrder[0],
  );
  const metadata = await generateMetadata({ params });
  expect(metadata.title).toBe(team.name);
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates?.canonical).toBe(`/teams/${uuid}`);
});

it("emits no fictitious roster for a missing cloud team or backend outage", async () => {
  for (const unavailable of [false, true]) {
    if (unavailable) mocks.fetchQuery.mockRejectedValue(new Error("Offline"));
    else mocks.fetchQuery.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page({ params }));
    expect(html).not.toContain("application/ld+json");
    expect(html).toContain(`data-team-editor="${uuid}"`);
    expect((await generateMetadata({ params })).title).toBe(
      "Shared Blood Bowl Team",
    );
  }
});

it("rejects invalid UUIDs before querying and preserves request boundary errors", async () => {
  const invalid = { params: Promise.resolve({ slug: "invalid" }) };
  await expect(Page(invalid)).rejects.toThrow("Not found");
  await expect(generateMetadata(invalid)).rejects.toThrow("Not found");
  expect(mocks.fetchQuery).not.toHaveBeenCalled();
  const boundary = new Error("Request boundary");
  mocks.connection.mockRejectedValue(boundary);
  await expect(Page({ params })).rejects.toBe(boundary);
  expect(mocks.fetchQuery).not.toHaveBeenCalled();
});
