import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyPlayerStats } from "../src/domain/league-rules";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const backend = read("convex/leagues.ts");
const authorization = read("convex/roles.ts");
const sharedUi = read("src/components/league-ui.tsx");
const messages = {
  en: JSON.parse(read("src/i18n/en.json")),
  uk: JSON.parse(read("src/i18n/uk.json")),
} as Record<string, { leagueUi: Record<string, unknown> }>;
const locales = ["en", "uk"];
const componentSources = [
  "league-ui",
  "league-workspace",
  "league-match",
  "league-career",
  "league-commissioner",
].map((name) => read(`src/components/${name}.tsx`));

function label(locale: string, section: string, key: string) {
  const group = messages[locale].leagueUi[section] as Record<string, unknown>;
  expect(group[key], `${locale}: leagueUi.${section}.${key}`).toBeTypeOf(
    "string",
  );
  expect(
    String(group[key]).trim(),
    `${locale}: leagueUi.${section}.${key}`,
  ).not.toBe("");
}

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("league UI and API vocabulary", () => {
  it("provides matching English and Ukrainian labels", () => {
    expect(leafKeys(messages.en.leagueUi).sort()).toEqual(
      leafKeys(messages.uk.leagueUi).sort(),
    );
  });

  it("shows a specific translated message for every backend error code", () => {
    const codes = new Set([
      ...Array.from(
        (backend + authorization).matchAll(/new ConvexError\("([A-Z_]+)"/g),
        (match) => match[1],
      ),
      ...Array.from(
        backend.matchAll(/code:\s*"([A-Z_]+)"/g),
        (match) => match[1],
      ),
    ]);
    const known = sharedUi.match(/const known\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    const accepted = new Set(
      Array.from(known.matchAll(/"([A-Z_]+)"/g), (match) => match[1]),
    );
    for (const code of codes) {
      expect(accepted.has(code), `useLeagueAction recognizes ${code}`).toBe(
        true,
      );
      for (const locale of locales) label(locale, "errors", code);
    }
  });

  it("labels every recorded audit action", () => {
    const actions = new Set(
      Array.from(
        backend.matchAll(
          /auditEvent\(\s*ctx,\s*[^,]+,\s*[^,]+,\s*"([a-z-]+)"/g,
        ),
        (match) => match[1],
      ),
    );
    expect(actions.size).toBeGreaterThan(15);
    for (const action of actions)
      for (const locale of locales) label(locale, "audit", action);
  });

  it("labels report and career counters and their tooltips", () => {
    const keys = new Set([
      ...Object.keys(emptyPlayerStats()),
      ...componentSources.flatMap((source) =>
        Array.from(
          source.matchAll(
            /const (?:\w+Columns|fields)\s*=\s*\[([\s\S]*?)\]\s*as const/g,
          ),
          (match) =>
            Array.from(
              match[1].matchAll(/"([a-zA-Z]+)"/g),
              (column) => column[1],
            ),
        ).flat(),
      ),
    ]);
    for (const key of keys)
      for (const locale of locales) {
        label(locale, "stats", key);
        label(locale, "statDescriptions", key);
      }
  });

  it("labels all schema statuses and administrative results", () => {
    const schema = read("convex/schema.ts").split("leagues: defineTable")[1];
    const validators = read("convex/leagueValidators.ts");
    const statusLines = [
      ...schema.matchAll(/status:\s*v\.union\(([^\n]+)\)/g),
      ...validators.matchAll(
        /export const playerStatusValidator = v\.union\(([\s\S]*?)\);/g,
      ),
    ];
    const statuses = new Set([
      "withdrawn",
      ...statusLines.flatMap((match) =>
        Array.from(
          match[1].matchAll(/v\.literal\("([a-z-]+)"\)/g),
          (literal) => literal[1],
        ),
      ),
    ]);
    for (const status of statuses)
      for (const locale of locales) label(locale, "status", status);
    for (const outcome of ["home-win", "away-win", "draw", "void"])
      for (const locale of locales) {
        expect(
          messages[locale].leagueUi[outcome],
          `${locale}: leagueUi.${outcome}`,
        ).toBeTypeOf("string");
      }
  });
});
