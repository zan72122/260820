import * as THREE from 'three';

/**
 * 端末負荷に応じた品質調整。
 * WebGL 2 で全機能が成立し、余裕がある場合のみ解像度と影を上げる。
 * E2E_FAST(?fast=1)では最低品質へ固定し決定性を上げる。
 */
export class AdaptiveQuality {
  private ema = 60;
  private timer = 0;
  tier: 'high' | 'low' = 'high';
  private forced: 'high' | 'low' | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private dirLight: THREE.DirectionalLight,
    fast: boolean,
  ) {
    if (fast) {
      this.forced = 'low';
      this.apply('low');
    } else {
      this.apply('high');
    }
  }

  private apply(tier: 'high' | 'low'): void {
    this.tier = tier;
    if (tier === 'high') {
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.dirLight.castShadow = true;
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.dirLight.castShadow = false;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  frame(dt: number): void {
    if (this.forced || dt <= 0) return;
    const fps = 1 / Math.max(1e-3, dt);
    this.ema += (fps - this.ema) * 0.05;
    this.timer += dt;
    if (this.timer > 4) {
      this.timer = 0;
      if (this.tier === 'high' && this.ema < 26) this.apply('low');
      else if (this.tier === 'low' && this.ema > 50) this.apply('high');
    }
  }
}
