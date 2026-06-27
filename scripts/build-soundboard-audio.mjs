/**
 * build-soundboard-audio.mjs
 * Synthesises 53 short, FUN musical "toy instrument" notes for the Animal Soundboard
 * and bakes them into ONE audio sprite: public/audio/animalvoices.mp3 plus a JSON
 * marker map public/audio/animalvoices.json ({resources, spritemap:{name:{start,end}}}).
 *
 * The sounds deliberately do NOT mimic animals. Every button is a note from a major
 * pentatonic scale (so any combination kids tap always sounds harmonious — there are
 * no "wrong notes"), voiced through a rotating set of playful toy timbres (xylophone,
 * marimba, music box, glockenspiel, pluck, bloop, boing, pop). Notes are short and
 * ringing; the scene plays them polyphonically so tapping = playing music.
 *
 * Pure oscillator synthesis (no recorded samples); mirrors scripts/build-audio.mjs.
 * Run: node scripts/build-soundboard-audio.mjs  (or: npm run soundboard-audio)
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
const GAP_SEC = 0.4;          // silence between notes so MP3 tails never bleed

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
  const f = enc.flush();
  if (f.length > 0) chunks.push(Buffer.from(f));
  return Buffer.concat(chunks);
}

const ms = (n) => Math.ceil((SAMPLE_RATE * n) / 1000);

function peakNormalize(buf, target) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0) { const g = target / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// One toy-instrument note: a stack of sine partials with a fast-attack / exponential
// "mallet" decay, optional vibrato and pitch glide. Always peak-normalised so every
// note sits at a balanced, kid-safe level.
function toneGen(freq, durMs, { partials, attackMs = 3, decay = 8, vibRate = 0, vibDepth = 0, glide = 1 }) {
  const n = ms(durMs);
  const aN = ms(attackMs);
  const out = new Float32Array(n);
  const phases = partials.map(() => 0);
  for (let i = 0; i < n; i++) {
    const tSec = i / SAMPLE_RATE;
    const tNorm = i / n;
    // glide: start at freq*glide, ramp to freq by the end; vibrato wobbles around it.
    let f = freq * (glide + (1 - glide) * tNorm);
    if (vibDepth) f *= 1 + Math.sin(2 * Math.PI * vibRate * tSec) * vibDepth;
    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      phases[p] += (2 * Math.PI * f * partials[p][0]) / SAMPLE_RATE;
      s += partials[p][1] * Math.sin(phases[p]);
    }
    const atk = i < aN ? i / Math.max(1, aN) : 1;
    out[i] = s * atk * Math.exp(-decay * tSec);
  }
  return peakNormalize(out, 0.62);
}

// Eight playful toy timbres, cycled across the buttons for variety.
const TIMBRES = [
  { durMs: 320, partials: [[1, 1], [3, 0.4], [6, 0.12]], attackMs: 2, decay: 11 },                 // xylophone
  { durMs: 460, partials: [[1, 1], [4, 0.5], [9.2, 0.1]], attackMs: 3, decay: 7 },                  // marimba
  { durMs: 600, partials: [[1, 1], [2, 0.5], [5.4, 0.3], [8.9, 0.12]], attackMs: 2, decay: 6 },     // music box
  { durMs: 540, partials: [[1, 1], [2.76, 0.45], [5.4, 0.2]], attackMs: 2, decay: 6.5 },            // glockenspiel
  { durMs: 300, partials: [[1, 1], [2, 0.35], [3, 0.12]], attackMs: 2, decay: 12 },                 // pluck / harp
  { durMs: 300, partials: [[1, 1], [2, 0.2]], attackMs: 4, decay: 9, glide: 1.5 },                  // bloop (down)
  { durMs: 360, partials: [[1, 1], [2, 0.25]], attackMs: 3, decay: 8, vibRate: 16, vibDepth: 0.045 }, // boing
  { durMs: 200, partials: [[1, 1], [3, 0.2]], attackMs: 1, decay: 16, glide: 0.7 },                 // pop (chirp up)
];

// Major pentatonic over two octaves (C4..C6) = 11 notes; any subset sounds harmonious.
const PENTA = [0, 2, 4, 7, 9];
const BASE_MIDI = 60; // C4
const SCALE = [];
for (let oct = 0; oct < 3 && SCALE.length < 11; oct++) {
  for (const semi of PENTA) { if (SCALE.length < 11) SCALE.push(BASE_MIDI + oct * 12 + semi); }
}

// The 53 marker names — identical to SoundboardScene's SOUNDBOARD_ORDER (52 emoji
// creatures + unicorn). The sound for each is purely musical; the name is just the key.
const ORDER = [
  "cat", "dog", "rabbit", "chipmunk", "rat",
  "cow", "pig", "horse", "goat", "ox", "chick", "rooster",
  "fox", "bear", "panda", "lion", "tiger", "sloth", "raccoon", "hedgehog", "kangaroo",
  "monkey", "gorilla", "orangutan",
  "octopus", "turtle", "whale", "crab", "penguin", "otter", "seal", "lobster", "jellyfish",
  "owl", "peacock", "eagle", "flamingo", "dove",
  "frog", "snake", "lizard",
  "butterfly", "snail", "ant", "donut", "microbe",
  "trex", "sauropod",
  "robot", "alien", "ghost", "poop", "unicorn",
];

function main() {
  const gapN = ms(GAP_SEC * 1000);
  const segments = [];
  const spritemap = {};
  let cursor = 0; // samples
  ORDER.forEach((name, i) => {
    const note = SCALE[i % SCALE.length];
    const timbre = TIMBRES[i % TIMBRES.length];
    const buf = toneGen(midiToFreq(note), timbre.durMs, timbre);
    const start = cursor / SAMPLE_RATE;
    const end = (cursor + buf.length) / SAMPLE_RATE;
    spritemap[name] = { start: +start.toFixed(4), end: +end.toFixed(4) };
    segments.push(buf);
    cursor += buf.length + gapN; // trailing silence gap after each note
  });
  const total = new Float32Array(cursor);
  let pos = 0;
  for (const seg of segments) { total.set(seg, pos); pos += seg.length + gapN; }

  const mp3 = encodeToMp3(total);
  fs.writeFileSync(path.join(OUT_DIR, "animalvoices.mp3"), mp3);
  fs.writeFileSync(
    path.join(OUT_DIR, "animalvoices.json"),
    JSON.stringify({ resources: ["animalvoices.mp3"], spritemap }, null, 2),
  );
  console.log(`animalvoices.mp3 → ${Math.round(mp3.length / 1024)}KB, ${Object.keys(spritemap).length} markers`);
}
main();
