import { afterEach, expect, it, vi } from "vitest";

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

it.each([
  ["production", "https://sideline.example"],
  ["preview", "https://sideline-feature.vercel.app"],
])(
  "configures the selected %s backend from Vercel defaults before building",
  async (environment, origin) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "sideline.example");
    vi.stubEnv("VERCEL_BRANCH_URL", "sideline-feature.vercel.app");
    vi.stubEnv("VERCEL_URL", "sideline-unique.vercel.app");
    vi.stubEnv(
      "NEXT_PUBLIC_CONVEX_URL",
      "https://selected-backend.eu-west-1.convex.cloud",
    );
    spawnSync.mockReturnValue({ status: 0 });
    await import("../scripts/vercel-build.mjs");
    const selector =
      environment === "production" ? [] : ["--deployment", "selected-backend"];
    expect(spawnSync.mock.calls.map((call) => call[1])).toEqual([
      ["exec", "convex", "env", "set", "SITE_URL", origin, ...selector],
      [
        "exec",
        "convex",
        "env",
        "set",
        "CUSTOM_AUTH_SITE_URL",
        origin,
        ...selector,
      ],
      ["run", "build"],
    ]);
  },
);

it("uses the canonical production domain in metadata, including on previews", async () => {
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "sideline.example");
  vi.stubEnv("VERCEL_ENV", "preview");
  const { siteUrl, isPreview } = await import("../src/lib/site-metadata");
  expect(siteUrl.origin).toBe("https://sideline.example");
  expect(isPreview).toBe(true);
});

it("uses localhost for metadata when Vercel defaults are absent", async () => {
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", undefined);
  const { siteUrl } = await import("../src/lib/site-metadata");
  expect(siteUrl.origin).toBe("http://localhost:3000");
});
