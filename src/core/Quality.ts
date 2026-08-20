import type { Settings } from './Settings'

/**
 * Adaptive quality. Degrades in the order required by the design brief:
 * distant leaf density -> turbidity particles -> wave subdivision ->
 * shadow resolution -> render scale. Mud removal, joint reveal and the jet
 * are never degraded: they carry the whole game.
 */
export type QualityState = {
  tier: number // 0 = best .. 4 = lowest
  renderScale: number
  shadowSize: number
  shadows: boolean
  turbidityBudget: number
  leafDensity: number
  waveDetail: number
}

const TIERS: Omit<QualityState, 'tier'>[] = [
  { renderScale: 1.0, shadowSize: 1024, shadows: true, turbidityBudget: 220, leafDensity: 1.0, waveDetail: 1.0 },
  { renderScale: 1.0, shadowSize: 1024, shadows: true, turbidityBudget: 220, leafDensity: 0.55, waveDetail: 1.0 },
  { renderScale: 0.92, shadowSize: 1024, shadows: true, turbidityBudget: 130, leafDensity: 0.4, waveDetail: 0.7 },
  { renderScale: 0.85, shadowSize: 512, shadows: true, turbidityBudget: 90, leafDensity: 0.3, waveDetail: 0.5 },
  { renderScale: 0.7, shadowSize: 512, shadows: false, turbidityBudget: 60, leafDensity: 0.2, waveDetail: 0.35 },
]

export class Quality {
  state: QualityState = { tier: 0, ...TIERS[0] }
  private acc = 0
  private frames = 0
  private cooldown = 2.5
  private listeners = new Set<(q: QualityState) => void>()
  private locked = false

  constructor(private settings: Settings) {
    this.applyPreference()
    settings.onChange(() => this.applyPreference())
  }

  private applyPreference() {
    const q = this.settings.data.quality
    if (q === 'auto') {
      this.locked = false
      return
    }
    this.locked = true
    this.setTier(q === 'low' ? 4 : 0)
  }

  onChange(fn: (q: QualityState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setTier(tier: number) {
    const t = Math.max(0, Math.min(TIERS.length - 1, tier))
    if (t === this.state.tier) return
    this.state = { tier: t, ...TIERS[t] }
    for (const l of this.listeners) l(this.state)
  }

  /** Feed frame time in seconds. */
  sample(dt: number) {
    if (this.locked) return
    this.acc += dt
    this.frames++
    this.cooldown -= dt
    if (this.acc < 1.0) return
    const fps = this.frames / this.acc
    this.acc = 0
    this.frames = 0
    if (this.cooldown > 0) return
    if (fps < 32) {
      this.setTier(this.state.tier + 1)
      this.cooldown = 2.5
    } else if (fps > 56 && this.state.tier > 0) {
      this.setTier(this.state.tier - 1)
      this.cooldown = 6
    }
  }
}
