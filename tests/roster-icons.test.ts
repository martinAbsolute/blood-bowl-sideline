import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { rosters } from "../src/domain/catalog";
import { getRosterIconSrc } from "../src/domain/player-icons";

describe("team roster SVGs", () => {
  it("covers every roster with a monochrome SVG", () => {
    const directory = "public/teams";
    const files = [...new Set(rosters.map((roster) => getRosterIconSrc(roster.id).replace("/teams/", "")))];
    expect(readdirSync(directory).sort()).toEqual(files.sort());

    for (const roster of rosters) {
      const svg = readFileSync(`public${getRosterIconSrc(roster.id)}`, "utf8");
      expect(svg, roster.id).toMatch(/^<svg[^>]+viewBox="[^"]+"/);
      expect(svg, roster.id).toContain('<path fill="currentColor"');
      expect(svg, roster.id).not.toMatch(/<script|<foreignObject/i);
    }
    const hashes = files.map((file) =>
      createHash("sha256")
        .update(readFileSync(`${directory}/${file}`))
        .digest("hex"),
    );
    expect(new Set(hashes).size).toBe(files.length);
  });
});
