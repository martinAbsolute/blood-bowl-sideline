import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, it } from "vitest";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";
import dictionary from "../src/dictionary";
import loadDictionary from "../src/loadDictionary";
import {
  skills,
  inducements,
  skillName,
  sortSkillIds,
} from "../src/domain/catalog";
import {
  translatedSkillName,
  skillSearchText,
} from "../src/lib/translated-skill-name";
import glossary from "../docs/translations/community-glossary.json";

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

it("uses every community skill translation, including catalog spelling variants", () => {
  const rows = glossary.find(
    (sheet) => sheet.sheet === "Skills & Traits",
  )!.rows;
  const terms = new Map(
    rows.slice(1).map((row) => {
      const cells = Object.entries(row);
      return [
        cells
          .find(([cell]) => cell.startsWith("B"))![1]!
          .trim()
          .toLowerCase(),
        cells.find(([cell]) => cell.startsWith("C"))![1]!.trim(),
      ];
    }),
  );
  const aliases: Record<string, string> = {
    "ball and chain": "ball & chain",
    "pogo stick": "pogo",
    "timmm-ber!": "timm-ber!",
    hatred: "hatred (х)",
  };
  for (const skill of skills) {
    if (skill.category === "special") continue;
    const base = skill.name.replace(/ \(x\+?\)$/i, "").toLowerCase();
    const expected = terms.get(aliases[base] ?? base);
    expect(expected, skill.id).toBeDefined();
    expect(
      uk.skillNames[skill.id as keyof typeof uk.skillNames].replace(
        / \(x\+?\)$/i,
        "",
      ),
    ).toBe(expected);
    expect(en.skillNames[skill.id as keyof typeof en.skillNames]).toBe(
      skill.name,
    );
  }
  for (const item of inducements) {
    expect(uk.inducementNames).toHaveProperty(item.id);
    expect(en.inducementNames[item.id as keyof typeof en.inducementNames]).toBe(
      item.name,
    );
  }
});

it("renders Ukrainian parameterized names without changing English identities or sorting", async () => {
  runtimeCache();
  const t = await getTranslationsInternal({ locale: "uk", enableI18n: true });
  expect(translatedSkillName("dodge", t)).toBe("Ухилення");
  expect(translatedSkillName("loner:4+", t)).toBe("Одинак (4+)");
  expect(translatedSkillName("hatred:Orc", t)).toBe("Ненависть (Orc)");
  expect(translatedSkillName("unknown", t)).toBe("unknown");
  expect(skillName("dodge")).toBe("Dodge");
  expect(skillSearchText("dodge", t)).toBe("ухилення dodge");
  expect(uk.skillDescriptions.dodge).not.toContain("(Dodge)");
  expect(uk.inducementNames.bribes).toBe("Хабарі");
  expect(sortSkillIds(["dodge", "block"])).toEqual(["block", "dodge"]);
});

it("keeps both locales' keys and interpolation parameters in sync", () => {
  function flatten(value: object, prefix = ""): Record<string, string> {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof entry === "string"
          ? [[path, entry]]
          : Object.entries(flatten(entry, path));
      }),
    );
  }
  const source = flatten(en),
    translated = flatten(uk);
  expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
  for (const [key, value] of Object.entries(source)) {
    const parameters = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    expect(parameters(translated[key]), key).toEqual(parameters(value));
  }
});
