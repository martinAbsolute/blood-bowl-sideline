import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  rename,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { format } from "prettier";

// Offline by default: rebuild from checked-in originals. --download refreshes
// the reviewed URLs, or --cache <directory> imports a previously downloaded set.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(root, "public/assets/fumbbl");
const sources = JSON.parse(
  await readFile(path.join(root, "scripts/fumbbl-sprite-sources.json"), "utf8"),
);
const rosters = JSON.parse(
  await readFile(path.join(root, "src/domain/data/rosters.json"), "utf8"),
);
const stars = JSON.parse(
  await readFile(path.join(root, "src/domain/data/stars.json"), "utf8"),
);
const cacheIndex = process.argv.indexOf("--cache");
const cache = cacheIndex === -1 ? undefined : process.argv[cacheIndex + 1];
if (cacheIndex !== -1 && !cache)
  throw new Error("--cache requires a directory");
const download = process.argv.includes("--download");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slug = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const fetchUrl = (url) => {
  const parsed = new URL(url);
  if (parsed.hostname !== "fumbbl.com")
    throw new Error(`Unexpected sprite host: ${url}`);
  parsed.protocol = "https:";
  return parsed.href;
};
const json = (value) => format(JSON.stringify(value), { parser: "json" });
const run = promisify(execFile);
const previous =
  !download && !cache
    ? JSON.parse(await readFile(path.join(assetsRoot, "manifest.json"), "utf8"))
    : undefined;
const entries = [
  ...sources.rosters.flatMap((roster) =>
    roster.players.map((player) => ({
      ...player,
      group: roster.name,
      sourcePages: [roster.sourcePage],
      kind: "position",
    })),
  ),
  ...sources.stars.map((star) => ({ ...star, kind: "star" })),
];
const ids = new Set();
for (const entry of entries) {
  if (ids.has(entry.id)) throw new Error(`Duplicate player ID: ${entry.id}`);
  ids.add(entry.id);
}
for (const roster of rosters) {
  const source = sources.rosters.find((r) => r.id === roster.id);
  if (
    source?.players.length !== roster.players.length ||
    roster.players.some(
      (player) => !source.players.some((p) => p.id === player.id),
    ) ||
    !source.players.some((p) => p.id === source.representative)
  )
    throw new Error(`Incomplete roster mapping: ${roster.id}`);
}
for (const star of stars) {
  if (!sources.stars.some((entry) => entry.id === star.id))
    throw new Error(`Missing star mapping: ${star.id}`);
}

// Validate and build everything in a temporary directory before replacing assets.
const staged = await mkdtemp(path.join(root, "public/assets/.fumbbl-"));
const assets = [];
const byUrl = new Map();
const catalog = { positions: {}, stars: {}, rosters: {} };
try {
  for (const entry of entries) {
    const url = fetchUrl(entry.sourceUrl);
    let asset = byUrl.get(url);
    if (!asset) {
      let bytes;
      if (cache) bytes = await readFile(path.join(cache, hash(url)));
      else if (download) {
        const result = await run(
          "curl",
          ["-sSL", "--fail", "--retry", "2", "--max-time", "30", url],
          { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
        );
        bytes = result.stdout;
      } else {
        const original = previous.assets.find((a) => a.sourceUrl === url);
        if (!original) throw new Error(`No saved original for ${url}`);
        bytes = await readFile(path.join(root, "public", original.src));
        if (hash(bytes) !== original.sha256)
          throw new Error(`Original checksum mismatch: ${url}`);
      }
      const { width, height, format, pages } = await sharp(bytes).metadata();
      if (!width || !height || !["png", "gif"].includes(format) || pages > 1)
        throw new Error(`Unsupported image: ${url}`);
      const columns = entry.layout === "four-poses" ? 4 : 1;
      const frameWidth = width / columns;
      if (
        !Number.isInteger(frameWidth) ||
        frameWidth > 48 ||
        height > 48 ||
        (columns === 4 && frameWidth !== height)
      )
        throw new Error(
          `Unexpected ${entry.layout} dimensions: ${url} (${width}x${height})`,
        );
      const imageId = path
        .basename(new URL(url).pathname)
        .replace(/\.[^.]+$/, "");
      const directory = entry.kind === "star" ? "stars" : slug(entry.group);
      const basename = `${slug(entry.label)}-${imageId}`;
      const original = `originals/${directory}/${basename}-${width}x${height}.${format}`;
      await mkdir(path.dirname(path.join(staged, original)), {
        recursive: true,
      });
      await writeFile(path.join(staged, original), bytes);
      const frames = [];
      for (let column = 0; column < columns; column++) {
        const pose =
          columns === 1
            ? "front"
            : ["red-front", "red-side", "blue-front", "blue-side"][column];
        const src = `players/${directory}/${basename}-${pose}-${frameWidth}x${height}.png`;
        await mkdir(path.dirname(path.join(staged, src)), { recursive: true });
        await sharp(bytes)
          .extract({
            left: column * frameWidth,
            top: 0,
            width: frameWidth,
            height,
          })
          .png()
          .toFile(path.join(staged, src));
        frames.push({
          src: `/assets/fumbbl/${src}`,
          pose,
          x: column * frameWidth,
          y: 0,
          width: frameWidth,
          height,
        });
      }
      asset = {
        sourceUrl: url,
        src: `/assets/fumbbl/${original}`,
        width,
        height,
        sha256: hash(bytes),
        layout: entry.layout,
        frames,
        players: [],
      };
      assets.push(asset);
      byUrl.set(url, asset);
    }
    if (asset.layout !== entry.layout)
      throw new Error(`Conflicting sprite layout for ${url}`);
    asset.players.push({
      id: entry.id,
      label: entry.label,
      group: entry.group,
      sourcePages: entry.sourcePages,
      ...(entry.note ? { note: entry.note } : {}),
    });
    const frame = asset.frames[0];
    catalog[entry.kind === "star" ? "stars" : "positions"][entry.id] = {
      label: entry.label,
      group: entry.group,
      width: frame.width,
      height: frame.height,
      variants: [frame.src],
    };
  }
  for (const roster of sources.rosters)
    catalog.rosters[roster.id] = roster.representative;
  await writeFile(
    path.join(staged, "manifest.json"),
    await json({
      retrievedOn: sources.retrievedOn,
      sourcePages: [sources.rosterIndex, sources.leagueIndex],
      rosterPages: sources.rosters.map((roster) => roster.sourcePage),
      leaguePages: sources.leaguePages,
      positionCount: Object.keys(catalog.positions).length,
      catalogStarCount: stars.length,
      sourceStarCount: Object.keys(catalog.stars).length,
      assetCount: assets.length,
      frameCount: assets.reduce((sum, asset) => sum + asset.frames.length, 0),
      assets,
    }),
  );
  await writeFile(
    path.join(staged, "README.md"),
    await readFile(path.join(assetsRoot, "README.md")),
  );
  await rm(assetsRoot, { recursive: true });
  await rename(staged, assetsRoot);
  await writeFile(
    path.join(root, "src/domain/data/player-icons.json"),
    await json(catalog),
  );
  console.log(
    `Imported ${assets.length} originals; ${Object.keys(catalog.positions).length} positions and ${stars.length} catalog stars have sprites (${Object.keys(catalog.stars).length} source stars total).`,
  );
} catch (error) {
  await rm(staged, { recursive: true, force: true });
  throw error;
}
