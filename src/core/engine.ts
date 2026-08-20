import * as THREE from 'three';
import { buildSky } from '../gfx/sky';
import { clamp } from './util';
import { perf } from './perf';

export type Viewport = {
  width: number;
  height: number;
  portrait: boolean;
  aspect: number;
};

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly sunDir: THREE.Vector3;
  readonly canvas: HTMLCanvasElement;
  viewport: Viewport = { width: 1, height: 1, portrait: true, aspect: 1 };

  private updaters: Array<(dt: number, elapsed: number) => void> = [];
  private resizeCbs: Array<(v: Viewport) => void> = [];
  private clock = new THREE.Clock();
  private elapsed = 0;
  private raf = 0;
  /** Long frames get clipped instead of teleporting the simulation. */
  private maxDt = 1 / 20;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private renderScale = 1;

  constructor(mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: perf.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.canvas = this.renderer.domElement;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.05, 420);
    this.camera.position.set(0, 1.6, 3);

    const { sky, envMap, sunDir, sunColor } = buildSky(this.renderer);
    this.scene.add(sky);
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 1.3;
    this.sunDir = sunDir;

    // Aerial perspective: one fog colour matched to the horizon band.
    this.scene.fog = new THREE.FogExp2(0xbcc3ba, 0.0062);

    this.sun = new THREE.DirectionalLight(sunColor, 2.6);
    this.sun.position.copy(sunDir).multiplyScalar(24);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(perf.shadowSize, perf.shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = -8.5;
    cam.right = 8.5;
    cam.top = 8.5;
    cam.bottom = -8.5;
    cam.near = 1;
    cam.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.022;
    // shadows describe form here, they are not meant to punch holes in it
    this.sun.shadow.intensity = 0.78;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Bounce from the sky and the surrounding dry field, one cheap light.
    const hemi = new THREE.HemisphereLight(0xb4cbe4, 0x8a7a5c, 0.75);
    this.scene.add(hemi);

    this.applyPixelRatio();
    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 80), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resize, { passive: true });
    }
  }

  /** Keep the shadow frustum tight around whatever the player is touching. */
  focusShadow(target: THREE.Vector3) {
    this.sun.position.copy(this.sunDir).multiplyScalar(20).add(target);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
  }

  private applyPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Cap total fragments so a 3x phone screen does not melt.
    const budget = 2.35e6;
    const wanted = Math.min(dpr, perf.pixelRatioCap);
    const px = w * h * wanted * wanted;
    this.renderScale = px > budget ? Math.sqrt(budget / px) : 1;
    this.renderer.setPixelRatio(clamp(wanted * this.renderScale, Math.min(1, perf.pixelRatioCap), perf.pixelRatioCap));
  }

  resize = () => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.applyPixelRatio();
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewport = { width: w, height: h, portrait: h >= w, aspect: w / h };
    for (const cb of this.resizeCbs) cb(this.viewport);
  };

  onUpdate(fn: (dt: number, elapsed: number) => void) {
    this.updaters.push(fn);
  }

  onResize(fn: (v: Viewport) => void) {
    this.resizeCbs.push(fn);
    fn(this.viewport);
  }

  /** Rolling average FPS, used only to decide whether to shed quality. */
  fps = 60;

  private manual = false;

  /** One simulation step. `render` is false when only state matters. */
  tick(dt: number, render = true) {
    const step = Math.min(dt, this.maxDt);
    this.elapsed += step;
    for (const fn of this.updaters) fn(step, this.elapsed);
    if (render) this.renderer.render(this.scene, this.camera);
  }

  /**
   * Hands the clock to the caller. Used by the automated play-through so a
   * software renderer's frame rate cannot change what the game does.
   */
  setManual(v: boolean) {
    this.manual = v;
    if (v) cancelAnimationFrame(this.raf);
    else {
      this.clock.getDelta();
      this.start();
    }
  }

  start() {
    const loop = () => {
      if (this.manual) return;
      this.raf = requestAnimationFrame(loop);
      const raw = this.clock.getDelta();
      this.fpsAccum += raw;
      this.fpsFrames++;
      if (this.fpsAccum > 1) {
        this.fps = this.fpsFrames / this.fpsAccum;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }
      this.tick(raw);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
