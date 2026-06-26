import Phaser from "phaser";
import { settings } from "../state/settings";

const MUSIC_KEYS = ["music1", "music2", "music3", "music4"] as const;
type MusicKey = (typeof MUSIC_KEYS)[number];

export class Sound {
  private _lastMusicKey: MusicKey | null = null;
  private _current?: Phaser.Sound.BaseSound;

  constructor(private scene: Phaser.Scene) {}

  private _pickNextTrack(): MusicKey {
    const candidates = MUSIC_KEYS.filter((k) => k !== this._lastMusicKey);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private _playTrack(key: MusicKey): void {
    const vol = settings.calm ? 0.25 : 0.5;
    this._lastMusicKey = key;
    const prev = this._current;
    const m = this.scene.sound.add(key, { loop: false, volume: vol });
    this._current = m;
    m.once("complete", () => {
      this._playTrack(this._pickNextTrack());
    });
    m.play();
    // Free the just-finished previous track (its 'complete' already fired) so
    // finished tracks don't accumulate in the sound manager over a long session.
    if (prev) prev.destroy();
  }

  playMusic(): void {
    this._playTrack(this._pickNextTrack());
  }

  collect(): void {
    this.scene.sound.play("collect", { volume: settings.calm ? 0.35 : 0.7 });
  }
  pop(): void {
    this.scene.sound.play("pop", { volume: settings.calm ? 0.3 : 0.6 });
  }
  fanfare(): void {
    this.scene.sound.play("fanfare", { volume: settings.calm ? 0.35 : 0.7 });
  }
  tada(): void {
    this.scene.sound.play("tada", { volume: settings.calm ? 0.4 : 0.8 });
  }
}
