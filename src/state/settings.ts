type Listener = () => void;

class Settings {
  calm = false; // default: full juicy
  private listeners: Listener[] = [];
  toggleCalm(): void {
    this.calm = !this.calm;
    for (const l of this.listeners) l();
  }
  onChange(cb: Listener): void {
    this.listeners.push(cb);
  }
}

export const settings = new Settings();
