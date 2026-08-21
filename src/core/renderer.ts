import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { QualitySettings } from './quality'

export interface Viewport {
  width: number
  height: number
  aspect: number
  portrait: boolean
}

export class RenderSystem {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly viewport: Viewport = { width: 1, height: 1, aspect: 1, portrait: true }

  private composer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  private renderPass: RenderPass | null = null
  private scale: number

  constructor(
    canvas: HTMLCanvasElement,
    private readonly quality: QualitySettings,
  ) {
    this.canvas = canvas
    this.scale = quality.renderScale
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.tier === 'high',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    })
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.shadowMap.enabled = quality.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x0a0d14, 1)
  }

  attachPostProcessing(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.quality.bloom) return
    const composer = new EffectComposer(this.renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    // Deliberately weak and high-threshold: only the diffuser faces themselves
    // should bloom, never the surfaces they illuminate.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.26, 0.62, 0.86)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    this.composer = composer
    this.bloomPass = bloom
    this.renderPass = renderPass
    this.resize()
  }

  setCamera(camera: THREE.Camera): void {
    if (this.renderPass) this.renderPass.camera = camera
  }

  setBloom(strength: number): void {
    if (this.bloomPass) this.bloomPass.strength = strength
  }

  setExposure(v: number): void {
    this.renderer.toneMappingExposure = v
  }

  setRenderScale(scale: number): void {
    if (Math.abs(scale - this.scale) < 0.005) return
    this.scale = scale
    this.resize()
  }

  get renderScale(): number {
    return this.scale
  }

  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth)
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight)
    this.viewport.width = w
    this.viewport.height = h
    this.viewport.aspect = w / h
    this.viewport.portrait = h >= w

    const ratio = this.quality.maxPixelRatio * this.scale
    const bw = Math.max(2, Math.round(w * ratio))
    const bh = Math.max(2, Math.round(h * ratio))
    this.renderer.setSize(bw, bh, false)
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    if (this.composer) {
      this.composer.setSize(bw, bh)
      this.bloomPass?.setSize(Math.max(2, bw >> 1), Math.max(2, bh >> 1))
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.composer) this.composer.render()
    else this.renderer.render(scene, camera)
  }

  dispose(): void {
    this.composer?.dispose()
    this.renderer.dispose()
  }
}
