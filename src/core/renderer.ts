import * as THREE from 'three';
import { clamp } from './util';
import { settings, type QualityTier } from './settings';

export interface Viewport {
  width: number;
  height: number;
  aspect: number;
  portrait: boolean;
  /** Shortest CSS pixel edge; used to size touch affordances. */
  minEdge: number;
}

/**
 * Owns the WebGL2 renderer, the resolution policy and the adaptive quality tier.
 *
 * The device pixel ratio is never used unclamped: a hard cap is combined with a
 * dynamic render scale that reacts to measured frame time, which is what keeps a
 * weaker phone above 30fps instead of dropping to a slideshow.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  viewport: Viewport = { width: 1, height: 1, aspect: 1, portrait: true, minEdge: 1 };

  tier: QualityTier = 2;
  onTierChange: ((tier: QualityTier) => void) | null = null;
  onResize: ((v: Viewport) => void) | null = null;

  private dprCap: number;
  private renderScale = 1;
  private targetScale = 1;
  private frameTimes: number[] = [];
  private lastAdjust = 0;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !settings.fast,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.setClearColor(0x0a1c2a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = false;

    this.dprCap = settings.fast ? 1 : 2;
    this.tier = settings.fast ? 1 : 2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.05, 260);

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resize);
    }
  }

  private resize = (): void => {
    const w = Math.max(1, Math.round(this.canvas.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(this.canvas.clientHeight || window.innerHeight));
    this.viewport = {
      width: w,
      height: h,
      aspect: w / h,
      portrait: h >= w,
      minEdge: Math.min(w, h),
    };
    const dpr = clamp(window.devicePixelRatio || 1, 1, this.dprCap) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.viewport.aspect;
    this.camera.updateProjectionMatrix();
    this.onResize?.(this.viewport);
  };

  /** Public so the app can re-run framing after a layout-affecting change. */
  refresh(): void {
    this.resize();
  }

  /** Feeds one measured frame into the adaptive resolution controller. */
  sample(dtMs: number, nowMs: number): void {
    if (settings.fast) return;
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (this.frameTimes.length < 60 || nowMs - this.lastAdjust < 1800) return;

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.lastAdjust = nowMs;

    if (median > 22 && this.targetScale > 0.62) {
      this.targetScale = Math.max(0.62, this.targetScale - 0.16);
      this.applyScale();
      if (this.tier > 0) this.setTier((this.tier - 1) as QualityTier);
    } else if (median > 26 && this.tier > 0) {
      this.setTier((this.tier - 1) as QualityTier);
    } else if (median < 15 && this.targetScale < 1) {
      this.targetScale = Math.min(1, this.targetScale + 0.12);
      this.applyScale();
    } else if (median < 14 && this.tier < 2) {
      this.setTier((this.tier + 1) as QualityTier);
    }
  }

  private applyScale(): void {
    this.renderScale = this.targetScale;
    const dpr = clamp(window.devicePixelRatio || 1, 1, this.dprCap) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.viewport.width, this.viewport.height, false);
  }

  private setTier(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.onTierChange?.(tier);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
