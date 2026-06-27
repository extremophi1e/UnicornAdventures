/**
 * build-soundboard-audio.mjs
 * Synthesises ~53 short, distinct, cute creature "voices" for the Animal Soundboard
 * and bakes them into ONE audio sprite: public/audio/animalvoices.mp3 plus a JSON
 * marker map public/audio/animalvoices.json ({resources, spritemap:{name:{start,end}}}).
 * No recorded samples; pure oscillator synthesis. Mirrors scripts/build-audio.mjs.
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
const GAP_SEC = 0.4;          // silence between voices so MP3 tails never bleed

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

// Per-sample frequency curve from [ms, multiplier] anchors, scaled by f0.
// Exponential interpolation; holds the last value to the end.
function contourCurve(f0, anchors, n) {
  const out = new Float32Array(n);
  const pts = anchors.map(([t, mul]) => [ms(t), f0 * mul]);
  for (let i = 0; i < n; i++) {
    let a = pts[0], b = pts[pts.length - 1];
    for (let k = 0; k < pts.length - 1; k++) {
      if (i >= pts[k][0] && i <= pts[k + 1][0]) { a = pts[k]; b = pts[k + 1]; break; }
      if (i > pts[pts.length - 1][0]) { a = b = pts[pts.length - 1]; }
    }
    const span = Math.max(1, b[0] - a[0]);
    const tt = Math.max(0, Math.min(1, (i - a[0]) / span));
    out[i] = a[1] * Math.pow(b[1] / a[1], tt);
  }
  return out;
}

function wave(kind, phase) {
  switch (kind) {
    case "sine": return Math.sin(phase);
    case "square": return Math.sin(phase) >= 0 ? 1 : -1;
    case "triangle": return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "sawtooth":
    default: { const t = (phase / (2 * Math.PI)) % 1; return 2 * (t - Math.floor(t + 0.5)); }
  }
}

// RBJ band-pass biquad applied in place (formant colour).
function bandpass(buf, freq, q) {
  if (!freq) return buf;
  const w0 = (2 * Math.PI * freq) / SAMPLE_RATE, a = Math.sin(w0) / (2 * q), c = Math.cos(w0);
  const b0 = a, b1 = 0, b2 = -a, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; buf[i] = y0;
  }
  return buf;
}

// Attack / decay-to-sustain / release envelope (all ms), in place.
function applyEnv(buf, aMs, dMs, sustain, rMs) {
  const n = buf.length, a = ms(aMs), d = ms(dMs), r = ms(rMs), relStart = Math.max(a + d, n - r);
  for (let i = 0; i < n; i++) {
    let e;
    if (i < a) e = i / Math.max(1, a);
    else if (i < a + d) e = 1 - (1 - sustain) * ((i - a) / Math.max(1, d));
    else if (i < relStart) e = sustain;
    else e = sustain * Math.max(0, 1 - (i - relStart) / Math.max(1, r));
    buf[i] *= e;
  }
  return buf;
}

function peakNormalize(buf, target = 0.7) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0) { const g = target / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

let _seed = 1234567;
function rand() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }

// Synthesise one voice from a fully-resolved parameter object → Float32 samples.
function synth(p) {
  const n = ms(p.durationMs);
  const freq = contourCurve(p.f0, p.contour, n);
  const out = new Float32Array(n);
  let cph = 0, mph = 0;           // carrier + FM-modulator phase accumulators
  for (let i = 0; i < n; i++) {
    let f = freq[i];
    if (p.vibratoDepth) f += Math.sin((2 * Math.PI * p.vibratoRate * i) / SAMPLE_RATE) * p.vibratoDepth;
    cph += (2 * Math.PI * f) / SAMPLE_RATE;
    let s;
    if (p.fmRatio) {
      mph += (2 * Math.PI * f * p.fmRatio) / SAMPLE_RATE;
      s = Math.sin(cph + p.fmIndex * Math.sin(mph));
    } else {
      s = wave(p.waveform, cph);
    }
    if (p.amPulseRate) {
      const lfo = 0.5 + 0.5 * Math.sin((2 * Math.PI * p.amPulseRate * i) / SAMPLE_RATE);
      s *= 0.25 + 0.75 * lfo;
    }
    if (p.noiseAmount) s = s * (1 - p.noiseAmount) + (rand() * 2 - 1) * p.noiseAmount;
    out[i] = s;
  }
  if (p.noiseAmount && p.noiseCutoff) bandpass(out, p.noiseCutoff, 0.9); // tame raw noise a bit
  if (p.formantFreq) bandpass(out, p.formantFreq, p.formantQ ?? 6);
  applyEnv(out, p.attackMs ?? 6, p.decayMs ?? 60, p.sustain ?? 0.7, p.releaseMs ?? 80);
  return peakNormalize(out, 0.7);
}

// Archetype defaults; per-creature entries override f0 (and anything else).
const A = {
  meow:    { waveform: "sine",     contour: [[0, 1], [40, 1.0], [200, 2.1], [480, 0.85]], vibratoRate: 18, vibratoDepth: 12, formantFreq: 1000, formantQ: 8, durationMs: 520, attackMs: 8, decayMs: 120, sustain: 0.6, releaseMs: 160 },
  bark:    { waveform: "sawtooth", contour: [[0, 1.8], [60, 1.0], [120, 0.7], [140, 1.7], [220, 0.8]], formantFreq: 700, formantQ: 4, durationMs: 240, attackMs: 3, decayMs: 60, sustain: 0.5, releaseMs: 40 },
  moo:     { waveform: "sawtooth", contour: [[0, 1.05], [120, 1.0], [600, 0.8]], vibratoRate: 6, vibratoDepth: 6, formantFreq: 320, formantQ: 5, durationMs: 700, attackMs: 25, decayMs: 120, sustain: 0.8, releaseMs: 160 },
  squeak:  { waveform: "sine",     contour: [[0, 1], [60, 1.6], [160, 1.0]], vibratoRate: 22, vibratoDepth: 30, durationMs: 220, attackMs: 4, decayMs: 40, sustain: 0.5, releaseMs: 60 },
  chirp:   { waveform: "sine",     contour: [[0, 1], [50, 2.4], [110, 1.2]], durationMs: 180, attackMs: 3, decayMs: 30, sustain: 0.4, releaseMs: 40, noiseAmount: 0.06, noiseCutoff: 4000 },
  coo:     { waveform: "sine",     contour: [[0, 1], [120, 1.15], [320, 0.95]], vibratoRate: 7, vibratoDepth: 10, formantFreq: 700, formantQ: 6, durationMs: 360, attackMs: 20, decayMs: 120, sustain: 0.7, releaseMs: 120 },
  ribbit:  { waveform: "sawtooth", contour: [[0, 1], [300, 1.0]], amPulseRate: 34, formantFreq: 950, formantQ: 7, durationMs: 320, attackMs: 4, decayMs: 60, sustain: 0.8, releaseMs: 60 },
  buzz:    { waveform: "sawtooth", contour: [[0, 1], [300, 1.0]], amPulseRate: 60, formantFreq: 1500, formantQ: 3, durationMs: 300, attackMs: 6, decayMs: 60, sustain: 0.7, releaseMs: 60 },
  hiss:    { waveform: "sine",     contour: [[0, 1.1], [300, 0.9]], noiseAmount: 0.85, noiseCutoff: 3500, durationMs: 360, attackMs: 10, decayMs: 120, sustain: 0.6, releaseMs: 120 },
  honk:    { waveform: "sawtooth", contour: [[0, 1.2], [80, 1.0], [260, 0.85]], vibratoRate: 10, vibratoDepth: 14, formantFreq: 600, formantQ: 5, durationMs: 340, attackMs: 8, decayMs: 80, sustain: 0.7, releaseMs: 90 },
  burble:  { waveform: "sine",     contour: [[0, 0.9], [120, 1.2], [300, 0.85]], amPulseRate: 14, formantFreq: 500, formantQ: 4, durationMs: 360, attackMs: 10, decayMs: 80, sustain: 0.7, releaseMs: 90, noiseAmount: 0.05, noiseCutoff: 1200 },
  robot:   { waveform: "square",   contour: [[0, 1], [300, 1.0]], fmRatio: 1.4, fmIndex: 6, amPulseRate: 16, durationMs: 360, attackMs: 4, decayMs: 40, sustain: 0.8, releaseMs: 60 },
  alien:   { waveform: "sine",     contour: [[0, 0.7], [120, 1.8], [240, 0.9], [400, 1.5]], fmRatio: 2.5, fmIndex: 5, vibratoRate: 26, vibratoDepth: 40, durationMs: 460, attackMs: 6, decayMs: 60, sustain: 0.7, releaseMs: 80 },
  ghost:   { waveform: "sine",     contour: [[0, 0.95], [250, 1.1], [600, 0.9]], vibratoRate: 3.2, vibratoDepth: 26, formantFreq: 900, formantQ: 9, durationMs: 640, attackMs: 60, decayMs: 160, sustain: 0.7, releaseMs: 220 },
  poop:    { waveform: "sawtooth", contour: [[0, 1.4], [320, 0.6]], amPulseRate: 22, formantFreq: 500, formantQ: 4, durationMs: 360, attackMs: 6, decayMs: 80, sustain: 0.7, releaseMs: 90 },
  unicorn: { waveform: "sine",     contour: [[0, 1], [120, 1.6], [280, 2.2], [520, 2.0]], vibratoRate: 9, vibratoDepth: 8, durationMs: 620, attackMs: 8, decayMs: 120, sustain: 0.7, releaseMs: 220 },
};

// [name, archetype, f0, durationMs?] — order IS the canonical order. 53 entries.
const VOICES = [
  ["cat", "meow", 330], ["dog", "bark", 220], ["rabbit", "squeak", 720], ["chipmunk", "squeak", 1000], ["rat", "squeak", 900],
  ["cow", "moo", 110], ["pig", "honk", 240, 280], ["horse", "honk", 360], ["goat", "honk", 320, 300], ["ox", "moo", 95], ["chick", "chirp", 1300], ["rooster", "chirp", 520, 380],
  ["fox", "bark", 300], ["bear", "moo", 150], ["panda", "burble", 260], ["lion", "moo", 180, 720], ["tiger", "moo", 170, 640], ["sloth", "coo", 230], ["raccoon", "buzz", 520], ["hedgehog", "squeak", 760], ["kangaroo", "honk", 300],
  ["monkey", "buzz", 420], ["gorilla", "moo", 120], ["orangutan", "moo", 175],
  ["octopus", "burble", 300], ["turtle", "burble", 240], ["whale", "moo", 90, 760], ["crab", "buzz", 600], ["penguin", "honk", 360], ["otter", "squeak", 640], ["seal", "honk", 300], ["lobster", "buzz", 520], ["jellyfish", "burble", 360],
  ["owl", "coo", 360], ["peacock", "chirp", 700, 260], ["eagle", "chirp", 900, 220], ["flamingo", "honk", 560], ["dove", "coo", 480],
  ["frog", "ribbit", 250], ["snake", "hiss", 320], ["lizard", "hiss", 380, 240],
  ["butterfly", "buzz", 320, 220], ["snail", "burble", 200], ["ant", "buzz", 360], ["donut", "buzz", 340], ["microbe", "alien", 420, 300],
  ["trex", "moo", 100, 760], ["sauropod", "moo", 92, 760],
  ["robot", "robot", 240], ["alien", "alien", 360], ["ghost", "ghost", 300], ["poop", "poop", 260], ["unicorn", "unicorn", 600],
];

function main() {
  const gapN = ms(GAP_SEC * 1000);
  const segments = [];
  const spritemap = {};
  let cursor = 0; // samples
  for (const [name, arch, f0, durationMs] of VOICES) {
    const base = A[arch];
    if (!base) throw new Error(`unknown archetype ${arch} for ${name}`);
    const p = { ...base, f0, ...(durationMs ? { durationMs } : {}) };
    const buf = synth(p);
    const start = cursor / SAMPLE_RATE;
    const end = (cursor + buf.length) / SAMPLE_RATE;
    spritemap[name] = { start: +start.toFixed(4), end: +end.toFixed(4) };
    segments.push(buf);
    cursor += buf.length + gapN; // trailing silence gap after each voice
  }
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
