/**
 * build-audio.mjs
 * Synthesises SFX audio files for Zoe's Rainbow Unicorn game.
 * Outputs MP3s to public/audio/ via @breezystack/lamejs.
 *
 * Generates: pop.mp3, collect.mp3, fanfare.mp3, tada.mp3
 * Does NOT generate music1-4.mp3 — those are real royalty-free tracks
 * downloaded from Incompetech (Kevin MacLeod, CC-BY). See public/audio/CREDITS.md.
 *
 * Run: node scripts/build-audio.mjs
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

/** Convert a float32 sample [-1,1] to int16 */
function f32ToI16(val) {
  const clamped = Math.max(-1, Math.min(1, val));
  return Math.round(clamped * 32767);
}

/** Encode float32 samples to MP3 and return Buffer */
function encodeToMp3(samples) {
  const encoder = new Mp3Encoder(CHANNELS, SAMPLE_RATE, BIT_RATE);
  const BLOCK = 1152;
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    i16[i] = f32ToI16(samples[i]);
  }

  const chunks = [];
  for (let offset = 0; offset < i16.length; offset += BLOCK) {
    const block = i16.subarray(offset, offset + BLOCK);
    const chunk = encoder.encodeBuffer(block);
    if (chunk.length > 0) chunks.push(Buffer.from(chunk));
  }
  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(Buffer.from(flush));
  return Buffer.concat(chunks);
}

/** Generate a sine tone */
function sine(freq, duration, amplitude = 0.5) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE));
  }
  return out;
}

/** Apply exponential decay envelope: full at 0, ~0 at end */
function applyDecay(samples, decayTime) {
  const k = Math.log(1000) / (SAMPLE_RATE * decayTime);
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= Math.exp(-k * i);
  }
  return samples;
}

/** Apply short attack + decay envelope */
function applyADEnvelope(samples, attackSec, decaySec) {
  const attackSamples = Math.floor(SAMPLE_RATE * attackSec);
  const decaySamples = samples.length - attackSamples;
  for (let i = 0; i < samples.length; i++) {
    let env;
    if (i < attackSamples) {
      env = i / attackSamples; // linear ramp up
    } else {
      const t = (i - attackSamples) / Math.max(1, decaySamples);
      env = Math.exp(-4 * t); // exponential decay
    }
    samples[i] *= env;
  }
  return samples;
}

/** Mix two float32 arrays (summed, clamped) — result length = max(a, b) */
function mix(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Float32Array(len);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

/** Concatenate float32 arrays with a silence gap */
function concat(arrays, gapSec = 0) {
  const gap = Math.floor(SAMPLE_RATE * gapSec);
  const total = arrays.reduce((s, a) => s + a.length + gap, 0);
  const out = new Float32Array(total);
  let pos = 0;
  for (const a of arrays) {
    out.set(a, pos);
    pos += a.length + gap;
  }
  return out;
}

function note(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ----- POP ---------------------------------------------------------------
// ~140 ms soft sine blip with quick exponential decay
{
  const freq = 600; // Hz — mellow blip
  const duration = 0.14; // seconds
  const samples = sine(freq, duration, 0.45);
  // Short 8 ms attack then fast decay
  applyADEnvelope(samples, 0.008, duration - 0.008);
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "pop.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`pop.mp3  → ${mp3.length} bytes`);
}

// ----- COLLECT -----------------------------------------------------------
// ~420 ms magical harp/chime sparkle: ascending pentatonic gliss of 5 soft
// bell-like notes (C6-D6-E6-G6-A6) with soft pluck attack + shimmer overtone
// tail.  Fairy-tale/unicorn magic feel — bright but gentle, kid-safe amplitude.
{
  // Pentatonic run: C6, D6, E6, G6, A6 (MIDI 84, 86, 88, 91, 93)
  const pentatonicFreqs = [
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
    1567.98, // G6
    1760.00, // A6
  ];
  const noteDur = 0.085;  // each note ~85 ms, slight overlap feel
  const gap = 0.005;      // 5 ms gap between notes
  const amp = 0.40;       // gentle, kid-safe amplitude ≤ 0.5

  /** Bell-like tone: fundamental + 2nd + 3rd partial with inharmonic shimmer */
  function bellNote(freq, duration, amplitude) {
    const n = Math.ceil(SAMPLE_RATE * duration);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      // Fundamental
      out[i] += amplitude * Math.sin(2 * Math.PI * freq * t);
      // 2nd partial (octave up) — shimmer
      out[i] += amplitude * 0.30 * Math.sin(2 * Math.PI * freq * 2 * t);
      // Inharmonic shimmer at 2.76x (bell-like overtone)
      out[i] += amplitude * 0.15 * Math.sin(2 * Math.PI * freq * 2.76 * t);
    }
    // Very short attack (4 ms), then exponential decay tail — harp/bell pluck
    applyADEnvelope(out, 0.004, duration - 0.004);
    return out;
  }

  const noteSegments = pentatonicFreqs.map((freq) =>
    bellNote(freq, noteDur, amp)
  );
  const samples = concat(noteSegments, gap);
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "collect.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`collect.mp3  → ${mp3.length} bytes  (magical harp/chime sparkle – 5-note pentatonic gliss)`);
}

// ----- FANFARE -----------------------------------------------------------
// ~1.2 s cheerful ascending major arpeggio: C5–E5–G5–C6
{
  const notes = [72, 76, 79, 84]; // C5, E5, G5, C6 (MIDI)
  const noteDur = 0.27; // each note duration
  const noteAmp = 0.45;
  const segs = notes.map((n, i) => {
    const freq = note(n);
    const s = sine(freq, noteDur + (i === notes.length - 1 ? 0.12 : 0), noteAmp);
    applyADEnvelope(s, 0.012, s.length / SAMPLE_RATE - 0.012);
    return s;
  });
  const samples = concat(segs, 0.02);
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "fanfare.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`fanfare.mp3  → ${mp3.length} bytes`);
}

// ----- TADA --------------------------------------------------------------
// ~1.6 s happy major-chord swell: C major triad (C4, E4, G4) sustained
{
  const chordNotes = [60, 64, 67]; // C4, E4, G4
  const totalDur = 1.6;
  const amp = 0.4 / chordNotes.length; // divide so sum doesn't clip
  const layers = chordNotes.map((n) => {
    const s = sine(note(n), totalDur, amp);
    applyADEnvelope(s, 0.06, totalDur - 0.06);
    return s;
  });
  // Add a C5 octave on top
  const top = sine(note(72), totalDur, amp * 0.6);
  applyADEnvelope(top, 0.06, totalDur - 0.06);
  layers.push(top);
  const samples = layers.reduce(mix);
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "tada.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`tada.mp3  → ${mp3.length} bytes`);
}

// NOTE: music1-4.mp3 are real royalty-free tracks (Kevin MacLeod / Incompetech, CC-BY).
// They are NOT synthesised here. See public/audio/CREDITS.md for details.
// To re-download them: curl from the URLs in CREDITS.md directly.

console.log("\nSFX audio files written to public/audio/ (pop, collect, fanfare, tada)");
