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

// ----- COLLECT -----------------------------------------------------------
// ~300 ms bright "coin sparkle" chime: two quick ascending notes (C6 → E6)
// with crisp pluck envelope + shimmer overtone — clearly different from the
// soft single-blip pop.
{
  const dur1 = 0.13; // first note (C6 = 1047 Hz)
  const dur2 = 0.17; // second note (E6 = 1319 Hz), slightly longer
  const amp = 0.45;

  // First note: C6 with a crisp pluck (very short attack, quick decay)
  const n1 = sine(1047, dur1, amp);
  applyADEnvelope(n1, 0.004, dur1 - 0.004);

  // Add a shimmer overtone at 2x frequency (an octave up) at lower amplitude
  const shimmer1 = sine(2094, dur1, amp * 0.25);
  applyADEnvelope(shimmer1, 0.004, dur1 - 0.004);
  for (let i = 0; i < n1.length; i++) n1[i] += shimmer1[i];

  // Second note: E6 — slightly brighter, slightly longer pluck
  const n2 = sine(1319, dur2, amp);
  applyADEnvelope(n2, 0.003, dur2 - 0.003);

  // Add shimmer on second note too
  const shimmer2 = sine(2638, dur2, amp * 0.2);
  applyADEnvelope(shimmer2, 0.003, dur2 - 0.003);
  for (let i = 0; i < n2.length; i++) n2[i] += shimmer2[i];

  // Concatenate with a tiny gap between the two notes
  const samples = concat([n1, n2], 0.02);
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "collect.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`collect.mp3  → ${mp3.length} bytes`);
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
// Four distinct peppy loopable tracks — upbeat, plucky, kid-friendly.
// CHARACTER: staccato chord stabs (NOT sustained pads) + bouncy 8th-note arpeggio
// + soft bass pulse on the beat.  Notes bounce rather than blur.

/**
 * addNote(out, startSample, freq, amp, durationSec, attackSec)
 * Write a single plucked sine note into the output buffer.
 * Attack is very short (crisp pluck), decay to ~0 by durationSec.
 */
function addNote(out, startSample, freq, amp, durationSec, attackSec = 0.006) {
  const nSamples = Math.floor(SAMPLE_RATE * durationSec);
  for (let s = 0; s < nSamples; s++) {
    const globalIdx = startSample + s;
    if (globalIdx >= out.length) break;
    const t = s / SAMPLE_RATE;
    const attack = Math.min(1, t / attackSec);
    const decay = Math.exp(-5 * (t / durationSec)); // fast decay = staccato
    out[globalIdx] += amp * attack * decay * Math.sin(2 * Math.PI * freq * t);
  }
}

/**
 * makeMusic(progression, opts) — synthesise one peppy background music track.
 *
 * Character: plucky chord stabs (very short, staccato) on beat 1 of each chord,
 * bouncy 8th-note arpeggio on melody, and a soft bass kick-blip on every beat.
 *
 * @param {number[][]} progression  Array of chord tone MIDI arrays, one per chord.
 * @param {{
 *   totalSec?: number,   total track duration (default 14)
 *   bpm?: number,        tempo in BPM (default 170)
 *   ampStab?: number,    chord stab amplitude (default 0.09)
 *   ampArp?: number,     arpeggio layer amplitude (default 0.13)
 *   ampBass?: number,    bass pulse amplitude (default 0.10)
 *   octaveShift?: number arp octave offset in semitones (default 12)
 * }} opts
 * @returns {Float32Array}
 */
function makeMusic(progression, opts = {}) {
  const {
    totalSec = 14,
    bpm = 170,
    ampStab = 0.09,
    ampArp = 0.13,
    ampBass = 0.10,
    octaveShift = 12,
  } = opts;

  const totalSamples = Math.ceil(SAMPLE_RATE * totalSec);
  const out = new Float32Array(totalSamples);

  const chordCount = progression.length;
  const chordDur = totalSec / chordCount;

  const beatDur = 60 / bpm;             // quarter note duration
  const eighthDur = beatDur / 2;        // 8th note — arp step
  const stabDur = beatDur * 0.35;       // chord stab: very short, ~35% of beat
  const bassDur = beatDur * 0.40;       // bass blip: short, punchy

  // Arp pattern: root → third → fifth → octave → fifth → third (lively bounce)
  const arpPattern = [0, 1, 2, 3, 2, 1];
  // Extended chord tones — add octave of root as index 3
  function extendedTones(chord) {
    return [chord[0], chord[1], chord[2], chord[0] + 12];
  }

  for (let ci = 0; ci < chordCount; ci++) {
    const chordTones = progression[ci];
    const chordStart = ci * chordDur;
    const chordStartSample = Math.floor(chordStart * SAMPLE_RATE);
    const ext = extendedTones(chordTones);

    // --- Chord stab: all three chord tones played together, very short ---
    // Placed on beat 1 of each chord, and beat 3 (adds rhythmic punch)
    const stabBeats = [0, 2]; // within-chord beat offsets
    for (const b of stabBeats) {
      const stabTime = chordStart + b * beatDur;
      if (stabTime >= totalSec) continue;
      const stabSample = Math.floor(stabTime * SAMPLE_RATE);
      for (const midiN of chordTones) {
        // Stab at mid-octave (not shifted — keeps it warm but staccato)
        addNote(out, stabSample, note(midiN), ampStab / chordTones.length, stabDur, 0.005);
      }
    }

    // --- Bass pulse: root note (two octaves down) on every beat ---
    const beatsInChord = Math.floor(chordDur / beatDur);
    for (let b = 0; b < beatsInChord; b++) {
      const bassTime = chordStart + b * beatDur;
      if (bassTime >= totalSec) continue;
      const bassSample = Math.floor(bassTime * SAMPLE_RATE);
      const rootFreq = note(chordTones[0] - 12); // one octave below chord root
      addNote(out, bassSample, rootFreq, ampBass, bassDur, 0.008);
    }

    // --- Bouncy 8th-note arpeggio on the melody layer ---
    const arpStepsInChord = Math.max(1, Math.floor(chordDur / eighthDur));
    for (let ai = 0; ai < arpStepsInChord; ai++) {
      const midiN = ext[arpPattern[ai % arpPattern.length]];
      const freq = note(midiN + octaveShift);
      const arpTime = chordStart + ai * eighthDur;
      if (arpTime >= totalSec) continue;
      const arpSample = Math.floor(arpTime * SAMPLE_RATE);
      // Each arp note: ~45% duty cycle, crisp pluck
      addNote(out, arpSample, freq, ampArp, eighthDur * 0.45, 0.004);
    }
  }

  // End fade: smooth the last 100 ms to avoid loop click
  const fadeLen = Math.floor(SAMPLE_RATE * 0.10);
  for (let i = 0; i < fadeLen; i++) {
    out[out.length - 1 - i] *= i / fadeLen;
  }

  return out;
}

// Track 1 — C major, happy & bouncy (C–G–Am–F)
{
  const progression = [
    [60, 64, 67], // C major
    [55, 59, 62], // G major
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
  ];
  const samples = makeMusic(progression, { totalSec: 14, bpm: 172, ampStab: 0.09, ampArp: 0.13, ampBass: 0.10 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music1.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music1.mp3  → ${mp3.length} bytes  (C major – bouncy/happy)`);
}

// Track 2 — G major, bright & lively (G–D–Em–C), slightly faster
{
  const progression = [
    [55, 59, 62], // G major
    [50, 54, 57], // D major
    [52, 55, 59], // E minor
    [48, 52, 55], // C major
  ];
  const samples = makeMusic(progression, { totalSec: 14, bpm: 180, ampStab: 0.08, ampArp: 0.14, ampBass: 0.09, octaveShift: 12 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music2.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music2.mp3  → ${mp3.length} bytes  (G major – bright/lively)`);
}

// Track 3 — F major, warm & skipping (F–C–Dm–Bb)
{
  const progression = [
    [53, 57, 60], // F major
    [60, 64, 67], // C major
    [50, 53, 57], // D minor
    [46, 50, 53], // Bb major
  ];
  const samples = makeMusic(progression, { totalSec: 16, bpm: 165, ampStab: 0.09, ampArp: 0.12, ampBass: 0.10, octaveShift: 12 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music3.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music3.mp3  → ${mp3.length} bytes  (F major – warm/skipping)`);
}

// Track 4 — A minor, playful (Am–F–C–G) — still minor but energetic, not dreamy
{
  const progression = [
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
    [60, 64, 67], // C major
    [55, 59, 62], // G major
  ];
  const samples = makeMusic(progression, { totalSec: 15, bpm: 168, ampStab: 0.08, ampArp: 0.12, ampBass: 0.09, octaveShift: 24 });
  const mp3 = encodeToMp3(samples);
  const outPath = path.join(OUT_DIR, "music4.mp3");
  fs.writeFileSync(outPath, mp3);
  console.log(`music4.mp3  → ${mp3.length} bytes  (A minor – playful/energetic)`);
}

// Remove old single music.mp3 if it still exists
const oldMusic = path.join(OUT_DIR, "music.mp3");
if (fs.existsSync(oldMusic)) {
  fs.unlinkSync(oldMusic);
  console.log("music.mp3  → removed (replaced by music1–4)");
}

console.log("\nAll audio files written to public/audio/");
