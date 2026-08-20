import * as THREE from 'three';
import { clamp } from './util';

export interface Metrics {
  fps: number;
  frameMs: number;
  calls: number;
  tris: number;
  pixelRatio: number;
  width: number;
  height: number;
}

const FIXED_DT = 1 / 60;
const MAX_SUBSTEPS = 4;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly metrics: Metrics = {
    fps: 60,
    frameMs: 16.7,
    calls: 0,
    tris: 0,
    pixelRatio: 1,
    width: 1,
    height: 1,
  };

  onFixed: (dt: number) => void = () => {};
  onFrame: (dt: number, elapsed: number) => void = () => {};
  onResize: (w: number, h: number, portrait: boolean) => void = () => {};

  elapsed = 0;
  portrait = true;
  paused = false;

  private accumulator = 0;
  private last = 0;
  private frameEma = 16.7;
  private targetRatio: number;
  private curRatio: number;
  private ratioCooldown = 0;
  private raf = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    // Never adopt a high-DPI ratio unconditionally: cap, then adapt.
    this.targetRatio = clamp(dpr, 1, 2);
    this.curRatio = Math.min(this.targetRatio, 1.6);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dpr < 1.6,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(this.curRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x8e8b85, 1);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 120);
    this.scene.add(this.camera);

    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.stop();
      },
      false,
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.renderer.shadowMap.needsUpdate = true;
        this.start();
      },
      false,
    );

    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(this.handleResize, 120));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleResize, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!document.hidden) this.last = performance.now();
    });
  }

  private handleResize = () => {
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    this.portrait = h >= w;
    document.body.classList.toggle('portrait', this.portrait);
    document.body.classList.toggle('landscape', !this.portrait);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.metrics.width = w;
    this.metrics.height = h;
    this.onResize(w, h, this.portrait);
  };

  resize() {
    this.handleResize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Adaptive internal resolution: step down under load, recover slowly. */
  private adaptResolution(dt: number) {
    this.ratioCooldown -= dt;
    if (this.ratioCooldown > 0) return;
    const ms = this.frameEma;
    let next = this.curRatio;
    if (ms > 26 && this.curRatio > 0.7) next = Math.max(0.7, this.curRatio - 0.18);
    else if (ms < 14.2 && this.curRatio < this.targetRatio) next = Math.min(this.targetRatio, this.curRatio + 0.12);
    if (Math.abs(next - this.curRatio) > 0.005) {
      this.curRatio = next;
      this.renderer.setPixelRatio(next);
      this.handleResize();
      this.ratioCooldown = 1.2;
    } else {
      this.ratioCooldown = 0.35;
    }
  }

  private tick = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.paused) return;
    if (dt > 0.25) dt = 0.25;

    this.frameEma = this.frameEma * 0.92 + dt * 1000 * 0.08;
    this.metrics.frameMs = this.frameEma;
    this.metrics.fps = 1000 / Math.max(1, this.frameEma);
    this.metrics.pixelRatio = this.curRatio;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.onFixed(FIXED_DT);
      this.accumulator -= FIXED_DT;
      this.elapsed += FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;

    this.onFrame(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);

    const info = this.renderer.info.render;
    this.metrics.calls = info.calls;
    this.metrics.tris = info.triangles;

    this.adaptResolution(dt);
  };
}
