/**
 * build-emoji.mjs
 * Downloads Google Noto animated emoji (https://googlefonts.github.io/noto-emoji-animation/,
 * served from fonts.gstatic.com, Apache-2.0), and for each item/enemy type samples +
 * downscales the animation into a grid sprite sheet for Phaser, then writes a TS manifest
 * (src/render/emoji.ts). One looping Phaser animation per type.
 *
 * Output: public/emoji/<type>.png  +  src/render/emoji.ts
 * Run: node scripts/build-emoji.mjs
 */
import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "emoji");
const OUT_TS = join(ROOT, "src", "render", "emoji.ts");

const FRAME_SIZE = 144;    // px/frame (2x the old 72px) — crisp but lighter than 216. Scenes divide
                           // their emoji setScale values by 2 to keep on-screen sizes unchanged.
const TARGET_FRAMES = 24;  // sampled frames per emoji (down from the source's ~70-84)
const MAX_ROW = 2016;      // grid width cap (mobile texture safety)

// item/enemy type -> Noto codepoint. The keys are stable internal IDs (used across
// CatchScene/GameScene/levels); the visible emoji is whatever codepoint they map to.
// The old food emoji (ice cream / donut / cake / cookie) play an "eaten" animation
// that ends transparent, so each falling item visibly vanished — replaced here with
// cute things whose animations loop in place without disappearing.
const TYPES = {
  cloud: "2601_fe0f",
  star: "2b50",
  icecream: "1f337", // tulip
  balloon: "1f388",
  heart: "1f496",
  flower: "1f338",
  donut: "1f41e",    // ladybug
  butterfly: "1f98b",
  gem: "1f48e",
  cupcake: "1f340",  // four-leaf clover
  lollipop: "1f431", // cat face
  // Unicorn Gumballs prize pool — 25 cute creatures/critters/etc. (no inanimate
  // objects). All verified to loop without disappearing. Keys are descriptive.
  cat: "1f431", fox: "1f98a", bear: "1f43b", panda: "1f43c", lion: "1f981",
  cow: "1f42e", sloth: "1f9a5", otter: "1f9a6", raccoon: "1f99d", hedgehog: "1f994",
  octopus: "1f419", turtle: "1f422", whale: "1f433", crab: "1f980", penguin: "1f427",
  chick: "1f425", owl: "1f989", frog: "1f438", snail: "1f40c",
  trex: "1f996", sauropod: "1f995", robot: "1f916", alien: "1f47e", ghost: "1f47b",
  poop: "1f4a9",
  // +25 more creatures (probed loop-safe).
  dog: "1f415", rabbit: "1f407", monkey: "1f412", pig: "1f416", tiger: "1f405",
  horse: "1f40e", goat: "1f410", ox: "1f402", rat: "1f400", gorilla: "1f98d",
  orangutan: "1f9a7", kangaroo: "1f998", seal: "1f9ad", chipmunk: "1f43f", peacock: "1f99a",
  rooster: "1f413", eagle: "1f985", flamingo: "1f9a9", dove: "1f54a_fe0f", snake: "1f40d",
  lizard: "1f98e", lobster: "1f99e", jellyfish: "1fabc", ant: "1f41c", microbe: "1f9a0",
};

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        fetchBuffer(res.headers.location, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

function sampleIndices(total, want) {
  if (total <= want) return Array.from({ length: total }, (_, i) => i);
  const out = [];
  for (let i = 0; i < want; i++) out.push(Math.round((i * (total - 1)) / (want - 1)));
  return [...new Set(out)];
}

async function buildOne(type, cp) {
  const url = `https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.gif`;
  const gif = await fetchBuffer(url);
  const meta = await sharp(gif, { animated: true }).metadata();
  const srcW = meta.width;
  const srcH = meta.pageHeight ?? meta.height;
  const pages = meta.pages ?? 1;
  const { data } = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const totalH = srcH * pages;
  if (data.length !== srcW * totalH * 4) throw new Error(`${type}: unexpected raw buffer ${data.length}`);

  const idx = sampleIndices(pages, TARGET_FRAMES);
  const n = idx.length;
  const cols = Math.min(n, Math.max(1, Math.floor(MAX_ROW / FRAME_SIZE)), Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);

  const composites = [];
  for (let k = 0; k < n; k++) {
    const frame = await sharp(data, { raw: { width: srcW, height: totalH, channels: 4 } })
      .extract({ left: 0, top: idx[k] * srcH, width: srcW, height: srcH })
      .resize(FRAME_SIZE, FRAME_SIZE)
      .raw()
      .toBuffer();
    composites.push({
      input: frame,
      raw: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4 },
      left: (k % cols) * FRAME_SIZE,
      top: Math.floor(k / cols) * FRAME_SIZE,
    });
  }

  const sheet = await sharp({
    create: { width: cols * FRAME_SIZE, height: rows * FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toBuffer();
  await writeFile(join(OUT_DIR, `${type}.png`), sheet);

  // frameRate that preserves the original loop duration.
  const delays = Array.isArray(meta.delay) && meta.delay.length ? meta.delay : null;
  const totalMs = delays ? delays.reduce((a, b) => a + b, 0) : n * 60;
  const frameRate = Math.max(6, Math.min(30, Math.round(n / (totalMs / 1000))));

  return { type, frameCount: n, frameRate, cols, rows, bytes: sheet.length };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const defs = [];
  for (const [type, cp] of Object.entries(TYPES)) {
    process.stdout.write(`${type} (${cp}) ... `);
    const r = await buildOne(type, cp);
    console.log(`${r.frameCount}f @ ${r.frameRate}fps  ${r.cols}x${r.rows} grid  ${Math.round(r.bytes / 1024)}KB`);
    defs.push(r);
  }

  const entries = defs
    .map((d) => `  ${d.type}: { key: "emoji-${d.type}", sheet: "emoji/${d.type}.png", anim: "emoji-${d.type}", frameWidth: ${FRAME_SIZE}, frameHeight: ${FRAME_SIZE}, frameCount: ${d.frameCount}, frameRate: ${d.frameRate} },`)
    .join("\n");
  const ts = `// AUTO-GENERATED by scripts/build-emoji.mjs — do not edit by hand.
// Source: Google Noto animated emoji (https://googlefonts.github.io/noto-emoji-animation/), Apache-2.0.
export interface EmojiDef {
  key: string;
  sheet: string;
  anim: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
}

export const EMOJI: Record<string, EmojiDef> = {
${entries}
};

export const EMOJI_DEFS: EmojiDef[] = Object.values(EMOJI);
`;
  await writeFile(OUT_TS, ts);
  console.log(`\nWrote ${OUT_TS} (${defs.length} emoji)`);
}

main().catch((e) => { console.error("build-emoji failed:", e); process.exit(1); });
