export type Tier = 'low' | 'mid' | 'high'

export interface QualitySettings {
  tier: Tier
  pixelRatioCap: number
  shadows: boolean
  shadowMapSize: number
  /** Radial segments used for every rope tube. */
  ropeSides: number
  /** Draw the fine knotted mesh between the cords. */
  fineMesh: boolean
  /** Subdivision of the fine mesh sheet, per cell. */
  fineMeshSub: number
  leafCount: number
  dust: number
  mangoTex: number
  leafTex: number
  barkTex: number
  floorTex: number
  netIterations: number
  anisotropy: number
  envSize: number
}

const PRESETS: Record<Tier, QualitySettings> = {
  low: {
    tier: 'low',
    pixelRatioCap: 1.35,
    shadows: true,
    shadowMapSize: 512,
    ropeSides: 4,
    fineMesh: true,
    fineMeshSub: 1,
    leafCount: 12,
    dust: 0,
    mangoTex: 512,
    leafTex: 256,
    barkTex: 256,
    floorTex: 256,
    netIterations: 6,
    anisotropy: 2,
    envSize: 64,
  },
  mid: {
    tier: 'mid',
    pixelRatioCap: 1.85,
    shadows: true,
    shadowMapSize: 1024,
    ropeSides: 5,
    fineMesh: true,
    fineMeshSub: 2,
    leafCount: 20,
    dust: 90,
    mangoTex: 640,
    leafTex: 384,
    barkTex: 384,
    floorTex: 384,
    netIterations: 8,
    anisotropy: 4,
    envSize: 96,
  },
  high: {
    tier: 'high',
    pixelRatioCap: 2.4,
    shadows: true,
    shadowMapSize: 2048,
    ropeSides: 6,
    fineMesh: true,
    fineMeshSub: 3,
    leafCount: 28,
    dust: 170,
    mangoTex: 768,
    leafTex: 512,
    barkTex: 512,
    floorTex: 512,
    netIterations: 8,
    anisotropy: 8,
    envSize: 128,
  },
}

function readOverride(): Tier | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search).get('q')
  return q === 'low' || q === 'mid' || q === 'high' ? q : null
}

/**
 * Pick a tier from what the device is willing to tell us. Nothing here changes
 * the physics or the staging: only shadow resolution, leaf density, dust and
 * texture size move. The fruit, the net and the catch are never reduced.
 */
export function detectQuality(gl?: WebGLRenderingContext | WebGL2RenderingContext): QualitySettings {
  const override = readOverride()
  if (override) return { ...PRESETS[override] }

  let score = 2
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const cores = nav?.hardwareConcurrency ?? 4
  const mem = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 4
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1

  if (cores <= 4) score -= 1
  if (cores >= 8) score += 0.5
  if (mem <= 3) score -= 1
  if (mem >= 8) score += 0.5
  if (dpr >= 3) score -= 0.25

  let rendererName = ''
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) rendererName = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  }
  // Software rasterisers must never be asked for shadow-heavy frames.
  if (/swiftshader|llvmpipe|software/i.test(rendererName)) score = 0

  const tier: Tier = score <= 0.75 ? 'low' : score >= 2.5 ? 'high' : 'mid'
  const settings = { ...PRESETS[tier] }

  // Deterministic capture mode: smallest practical cost, identical every run.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e')) {
    settings.pixelRatioCap = 1
    settings.dust = 0
    settings.shadowMapSize = Math.min(settings.shadowMapSize, 1024)
  }
  return settings
}

export function isE2E(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e')
}

export function fastMode(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('fast')
}
