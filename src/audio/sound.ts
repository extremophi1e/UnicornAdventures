import Phaser from "phaser";
import { ensureAudioLoaded, takeFirstTrack } from "../render/assets";

export const MUSIC_KEYS = ["music1", "music2", "music3", "music4", "music5", "music6"] as const;
export const CATCH_MUSIC_KEYS: readonly string[] = ["catch1", "catch2", "catch3", "catch4", "catch5"];
export const POP_MUSIC_KEYS: readonly string[] = ["popmusic", "popmusic2"];
export const GUMBALL_MUSIC_KEYS: readonly string[] = ["gumball", "gumball2"];
export const PEEKABOO_MUSIC_KEYS: readonly string[] = ["peekaboo1", "peekaboo2", "peekaboo3"];
// Garden reuses the calm meadow tracks as a quiet ambient bed (the tap-notes are the foreground).
export const GARDEN_MUSIC_KEYS: readonly string[] = PEEKABOO_MUSIC_KEYS;
export const GARDEN_NOTE_COUNT = 11;
export const EGGS_MUSIC_KEYS: readonly string[] = ["eggsmusic", "eggsmusic2", "eggsmusic3"];
const GIGGLE_KEYS = ["giggle1", "giggle2", "giggle3"] as const;

export class Sound {
  private _lastMusicKey: string | null = null;
  private _current?: Phaser.Sound.BaseSound;
  private _next: string | null = null;
  private _playlist: readonly string[] = MUSIC_KEYS;
  private _musicVolume = 0.5;
  private _stopped = false;

  constructor(private scene: Phaser.Scene) {
    // Once the scene shuts down, a still-in-flight track load must not resurrect
    // music on the dead scene (the lazy loader's callback may fire late).
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this._stopped = true; });
  }

  private _pickNextTrack(): string {
    const candidates = this._playlist.filter((k) => k !== this._lastMusicKey);
    const pool = candidates.length ? candidates : this._playlist;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private _playTrack(key: string): void {
    this._lastMusicKey = key;
    // Stream the track only when it's about to play — most playlists never get
    // past their first track, so the rest are never downloaded.
    ensureAudioLoaded(this.scene, key, () => {
      if (this._stopped) return;
      const prev = this._current;
      const m = this.scene.sound.add(key, { loop: false, volume: this._musicVolume });
      this._current = m;
      // Decide + prefetch the NEXT track now, while this one plays, so the hand-off
      // is gapless: tracks run for minutes but download in seconds, so it's cached
      // well before this one ends. Deciding it up front means the track we prefetch
      // is the same one we play next (not a fresh random pick at completion).
      this._next = this._pickNextTrack();
      ensureAudioLoaded(this.scene, this._next, () => {});
      m.once("complete", () => {
        this._playTrack(this._next ?? this._pickNextTrack());
      });
      m.play();
      // Free the just-finished previous track so finished tracks don't accumulate.
      if (prev) prev.destroy();
    });
  }

  playMusic(playlist: readonly string[] = MUSIC_KEYS, volume = 0.5): void {
    this._playlist = playlist;
    this._musicVolume = volume;
    this._lastMusicKey = null;
    // If the scene preloaded a first track (preloadFirstTrack), start with it so
    // music begins the instant the scene shows; otherwise pick one to stream now.
    this._playTrack(takeFirstTrack(this.scene) ?? this._pickNextTrack());
  }

  collect(): void {
    this.scene.sound.play("collect", { volume: 0.7 });
  }
  pop(): void {
    this.scene.sound.play("pop", { volume: 0.6 });
  }
  fanfare(): void {
    this.scene.sound.play("fanfare", { volume: 0.7 });
  }
  tada(): void {
    this.scene.sound.play("tada", { volume: 0.8 });
  }

  // Crack "tok" for tap N (1..3) — rising pitch is baked into the assets.
  crack(stage: number): void {
    const k = ["crack1", "crack2", "crack3"][Math.min(Math.max(stage, 1), 3) - 1];
    this.scene.sound.play(k, { volume: 0.6 });
  }

  // The shell-shatter on the final tap.
  shatter(): void {
    this.scene.sound.play("shatter", { volume: 0.7 });
  }

  // Play a random giggle variant — pitch variety avoids machine-gun fatigue on
  // repeated catches.
  giggle(volume = 0.6): void {
    const k = GIGGLE_KEYS[Math.floor(Math.random() * GIGGLE_KEYS.length)];
    this.scene.sound.play(k, { volume });
  }

  // Play one fun musical note from the soundboard audio sprite. Fire-and-forget /
  // polyphonic so rapid taps overlap and ring out into music (no cut-off).
  voice(marker: string, volume = 0.55): void {
    this.scene.sound.playAudioSprite("animalvoices", marker, { volume });
  }

  // Play the i-th pentatonic note (wraps). Polyphonic so rapid taps ring into a melody.
  note(i: number, volume = 0.4): void {
    this.scene.sound.playAudioSprite("gardennotes", `n${((i % GARDEN_NOTE_COUNT) + GARDEN_NOTE_COUNT) % GARDEN_NOTE_COUNT}`, { volume });
  }
}
