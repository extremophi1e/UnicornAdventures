/**
 * build-aquarium-audio.mjs
 * Downloads Tap the Aquarium's 3-track playlist (calm/ambient, CC-BY, Kevin MacLeod).
 * Output: public/audio/aquarium.mp3, aquarium2.mp3, aquarium3.mp3
 * Replace any file with your own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-aquarium-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "aquarium.mp3",  title: "Deep Haze",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deep%20Haze.mp3" },
  { file: "aquarium2.mp3", title: "Lightless Dawn", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lightless%20Dawn.mp3" },
  { file: "aquarium3.mp3", title: "Anamalie",       url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Anamalie.mp3" },
];

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
  for (const t of TRACKS) {
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, join(OUT_DIR, t.file)); console.log("ok"); }
    catch (e) { console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
  }
}
main();
