import { readFileSync, readdirSync } from "node:fs";
import { createTranslator, type Messages } from "next-intl";
import { join } from "node:path";
import { expect, it } from "vitest";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";
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
import { formats } from "../src/i18n/config";
import glossary from "../docs/translations/community-glossary.json";

function translator(locale: "en" | "uk") {
  return createTranslator({
    locale,
    formats,
    messages: (locale === "uk" ? uk : en) as Messages,
    onError(error) {
      throw error;
    },
  });
}

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

it("resolves every literal UI translation key in both locales", () => {
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
    for (const match of readFileSync(file, "utf8").matchAll(
      /\bt(?:\.rich)?\("([\w.-]+)"\s*[,)]/g,
    )) {
      expect(en, `${file}: ${match[1]}`).toHaveProperty(match[1]);
      expect(uk, `${file}: ${match[1]}`).toHaveProperty(match[1]);
    }
  }
});

it("renders every message with the next-intl ICU runtime in both locales", () => {
  for (const locale of ["en", "uk"] as const) {
    const t = translator(locale);
    for (const [key, message] of Object.entries(
      flatten(locale === "uk" ? uk : en),
    )) {
      const values = Object.fromEntries(
        [...message.matchAll(/\{(\w+)(?:\}|,)/g)].map(([, name]) => [
          name,
          name === "count" ? 2 : "test",
        ]),
      );
      expect(
        t(key as Parameters<typeof t>[0], values),
        `${locale}: ${key}`,
      ).toEqual(expect.any(String));
    }
    expect(t("devAuth.title")).toBe((locale === "uk" ? uk : en).devAuth.title);
    expect(t("appVersion", { version: "test" })).toContain("test");
  }
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
  const t = translator("uk");
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

it("uses English and Ukrainian plural rules for recruitment counts", () => {
  const english = translator("en"),
    ukrainian = translator("uk");
  expect(english("sevensRecruitMore", { count: 1 })).toBe(
    "Add 1 more player to start.",
  );
  expect(english("sevensRecruitMore", { count: 2 })).toBe(
    "Add 2 more players to start.",
  );
  expect(ukrainian("sevensRecruitMore", { count: 1 })).toContain("1 гравця");
  expect(ukrainian("sevensRecruitMore", { count: 2 })).toContain("2 гравців");
  expect(ukrainian("sevensRecruitMore", { count: 5 })).toContain("5 гравців");
  expect(ukrainian("sevensRecruitMore", { count: 21 })).toContain("21 гравця");
});
