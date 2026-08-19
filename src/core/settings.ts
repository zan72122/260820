export interface GameSettings {
  sound: boolean;
  /** "光を弱くする" — dims the local flame light and the additive glow. */
  softLight: boolean;
}

const KEY = 'fire-ice-baked-alaska/settings/v1';

const DEFAULTS: GameSettings = { sound: true, softLight: false };

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      softLight: typeof parsed.softLight === 'boolean' ? parsed.softLight : DEFAULTS.softLight,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — settings simply do not persist */
  }
}
