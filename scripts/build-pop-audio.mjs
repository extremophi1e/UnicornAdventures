/**
 * build-pop-audio.mjs
 * Downloads Pop the Cuties' 3-track playlist (CC-BY, Kevin MacLeod).
 * Output: public/audio/popmusic.mp3, popmusic2.mp3, popmusic3.mp3
 * Replace any file with your own track (keep the filename).
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-pop-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "popmusic.mp3",  title: "Wallpaper",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wallpaper.mp3" },
  { file: "popmusic2.mp3", title: "Investigations", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3" },
  { file: "popmusic3.mp3", title: "Beach Party",    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Beach%20Party.mp3" },
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
    catch (e) { console.error(`FAILED: ${e.message} — pick another upbeat CC-BY track and update the URL + CREDITS.md`); process.exitCode = 1; }
  }
}
main();
