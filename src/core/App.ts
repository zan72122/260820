import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import type { Flags } from './flags'

/** Renderer/scene shell. Rendering-policy decisions (tone mapping, shadow
 * type, E2E_FAST reductions) live here so the rest of the code stays clean. */
export class App {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly flags: Flags,
  ) {
    try {
      this.renderer = new WebGLRenderer({
        canvas,
        antialias: !flags.e2eFast,
        powerPreference: 'high-performance',
      })
    } catch (err) {
      showFatal(
        'WebGLコンテキストを作成できませんでした。ブラウザのハードウェアアクセラレーション設定をご確認ください。',
      )
      throw err
    }

    this.renderer.outputColorSpace = SRGBColorSpace
    // AgX desaturates bright warm highlights instead of skewing them toward
    // neon orange — important for a low-sun scene. (ACES kept as fallback for
    // older three versions.)
    this.renderer.toneMapping = AgXToneMapping ?? ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.shadowMap.enabled = !flags.e2eFast
    this.renderer.shadowMap.type = PCFSoftShadowMap

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(50, 16 / 9, 0.1, 900)

    this.applySize()
    window.addEventListener('resize', () => this.applySize())
  }

  private applySize(): void {
    if (this.flags.e2eFast) {
      // Small fixed framebuffer: cheap and resolution-independent for tests.
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(480, 270, false)
      this.camera.aspect = 480 / 270
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      this.renderer.setSize(window.innerWidth, window.innerHeight, false)
      this.camera.aspect = window.innerWidth / window.innerHeight
    }
    this.camera.updateProjectionMatrix()
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}

export function showFatal(message: string): void {
  const el = document.getElementById('fatal')
  if (el) {
    el.hidden = false
    el.textContent = message
  }
}
