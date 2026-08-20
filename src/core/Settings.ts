export type SettingsData = {
  volume: number
  calmVisuals: boolean // 光・動き・粒子を弱くする
  quality: 'auto' | 'low' | 'high'
}

const KEY = 'renkon.settings.v1'

const DEFAULTS: SettingsData = { volume: 0.8, calmVisuals: false, quality: 'auto' }

export class Settings {
  data: SettingsData = { ...DEFAULTS }
  private listeners = new Set<(d: SettingsData) => void>()

  constructor() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) Object.assign(this.data, JSON.parse(raw) as Partial<SettingsData>)
    } catch {
      /* storage unavailable (private mode) — defaults are fine */
    }
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    this.data[key] = value
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch {
      /* ignore */
    }
    for (const l of this.listeners) l(this.data)
  }

  onChange(fn: (d: SettingsData) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
