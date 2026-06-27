// Centralized, lazy asset loading. Instead of BootScene downloading every game's
// art + audio up front (~140 MB), Boot loads only the title-screen core and each
// game scene pulls its own emoji / atlas / SFX in its preload() on first entry
// (cached after, so re-entry is instant). Music is streamed per-track on demand
// by audio/sound.ts — see AUDIO_FILES + ensureAudioLoaded below.
import Phaser from "phaser";
import { EMOJI } from "./emoji";
import { ATLAS_KEY } from "./sprites";
import {
  CATCH_UNICORN_KEY,
  CATCH_UNICORN_SHEET,
  CATCH_UNICORN_ANIM,
  CATCH_UNICORN,
} from "./catchUnicorn";

// Single source of truth for plain audio keys -> file(s). Used both by scene
// preloads (SFX) and by Sound's on-demand music loader.
export const AUDIO_FILES: Record<string, string[]> = {
  title: ["audio/title.mp3"],
  music1: ["audio/music1.mp3"],
  music2: ["audio/music2.mp3"],
  music3: ["audio/music3.mp3"],
  music4: ["audio/music4.mp3"],
  music5: ["audio/music5.mp3"],
  music6: ["audio/music6.mp3"],
  popmusic: ["audio/popmusic.mp3"],
  popmusic2: ["audio/popmusic2.mp3"],
  gumball: ["audio/gumball.mp3"],
  gumball2: ["audio/gumball2.mp3"],
  aquarium: ["audio/aquarium.mp3"],
  catch1: ["audio/catch1.mp3"],
  catch2: ["audio/catch2.mp3"],
  catch3: ["audio/catch3.mp3"],
  catch4: ["audio/catch4.mp3"],
  catch5: ["audio/catch5.mp3"],
  peekaboo1: ["audio/peekaboo1.mp3"],
  peekaboo2: ["audio/peekaboo2.mp3"],
  peekaboo3: ["audio/peekaboo3.mp3"],
  eggsmusic: ["audio/eggsmusic.mp3"],
  eggsmusic2: ["audio/eggsmusic2.mp3"],
  eggsmusic3: ["audio/eggsmusic3.mp3"],
  // SFX (small) — loaded by each scene that uses them.
  collect: ["audio/collect.mp3"],
  pop: ["audio/pop.mp3"],
  fanfare: ["audio/fanfare.mp3"],
  tada: ["audio/tada.mp3"],
  crack1: ["audio/crack1.mp3"],
  crack2: ["audio/crack2.mp3"],
  crack3: ["audio/crack3.mp3"],
  shatter: ["audio/shatter.mp3"],
  giggle1: ["audio/giggle1.mp3"],
  giggle2: ["audio/giggle2.mp3"],
  giggle3: ["audio/giggle3.mp3"],
  blub: ["audio/blub.wav"],
  sproing: ["audio/sproing.wav"],
  chime: ["audio/chime.wav"],
};

// Audio sprites: key -> [jsonUrl, audioUrl(s)].
const AUDIO_SPRITES: Record<string, [string, string[]]> = {
  animalvoices: ["audio/animalvoices.json", ["audio/animalvoices.mp3"]],
  gardennotes: ["audio/gardennotes.json", ["audio/gardennotes.mp3"]],
};

// Every emoji key — for the modes (Catch, Pop) that draw from the whole set.
export const ALL_EMOJI_KEYS: string[] = Object.keys(EMOJI);

// Queue the given audio keys, skipping any already cached (so re-entry is a no-op).
export function loadAudio(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const k of keys) {
    if (scene.cache.audio.exists(k)) continue;
    const sprite = AUDIO_SPRITES[k];
    if (sprite) {
      scene.load.audioSprite(k, sprite[0], sprite[1]);
    } else if (AUDIO_FILES[k]) {
      scene.load.audio(k, AUDIO_FILES[k]);
    }
  }
}

// Carries the first-music-track choice from a scene's preload() to the Sound
// created later in its create(). Keyed by scene so each mode is isolated, and
// consumed once (WeakMap → no leak when the scene is gone).
const _firstTrack = new WeakMap<Phaser.Scene, string>();

// Pick the track a playlist should open with, queue it in the scene's preload so
// the loading bar covers it (music then starts the instant the scene shows), and
// stash the choice for playMusic() to pick up. Keeps the random-first variety.
export function preloadFirstTrack(scene: Phaser.Scene, playlist: readonly string[]): void {
  if (!playlist.length) return;
  const key = playlist[Math.floor(Math.random() * playlist.length)];
  loadAudio(scene, [key]);
  _firstTrack.set(scene, key);
}

// Consume the stashed first-track choice for this scene (undefined if none).
export function takeFirstTrack(scene: Phaser.Scene): string | undefined {
  const key = _firstTrack.get(scene);
  _firstTrack.delete(scene);
  return key;
}

// Queue the spritesheets for the given emoji keys, skipping cached ones.
export function loadEmoji(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const k of keys) {
    const d = EMOJI[k];
    if (!d || scene.textures.exists(d.key)) continue;
    scene.load.spritesheet(d.key, d.sheet, { frameWidth: d.frameWidth, frameHeight: d.frameHeight });
  }
}

// Register the looping animation for each emoji key (call in create(), after the
// spritesheets have loaded). Guarded so it's safe to call on every scene entry.
export function registerEmojiAnims(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const k of keys) {
    const d = EMOJI[k];
    if (!d || scene.anims.exists(d.anim)) continue;
    scene.anims.create({
      key: d.anim,
      frames: scene.anims.generateFrameNumbers(d.key, { start: 0, end: d.frameCount - 1 }),
      frameRate: d.frameRate,
      repeat: -1,
    });
  }
}

