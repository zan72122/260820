import * as THREE from 'three';
import { pickQuality, isFastMode, type QualityProfile } from './tuning';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  onContextLost: () => void;
  onContextRestored: () => void;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  quality: QualityProfile;
  /** true when the display is taller than it is wide */
  portrait: boolean;
  width: number;
  height: number;
  resize: () => void;
  dispose: () => void;
}

/** WebGPU is used only as a "this device has headroom" signal — the render path
 *  stays WebGL 2 so every feature works on mobile Safari. */
function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function createStage(opts: StageOptions): Stage {
  const { canvas } = opts;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isFastMode(),
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    // Keeps a rotate/resize from flashing an empty buffer on iOS.
    preserveDrawingBuffer: false,
  });

  const gl = renderer.getContext();
  const quality = pickQuality(gl);
  if (hasWebGPU() && !isFastMode()) {
    quality.maskSize = Math.max(quality.maskSize, 512);
    quality.flameExtras = true;
    quality.backdropDetail = 2;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping =
    (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ??
    THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0d0b0d, 1);
  renderer.info.autoReset = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14100f);
  scene.fog = new THREE.Fog(0x161113, 6.0, 20.0);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
  camera.position.set(2.0, 4.2, 4.2);
  camera.lookAt(0, 0.85, 0);

  const state = { portrait: true, width: 1, height: 1 };

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    state.portrait = h >= w;
    state.width = w;
    state.height = h;
    // Portrait phones need a wider vertical field so the torch can sit low and
    // the cake can sit high without either leaving the frame.
    camera.fov = state.portrait ? 62 : 40;
    camera.updateProjectionMatrix();
  };
  resize();

  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onContextLost();
  };
  const onRestored = () => opts.onContextRestored();
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  return {
    renderer,
    scene,
    camera,
    quality,
    get portrait() {
      return state.portrait;
    },
    get width() {
      return state.width;
    },
    get height() {
      return state.height;
    },
    resize,
    dispose: () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      renderer.dispose();
    },
  };
}
