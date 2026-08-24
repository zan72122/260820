import type { WebGLRenderer } from 'three';
import type { Lighting } from '../scene/Lighting';

export type QualityLevel = 'high' | 'medium' | 'low';

/**
 * Keeps the frame rate honest on a phone without letting the material
 * distinctions go: the pixel ratio and the shadow budget move first, and the close-up
 * material response (metal vs rubber vs synthetic skin) is the last thing
 * anything is allowed to touch.
 */
export class AdaptiveQuality {
  level: QualityLevel = 'high';
  private samples: number[] = [];
  private cooldown = 2.5;
  private maxDpr: number;
  private currentDpr: number;
  private onChange?: (level: QualityLevel) => void;

  constructor(
    private renderer: WebGLRenderer,
    private lighting: Lighting,
  ) {
    const dpr = window.devicePixelRatio || 1;
    // Above 2x there is nothing left to see on a phone, only heat.
    this.maxDpr = Math.min(dpr, 2);
    this.currentDpr = this.maxDpr;
    this.renderer.setPixelRatio(this.currentDpr);
    this.lighting.setQuality('high');
  }

  setOnChange(fn: (level: QualityLevel) => void): void {
    this.onChange = fn;
  }

  getPixelRatio(): number {
    return this.currentDpr;
  }

  update(dt: number): void {
    if (dt <= 0 || dt > 0.5) return;
    this.samples.push(1 / dt);
    if (this.samples.length > 90) this.samples.shift();
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.samples.length < 60) return;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.cooldown = 3.0;

    if (median < 45 && this.level !== 'low') {
      this.step(this.level === 'high' ? 'medium' : 'low');
    } else if (median > 58 && this.level !== 'high' && this.currentDpr < this.maxDpr) {
      this.step(this.level === 'low' ? 'medium' : 'high');
    }
  }

  private step(level: QualityLevel): void {
    this.level = level;
    this.currentDpr =
      level === 'high'
        ? this.maxDpr
        : level === 'medium'
          ? Math.min(this.maxDpr, 1.4)
          : Math.min(this.maxDpr, 1.05);
    this.renderer.setPixelRatio(this.currentDpr);
    this.lighting.setQuality(level);
    this.samples.length = 0;
    this.onChange?.(level);
  }
}
