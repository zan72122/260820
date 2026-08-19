import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Config, maxPixelRatio } from './config';
import { clamp } from '../util/math';

export interface Viewport {
  width: number;
  height: number;
  portrait: boolean;
  aspect: number;
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly viewport: Viewport = { width: 1, height: 1, portrait: false, aspect: 1 };

  private pmrem: THREE.PMREMGenerator;
  private ratio: number;
  private frameTimes: number[] = [];
  private lastAdapt = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: !Config.fast,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.98;
    this.gl.shadowMap.enabled = !Config.fast;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.ratio = Config.fast || Config.lowres ? 0.5 : clamp(window.devicePixelRatio || 1, 1, maxPixelRatio());
    this.gl.setPixelRatio(this.ratio);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.012, 24);
    this.scene.background = new THREE.Color(0x2b2621);

    // One generated indoor environment gives the stainless something to reflect
    // without shipping an HDR file. Image based lighting is the most expensive
    // thing in the shader, so the software-rendered test profile drops it.
    this.pmrem = new THREE.PMREMGenerator(this.gl);
    if (!Config.fast) {
      const env = this.pmrem.fromScene(new RoomEnvironment(), 0.06);
      this.scene.environment = env.texture;
      this.scene.environmentIntensity = 0.6;
    }

    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.viewport.width = w;
    this.viewport.height = h;
    this.viewport.aspect = w / h;
    this.viewport.portrait = h >= w;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps the frame budget by trimming resolution rather than dropping features. */
  adapt(dt: number, now: number) {
    if (Config.fast || Config.lowres) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (now - this.lastAdapt < 2000 || this.frameTimes.length < 45) return;
    this.lastAdapt = now;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const cap = clamp(window.devicePixelRatio || 1, 1, maxPixelRatio());
    let next = this.ratio;
    if (median > 1 / 45) next = Math.max(0.75, this.ratio - 0.25);
    else if (median < 1 / 58) next = Math.min(cap, this.ratio + 0.25);
    if (Math.abs(next - this.ratio) > 0.01) {
      this.ratio = next;
      this.gl.setPixelRatio(next);
      this.gl.setSize(this.viewport.width, this.viewport.height, false);
    }
  }

  get pixelRatio() {
    return this.ratio;
  }

  render() {
    this.gl.render(this.scene, this.camera);
  }
}
