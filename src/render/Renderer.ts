import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'
import { clamp, damp } from '../util/math'

/**
 * Renderer wrapper with an explicit internal resolution budget.
 *
 * High-DPI phones will happily ask for 3x the pixels they need; we cap the base
 * ratio and then trim further if frames start costing too much, so the town
 * lighting up never turns into a slideshow.
 */
export class Renderer {
  readonly gl: WebGLRenderer
  readonly supported: boolean

  private basePR = 1
  private scale = 1
  private targetScale = 1
  private accum = 0
  private frames = 0
  private slowFor = 0
  private fastFor = 0
  private width = 1
  private height = 1

  constructor(canvas: HTMLCanvasElement) {
    let gl: WebGLRenderer | null = null
    try {
      gl = new WebGLRenderer({
        canvas,
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: true,
      })
    } catch {
      gl = null
    }
    this.supported = !!gl
    this.gl = gl ?? (null as unknown as WebGLRenderer)
    if (!gl) return

    gl.outputColorSpace = SRGBColorSpace
    gl.toneMapping = ACESFilmicToneMapping
    gl.toneMappingExposure = 1
    gl.shadowMap.enabled = true
    gl.shadowMap.type = PCFSoftShadowMap
    gl.setClearColor(0x10141f, 1)

    const dpr = window.devicePixelRatio || 1
    // Two device pixels per CSS pixel is already past the point of visible return
    // on a phone; three is pure heat.
    this.basePR = Math.min(dpr, dpr > 2.5 ? 1.75 : 2)
    gl.setPixelRatio(this.basePR)
  }

  setSize(w: number, h: number): void {
    this.width = w
    this.height = h
    this.gl.setSize(w, h, false)
    this.gl.setPixelRatio(this.basePR * this.scale)
  }

  /** Smoothly close the gap between the current tone-mapping exposure and the target. */
  setExposure(target: number, dt: number): void {
    this.gl.toneMappingExposure = damp(this.gl.toneMappingExposure, target, 0.6, dt)
  }

  /** Watch the frame cost and trim internal resolution before the frame rate drops. */
  measure(dt: number): void {
    this.accum += dt
    this.frames++
    if (this.accum < 0.5) return
    const avg = this.accum / this.frames
    this.accum = 0
    this.frames = 0

    if (avg > 0.0235) {
      this.slowFor += 0.5
      this.fastFor = 0
    } else if (avg < 0.0142) {
      this.fastFor += 0.5
      this.slowFor = 0
    } else {
      this.slowFor = 0
      this.fastFor = 0
    }

    if (this.slowFor >= 1.0 && this.targetScale > 0.6) {
      this.targetScale = clamp(this.targetScale - 0.12, 0.6, 1)
      this.slowFor = 0
    } else if (this.fastFor >= 3.0 && this.targetScale < 1) {
      this.targetScale = clamp(this.targetScale + 0.08, 0.6, 1)
      this.fastFor = 0
    }

    if (Math.abs(this.targetScale - this.scale) > 0.005) {
      this.scale = this.targetScale
      this.gl.setPixelRatio(this.basePR * this.scale)
      this.gl.setSize(this.width, this.height, false)
    }
  }

  /** Effective device-pixels-per-CSS-pixel, used to size point sprites. */
  get pixelScale(): number {
    return this.basePR * this.scale
  }
}
