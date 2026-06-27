/**
 * build-peekaboo-audio.mjs
 * Synthesises a cute stylised "giggle" (a rising 3-blip chime "tee-hee") for the
 * Peekaboo mode, in 3 pitch variants so repeated catches don't fatigue. Outputs
 * public/audio/giggle1.mp3 / giggle2.mp3 / giggle3.mp3. Mirrors build-audio.mjs.
 * Run: node scripts/build-peekaboo-audio.mjs  (or: npm run peekaboo-audio)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_RATE = 128;

function f32ToI16(v) { const c = Math.max(-1, Math.min(1, v)); return Math.round(c * 32767); }

function encodeToMp3(samples) {
  const enc = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152;
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) i16[i] = f32ToI16(samples[i]);
  const chunks = [];
  for (let off = 0; off < i16.length; off += BLOCK) {
    const c = enc.encodeBuffer(i16.subarray(off, off + BLOCK));
    if (c.length > 0) chunks.push(Buffer.from(c));
  }
  const fl = enc.flush();
  if (fl.length > 0) chunks.push(Buffer.from(fl));
  return Buffer.concat(chunks);
}

function sine(freq, duration, amplitude) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE));
  return out;
}

function applyADEnvelope(samples, attackSec, decaySec) {
  const attack = Math.floor(SAMPLE_RATE * attackSec);
  const decay = Math.max(1, samples.length - attack);
  for (let i = 0; i < samples.length; i++) {
    const env = i < attack ? i / Math.max(1, attack) : Math.exp(-4 * ((i - attack) / decay));
    samples[i] *= env;
  }
  return samples;
}

function concat(arrays, gapSec) {
  const gap = Math.floor(SAMPLE_RATE * gapSec);
  const total = arrays.reduce((s, a) => s + a.length + gap, 0);
  const out = new Float32Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length + gap; }
  return out;
}

// One giggle = three rising blips; each blip is a bright bell-ish tone (fundamental
// + an octave partial) with a quick pluck attack and fast decay.
function giggle(freqs) {
  const blipDur = 0.13, gap = 0.02, amp = 0.5;
  const segs = freqs.map((f) => {
    const s = sine(f, blipDur, amp);
    for (let i = 0; i < s.length; i++) s[i] += 0.3 * amp * Math.sin(2 * Math.PI * f * 2 * (i / SAMPLE_RATE));
    return applyADEnvelope(s, 0.004, blipDur - 0.004);
  });
  return concat(segs, gap);
}

const VARIANTS = {
  giggle1: [784.0, 988.0, 1175.0], // G5 B5 D6
  giggle2: [880.0, 1047.0, 1319.0], // A5 C6 E6
  giggle3: [698.0, 880.0, 1047.0], // F5 A5 C6
};

for (const [name, freqs] of Object.entries(VARIANTS)) {
  const mp3 = encodeToMp3(giggle(freqs));
  fs.writeFileSync(path.join(OUT_DIR, `${name}.mp3`), mp3);
  console.log(`${name}.mp3 → ${Math.round(mp3.length / 1024)}KB`);
}
