import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import fontkit from "next/dist/compiled/@next/font/dist/fontkit/index.js";

// The supplied option 1 is the source of every mark. Only its empty margins
// are cropped in logo.svg; its paths, proportions, and colors are untouched.
const root = new URL("../", import.meta.url);
const logo = await readFile(new URL("public/brand/logo.svg", root), "utf8");
const paths = logo.match(/<path\b[^>]*\/>/g).join("\n");
const paper = "#F6F4ED";
const ink = "#26362E";
const orange = "#E56D3B";

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${paper}"/>
  <g transform="translate(4 2)">${paths}</g>
</svg>\n`;
await writeFile(new URL("src/app/icon.svg", root), icon);
await writeFile(
  new URL("src/app/apple-icon.png", root),
  await sharp(Buffer.from(icon)).resize(180, 180).png().toBuffer(),
);

// PNG-backed ICO with native sizes, avoiding browser downscaling at 16px.
const sizes = [16, 32, 48, 64, 256];
const images = await Promise.all(
  sizes.map((size) =>
    sharp(Buffer.from(icon)).resize(size, size).png().toBuffer(),
  ),
);
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index] === 256 ? 0 : sizes[index];
  directory[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(
  new URL("src/app/favicon.ico", root),
  Buffer.concat([directory, ...images]),
);

// Measure visible ink rather than font line boxes. The two lines share a left
// edge, and the mark's top and bottom align exactly with the wordmark's ink.
async function line(content, size, spacing) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="180">
    <text x="10" y="140" font-family="Arial, Helvetica, sans-serif" font-weight="700"
      font-size="${size}" letter-spacing="${spacing}" fill="${ink}">${content}</text>
  </svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { svg, left, top, width: right - left + 1, height: bottom - top + 1 };
}

const top = await line("BLOOD BOWL", 62, 4);
const bottom = await line(`SIDELINE<tspan fill="${orange}">.</tspan>`, 116, -4);
const gap = 22;
const height = top.height + gap + bottom.height;
const markWidth = (height * 38) / 52;
const markGap = 48;
const width = markWidth + markGap + Math.max(top.width, bottom.width);
const x = (1200 - width) / 2;
const y = (630 - height) / 2;
const textX = x + markWidth + markGap;
function positionedLine(item, atY) {
  return `<svg x="${textX}" y="${atY}" width="${item.width}" height="${item.height}"
    viewBox="${item.left} ${item.top} ${item.width} ${item.height}">${item.svg.match(/<text[\s\S]*<\/text>/)[0]}</svg>`;
}
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${paper}"/>
  <svg x="${x}" y="${y}" width="${markWidth}" height="${height}" viewBox="9 4 38 52">${paths}</svg>
  ${positionedLine(top, y)}
  ${positionedLine(bottom, y + top.height + gap)}
</svg>\n`;
await writeFile(
  new URL("src/app/opengraph-image.png", root),
  await sharp(Buffer.from(og)).png().toBuffer(),
);

// Outline the approved wordmark for the header, so it stays identical across
// platforms and never shifts while a font loads. No font file is published.
// To regenerate elsewhere, pass the path to an Arial Bold TTF as the first arg.
const font = fontkit.default(
  await readFile(process.argv[2] ?? "C:/Windows/Fonts/arialbd.ttf"),
);
function outlinedLine(text, size, spacing, target, atY) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = 0,
    left = Infinity,
    right = -Infinity,
    topEdge = Infinity,
    bottomEdge = -Infinity;
  const glyphs = run.glyphs
    .map((glyph, index) => {
      // The dot's separate color span in the approved SVG starts a new text run.
      if (text[index] === ".") cursor -= spacing;
      const position = run.positions[index];
      const gx = cursor + position.xOffset * scale;
      const gy = -position.yOffset * scale;
      const box = glyph.bbox;
      if (glyph.path.toSVG()) {
        left = Math.min(left, gx + box.minX * scale);
        right = Math.max(right, gx + box.maxX * scale);
        topEdge = Math.min(topEdge, gy - box.maxY * scale);
        bottomEdge = Math.max(bottomEdge, gy - box.minY * scale);
      }
      cursor += position.xAdvance * scale + spacing;
      return `<path fill="${text[index] === "." ? orange : ink}" d="${glyph.path.toSVG()}"
      transform="translate(${gx} ${gy}) scale(${scale} ${-scale})"/>`;
    })
    .join("\n");
  return `<g transform="translate(${markWidth + markGap} ${atY}) scale(${target.width / (right - left)} ${target.height / (bottomEdge - topEdge)})">
    <g transform="translate(${-left} ${-topEdge})">${glyphs}</g>
  </g>`;
}
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <svg width="${markWidth}" height="${height}" viewBox="9 4 38 52">${paths}</svg>
  ${outlinedLine("BLOOD BOWL", 62, 4, top, 0)}
  ${outlinedLine("SIDELINE.", 116, -4, bottom, top.height + gap)}
</svg>\n`;
await writeFile(new URL("public/brand/lockup.svg", root), lockup);

console.log(
  `Brand assets generated. OG: 1200 × 630; lockup: ${Math.round(width)} × ${height}, centered.`,
);
