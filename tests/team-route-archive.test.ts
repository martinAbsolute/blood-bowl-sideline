import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: query }));
const uuid = "5d843a7d-5059-45a3-9f11-a30504824955";

beforeEach(() => {
  query.mockReset();
});

it("returns a 404 rewrite for archived URLs, including prefetch requests", async () => {
  query.mockResolvedValue(true);
  const response = await proxy(
    new NextRequest(`https://sideline.example/teams/${uuid}`, {
      headers: { "next-router-prefetch": "1" },
    }),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "https://sideline.example/404",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("allows active and device-only UUIDs to reach their editor", async () => {
  query.mockResolvedValue(false);
  const response = await proxy(
    new NextRequest(`https://sideline.example/teams/${uuid}`),
  );
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

it("does not query Convex for an invalid UUID", async () => {
  const response = await proxy(
    new NextRequest("https://sideline.example/teams/invalid"),
  );
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(query).not.toHaveBeenCalled();
});

it("propagates backend outages rather than classifying the team as missing", async () => {
  query.mockRejectedValue(new Error("Backend unavailable"));
  await expect(
    proxy(new NextRequest(`https://sideline.example/teams/${uuid}`)),
  ).rejects.toThrow("Backend unavailable");
});
