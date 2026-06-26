/**
 * build-icons.mjs — generate PWA icons for Zoe's Rainbow Unicorn
 *
 * Outputs:
 *   public/icon-192.png        192×192  standard
 *   public/icon-512.png        512×512  standard
 *   public/icon-maskable-512.png 512×512 maskable (unicorn in safe zone)
 *
 * Strategy: download the OpenMoji unicorn SVG/PNG; compose on pink background.
 * Fallback: draw a pink square with a white star if the download fails.
 */

import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const PINK = { r: 255, g: 143, b: 207, alpha: 1 };

// Download helper
function download(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Pink background buffer for given size */
function pinkBg(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 143, b: 207, alpha: 1 },
    },
  }).png().toBuffer();
}

/** Fallback: white star SVG composited on pink */
async function fallbackIcon(size, outputPath) {
  const half = size / 2;
  const r = half * 0.45;
  // 5-pointed star path centred in a size×size viewBox
  function starPoints(cx, cy, outerR, innerR, points = 5) {
    const step = Math.PI / points;
    let d = "";
    for (let i = 0; i < points * 2; i++) {
      const angle = i * step - Math.PI / 2;
      const radius = i % 2 === 0 ? outerR : innerR;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      d += (i === 0 ? "M" : "L") + `${x.toFixed(2)},${y.toFixed(2)}`;
    }
    return d + "Z";
  }
  const starPath = starPoints(half, half, r, r * 0.42);
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${size}" height="${size}" fill="#ff8fcf"/>` +
    `<path d="${starPath}" fill="white" opacity="0.9"/>` +
    `</svg>`
  );
  await sharp(svg).png().toFile(outputPath);
  console.log(`  [fallback star] ${path.basename(outputPath)}`);
}

async function buildIcons(unicornBuffer) {
  await mkdir(PUBLIC, { recursive: true });

  const specs = [
    { name: "icon-192.png", size: 192, padding: 0.1 },
    { name: "icon-512.png", size: 512, padding: 0.1 },
    { name: "icon-maskable-512.png", size: 512, padding: 0.2 },
  ];

  for (const spec of specs) {
    const outPath = path.join(PUBLIC, spec.name);
    const unicornSize = Math.round(spec.size * (1 - spec.padding * 2));
    const offset = Math.round(spec.size * spec.padding);

    const bg = await pinkBg(spec.size);
    const unicornResized = await sharp(unicornBuffer)
      .resize(unicornSize, unicornSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp(bg)
      .composite([{ input: unicornResized, top: offset, left: offset }])
      .png()
      .toFile(outPath);

    console.log(`  ${spec.name} (${spec.size}x${spec.size}, padding ${Math.round(spec.padding * 100)}%)`);
  }
}

async function main() {
  console.log("Building PWA icons...");

  const unicornUrl =
    "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/72x72/1F984.png";

  let unicornBuffer = null;
  try {
    console.log(`  Downloading unicorn from ${unicornUrl}`);
    unicornBuffer = await download(unicornUrl);
    console.log(`  Downloaded ${unicornBuffer.length} bytes`);
  } catch (err) {
    console.warn(`  Download failed: ${err.message}`);
    console.warn("  Falling back to pink+star icons.");
  }

  if (unicornBuffer) {
    await buildIcons(unicornBuffer);
  } else {
    // Fallback: generate all three as pink+star
    await mkdir(PUBLIC, { recursive: true });
    for (const [name, size] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-512.png", 512],
    ]) {
      await fallbackIcon(size, path.join(PUBLIC, name));
    }
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
