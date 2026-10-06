import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rosters } from "../src/domain/catalog";

describe("team roster SVGs", () => {
  it("covers every roster with a monochrome SVG", () => {
    const directory = "public/assets/team-icons";
    expect(
      readdirSync(directory)
        .filter((name) => name.endsWith(".svg"))
        .sort(),
    ).toEqual(rosters.map((roster) => `${roster.id}.svg`).sort());

    for (const roster of rosters) {
      const svg = readFileSync(`${directory}/${roster.id}.svg`, "utf8");
      expect(svg, roster.id).toMatch(/^<svg[^>]+viewBox="[^"]+"/);
      expect(svg, roster.id).toContain('<path fill="currentColor"');
      expect(svg, roster.id).not.toMatch(/<script|<foreignObject/i);
    }
  });
});
