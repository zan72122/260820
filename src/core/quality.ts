import { clamp } from './math'

export type Tier = 'low' | 'medium' | 'high'

export interface QualitySettings {
  tier: Tier
  /** Hard ceiling on simultaneously active real point lights. */
  maxRealLights: number
  shadowMapSize: number
  shadows: boolean
  bloom: boolean
  /** Multiplier applied on top of the device pixel ratio. */
  renderScale: number
  maxPixelRatio: number
  leafCount: number
  mothCount: number
  rollerSegments: number
  anisotropy: number
}

function detectTier(gl: WebGL2RenderingContext | WebGLRenderingContext | null): Tier {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  let renderer = ''
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  }
  const r = renderer.toLowerCase()
  // Software rasterisers must never be asked for shadows or bloom.
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software')) return 'low'
  if (mem <= 2 || cores <= 2) return 'low'
  if (mem >= 6 && cores >= 6) return 'high'
  // Apple GPUs report generically but comfortably handle the medium tier and above.
  if (r.includes('apple')) return 'high'
  return 'medium'
}

export function createQuality(canvas: HTMLCanvasElement): QualitySettings {
  const gl = (canvas.getContext('webgl2') ??
    canvas.getContext('webgl')) as WebGL2RenderingContext | null
  const tier = detectTier(gl)
  const dpr = window.devicePixelRatio || 1

  if (tier === 'low') {
    return {
      tier,
      maxRealLights: 2,
      shadowMapSize: 512,
      shadows: false,
      bloom: false,
      renderScale: 0.8,
      maxPixelRatio: Math.min(dpr, 1.25),
      leafCount: 34,
      mothCount: 0,
      rollerSegments: 10,
      anisotropy: 1,
    }
  }
  if (tier === 'medium') {
    return {
      tier,
      maxRealLights: 4,
      shadowMapSize: 1024,
      shadows: true,
      bloom: true,
      renderScale: 0.92,
      maxPixelRatio: Math.min(dpr, 1.75),
      leafCount: 70,
      mothCount: 10,
      rollerSegments: 12,
      anisotropy: 4,
    }
  }
  return {
    tier,
    maxRealLights: 6,
    shadowMapSize: 1536,
    shadows: true,
    bloom: true,
    renderScale: 1,
    maxPixelRatio: Math.min(dpr, 2),
    leafCount: 110,
    mothCount: 16,
    rollerSegments: 16,
    anisotropy: 8,
  }
}

/**
 * Watches recent frame times and nudges the internal render scale so a weaker
 * phone trades resolution for a steady frame rate instead of stuttering.
 */
export class AdaptiveScale {
  private samples: number[] = []
  private cooldown = 1.5
  private readonly min: number
  private readonly max: number
  current: number

  constructor(base: number, min = 0.62) {
    this.current = base
    this.max = base
    this.min = Math.min(min, base)
  }

  /** Returns the new scale when it changed, otherwise null. */
  update(dt: number): number | null {
    this.cooldown -= dt
    this.samples.push(dt)
    if (this.samples.length > 48) this.samples.shift()
    if (this.cooldown > 0 || this.samples.length < 40) return null

    const sorted = [...this.samples].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    let next = this.current
    if (median > 1 / 44) next = this.current - 0.09
    else if (median < 1 / 57) next = this.current + 0.05
    next = clamp(next, this.min, this.max)

    if (Math.abs(next - this.current) < 0.004) {
      this.cooldown = 1.2
      return null
    }
    this.current = next
    this.cooldown = 2.4
    this.samples.length = 0
    return this.current
  }
}
