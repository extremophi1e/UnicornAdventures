/**
 * build-aquarium-sfx.mjs
 * Synthesizes three short reaction SFX for Tap the Aquarium as 16-bit mono WAVs.
 *   blub.wav    — soft bubble (descending sine)
 *   sproing.wav — comedic split "boing" (rising sine + vibrato)
 *   chime.wav   — bright jackpot bell (two partials, exp decay)
 * No dependencies. Run: node scripts/build-aquarium-sfx.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "audio");
const SR = 44100;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}
function render(dur, fn) {
  const n = Math.floor(SR * dur);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i / SR);
  return a;
}
const env = (t, dur, atk = 0.005, rel = 0.08) =>
  Math.max(0, Math.min(Math.min(1, t / atk), Math.min(1, (dur - t) / rel)));

const blub = render(0.20, (t) => {
  const f = 220 - 120 * (t / 0.20);
  return Math.sin(2 * Math.PI * f * t) * 0.5 * env(t, 0.20, 0.004, 0.10);
});
const sproing = render(0.26, (t) => {
  const f = 180 + 580 * Math.min(1, t / 0.18) + 40 * Math.sin(2 * Math.PI * 18 * t);
  return Math.sin(2 * Math.PI * f * t) * 0.5 * env(t, 0.26, 0.004, 0.12);
});
const chime = render(0.60, (t) => {
  const e = Math.exp(-6 * t);
  return (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.3) * e * 0.5;
});

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "blub.wav"), wav(blub));
writeFileSync(join(OUT, "sproing.wav"), wav(sproing));
writeFileSync(join(OUT, "chime.wav"), wav(chime));
console.log("wrote blub.wav, sproing.wav, chime.wav");
