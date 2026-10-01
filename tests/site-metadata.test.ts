import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

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
