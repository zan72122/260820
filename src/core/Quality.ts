import * as THREE from 'three';

export interface QualitySettings {
  particleScale: number;
  farProps: boolean;
  shadowSize: number;
  renderScale: number;
}

const STAGES: QualitySettings[] = [
  { particleScale: 1.0, farProps: true, shadowSize: 2048, renderScale: 1.0 },
  { particleScale: 0.55, farProps: true, shadowSize: 2048, renderScale: 1.0 },
  { particleScale: 0.32, farProps: false, shadowSize: 1024, renderScale: 1.0 },
  { particleScale: 0.32, farProps: false, shadowSize: 1024, renderScale: 0.82 },
  { particleScale: 0.22, farProps: false, shadowSize: 512, renderScale: 0.66 },
];

/**
 * Load shedding in a fixed order: particles, then distant props, then shadow
 * resolution, then render scale. The water/suction causality, the pipe reveal
 * and the hose weight are never what gets cut.
 */
export class Quality {
  stage = 0;
  /** Geometry detail decided once at build time: 0 low, 1 mid, 2 high. */
  readonly level: number;
  private samples: number[] = [];
  private cooldown = 2.5;
  private onChange: (s: QualitySettings) => void;

  constructor(renderer: THREE.WebGLRenderer, onChange: (s: QualitySettings) => void) {
    this.onChange = onChange;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(window.innerWidth, window.innerHeight) * dpr;
    const gl = renderer.getContext();
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.level = maxTex >= 8192 && px >= 1300 ? 2 : maxTex >= 4096 ? 1 : 0;
    this.stage = px > 2400 ? 1 : 0;
    if (this.level === 0) this.stage = Math.max(this.stage, 2);
  }

  get settings(): QualitySettings {
    return STAGES[Math.min(this.stage, STAGES.length - 1)];
  }

  apply() {
    this.onChange(this.settings);
  }

  update(dt: number) {
    this.cooldown -= dt;
    this.samples.push(dt);
    if (this.samples.length > 60) this.samples.shift();
    if (this.cooldown > 0 || this.samples.length < 45) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const fps = 1 / Math.max(median, 1e-4);
    if (fps < 27 && this.stage < STAGES.length - 1) {
      this.stage++;
      this.cooldown = 3.0;
      this.apply();
    } else if (fps > 55 && this.stage > 0) {
      this.stage--;
      this.cooldown = 6.0;
      this.apply();
    }
  }
}
