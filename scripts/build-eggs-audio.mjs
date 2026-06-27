/**
 * build-eggs-audio.mjs
 * Synthesises crack/shatter SFX for Surprise Eggs and downloads a default CC-BY
 * music loop. Outputs to public/audio/.
 *   SFX (synth):   crack1.mp3, crack2.mp3, crack3.mp3, shatter.mp3
 *   Music (fetch): eggsmusic.mp3  (user-swappable; keep the filename)
 * Run: node scripts/build-eggs-audio.mjs   (npm run eggs-audio)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100, CHANNELS = 1, BIT_RATE = 128;

function f32ToI16(v) { const c = Math.max(-1, Math.min(1, v)); return Math.round(c * 32767); }
function encodeToMp3(samples) {
  const enc = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152;
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) i16[i] = f32ToI16(samples[i]);
  const chunks = [];
  for (let o = 0; o < i16.length; o += BLOCK) {
    const c = enc.encodeBuffer(i16.subarray(o, o + BLOCK));
    if (c.length > 0) chunks.push(Buffer.from(c));
  }
  const fl = enc.flush(); if (fl.length > 0) chunks.push(Buffer.from(fl));
  return Buffer.concat(chunks);
}
function write(name, samples) {
  const mp3 = encodeToMp3(samples);
  fs.writeFileSync(path.join(OUT_DIR, name), mp3);
  console.log(`${name}  → ${mp3.length} bytes`);
}

// White noise in [-1,1].
function noise(duration, amp = 1) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * (Math.random() * 2 - 1);
  return out;
}
function sine(freq, duration, amp = 0.5) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE));
  return out;
}
// Exponential decay across the buffer (k larger = snappier).
function decay(samples, k = 18) {
  const n = samples.length;
  for (let i = 0; i < n; i++) samples[i] *= Math.exp(-k * (i / n));
  return samples;
}
function mix(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Float32Array(len);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}
// A short "tok": a sharp noise transient blended with a pitched body. Rising
// `pitch` across crack1/2/3 makes the three taps climb.
function tok(pitch) {
  const dur = 0.05;
  return mix(decay(noise(dur, 0.5), 26), decay(sine(pitch, dur, 0.5), 22));
}

write("crack1.mp3", tok(420));
write("crack2.mp3", tok(560));
write("crack3.mp3", tok(720));
// Shatter: a longer noise burst + a little low body.
write("shatter.mp3", mix(decay(noise(0.18, 0.7), 12), decay(sine(300, 0.18, 0.3), 10)));

// ---- music download (user-swappable) -----------------------------------
const TRACK = {
  file: "eggsmusic.mp3",
  title: "Fluffing a Duck",
  url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3",
};
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume(); download(res.headers.location, dest, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
  });
}
process.stdout.write(`Downloading ${TRACK.title} -> ${TRACK.file} ... `);
download(TRACK.url, path.join(OUT_DIR, TRACK.file))
  .then(() => console.log("ok"))
  .catch((e) => console.error(`FAILED: ${e.message} — pick another gentle CC-BY track, update the URL + CREDITS.md`));
