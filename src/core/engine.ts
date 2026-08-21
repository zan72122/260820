import * as THREE from 'three';
import type { Flags } from '../util/flags';

export const FIXED_DT = 1 / 120;

/**
 * レンダラと時間管理。描画は可変フレームレート、シミュレーションは固定Δt。
 * fast モード（E2E）では自動シミュレーションを止め、テストが advance() で
 * 論理時間を直接進める。描画結果は同じワールド状態を映すだけ。
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly flags: Flags;

  /** 固定Δtで呼ばれる。物理・ゲームロジック用 */
  onFixedStep: (dt: number) => void = () => {};
  /** 毎描画フレームで呼ばれる。カメラ補間・HUD用 */
  onFrame: (frameDt: number) => void = () => {};

  private accumulator = 0;
  private lastTime = -1;
  private container: HTMLElement;

  constructor(container: HTMLElement, flags: Flags) {
    this.flags = flags;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !flags.fast,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(flags.fast ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !flags.fast;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 120);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const scale = this.flags.fast ? 0.5 : 1;
    this.renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 論理時間を dt 秒ぶん、固定Δt刻みで進める（決定論） */
  advance(dt: number): void {
    let remaining = dt;
    while (remaining > 1e-9) {
      this.onFixedStep(FIXED_DT);
      remaining -= FIXED_DT;
    }
  }

  start(): void {
    this.renderer.setAnimationLoop((timeMs) => {
      const t = timeMs / 1000;
      if (this.lastTime < 0) this.lastTime = t;
      const frameDt = Math.min(t - this.lastTime, 0.25);
      this.lastTime = t;

      if (!this.flags.fast) {
        this.accumulator += frameDt;
        while (this.accumulator >= FIXED_DT) {
          this.onFixedStep(FIXED_DT);
          this.accumulator -= FIXED_DT;
        }
      }
      this.onFrame(frameDt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
