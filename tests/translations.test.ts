import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

it("both dictionaries contain every literal UI translation key", () => {
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
    for (const match of source.matchAll(/\bt\("([\w.-]+)"/g)) {
      expect(en, `${file}: ${match[1]}`).toHaveProperty(match[1]);
      expect(uk, `${file}: ${match[1]}`).toHaveProperty(match[1]);
    }
  }
});
