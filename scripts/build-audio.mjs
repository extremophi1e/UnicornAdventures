/**
 * build-audio.mjs
 * Synthesises placeholder audio files for Zoe's Rainbow Unicorn game.
 * Outputs MP3s to public/audio/ via @breezystack/lamejs.
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

// ----- MUSIC TRACKS -------------------------------------------------------
// Four distinct gentle loopable tracks: sine pad + arpeggio, different keys/moods.
// Each ~14 s, amplitude quiet enough to loop under gameplay.

/**
 * makeMusic(progression, opts) — synthesise one gentle background music track.
 *
 * @param {number[][]} progression  Array of chord tone MIDI arrays, one per chord.
 * @param {{
 *   totalSec?: number,   total track duration (default 14)
 *   bpm?: number,        arpeggio speed in beats-per-minute (default 120)
 *   ampPad?: number,     pad layer amplitude (default 0.10)
 *   ampArp?: number,     arpeggio layer amplitude (default 0.12)
 *   octaveShift?: number arp octave offset (default +1, i.e. 12 semitones up)
 * }} opts
 * @returns {Float32Array}
 */
function makeMusic(progression, opts = {}) {
  const {
    totalSec = 14,
    bpm = 120,
    ampPad = 0.10,
    ampArp = 0.12,
    octaveShift = 12,
  } = opts;

  const totalSamples = Math.ceil(SAMPLE_RATE * totalSec);
  const out = new Float32Array(totalSamples);

  const chordCount = progression.length;
  const chordDur = totalSec / chordCount;

  // Arpeggio note duration based on BPM (quarter note)
  const noteDurMusic = 60 / bpm;
  // Arp pattern: root, third, fifth, third
  const arpPattern = [0, 1, 2, 1];

  for (let ci = 0; ci < chordCount; ci++) {
    const chordTones = progression[ci];
    const chordStart = ci * chordDur;

    // Sustained pad: low root sine
    const root = chordTones[0];
    const padSamples = Math.floor(SAMPLE_RATE * chordDur);
    for (let s = 0; s < padSamples; s++) {
      const t = s / SAMPLE_RATE;
      const globalIdx = Math.floor(chordStart * SAMPLE_RATE) + s;
      if (globalIdx >= out.length) break;
      out[globalIdx] +=
        ampPad *
        Math.sin(2 * Math.PI * note(root) * t) *
        Math.min(1, t / 0.05) *             // 50 ms attack
        Math.min(1, (chordDur - t) / 0.08); // 80 ms release
    }

    // Arpeggio notes over the chord
    const arpPerChord = Math.max(1, Math.floor(chordDur / noteDurMusic));
    for (let ai = 0; ai < arpPerChord; ai++) {
      const midiN = chordTones[arpPattern[ai % arpPattern.length]];
      const freq = note(midiN + octaveShift);
      const noteStart = chordStart + ai * noteDurMusic;
      const noteStartSample = Math.floor(noteStart * SAMPLE_RATE);
      const nSamples = Math.floor(SAMPLE_RATE * noteDurMusic * 0.65);
      for (let s = 0; s < nSamples; s++) {
        const globalIdx = noteStartSample + s;
        if (globalIdx >= out.length) break;
        const t = s / SAMPLE_RATE;
        const env =
          Math.min(1, t / 0.015) *                      // 15 ms attack
          Math.exp(-3 * (t / (noteDurMusic * 0.9)));     // decay
        out[globalIdx] += ampArp * env * Math.sin(2 * Math.PI * freq * t);
      }
    }
  }

  // End fade: smooth the last 80 ms to avoid loop click
  const fadeLen = Math.floor(SAMPLE_RATE * 0.08);
  for (let i = 0; i < fadeLen; i++) {
    out[out.length - 1 - i] *= i / fadeLen;
  }

  return out;
}

// Track 1 — C major, happy (C–G–Am–F), moderate tempo
{
  const progression = [
    [60, 64, 67], // C major
    [55, 59, 62], // G major
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
  ];
  const samples = makeMusic(progression, { totalSec: 14, bpm: 160, ampPad: 0.10, ampArp: 0.12 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music1.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music1.mp3  → ${mp3.length} bytes  (C major – happy)`);
}

// Track 2 — G major, bright (G–D–Em–C), slightly faster
{
  const progression = [
    [55, 59, 62], // G major
    [50, 54, 57], // D major
    [52, 55, 59], // E minor
    [48, 52, 55], // C major (low root)
  ];
  const samples = makeMusic(progression, { totalSec: 14, bpm: 180, ampPad: 0.09, ampArp: 0.13, octaveShift: 12 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music2.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music2.mp3  → ${mp3.length} bytes  (G major – bright)`);
}

// Track 3 — F major, warm (F–C–Dm–Bb), slower and mellower
{
  const progression = [
    [53, 57, 60], // F major
    [60, 64, 67], // C major
    [50, 53, 57], // D minor
    [46, 50, 53], // Bb major
  ];
  const samples = makeMusic(progression, { totalSec: 16, bpm: 148, ampPad: 0.11, ampArp: 0.11, octaveShift: 12 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music3.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music3.mp3  → ${mp3.length} bytes  (F major – warm)`);
}

// Track 4 — A minor, dreamy (Am–F–C–G), gentle tempo with higher octave arp
{
  const progression = [
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
    [60, 64, 67], // C major
    [55, 59, 62], // G major
  ];
  const samples = makeMusic(progression, { totalSec: 15, bpm: 152, ampPad: 0.09, ampArp: 0.11, octaveShift: 24 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music4.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music4.mp3  → ${mp3.length} bytes  (A minor – dreamy)`);
}

// Remove old single music.mp3 if it still exists
const oldMusic = path.join(OUT_DIR, "music.mp3");
if (fs.existsSync(oldMusic)) {
  fs.unlinkSync(oldMusic);
  console.log("music.mp3  → removed (replaced by music1–4)");
}

console.log("\nAll audio files written to public/audio/");
