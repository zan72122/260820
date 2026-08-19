import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { FAST, MAX_PIXEL_RATIO, SHADOWS } from './flags'

export interface Viewport {
  width: number
  height: number
  aspect: number
  portrait: boolean
}

/**
 * WebGL2 renderer with an adaptive pixel ratio. The budget check runs on a
 * rolling average so a single hitch never drops resolution, and resolution is
 * only ever raised back to the cap the device started with.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly viewport: Viewport = { width: 1, height: 1, aspect: 1, portrait: false }

  private pixelRatio = 1
  private targetRatio = 1
  private frameTimes: number[] = []
  private lastAdjust = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !FAST,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.18
    this.renderer.shadowMap.enabled = SHADOWS
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x120d0b, 1)

    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 400)
    this.scene.fog = new THREE.Fog(0x1a1310, 62, 205)

    {
      // even the fast profile keeps the environment: without it every metal in
      // the scene renders black, which is worse than the cost of one PMREM pass
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      const env = pmrem.fromScene(new RoomEnvironment(), 0.05)
      this.scene.environment = env.texture
      this.scene.environmentIntensity = 0.55
      pmrem.dispose()
    }

    this.targetRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    this.pixelRatio = this.targetRatio
    this.resize()
  }

  resize() {
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)
    this.viewport.width = w
    this.viewport.height = h
    this.viewport.aspect = w / h
    this.viewport.portrait = h >= w
    this.camera.aspect = this.viewport.aspect
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h, false)
  }

  /** Feed each frame's duration; drops resolution when we run over budget. */
  sampleFrame(ms: number, now: number) {
    if (FAST) return
    this.frameTimes.push(ms)
    if (this.frameTimes.length > 50) this.frameTimes.shift()
    if (this.frameTimes.length < 50 || now - this.lastAdjust < 2500) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    let next = this.pixelRatio
    if (avg > 23 && this.pixelRatio > 1) next = Math.max(1, this.pixelRatio - 0.35)
    else if (avg < 13 && this.pixelRatio < this.targetRatio)
      next = Math.min(this.targetRatio, this.pixelRatio + 0.25)
    if (Math.abs(next - this.pixelRatio) > 0.01) {
      this.pixelRatio = next
      this.renderer.setPixelRatio(this.pixelRatio)
      this.renderer.setSize(this.viewport.width, this.viewport.height, false)
    }
    this.lastAdjust = now
    this.frameTimes.length = 0
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.dispose()
  }
}
