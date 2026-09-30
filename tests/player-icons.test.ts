import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { rosters, stars } from "../src/domain/catalog";
import {
  getPositionArtwork,
  getRosterArtwork,
  getStarArtwork,
  positionArtwork,
} from "../src/domain/player-icons";

const manifest = JSON.parse(
  readFileSync("public/assets/fumbbl/manifest.json", "utf8"),
) as {
  sheetCount: number;
  frameCount: number;
  sheets: {
    id: string;
    label: string;
    group: string;
    src: string;
    width: number;
    height: number;
    sha256: string;
    frames: {
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  }[];
};
const publicPath = (src: string) => path.join("public", src);

describe("FUMBBL asset integrity", () => {
  it("preserves all originals and every lossless crop with accurate dimensions", async () => {
    expect(manifest.sheetCount).toBe(227);
    expect(manifest.sheets).toHaveLength(227);
    expect(new Set(manifest.sheets.map((s) => s.id)).size).toBe(227);
    let frameCount = 0;
    for (const sheet of manifest.sheets) {
      const bytes = readFileSync(publicPath(sheet.src));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        sheet.sha256,
      );
      const metadata = await sharp(bytes).metadata();
      expect([metadata.width, metadata.height]).toEqual([
        sheet.width,
        sheet.height,
      ]);
      expect(sheet.src).toContain(`-${sheet.width}x${sheet.height}.`);
      for (const frame of sheet.frames) {
        const crop = readFileSync(publicPath(frame.src));
        const dimensions = await sharp(crop).metadata();
        expect([dimensions.width, dimensions.height]).toEqual([
          frame.width,
          frame.height,
        ]);
        expect(frame.src.endsWith(`-${frame.width}x${frame.height}.png`)).toBe(
          true,
        );
        const actual = await sharp(crop).ensureAlpha().raw().toBuffer();
        const expected = await sharp(bytes)
          .extract({
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          })
          .ensureAlpha()
          .raw()
          .toBuffer();
        expect(actual.equals(expected)).toBe(true);
        frameCount++;
      }
    }
    expect(frameCount).toBe(2308);
    expect(frameCount).toBe(manifest.frameCount);
  }, 30000);

  it("maps every roster and explicitly accounts for each current position", () => {
    const missing = new Set([
      "gnome-0",
      "gnome-1",
      "gnome-2",
      "gnome-3",
      "norse-1",
      "vampire-4",
    ]);
    for (const roster of rosters) {
      expect(getRosterArtwork(roster.id), roster.id).toBeDefined();
      expect(positionArtwork[roster.id]).toHaveLength(roster.players.length);
      for (const position of roster.players) {
        expect(!!getPositionArtwork(position.id), position.id).toBe(
          !missing.has(position.id),
        );
      }
    }
  });

  it("uses dedicated star artwork for source matches and documented spelling aliases", () => {
    for (const id of [
      "griff-oberwald",
      "count-luthor-von-drakenforg",
      "rumbelow-sheepskin",
      "varag-ghoul-chewer",
      "gretchen-wachter",
      "the-mighty-zug",
      "wilhelm-chaney",
      "hthark-the-unstoppable",
    ]) {
      expect(getStarArtwork(id)?.group, id).toBe("Star Players");
    }
    expect(getStarArtwork("akhorne-the-squirrel")).toBeUndefined();
    expect(stars.filter((star) => getStarArtwork(star.id))).toHaveLength(51);
  });
});
