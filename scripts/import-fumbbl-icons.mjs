import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Run with a pageAssets bundle manifest, or with no argument to re-slice originals.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(root, "public/assets/fumbbl");
const sourcePath = process.argv[2];
const sourceAssets = sourcePath
  ? JSON.parse(await readFile(sourcePath, "utf8")).assets
  : JSON.parse(
      await readFile(path.join(assetsRoot, "manifest.json"), "utf8"),
    ).sheets.map((sheet) => ({
      name: sheet.id,
      path: path.join(root, "public", sheet.src),
    }));
const sources = new Map(sourceAssets.map((asset) => [asset.name, asset.path]));
const slug = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const labels = await readFile(
  path.join(root, "scripts/fumbbl-icon-labels.txt"),
  "utf8",
);
const entries = [];
let group;
for (const line of labels.split(/\r?\n/)) {
  if (line.startsWith("[")) group = line.slice(1, -1);
  else if (/^\d+\|/.test(line)) {
    const [id, label] = line.split("|");
    entries.push({ id, label, group });
  }
}
if (entries.length !== 227 || new Set(entries.map((e) => e.id)).size !== 227)
  throw new Error("Expected 227 uniquely labeled catalog sheets");
if (
  sources.size !== entries.length ||
  entries.some((entry) => !sources.has(entry.id))
)
  throw new Error("Source bundle does not match the complete labeled catalog");
const sheets = [],
  preview = {};
let frameCount = 0;
for (const entry of entries) {
  const bytes = await readFile(sources.get(entry.id));
  const metadata = await sharp(bytes).metadata();
  const { width, height, format } = metadata;
  // All sheets have four columns: red front/side, blue front/side.
  // Hubris Rakarth uniquely uses 28x32 rectangular cells.
  const frameWidth = width / 4,
    frameHeight = entry.id === "436462" ? 32 : frameWidth;
  if (!Number.isInteger(frameWidth) || height % frameHeight !== 0)
    throw new Error(
      `Unrecognized sheet layout: ${entry.id} (${width}x${height})`,
    );
  const directory = slug(entry.group),
    basename = `${slug(entry.label)}-${entry.id}`;
  const original = `assets/fumbbl/sheets/${directory}/${basename}-${width}x${height}.${format}`;
  await mkdir(path.dirname(path.join(root, "public", original)), {
    recursive: true,
  });
  if (
    path.resolve(sources.get(entry.id)) !==
    path.resolve(root, "public", original)
  )
    await copyFile(sources.get(entry.id), path.join(root, "public", original));
  const frames = [];
  for (let row = 0; row < height / frameHeight; row++) {
    for (let column = 0; column < 4; column++) {
      const teamColor = column < 2 ? "red" : "blue",
        pose = column % 2 === 0 ? "front" : "side";
      const variant = row + 1;
      const src = `assets/fumbbl/players/${directory}/${basename}-v${String(variant).padStart(2, "0")}-${teamColor}-${pose}-${frameWidth}x${frameHeight}.png`;
      await mkdir(path.dirname(path.join(root, "public", src)), {
        recursive: true,
      });
      await sharp(bytes)
        .extract({
          left: column * frameWidth,
          top: row * frameHeight,
          width: frameWidth,
          height: frameHeight,
        })
        .png()
        .toFile(path.join(root, "public", src));
      frames.push({
        src: `/${src}`,
        variant,
        teamColor,
        pose,
        x: column * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      });
      frameCount++;
    }
  }
  sheets.push({
    ...entry,
    sourceUrl: `https://fumbbl.com/i/${entry.id}`,
    src: `/${original}`,
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    frameWidth,
    frameHeight,
    variants: height / frameHeight,
    frames,
  });
  preview[entry.id] = {
    label: entry.label,
    group: entry.group,
    width: frameWidth,
    height: frameHeight,
    variants: frames
      .filter((f) => f.teamColor === "red" && f.pose === "front")
      .map((f) => f.src),
  };
}
await writeFile(
  path.join(assetsRoot, "manifest.json"),
  JSON.stringify(
    {
      sourcePage: "https://fumbbl.com/p/icons",
      retrievedOn: "2026-09-30",
      sheetCount: sheets.length,
      frameCount,
      sheets,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  path.join(root, "src/domain/data/player-icons.json"),
  JSON.stringify(preview, null, 2) + "\n",
);
console.log(
  `Imported ${sheets.length} original sheets and ${frameCount} frames.`,
);