// The OpenMoji atlas (sparkle bursts + a few static frames) — shared by every
// game's Celebrations. Tiny (~26 KB); loaded on first game entry.
export function loadAtlas(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ATLAS_KEY)) {
    scene.load.atlas(ATLAS_KEY, "atlas/openmoji.png", "atlas/openmoji.json");
  }
}

// The unified animated unicorn — loaded in Boot (the title shows it) so it's
// available everywhere without a per-scene fetch.
export function loadCatchUnicorn(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CATCH_UNICORN_KEY)) {
    scene.load.spritesheet(CATCH_UNICORN_KEY, CATCH_UNICORN_SHEET, {
      frameWidth: CATCH_UNICORN.frameWidth,
      frameHeight: CATCH_UNICORN.frameHeight,
    });
  }
}

export function registerCatchUnicornAnim(scene: Phaser.Scene): void {
  if (!scene.anims.exists(CATCH_UNICORN_ANIM)) {
    scene.anims.create({
      key: CATCH_UNICORN_ANIM,
      frames: scene.anims.generateFrameNumbers(CATCH_UNICORN_KEY, { start: 0, end: CATCH_UNICORN.frameCount - 1 }),
      frameRate: CATCH_UNICORN.frameRate,
      repeat: -1,
    });
  }
}

// Ensure a single audio key is in the cache, then run onReady. If it's already
// cached (or unknown), onReady fires synchronously. Used by Sound to stream each
// music track only when it's about to play.
export function ensureAudioLoaded(scene: Phaser.Scene, key: string, onReady: () => void): void {
  if (scene.cache.audio.exists(key)) { onReady(); return; }
  const files = AUDIO_FILES[key];
  if (!files) { onReady(); return; }
  scene.load.once(`filecomplete-audio-${key}`, onReady);
  scene.load.audio(key, files);
  scene.load.start();
}

// Centered white progress bar shown while a scene preloads (no text — pre-readers).
// Auto-removes on complete; if nothing needs loading it never draws (no flash).
// ROYGBIV — the loading fill grows as a rainbow, revealed left-to-right.
const LOADING_RAINBOW = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00a3ff, 0x5e5ce6, 0xaf52de];

// A cheerful rainbow loading bar (no text — pre-readers): a soft rounded track
// fills with a glossy ROYGBIV rainbow with rounded ends, a glowing leading dot,
// and a gentle pulse. Auto-removes on complete.
export function showLoadingBar(scene: Phaser.Scene): void {
  const W = scene.scale.width, H = scene.scale.height;
  const barW = Math.min(440, W - 80);
  const barH = 28;
  const barX = (W - barW) / 2;
  const barY = H / 2 - barH / 2;
  const r = barH / 2;

  const layer = scene.add.container(0, 0).setDepth(1_000_000);

  // Soft pulsing glow behind the bar.
  const glow = scene.add.graphics();
  glow.fillStyle(0xffffff, 1).fillRoundedRect(barX - 16, barY - 16, barW + 32, barH + 32, r + 12);
  glow.setAlpha(0.12);
  scene.tweens.add({ targets: glow, alpha: 0.32, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });

  // Drop shadow + translucent track pill + thin bright rim.
  const track = scene.add.graphics();
  track.fillStyle(0x1a1a2e, 0.28).fillRoundedRect(barX - 5, barY - 3, barW + 10, barH + 10, r + 4);
  track.fillStyle(0xffffff, 0.16).fillRoundedRect(barX, barY, barW, barH, r);
  track.lineStyle(2, 0xffffff, 0.55).strokeRoundedRect(barX, barY, barW, barH, r);

  // Redrawn each progress tick: the rainbow fill (rounded both ends) + glossy
  // highlight + a glowing white leading dot at the fill edge.
  const fill = scene.add.graphics();
  const drawFill = (p: number) => {
    fill.clear();
    const fw = Math.max(barH, barW * Phaser.Math.Clamp(p, 0, 1)); // keep a rounded nub even at ~0
    const n = LOADING_RAINBOW.length;
    const seg = barW / n;
    for (let i = 0; i < n; i++) {
      const x0 = barX + i * seg;
      if (x0 >= barX + fw) break;
      const x1 = Math.min(barX + (i + 1) * seg, barX + fw);
      const first = i === 0;
      const last = x1 >= barX + fw - 0.5; // segment that reaches the fill edge → round its right
      fill.fillStyle(LOADING_RAINBOW[i], 1);
      if (first || last) {
        fill.fillRoundedRect(x0, barY, x1 - x0, barH, {
          tl: first ? r : 0, bl: first ? r : 0, tr: last ? r : 0, br: last ? r : 0,
        });
      } else {
        fill.fillRect(x0, barY, x1 - x0, barH);
      }
    }
    // Glassy highlight along the top of the filled area.
    fill.fillStyle(0xffffff, 0.28).fillRoundedRect(barX + 2, barY + 3, fw - 4, barH * 0.36, r * 0.5);
    // Glowing leading dot.
    const dx = barX + fw;
    fill.fillStyle(0xffffff, 0.35).fillCircle(dx, barY + barH / 2, barH * 0.85);
    fill.fillStyle(0xffffff, 1).fillCircle(dx, barY + barH / 2, barH * 0.42);
  };
  drawFill(0.0001);

  layer.add([glow, track, fill]);

  const onProgress = (p: number) => drawFill(p);
  scene.load.on("progress", onProgress);
  // Remove the progress handler too, not just the bar: music/prefetch loads run
  // through this same scene loader at runtime and would otherwise keep firing it
  // on the destroyed graphics.
  scene.load.once("complete", () => {
    scene.load.off("progress", onProgress);
    scene.tweens.killTweensOf(glow);
    layer.destroy();
  });
}
