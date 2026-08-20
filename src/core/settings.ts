export type SettingsState = {
  volume: number; // 0..1
  reduceMotion: boolean;
  haptics: boolean;
};

const KEY = 'imo.settings.v1';

const load = (): SettingsState => {
  const base: SettingsState = { volume: 0.7, reduceMotion: false, haptics: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<SettingsState>;
    return {
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : base.volume,
      reduceMotion: !!p.reduceMotion,
      haptics: p.haptics !== false,
    };
  } catch {
    return base;
  }
};

class Settings {
  state: SettingsState = load();
  private listeners = new Set<(s: SettingsState) => void>();

  constructor() {
    // Respect the OS-level preference on first run.
    try {
      if (localStorage.getItem(KEY) === null && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.state.reduceMotion = true;
      }
    } catch {
      /* no-op */
    }
  }

  onChange(fn: (s: SettingsState) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(patch: Partial<SettingsState>) {
    this.state = { ...this.state, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* private mode: keep in memory */
    }
    for (const fn of this.listeners) fn(this.state);
  }

  /** Global animation amplitude multiplier. */
  get motionScale() {
    return this.state.reduceMotion ? 0.35 : 1;
  }
}

export const settings = new Settings();
