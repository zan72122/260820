/** 実行環境の判定と描画品質ティア。端末性能に応じて段階調整する。 */

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualitySettings {
  tier: QualityTier
  /** 内部解像度スケール（devicePixelRatio の上限） */
  pixelRatio: number
  /** 影マップ解像度。0 なら影マップ無効（接地影のみ） */
  shadowMapSize: number
  /** ぼかし接地影を使うか */
  contactShadows: boolean
  /** 背景植生のインスタンス数 */
  vegetation: number
  /** 吊荷の二次運動（揺れ）を出すか */
  secondaryMotion: boolean
  /** 手前の砕石など細かい散乱物 */
  groundDetail: number
  anisotropy: number
}

function readFlag(name: string): boolean {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  if (q.get(name) === '1') return true
  if (q.get(name) === '0') return false
  const injected = (window as unknown as Record<string, unknown>)[`__${name.toUpperCase()}`]
  return injected === true || injected === 1 || injected === '1'
}

/** E2E_FAST 相当。決定論的・低負荷モード。 */
export const FAST_MODE = readFlag('fast')

function detectRenderer(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return ''
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  } catch {
    return ''
  }
}

function forcedTier(): QualityTier | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('q')
  return v === 'low' || v === 'medium' || v === 'high' ? v : null
}

export function detectQuality(): QualitySettings {
  const forced = forcedTier()
  if (forced) return tierSettings(forced, forced === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2))
  if (FAST_MODE) return tierSettings('low', 1)

  const renderer = detectRenderer().toLowerCase()
  const software = /swiftshader|llvmpipe|software|angle \(google, vulkan/.test(renderer)
  const cores = navigator.hardwareConcurrency ?? 4
  const dpr = window.devicePixelRatio || 1
  const smallMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  if (software) return tierSettings('low', 1)
  if (cores <= 4 || (smallMemory !== undefined && smallMemory <= 3)) {
    return tierSettings('medium', Math.min(dpr, 1.5), reducedMotion)
  }
  return tierSettings('high', Math.min(dpr, 2), reducedMotion)
}

export function tierSettings(tier: QualityTier, pixelRatio: number, reducedMotion = false): QualitySettings {
  switch (tier) {
    case 'low':
      return {
        tier,
        pixelRatio: Math.min(pixelRatio, 1),
        shadowMapSize: 0,
        contactShadows: true,
        vegetation: 10,
        secondaryMotion: !reducedMotion,
        groundDetail: 24,
        anisotropy: 1,
      }
    case 'medium':
      return {
        tier,
        pixelRatio,
        shadowMapSize: 1024,
        contactShadows: true,
        vegetation: 22,
        secondaryMotion: !reducedMotion,
        groundDetail: 60,
        anisotropy: 4,
      }
    default:
      return {
        tier,
        pixelRatio,
        shadowMapSize: 2048,
        contactShadows: true,
        vegetation: 40,
        secondaryMotion: !reducedMotion,
        groundDetail: 120,
        anisotropy: 8,
      }
  }
}

/** 1 段階下げる。実測 FPS が低いときに使う。 */
export function downgrade(q: QualitySettings): QualitySettings | null {
  if (q.tier === 'high') return tierSettings('medium', Math.min(q.pixelRatio, 1.5))
  if (q.tier === 'medium') return tierSettings('low', 1)
  return null
}
