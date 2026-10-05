import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { rosters, stars } from "../src/domain/catalog";
import {
  getPositionArtwork,
  getRosterArtwork,
  getStarArtwork,
} from "../src/domain/player-icons";
import sourceMap from "../scripts/fumbbl-sprite-sources.json";
import manifest from "../public/assets/fumbbl/manifest.json";
import iconData from "../src/domain/data/player-icons.json";

const publicPath = (src: string) => path.join("public", src);
const positionSources = sourceMap.rosters.flatMap((roster) => roster.players);
const sourceFor = (id: string) =>
  manifest.assets.find((asset) =>
    asset.players.some((player) => player.id === id),
  );

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  });
}

describe("FUMBBL canonical sprite library", () => {
  it("preserves each original and every crop without resizing or losing pixels", async () => {
    expect(manifest.assetCount).toBe(manifest.assets.length);
    expect(new Set(manifest.assets.map((asset) => asset.sourceUrl)).size).toBe(
      manifest.assetCount,
    );
    let frameCount = 0;
    for (const asset of manifest.assets) {
      const bytes = readFileSync(publicPath(asset.src));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        asset.sha256,
      );
      const metadata = await sharp(bytes).metadata();
      expect([metadata.width, metadata.height]).toEqual([
        asset.width,
        asset.height,
      ]);
      expect(asset.src).toContain(`-${asset.width}x${asset.height}.`);
      expect(metadata.pages ?? 1).toBe(1);
      expect(asset.frames).toHaveLength(asset.layout === "four-poses" ? 4 : 1);
      for (const frame of asset.frames) {
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
        expect(actual.equals(expected), frame.src).toBe(true);
        expect(
          (await sharp(crop).stats()).channels[3].max,
          frame.src,
        ).toBeGreaterThan(0);
        frameCount++;
      }
    }
    expect(frameCount).toBe(manifest.frameCount);
  }, 30000);

  it("covers every catalog position, star and roster using its reviewed source", () => {
    expect(manifest.rosterPages).toHaveLength(31);
    expect(manifest.leaguePages).toEqual(sourceMap.leaguePages);
    expect(manifest.leaguePages).toHaveLength(25);
    expect(manifest.positionCount).toBe(163);
    expect(manifest.catalogStarCount).toBe(stars.length);
    expect(Object.keys(iconData.positions).sort()).toEqual(
      rosters
        .flatMap((roster) => roster.players.map((player) => player.id))
        .sort(),
    );
    expect(Object.keys(iconData.rosters).sort()).toEqual(
      rosters.map((roster) => roster.id).sort(),
    );
    for (const roster of rosters) {
      expect(getRosterArtwork(roster.id), roster.id).toBeDefined();
      for (const position of roster.players) {
        const artwork = getPositionArtwork(position.id);
        const source = positionSources.find(
          (entry) => entry.id === position.id,
        )!;
        const asset = sourceFor(position.id)!;
        expect(artwork, position.id).toBeDefined();
        expect(asset.sourceUrl).toBe(
          source.sourceUrl.replace(/^http:/, "https:"),
        );
        expect(artwork?.label).toBe(source.label);
        expect(artwork?.variants).toEqual([asset.frames[0].src]);
        expect([artwork?.width, artwork?.height]).toEqual([
          asset.frames[0].width,
          asset.frames[0].height,
        ]);
      }
    }
    for (const star of stars) {
      const artwork = getStarArtwork(star.id);
      const source = sourceMap.stars.find((entry) => entry.id === star.id)!;
      const asset = sourceFor(star.id)!;
      expect(artwork?.group, star.id).toBe("Star Players");
      expect(asset.sourceUrl).toBe(source.sourceUrl);
      expect(artwork?.label).toBe(source.label);
      expect(artwork?.variants).toEqual([asset.frames[0].src]);
      expect(asset.frames[0].pose).toBe("red-front");
    }
    expect(manifest.sourceStarCount).toBe(68);
    expect(getPositionArtwork("unknown")).toBeUndefined();
    expect(getRosterArtwork("unknown")).toBeUndefined();
    expect(getStarArtwork("unknown")).toBeUndefined();
  });

  it("matches reordered and previously missing roles by identity", () => {
    const expectedSources = {
      "goblin-3": "578628", // Ooligan, not Doom Diver
      "goblin-4": "578400", // Doom Diver
      "norse-2": "noberserker1.gif", // Berserker, not Valkyrie
      "norse-3": "692266", // Valkyrie
      "norse-1": "692265", // Beer Boar
      "gnome-0": "735055",
      "gnome-1": "735054",
      "gnome-2": "735052",
      "gnome-3": "735053",
      "vampire-4": "719301", // Vargheist
      "khorne-3": "682105", // Dedicated Bloodspawn
      "bretonnian-3": "375672.png", // Dedicated Grail Knight
    };
    for (const [id, image] of Object.entries(expectedSources))
      expect(sourceFor(id)?.sourceUrl.endsWith(`/${image}`), id).toBe(true);
    expect(sourceFor("akhorne-the-squirrel")?.sourceUrl).toBe(
      "https://fumbbl.com/i/682638",
    );
    expect(sourceFor("josef-bugman")?.sourceUrl).toBe(
      "https://fumbbl.com/i/693925",
    );
    expect(sourceFor("josef-bugman")?.players[0]).toMatchObject({
      sourcePages: ["https://fumbbl.com/p/notes?id=9260&op=view"],
      note: expect.stringContaining("not a canonical league-list sprite"),
    });
  });

  it("contains no obsolete or unreferenced asset files", () => {
    const expected = manifest.assets.flatMap((asset) => [
      publicPath(asset.src),
      ...asset.frames.map((frame) => publicPath(frame.src)),
    ]);
    expected.push(
      path.join("public", "assets", "fumbbl", "manifest.json"),
      path.join("public", "assets", "fumbbl", "README.md"),
    );
    expect(filesIn("public/assets/fumbbl").sort()).toEqual(expected.sort());
    expect(new Set(expected).size).toBe(expected.length);
  });
});
