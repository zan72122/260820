import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { CameraDirector } from './CameraDirector'
import { clamp } from './util'

/** 章（チャプター）。次のパートを足すときはこれを実装して差し替える。 */
export interface Chapter {
  readonly scene: THREE.Scene
  readonly director: CameraDirector
  readonly exposure: number
  readonly bloomStrength: number
  enter(): void
  update(dt: number): void
  onTap(x: number, y: number, rect: DOMRect): void
  dispose(): void
}

export type Quality = {
  /** 0（軽い）〜1（きれい） */
  level: number
  pixelRatio: number
  shadowMap: number
  bloom: boolean
}

export function detectQuality(): Quality {
  const dpr = window.devicePixelRatio || 1
  const cores = navigator.hardwareConcurrency || 4
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4

  let level = 1
  if (mobile) level = cores >= 6 && mem >= 4 ? 0.75 : 0.45
  if (!mobile && cores < 4) level = 0.6

  return {
    level,
    pixelRatio: clamp(dpr, 1, level > 0.6 ? 2 : 1.5),
    shadowMap: level > 0.6 ? 2048 : 1024,
    bloom: true,
  }
}

export class Game {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly quality: Quality
  private composer: EffectComposer | null = null
  private renderPass: RenderPass | null = null
  private bloomPass: UnrealBloomPass | null = null
  private chapter: Chapter | null = null
  private last = 0
  private running = false
  private frameTimes: number[] = []
  private degraded = false
  private pointerStart: { x: number; y: number; t: number } | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.quality = detectQuality()
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.level > 0.6,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.setPixelRatio(this.quality.pixelRatio)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x05080f, 1)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', () => setTimeout(this.onResize, 250))

    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: true })
    canvas.addEventListener('pointerup', this.onPointerUp, { passive: true })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  setChapter(c: Chapter) {
    this.chapter?.dispose()
    this.chapter = c
    this.buildComposer(c)
    this.onResize()
    c.enter()
  }

  private buildComposer(c: Chapter) {
    this.composer?.dispose()
    const composer = new EffectComposer(this.renderer)
    const rp = new RenderPass(c.scene, c.director.camera)
    composer.addPass(rp)
    if (this.quality.bloom) {
      const size = this.renderSize()
      const bp = new UnrealBloomPass(
        new THREE.Vector2(size.w * 0.5, size.h * 0.5),
        0.4,
        0.62,
        0.90,
      )
      composer.addPass(bp)
      this.bloomPass = bp
    }
    composer.addPass(new OutputPass())
    this.composer = composer
    this.renderPass = rp
  }

  private renderSize() {
    return { w: window.innerWidth, h: window.innerHeight }
  }

  private onResize = () => {
    const { w, h } = this.renderSize()
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.bloomPass?.setSize(w * 0.5, h * 0.5)
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() }
  }

  private onPointerUp = (e: PointerEvent) => {
    const s = this.pointerStart
    this.pointerStart = null
    if (!s || !this.chapter) return
    const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y)
    if (moved > 26 || performance.now() - s.t > 900) return
    this.chapter.onTap(e.clientX, e.clientY, this.canvas.getBoundingClientRect())
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    if (!this.running) return
    requestAnimationFrame(this.loop)
    const dt = Math.min(0.06, (now - this.last) / 1000)
    this.last = now
    const c = this.chapter
    if (!c) return

    c.update(dt)
    this.renderer.toneMappingExposure = c.exposure
    if (this.bloomPass) this.bloomPass.strength = c.bloomStrength
    if (this.renderPass) {
      this.renderPass.scene = c.scene
      this.renderPass.camera = c.director.camera
    }
    this.composer ? this.composer.render(dt) : this.renderer.render(c.scene, c.director.camera)

    this.watchPerformance(dt)
  }

  /** 重いときは静かに解像度を落とす（見た目の破綻より滑らかさを優先）。 */
  private watchPerformance(dt: number) {
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    if (!this.degraded && avg > 0.034) {
      this.degraded = true
      const pr = Math.max(1, this.renderer.getPixelRatio() * 0.72)
      this.renderer.setPixelRatio(pr)
      this.onResize()
    }
  }

  get canvasRect() {
    return this.canvas.getBoundingClientRect()
  }
}
