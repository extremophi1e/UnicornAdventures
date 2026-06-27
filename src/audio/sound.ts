import Phaser from "phaser";

const MUSIC_KEYS = ["music1", "music2", "music3", "music4"] as const;
export const CATCH_MUSIC_KEYS: readonly string[] = ["catch1", "catch2", "catch3"];

export class Sound {
  private _lastMusicKey: string | null = null;
  private _current?: Phaser.Sound.BaseSound;
  private _playlist: readonly string[] = MUSIC_KEYS;
  private _voices?: Phaser.Sound.BaseSound; // retained audiosprite instance (cut-off-previous)

  constructor(private scene: Phaser.Scene) {}

  private _pickNextTrack(): string {
    const candidates = this._playlist.filter((k) => k !== this._lastMusicKey);
    const pool = candidates.length ? candidates : this._playlist;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private _playTrack(key: string): void {
    this._lastMusicKey = key;
    const prev = this._current;
    const m = this.scene.sound.add(key, { loop: false, volume: 0.5 });
    this._current = m;
    m.once("complete", () => {
      this._playTrack(this._pickNextTrack());
    });
    m.play();
    // Free the just-finished previous track so finished tracks don't accumulate.
    if (prev) prev.destroy();
  }

  playMusic(playlist: readonly string[] = MUSIC_KEYS): void {
    this._playlist = playlist;
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

  // Play one creature voice from the baked audio sprite; stops any voice already
  // playing so the latest tap always wins (no pile-up on rapid tapping).
  voice(marker: string, volume = 0.7): void {
    if (!this._voices) this._voices = this.scene.sound.addAudioSprite("animalvoices");
    this._voices.stop();
    (this._voices as Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound).play(marker, { volume });
  }
}
