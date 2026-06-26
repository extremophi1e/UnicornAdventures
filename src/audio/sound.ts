import Phaser from "phaser";
import { settings } from "../state/settings";

const MUSIC_KEYS = ["music1", "music2", "music3", "music4"] as const;
type MusicKey = (typeof MUSIC_KEYS)[number];

export class Sound {
  private _lastMusicKey: MusicKey | null = null;

  constructor(private scene: Phaser.Scene) {}

  private _pickNextTrack(): MusicKey {
    const candidates = MUSIC_KEYS.filter((k) => k !== this._lastMusicKey);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private _playTrack(key: MusicKey): void {
    const vol = settings.calm ? 0.25 : 0.5;
    this._lastMusicKey = key;
    const m = this.scene.sound.add(key, { loop: false, volume: vol });
    m.once("complete", () => {
      this._playTrack(this._pickNextTrack());
    });
    m.play();
  }

  playMusic(): void {
    this._playTrack(this._pickNextTrack());
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
