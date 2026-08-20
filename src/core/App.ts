import {
  ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, Texture, Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildEnvironment } from '../gfx/Env';
import { damp } from './Easing';
import { guessQuality, qualityFor, QualityGovernor, type QualitySettings, type QualityTier } from './Quality';

/** Slightly under-exposed: the crystals are the only thing allowed to be hot. */
const BASE_EXPOSURE = 0.9;

export interface AppHooks {
  onFrame(dt: number): void;
  onResize(width: number, height: number, aspect: number): void;
  onQualityChange(q: QualitySettings): void;
}

/**
 * Renderer, post chain and frame loop. Everything here is sized to a phone:
 * capped pixel ratio, half-resolution bloom, and a governor that quietly steps
 * quality down rather than letting the stone stutter while it is being washed.
 */
export class App {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly envMap: Texture | null;
  quality: QualitySettings;

  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private hooks: AppHooks | null = null;
  private raf = 0;
  private last = 0;
  private running = false;
  private exposure = BASE_EXPOSURE;
  private exposureTarget = BASE_EXPOSURE;
  private governor: QualityGovernor;
  private canvas: HTMLCanvasElement;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, opts: { fast?: boolean; tier?: QualityTier } = {}) {
    this.canvas = canvas;
    this.quality = guessQuality({ fast: opts.fast, hint: opts.tier });

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.quality.tier !== 'low',
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x07060a, 1);

    this.camera = new PerspectiveCamera(42, 1, 0.05, 40);
    this.scene.environmentIntensity = 0.9;

    this.envMap = buildEnvironment(this.renderer);
    this.scene.environment = this.envMap;

    this.governor = new QualityGovernor((tier) => this.applyQuality(qualityFor(tier)));

    this.applyPixelRatio();
    this.buildComposer();
    this.resize();

    window.addEventListener('resize', this.onWindowResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.onWindowResize, { passive: true });
    window.addEventListener('orientationchange', this.onWindowResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onWindowResize = () => {
    // iOS reports the new size a beat after the event fires.
    this.resize();
    setTimeout(() => this.resize(), 220);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.stop();
    } else if (this.hooks) {
      this.start(this.hooks);
    }
  };

  private applyPixelRatio(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDpr);
    this.renderer.setPixelRatio(this.dpr);
    this.composer?.setPixelRatio(this.dpr);
  }

  get pixelRatio(): number { return this.dpr; }

  private buildComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (!this.quality.bloom) return;

    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.dpr);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const size = this.sizeVector();
    // Selective by threshold rather than by layer: only the crystals ever push
    // pixels above it, so the workshop stays matte while the gems glow.
    const bloom = new UnrealBloomPass(
      new Vector2(Math.max(8, size.x * this.quality.bloomScale),
                  Math.max(8, size.y * this.quality.bloomScale)),
      0.40, 0.55, 1.00,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    this.composer = composer;
    this.bloom = bloom;
  }

  private sizeVector(): Vector2 {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    return new Vector2(w, h);
  }

  applyQuality(q: QualitySettings): void {
    this.quality = q;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.applyPixelRatio();
    this.buildComposer();
    this.resize();
    this.hooks?.onQualityChange(q);
  }

  resize(): void {
    const { x: w, y: h } = this.sizeVector();
    const aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.hooks?.onResize(w, h, aspect);
  }

  /** Brief exposure lift — used for the instant the stone cracks. */
  flash(amount: number): void {
    this.exposureTarget = Math.max(this.exposureTarget, BASE_EXPOSURE + amount);
  }

  start(hooks: AppHooks): void {
    this.hooks = hooks;
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      // A long frame (tab switch, thermal hitch) must not teleport the physics,
      // but clamping too hard makes a struggling device run in slow motion.
      const dt = Math.min(0.1, Math.max(0.0001, (now - this.last) / 1000));
      this.last = now;

      this.exposure = damp(this.exposure, this.exposureTarget, 6, dt);
      this.exposureTarget = damp(this.exposureTarget, BASE_EXPOSURE, 5, dt);
      this.renderer.toneMappingExposure = this.exposure;

      hooks.onFrame(dt);
      this.render();
      this.governor.sample(dt, this.quality.tier);
    };
    this.raf = requestAnimationFrame(tick);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get bloomPass(): UnrealBloomPass | null { return this.bloom; }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onWindowResize);
    window.visualViewport?.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
