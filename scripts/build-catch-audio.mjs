/**
 * build-catch-audio.mjs
 * Downloads 3 calm royalty-free Kevin MacLeod tracks (CC-BY) for the Rainbow
 * Catch playlist. Output: public/audio/catch1.mp3 .. catch3.mp3
 * See public/audio/CREDITS.md for attribution. Run: node scripts/build-catch-audio.mjs
 */
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const TRACKS = [
  { file: "catch1.mp3", title: "Sneaky Adventure",  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Adventure.mp3" },
  { file: "catch2.mp3", title: "Cheery Monday",      url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cheery%20Monday.mp3" },
  { file: "catch3.mp3", title: "Pleasant Porridge",  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pleasant%20Porridge.mp3" },
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
    // Guard against a stalled connection hanging the build forever.
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  let failed = 0;
  for (const t of TRACKS) {
    const dest = join(OUT_DIR, t.file);
    process.stdout.write(`Downloading ${t.title} -> ${t.file} ... `);
    try { await download(t.url, dest); console.log("ok"); }
    catch (e) { failed++; console.error(`FAILED: ${e.message} — pick another calm CC-BY track and update the URL + CREDITS.md`); }
  }
  if (failed) process.exitCode = 1;
}
main();
