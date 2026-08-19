import * as THREE from 'three';
import { isIOS, isMobile } from './util';

export interface Quality {
  /** true on weaker devices: smaller sim grid, fewer segments, smaller shadow map */
  low: boolean;
  maxPixelRatio: number;
  shadowSize: number;
  fieldW: number;
  fieldH: number;
}

export function pickQuality(): Quality {
  const mobile = isMobile();
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const weak = mobile && (mem <= 3 || cores <= 4);
  return {
    low: weak,
    maxPixelRatio: weak ? 1.35 : mobile ? 2.0 : Math.min(window.devicePixelRatio || 1, 2),
    shadowSize: weak ? 512 : 1024,
    fieldW: weak ? 160 : 224,
    fieldH: weak ? 112 : 160,
  };
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly quality: Quality;

  private pixelRatio: number;
  private frameAcc = 0;
  private frameCount = 0;
  private adaptAcc = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.quality = pickQuality();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.quality.low,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      // iOS Safari can lose the drawing buffer on rotation without this
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isIOS()
      ? THREE.PCFShadowMap
      : THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0f0e10, 1);

    this.pixelRatio = this.quality.maxPixelRatio;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 12);
    this.scene.fog = new THREE.FogExp2(0x5b5560, 0.42);
    this.resize();
  }

  get aspect() {
    return this.camera.aspect;
  }

  get portrait() {
    return this.camera.aspect < 1;
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the frame budget: nudge the pixel ratio instead of dropping features. */
  adapt(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    this.adaptAcc += dt;
    if (this.adaptAcc < 1.2) return;
    const avg = this.frameAcc / Math.max(1, this.frameCount);
    this.frameAcc = 0;
    this.frameCount = 0;
    this.adaptAcc = 0;
    const min = 0.75;
    if (avg > 0.023 && this.pixelRatio > min) {
      this.pixelRatio = Math.max(min, this.pixelRatio - 0.2);
      this.resize();
    } else if (avg < 0.0135 && this.pixelRatio < this.quality.maxPixelRatio) {
      this.pixelRatio = Math.min(this.quality.maxPixelRatio, this.pixelRatio + 0.12);
      this.resize();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
