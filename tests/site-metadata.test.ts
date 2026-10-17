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

it("uses the production domain when Vercel defaults are absent", async () => {
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", undefined);
  const { siteUrl } = await import("../src/lib/site-metadata");
  expect(siteUrl.origin).toBe("https://sideline.com.ua");
});

it("uses the requested homepage title, description and period-separated social titles", async () => {
  const { homeTitle, siteDescription, pageTitle, pageMetadata } = await import("../src/lib/site-metadata");
  expect(homeTitle).toBe("Blood Bowl Sideline. Blood Bowl Team Builder");
  expect(siteDescription).toBe(
    "Build, save and share your Blood Bowl teams. Plan rosters and player advancements with BB2025 rules.",
  );
  expect(pageTitle("My teams")).toBe("My teams. Blood Bowl Sideline.");
  expect(pageTitle("Orcs.")).toBe("Orcs. Blood Bowl Sideline.");
  const metadata = pageMetadata("Orcs.", "/teams/example", siteDescription);
  expect(metadata.title).toBe("Orcs");
  expect(metadata.openGraph).toMatchObject({ title: "Orcs. Blood Bowl Sideline." });
  expect(metadata.twitter).toMatchObject({ title: "Orcs. Blood Bowl Sideline." });
  const { metadata: home } = await import("../src/app/page");
  expect(home.title).toEqual({ absolute: homeTitle });
  expect(home.alternates?.canonical).toBe("/");
  const { metadata: teams } = await import("../src/app/teams/page");
  expect(teams.title).toBe("My teams");
});

it("includes the homepage and league directory in the sitemap and blocks previews", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const { default: sitemap } = await import("../src/app/sitemap");
  const { siteUrl } = await import("../src/lib/site-metadata");
  const urls = sitemap().map((entry) => entry.url);
  expect(urls).toContain(new URL("/", siteUrl).href);
  expect(urls).toContain(new URL("/leagues", siteUrl).href);
  vi.resetModules();
  vi.stubEnv("VERCEL_ENV", "preview");
  expect((await import("../src/app/sitemap")).default()).toEqual([]);
  expect((await import("../src/app/robots")).default().rules).toEqual({ userAgent: "*", disallow: "/" });
});
