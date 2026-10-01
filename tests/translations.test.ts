import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, it } from "vitest";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";
import dictionary from "../src/dictionary";
import loadDictionary from "../src/loadDictionary";

// Resolve the actual GT runtime used by gt-next, including pnpm's dependency layout.
const require = createRequire(import.meta.url);
const gtRequire = createRequire(require.resolve("gt-next"));
const {
  I18nCache,
  I18nConfig,
  getTranslationsInternal,
  setI18nCache,
  setI18nConfig,
} = gtRequire("gt-i18n/internal");

function runtimeCache() {
  setI18nConfig(
    new I18nConfig({
      defaultLocale: "en",
      locales: ["en", "uk"],
      runtimeUrl: null,
    }),
  );
  const cache = new I18nCache({
    dictionary,
    loadDictionary,
    loadTranslations: async () => ({}),
    runtimeUrl: null,
  });
  setI18nCache(cache);
  return cache;
}

it("the installed GT runtime resolves every literal UI translation key in both locales", async () => {
  const cache = runtimeCache();
  await cache.loadDictionary("uk");
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : entry.name.endsWith(".tsx")
          ? [join(dir, entry.name)]
          : [],
    );
  }
  for (const file of walk("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\("([\w.-]+)"\s*[,)]/g)) {
      expect(en, `${file}: ${match[1]}`).toHaveProperty(match[1]);
      expect(uk, `${file}: ${match[1]}`).toHaveProperty(match[1]);
      for (const locale of ["en", "uk"]) {
        expect(
          cache.lookupDictionary(locale, match[1])?.entry,
          `${locale} runtime: ${file}: ${match[1]}`,
        ).toEqual(expect.any(String));
      }
    }
  }
});

it("the actual source and locale loader preserve nested league and development entries", async () => {
  const cache = runtimeCache();
  for (const [locale, expected] of [
    ["en", en],
    ["uk", uk],
  ] as const) {
    await cache.loadDictionary(locale);
    function checkLeaves(value: object, prefix = "") {
      for (const [key, entry] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof entry === "string") {
          expect(
            cache.lookupDictionary(locale, path)?.entry,
            `${locale}: ${path}`,
          ).toBe(entry);
        } else {
          checkLeaves(entry, path);
        }
      }
    }
    checkLeaves(expected);
    const t = await getTranslationsInternal({ locale, enableI18n: true });
    expect(t("devAuth.title")).toBe(expected.devAuth.title);
    expect(t("leagueUi.errors.CONFLICT")).toBe(
      expected.leagueUi.errors.CONFLICT,
    );
    expect(t("appVersion", { version: "test" })).toBe(
      expected.appVersion.replace("{version}", "test"),
    );
  }
  expect(await loadDictionary("en-US")).toBe(dictionary);
  expect(await loadDictionary("uk-UA")).toBe(uk);
});
