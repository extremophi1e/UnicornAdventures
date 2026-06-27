import Phaser from "phaser";

const MUSIC_KEYS = ["music1", "music2", "music3", "music4", "music5", "music6"] as const;
export const CATCH_MUSIC_KEYS: readonly string[] = ["catch1", "catch2", "catch3", "catch4", "catch5"];
export const POP_MUSIC_KEYS: readonly string[] = ["popmusic", "popmusic2"];
export const GUMBALL_MUSIC_KEYS: readonly string[] = ["gumball", "gumball2"];
const GIGGLE_KEYS = ["giggle1", "giggle2", "giggle3"] as const;

export class Sound {
  private _lastMusicKey: string | null = null;
  private _current?: Phaser.Sound.BaseSound;
  private _playlist: readonly string[] = MUSIC_KEYS;
  private _musicVolume = 0.5;

  constructor(private scene: Phaser.Scene) {}

  private _pickNextTrack(): string {
    const candidates = this._playlist.filter((k) => k !== this._lastMusicKey);
    const pool = candidates.length ? candidates : this._playlist;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private _playTrack(key: string): void {
    this._lastMusicKey = key;
    const prev = this._current;
    const m = this.scene.sound.add(key, { loop: false, volume: this._musicVolume });
    this._current = m;
    m.once("complete", () => {
      this._playTrack(this._pickNextTrack());
    });
    m.play();
    // Free the just-finished previous track so finished tracks don't accumulate.
    if (prev) prev.destroy();
  }

  playMusic(playlist: readonly string[] = MUSIC_KEYS, volume = 0.5): void {
    this._playlist = playlist;
    this._musicVolume = volume;
    this._lastMusicKey = null;
    this._playTrack(this._pickNextTrack());
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
}
