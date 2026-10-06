import { afterEach, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { contentMetadata } from "../src/lib/content-metadata";

const mocks = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
vi.mock("convex/nextjs", () => mocks);
afterEach(() => mocks.fetchQuery.mockReset());

const uuid = "11111111-1111-4111-8111-111111111111";
const metadata = () =>
  contentMetadata(
    api.teams.getByUuid,
    { uuid },
    `/teams/${uuid}`,
    "Shared Blood Bowl Team",
    "Shared roster",
    (data) => data?.team.name,
  );

it("uses public team content in page and social sharing titles without passing auth", async () => {
  mocks.fetchQuery.mockResolvedValue({ team: { name: "Reikland Reavers" } });
  const result = await metadata();
  expect(result.title).toBe("Reikland Reavers");
  expect(result.openGraph).toMatchObject({
    title: "Reikland Reavers | Blood Bowl Sideline.",
    url: `/teams/${uuid}`,
  });
  expect(result.twitter).toMatchObject({
    title: "Reikland Reavers | Blood Bowl Sideline.",
  });
  expect(mocks.fetchQuery).toHaveBeenCalledWith(api.teams.getByUuid, { uuid });
});

it("falls back for missing, unnamed or unavailable content", async () => {
  for (const data of [null, { team: { name: "  " } }]) {
    mocks.fetchQuery.mockResolvedValue(data);
    expect((await metadata()).title).toBe("Shared Blood Bowl Team");
  }
  mocks.fetchQuery.mockRejectedValue(new Error("Unavailable"));
  expect((await metadata()).title).toBe("Shared Blood Bowl Team");
});
