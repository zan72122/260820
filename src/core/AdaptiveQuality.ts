import * as THREE from 'three';
import { clamp } from './Rng';

export interface QualitySettings {
  dpr: number;
  shadows: boolean;
  shadowSize: number;
  foamParticles: number;
  droplets: number;
  jetRings: number;
  jetSegments: number;
  jetSleeve: boolean;
  caustics: boolean;
  secondFilmLayer: boolean;
  reduceMotion: boolean;
}

const TIERS: QualitySettings[] = [
  {
    dpr: 1,
    shadows: false,
    shadowSize: 512,
    foamParticles: 60,
    droplets: 16,
    jetRings: 6,
    jetSegments: 6,
    jetSleeve: false,
    caustics: false,
    secondFilmLayer: false,
    reduceMotion: false,
  },
  {
    dpr: 1.25,
    shadows: true,
    shadowSize: 1024,
    foamParticles: 150,
    droplets: 36,
    jetRings: 8,
    jetSegments: 8,
    jetSleeve: true,
    caustics: false,
    secondFilmLayer: true,
    reduceMotion: false,
  },
  {
    dpr: 1.75,
    shadows: true,
    shadowSize: 2048,
    foamParticles: 260,
    droplets: 64,
    jetRings: 11,
    jetSegments: 10,
    jetSleeve: true,
    caustics: true,
    secondFilmLayer: true,
    reduceMotion: false,
  },
];

/**
 * Keeps the frame rate honest on a phone: device pixel ratio first, then
 * shadows, then the extras. Particle counts and jet tessellation are chosen
 * once at start-up; everything else can move while the game runs.
 */
export class AdaptiveQuality {
  private tier: number;
  private readonly ceiling: number;
  private frames = 0;
  private accum = 0;
  private goodTime = 0;
  private settings: QualitySettings;
  onChange: ((s: QualitySettings) => void) | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    fastMode: boolean,
  ) {
    const dpr = window.devicePixelRatio || 1;
    const cores = navigator.hardwareConcurrency ?? 4;
    const hasWebGPU = 'gpu' in navigator;
    let start = 1;
    if (fastMode) start = 0;
    else if (cores >= 6 && dpr >= 2 && hasWebGPU) start = 2;
    else if (cores >= 6 && dpr >= 2) start = 2;
    else if (cores <= 3) start = 0;

    this.tier = start;
    this.ceiling = start;
    this.settings = { ...TIERS[start] };
    if (fastMode) {
      // Software rendering in the test harness: keep everything deterministic
      // and cheap, and never judge motion quality from it.
      this.settings.reduceMotion = true;
      this.settings.dpr = 1;
    }
    this.applyDpr();
  }

  get current(): QualitySettings {
    return this.settings;
  }

  private applyDpr(): void {
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, this.settings.dpr), 0.75, 2);
    this.renderer.setPixelRatio(dpr);
  }

  private setTier(tier: number): void {
    const next = clamp(tier, 0, this.ceiling);
    if (next === this.tier) return;
    this.tier = next;
    const reduce = this.settings.reduceMotion;
    this.settings = { ...TIERS[next], reduceMotion: reduce };
    this.applyDpr();
    this.onChange?.(this.settings);
  }

  update(dt: number): void {
    this.accum += dt;
    this.frames++;
    if (this.accum < 1.1) return;
    const avg = this.accum / this.frames;
    this.accum = 0;
    this.frames = 0;

    if (avg > 0.0215) {
      // Below ~46fps for a whole second: give something back.
      this.goodTime = 0;
      this.setTier(this.tier - 1);
    } else if (avg < 0.0142) {
      this.goodTime += 1.1;
      if (this.goodTime > 5 && this.tier < this.ceiling) {
        this.goodTime = 0;
        this.setTier(this.tier + 1);
      }
    } else {
      this.goodTime = 0;
    }
  }

  handleResize(): void {
    this.applyDpr();
  }
}
