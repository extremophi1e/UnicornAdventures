/**
 * build-aquarium-audio.mjs
 * Downloads one calm royalty-free Kevin MacLeod track (CC-BY) as the default
 * music for Tap the Aquarium. Output: public/audio/aquarium.mp3
 * The user can replace this file with their own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-aquarium-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACK = {
  file: "aquarium.mp3",
  title: "Carefree",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3",
};

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const dest = join(OUT_DIR, TRACK.file);
  process.stdout.write(`Downloading ${TRACK.title} -> ${TRACK.file} ... `);
  try { await download(TRACK.url, dest); console.log("ok"); }
  catch (e) { console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
}
main();
