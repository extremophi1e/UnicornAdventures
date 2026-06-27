// Pure music-track key registry — no Phaser import, so the per-game invariant
// (exactly 3 unique tracks each) is unit-testable in the node test env. Each key
// equals its AUDIO_FILES entry (src/render/assets.ts) and the mp3 filename stem
// in public/audio (e.g. "garden1" -> public/audio/garden1.mp3).

export const MUSIC_KEYS = ["music1", "music2", "music3"] as const;                    // Galaga shooter
export const CATCH_MUSIC_KEYS = ["catch1", "catch2", "catch3"] as const;             // Rainbow Catch
export const POP_MUSIC_KEYS = ["popmusic", "popmusic2", "popmusic3"] as const;       // Pop the Cuties
export const GUMBALL_MUSIC_KEYS = ["gumball", "gumball2", "gumball3"] as const;       // Unicorn Gumballs
export const PEEKABOO_MUSIC_KEYS = ["peekaboo1", "peekaboo2", "peekaboo3"] as const; // Peekaboo
export const GARDEN_MUSIC_KEYS = ["garden1", "garden2", "garden3"] as const;         // Tap-to-Grow Garden
export const EGGS_MUSIC_KEYS = ["eggsmusic", "eggsmusic2", "eggsmusic3"] as const;   // Surprise Eggs
export const AQUARIUM_MUSIC_KEYS = ["aquarium", "aquarium2", "aquarium3"] as const;  // Tap the Aquarium

// Every game that has background music -> its playlist. Soundboard is
// intentionally absent (tap-instrument, no music).
export const GAME_MUSIC: Record<string, readonly string[]> = {
  galaga: MUSIC_KEYS,
  catch: CATCH_MUSIC_KEYS,
  pop: POP_MUSIC_KEYS,
  gumball: GUMBALL_MUSIC_KEYS,
  peekaboo: PEEKABOO_MUSIC_KEYS,
  garden: GARDEN_MUSIC_KEYS,
  eggs: EGGS_MUSIC_KEYS,
  aquarium: AQUARIUM_MUSIC_KEYS,
};
