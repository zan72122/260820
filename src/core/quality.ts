/**
 * Quality tiers. Whatever tier we land on, the causal chain
 * (sheet moves -> light reaches the underside -> colour changes) is preserved:
 * only ornament is traded away.
 */

export type Tier = 'low' | 'balanced' | 'high'

export interface QualitySettings {
  tier: Tier
  dprCap: number
  shadowMapSize: number
  softShadow: boolean
  fuzzShells: number
  moteCount: number
  backgroundTrees: number
  leavesPerBranch: number
  peachSegments: number
  sheetSegments: number
  grassTufts: number
  groundPebbles: number
  anisotropy: number
  bounceOnLeaves: boolean
}

const PRESETS: Record<Tier, Omit<QualitySettings, 'tier'>> = {
  low: {
    dprCap: 1.35,
    shadowMapSize: 1024,
    softShadow: false,
    fuzzShells: 1,
    moteCount: 26,
    backgroundTrees: 7,
    leavesPerBranch: 9,
    peachSegments: 56,
    sheetSegments: 40,
    grassTufts: 260,
    groundPebbles: 14,
    anisotropy: 2,
    bounceOnLeaves: false,
  },
  balanced: {
    dprCap: 1.9,
    shadowMapSize: 1536,
    softShadow: true,
    fuzzShells: 3,
    moteCount: 60,
    backgroundTrees: 12,
    leavesPerBranch: 16,
    peachSegments: 88,
    sheetSegments: 64,
    grassTufts: 520,
    groundPebbles: 26,
    anisotropy: 4,
    bounceOnLeaves: true,
  },
  high: {
    dprCap: 2.25,
    shadowMapSize: 2048,
    softShadow: true,
    fuzzShells: 5,
    moteCount: 110,
    backgroundTrees: 18,
    leavesPerBranch: 24,
    peachSegments: 120,
    sheetSegments: 88,
    grassTufts: 900,
    groundPebbles: 40,
    anisotropy: 8,
    bounceOnLeaves: true,
  },
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

export function detectTier(gl?: WebGL2RenderingContext | null): Tier {
  const nav = navigator as NavigatorWithMemory
  const mem = nav.deviceMemory ?? 4
  const cores = nav.hardwareConcurrency ?? 4
  let score = 0
  score += mem >= 8 ? 2 : mem >= 4 ? 1 : 0
  score += cores >= 8 ? 2 : cores >= 6 ? 1 : 0

  let rendererName = ''
  if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbg) rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
  }
  const soft = /swiftshader|llvmpipe|softwarerasterizer|angle \(software/i.test(rendererName)
  if (soft) return 'low'
  if (/apple (a1[4-9]|m[1-9])/i.test(rendererName)) score += 2

  const px = window.screen.width * window.screen.height * (window.devicePixelRatio || 1)
  if (px > 4.2e6) score -= 1

  if (score >= 4) return 'high'
  if (score >= 2) return 'balanced'
  return 'low'
}

export function settingsFor(tier: Tier): QualitySettings {
  return { tier, ...PRESETS[tier] }
}

/**
 * Load governor. Nudges the render scale in small steps so quality never
 * visibly snaps; only sustained pressure demotes the tier.
 */
export class LoadGovernor {
  renderScale = 1
  private avgMs = 16.7
  private pressure = 0
  private cooldown = 2
  private minScale: number

  constructor(
    private readonly onTierChange: (t: Tier) => void,
    private tier: Tier,
  ) {
    this.minScale = tier === 'low' ? 0.6 : 0.72
  }

  reset(tier: Tier): void {
    this.tier = tier
    this.pressure = 0
    this.cooldown = 3
    this.minScale = tier === 'low' ? 0.6 : 0.72
  }

  update(frameMs: number, dt: number): void {
    this.avgMs += (frameMs - this.avgMs) * 0.06
    if (this.cooldown > 0) {
      this.cooldown -= dt
      return
    }
    const heavy = this.avgMs > 26
    const light = this.avgMs < 15
    if (heavy) {
      this.pressure += dt
      this.renderScale = Math.max(this.minScale, this.renderScale - 0.012)
    } else if (light) {
      this.pressure = Math.max(0, this.pressure - dt * 0.5)
      this.renderScale = Math.min(1, this.renderScale + 0.004)
    } else {
      this.pressure = Math.max(0, this.pressure - dt * 0.2)
    }
    if (this.pressure > 6 && this.renderScale <= this.minScale + 0.02) {
      const next: Tier | null = this.tier === 'high' ? 'balanced' : this.tier === 'balanced' ? 'low' : null
      if (next) {
        this.tier = next
        this.pressure = 0
        this.cooldown = 6
        this.renderScale = Math.min(1, this.renderScale + 0.18)
        this.onTierChange(next)
      }
    }
  }
}
