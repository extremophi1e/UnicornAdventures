/**
 * build-title-song.mjs
 * Synthesises an upbeat title-screen theme to public/audio/title.mp3.
 * C major, I-V-vi-IV (C G Am F) x2, ~130 BPM — melody pluck + bass + kick + hats.
 * Loops cleanly (last bar F resolves back to bar-1 C).
 * Run: node scripts/build-title-song.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lamejs from "@breezystack/lamejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Mp3Encoder } = lamejs;
const OUT = path.join(__dirname, "..", "public", "audio", "title.mp3");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const SR = 44100;
const BPM = 130;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const note = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Per-chord: bass root (low octave) + a bright 4-note arpeggio (melody).
const prog = [
  { root: 36, arp: [72, 76, 79, 84] }, // C  (C E G C)
  { root: 43, arp: [71, 74, 79, 83] }, // G  (B D G B)
  { root: 45, arp: [72, 76, 81, 84] }, // Am (C E A C)
  { root: 41, arp: [72, 77, 81, 84] }, // F  (C F A C)
];
const bars = [...prog, ...prog]; // 8 bars

const totalSec = bars.length * BAR + 0.3;
const N = Math.ceil(totalSec * SR);
const mix = new Float32Array(N);

function addAt(startSec, samples) {
  const off = Math.floor(startSec * SR);
  for (let i = 0; i < samples.length && off + i < N; i++) mix[off + i] += samples[i];
}

function envAD(arr, atk, dec) {
  const a = Math.floor(SR * atk);
  for (let i = 0; i < arr.length; i++) {
    arr[i] *= i < a ? i / a : Math.exp((-(i - a) / Math.max(1, SR * dec)) * 4);
  }
  return arr;
}

function pluck(freq, dur, amp) {
  const n = Math.ceil(SR * dur);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    o[i] = amp * (Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(2 * Math.PI * 2 * freq * t) + 0.2 * Math.sin(2 * Math.PI * 3 * freq * t));
  }
  return envAD(o, 0.005, dur);
}

function bass(freq, dur, amp) {
  const n = Math.ceil(SR * dur);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    o[i] = amp * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * 2 * freq * t));
  }
  return envAD(o, 0.008, dur * 0.9);
}

function kick(amp) {
  const dur = 0.16;
  const n = Math.ceil(SR * dur);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 90 - 45 * (t / dur);
    o[i] = amp * Math.sin(2 * Math.PI * f * t);
  }
  return envAD(o, 0.002, dur);
}

function hat(amp) {
  const dur = 0.035;
  const n = Math.ceil(SR * dur);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = amp * (Math.random() * 2 - 1);
  return envAD(o, 0.001, dur);
}

bars.forEach((bar, b) => {
  const start = b * BAR;
  const seq = [bar.arp[0], bar.arp[1], bar.arp[2], bar.arp[3], bar.arp[3], bar.arp[2], bar.arp[1], bar.arp[0]];
  for (let e = 0; e < 8; e++) addAt(start + e * (BEAT / 2), pluck(note(seq[e]), (BEAT / 2) * 0.95, 0.26));
  for (let q = 0; q < 4; q++) addAt(start + q * BEAT, bass(note(bar.root), BEAT * 0.9, 0.28));
  for (let q = 0; q < 4; q++) addAt(start + q * BEAT, kick(0.33));
  for (let e = 0; e < 8; e++) addAt(start + e * (BEAT / 2), hat(0.05));
});

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]));
const g = peak > 0 ? 0.9 / peak : 1;
const i16 = new Int16Array(N);
for (let i = 0; i < N; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(mix[i] * g * 32767)));

const enc = new Mp3Encoder(1, SR, 160);
const chunks = [];
for (let off = 0; off < i16.length; off += 1152) {
  const c = enc.encodeBuffer(i16.subarray(off, off + 1152));
  if (c.length) chunks.push(Buffer.from(c));
}
const fl = enc.flush();
if (fl.length) chunks.push(Buffer.from(fl));
fs.writeFileSync(OUT, Buffer.concat(chunks));
console.log(`Wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${totalSec.toFixed(1)}s loop)`);
