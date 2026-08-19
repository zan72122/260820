import * as THREE from 'three';

export interface Quality {
  /** hard cap on devicePixelRatio */
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  /** rice hills across the whole paddy */
  riceDensity: number;
  particles: boolean;
  /** cheap mode used by the automated smoke test */
  fast: boolean;
}

function detectQuality(): Quality {
  const params = new URLSearchParams(location.search);
  const fast = params.get('fast') === '1' || (window as any).E2E_FAST === true;
  if (fast) {
    return { maxDpr: 1, shadows: false, shadowMapSize: 512, riceDensity: 0.35, particles: false, fast: true };
  }
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight);
  // Older / smaller phones: keep the shadow atlas and rice count modest.
  const weak = (mem !== undefined && mem <= 3) || cores <= 4 || small <= 360;
  return {
    maxDpr: weak ? 1.5 : 2,
    shadows: true,
    shadowMapSize: weak ? 1024 : 2048,
    riceDensity: weak ? 0.7 : 1,
    particles: true,
    fast: false,
  };
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly quality: Quality;
  private prevMs = 0;

  /** true when the viewport is taller than it is wide */
  portrait = true;

  private updaters: Array<(dt: number, elapsed: number) => void> = [];
  private running = false;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.quality = detectQuality();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.quality.fast,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x9fb2c4, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    if (this.quality.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.25, 420);
    this.scene.add(this.camera);

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 120));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resize);
    }
    document.addEventListener('visibilitychange', () => {
      // Coming back from a locked screen should not fire one giant dt.
      if (!document.hidden) this.prevMs = performance.now();
    });
  }

  readonly resize = () => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.portrait = h >= w;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // A phone held upright sees far less horizontally; widen the lens so the
    // machine and the rice ahead of it both stay in frame.
    this.camera.fov = this.portrait ? 62 : 50;
    this.camera.updateProjectionMatrix();
  };

  onUpdate(fn: (dt: number, elapsed: number) => void) {
    this.updaters.push(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.prevMs = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private tick = () => {
    // Clamp dt: a stalled tab must never teleport the machine across the field.
    const now = performance.now();
    const raw = (now - this.prevMs) / 1000;
    this.prevMs = now;
    const dt = Math.min(Math.max(raw, 0), 1 / 20);
    this.lastTime += dt;
    for (let i = 0; i < this.updaters.length; i++) this.updaters[i](dt, this.lastTime);
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Used by the smoke test to run the simulation without waiting in real
   * time.  `render: false` skips drawing entirely, which is what makes a
   * whole-paddy run finish in seconds on a software rasteriser.
   */
  advance(seconds: number, step = 1 / 30, render = true) {
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(step, left);
      this.lastTime += dt;
      for (let i = 0; i < this.updaters.length; i++) this.updaters[i](dt, this.lastTime);
      left -= dt;
    }
    if (render) this.renderer.render(this.scene, this.camera);
  }
}
