/**
 * build-atlas.mjs
 * Downloads 12 OpenMoji 72x72 PNGs and composites them into a Phaser JSON-hash atlas.
 * Usage: node scripts/build-atlas.mjs
 * Output: public/atlas/openmoji.png + public/atlas/openmoji.json
 *
 * If any download fails, a placeholder coloured square is used so the atlas
 * always contains all 12 frames.
 */

import sharp from "sharp";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "atlas");

// Frame name -> Unicode code point (used for OpenMoji URL)
const FRAMES = [
  { name: "unicorn",   code: "1F984" },
  { name: "sparkle",   code: "2728"  },
  { name: "cloud",     code: "2601"  },
  { name: "cupcake",   code: "1F9C1" },
  { name: "star",      code: "2B50"  },
  { name: "lollipop",  code: "1F36D" },
  { name: "icecream",  code: "1F366" },
  { name: "balloon",   code: "1F388" },
  { name: "heart",     code: "1F496" },
  { name: "flower",    code: "1F338" },
  { name: "donut",     code: "1F369" },
  { name: "butterfly", code: "1F98B" },
  { name: "gem",       code: "1F48E" },
];

const CELL = 72;
const COLS = 6;
const ROWS = Math.ceil(FRAMES.length / COLS);  // 2
const ATLAS_W = COLS * CELL;
const ATLAS_H = ROWS * CELL;

const BASE_URL = "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/72x72";

/** Download a URL to a Buffer, resolves null if non-200 or error. */
function fetchBuffer(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`  [warn] HTTP ${res.statusCode} for ${url}`);
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", (e) => {
        console.warn(`  [warn] stream error for ${url}: ${e.message}`);
        resolve(null);
      });
    }).on("error", (e) => {
      console.warn(`  [warn] request error for ${url}: ${e.message}`);
      resolve(null);
    });
  });
}

/** Palette for placeholder squares (one per frame index). */
const PLACEHOLDER_COLORS = [
  [255, 182, 193], [255, 218, 185], [144, 238, 144], [135, 206, 250],
  [221, 160, 221], [255, 255, 153], [255, 160, 122], [173, 216, 230],
  [250, 128, 114], [152, 251, 152], [255, 228, 181], [176, 196, 222],
  [180, 220, 255],
];

/** Build a placeholder 72x72 PNG buffer for a frame. */
async function makePlaceholder(name, index) {
  const [r, g, b] = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];
  // A solid coloured rounded-rect with the first letter of the name overlaid via SVG.
  const letter = name[0].toUpperCase();
  const svg = `<svg width="${CELL}" height="${CELL}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CELL}" height="${CELL}" rx="16" ry="16" fill="rgb(${r},${g},${b})"/>
    <text x="50%" y="54%" font-size="36" font-family="sans-serif" font-weight="bold"
      fill="#333" text-anchor="middle" dominant-baseline="middle">${letter}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Downloading ${FRAMES.length} OpenMoji sprites…`);

  const placeholders = [];
  const composites = [];

  for (let i = 0; i < FRAMES.length; i++) {
    const { name, code } = FRAMES[i];
    const url = `${BASE_URL}/${code}.png`;
    console.log(`  [${i + 1}/${FRAMES.length}] ${name} (${code})…`);

    let buf = await fetchBuffer(url);
    let isPlaceholder = false;

    if (!buf || buf.length === 0) {
      console.warn(`  → using placeholder for "${name}"`);
      buf = await makePlaceholder(name, i);
      isPlaceholder = true;
    }

    if (isPlaceholder) placeholders.push(name);

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    composites.push({
      input: buf,
      left: col * CELL,
      top: row * CELL,
    });
  }

  // Create blank canvas and composite all frames onto it
  console.log(`\nCompositing ${FRAMES.length} frames into ${ATLAS_W}×${ATLAS_H} atlas…`);
  const atlasBuffer = await sharp({
    create: {
      width: ATLAS_W,
      height: ATLAS_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const pngPath = join(OUT_DIR, "openmoji.png");
  await writeFile(pngPath, atlasBuffer);
  console.log(`Wrote ${pngPath} (${atlasBuffer.length} bytes)`);

  // Build Phaser JSON-hash atlas
  const frames = {};
  for (let i = 0; i < FRAMES.length; i++) {
    const { name } = FRAMES[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    frames[name] = {
      frame: { x: col * CELL, y: row * CELL, w: CELL, h: CELL },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
      sourceSize: { w: CELL, h: CELL },
    };
  }

  const atlasJson = {
    frames,
    meta: {
      image: "openmoji.png",
      size: { w: ATLAS_W, h: ATLAS_H },
      scale: "1",
    },
  };

  const jsonPath = join(OUT_DIR, "openmoji.json");
  await writeFile(jsonPath, JSON.stringify(atlasJson, null, 2));
  console.log(`Wrote ${jsonPath}`);

  // Summary
  if (placeholders.length === 0) {
    console.log(`\nAll ${FRAMES.length} frames downloaded successfully.`);
  } else {
    console.warn(`\n${placeholders.length} placeholder frame(s): ${placeholders.join(", ")}`);
    console.log(`${FRAMES.length - placeholders.length}/${FRAMES.length} frames are real OpenMoji sprites.`);
  }
}

main().catch((e) => {
  console.error("Atlas build failed:", e);
  process.exit(1);
});
