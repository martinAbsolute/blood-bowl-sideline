import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { rosters, stars } from "../src/domain/catalog";
import { getPositionArtwork, getStarArtwork } from "../src/domain/player-icons";

const artwork = [
  ...rosters.flatMap((roster) => roster.players.map((player) => getPositionArtwork(player.id))),
  ...stars.map((star) => getStarArtwork(star.id)),
];

describe("player sprite assets", () => {
  it("covers every catalog position and star, with fallbacks for unknown IDs", () => {
    for (const image of artwork) {
      expect(image).toBeDefined();
      expect(image?.src).toMatch(/^\/players\/[a-z0-9-]+\.png$/);
    }
    expect(getPositionArtwork("unknown")).toBeUndefined();
    expect(getStarArtwork("unknown")).toBeUndefined();
  });

  it("has one file per image, no duplicate bytes, and correct native dimensions", async () => {
    const images = new Map(artwork.map((image) => [image!.src, image!]));
    expect(readdirSync("public/players").sort()).toEqual(
      [...images.keys()].map((src) => src.replace("/players/", "")).sort(),
    );
    const hashes = new Set<string>();
    for (const image of images.values()) {
      const bytes = readFileSync("public" + image.src);
      const metadata = await sharp(bytes).metadata();
      expect([metadata.width, metadata.height], image.src).toEqual([image.width, image.height]);
      expect(metadata.format, image.src).toBe("png");
      expect(metadata.pages ?? 1, image.src).toBe(1);
      expect((await sharp(bytes).stats()).channels[3].max, image.src).toBeGreaterThan(0);
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(hashes.has(hash), "Duplicate sprite: " + image.src).toBe(false);
      hashes.add(hash);
    }
  });

  it("keeps commonly confused roster roles distinct", () => {
    expect(getPositionArtwork("goblin-3")?.src).toBe("/players/goblin-ooligan.png");
    expect(getPositionArtwork("goblin-4")?.src).toBe("/players/goblin-doom-diver.png");
    expect(getPositionArtwork("norse-2")?.src).toBe("/players/norse-berserker.png");
    expect(getPositionArtwork("norse-3")?.src).toBe("/players/norse-valkyrie.png");
  });
});
