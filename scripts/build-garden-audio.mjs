/**
 * build-garden-audio.mjs
 * Synthesises 11 short "music box" notes (ascending major pentatonic, C5..) into
 * ONE audio sprite: public/audio/gardennotes.mp3 + gardennotes.json (markers n0..n10).
 * Tapping the garden plays the next note up the scale, so constant tapping makes a
 * gentle rising melody (pentatonic = no wrong notes). Pure oscillator synthesis.
 * Run: node scripts/build-garden-audio.mjs  (or: npm run garden-audio)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100, CHANNELS = 1, BIT_RATE = 128, GAP_SEC = 0.35;
const ms = (n) => Math.ceil((SAMPLE_RATE * n) / 1000);
const f32ToI16 = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767);
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function encodeToMp3(samples) {
  const enc = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152, i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) i16[i] = f32ToI16(samples[i]);
  const chunks = [];
  for (let off = 0; off < i16.length; off += BLOCK) {
    const c = enc.encodeBuffer(i16.subarray(off, off + BLOCK));
    if (c.length > 0) chunks.push(Buffer.from(c));
  }
  const f = enc.flush();
  if (f.length > 0) chunks.push(Buffer.from(f));
  return Buffer.concat(chunks);
}
function peakNormalize(buf, target) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0) { const g = target / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}
// Music-box timbre: bright partials, fast mallet attack, ringing decay.
function note(freq) {
  const durMs = 560, n = ms(durMs), aN = ms(2), out = new Float32Array(n);
  const partials = [[1, 1], [2, 0.5], [5.4, 0.3], [8.9, 0.12]];
  const phases = partials.map(() => 0);
  for (let i = 0; i < n; i++) {
    const tSec = i / SAMPLE_RATE; let s = 0;
    for (let p = 0; p < partials.length; p++) {
      phases[p] += (2 * Math.PI * freq * partials[p][0]) / SAMPLE_RATE;
      s += partials[p][1] * Math.sin(phases[p]);
    }
    const atk = i < aN ? i / Math.max(1, aN) : 1;
    out[i] = s * atk * Math.exp(-6 * tSec);
  }
  return peakNormalize(out, 0.6);
}

// Major pentatonic ascending from C5 (MIDI 72): 11 notes over ~2.5 octaves.
const PENTA = [0, 2, 4, 7, 9], BASE = 72, SCALE = [];
for (let oct = 0; SCALE.length < 11; oct++)
  for (const semi of PENTA) { if (SCALE.length < 11) SCALE.push(BASE + oct * 12 + semi); }

function main() {
  const gapN = ms(GAP_SEC * 1000), segments = [], spritemap = {};
  let cursor = 0;
  SCALE.forEach((midi, i) => {
    const buf = note(midiToFreq(midi));
    spritemap[`n${i}`] = { start: +(cursor / SAMPLE_RATE).toFixed(4), end: +((cursor + buf.length) / SAMPLE_RATE).toFixed(4) };
    segments.push(buf); cursor += buf.length + gapN;
  });
  const total = new Float32Array(cursor); let pos = 0;
  for (const seg of segments) { total.set(seg, pos); pos += seg.length + gapN; }
  const mp3 = encodeToMp3(total);
  fs.writeFileSync(path.join(OUT_DIR, "gardennotes.mp3"), mp3);
  fs.writeFileSync(path.join(OUT_DIR, "gardennotes.json"),
    JSON.stringify({ resources: ["gardennotes.mp3"], spritemap }, null, 2));
  console.log(`gardennotes.mp3 → ${Math.round(mp3.length / 1024)}KB, ${Object.keys(spritemap).length} markers`);
}
main();
