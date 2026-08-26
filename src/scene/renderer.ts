import * as THREE from 'three';
import { caps } from './caps';
import { makeValueNoise, fbm } from '../util/noise';
import { clamp } from '../util/math';

export interface RendererHandle {
  renderer: THREE.WebGLRenderer;
  webgpu: boolean;
  label: string;
}

function configure(r: THREE.WebGLRenderer, dpr: number): void {
  r.setPixelRatio(dpr);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.94;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
}

/**
 * 既定は WebGL 2。`?renderer=webgpu` を付けたときだけ WebGPURenderer を試し、
 * 初期化に失敗すれば必ず WebGL 2 へ戻る。
 */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererHandle> {
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const wantGpu = new URLSearchParams(location.search).get('renderer') === 'webgpu';
  if (wantGpu && 'gpu' in navigator) {
    try {
      const mod = (await import('three/webgpu')) as unknown as {
        WebGPURenderer: new (p: Record<string, unknown>) => THREE.WebGLRenderer & { init(): Promise<void> };
      };
      const r = new mod.WebGPURenderer({ canvas, antialias: dpr < 2 });
      await r.init();
      caps.rawShaders = false;
      caps.backend = 'webgpu';
      configure(r, dpr);
      return { renderer: r, webgpu: true, label: 'WebGPU' };
    } catch (err) {
      console.warn('[shishi] WebGPU 初期化に失敗。WebGL 2 へ戻ります。', err);
    }
  }
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: dpr < 2,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  caps.rawShaders = true;
  caps.backend = 'webgl2';
  configure(r, dpr);
  return { renderer: r, webgpu: false, label: 'WebGL 2' };
}

/** 曇天後のやわらかい空。環境反射にだけ使う。 */
function skyTexture(): THREE.Texture {
  const w = 256;
  const h = 128;
  const img = new ImageData(w, h);
  const n = makeValueNoise(32, 5150);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = y / h;
      const cloud = fbm(n, (x / w) * 4, v * 4, 4);
      let r: number;
      let g: number;
      let b: number;
      if (v < 0.5) {
        const t = v / 0.5;
        r = 0.72 - t * 0.05 + cloud * 0.06;
        g = 0.76 - t * 0.03 + cloud * 0.06;
        b = 0.78 - t * 0.02 + cloud * 0.05;
      } else {
        const t = (v - 0.5) / 0.5;
        r = 0.34 - t * 0.14;
        g = 0.33 - t * 0.13;
        b = 0.28 - t * 0.11;
      }
      const i = (y * w + x) * 4;
      img.data[i] = r * 255;
      img.data[i + 1] = g * 255;
      img.data[i + 2] = b * 255;
      img.data[i + 3] = 255;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d')!.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const sky = skyTexture();
    const rt = pmrem.fromEquirectangular(sky);
    pmrem.dispose();
    sky.dispose();
    return rt.texture;
  } catch (err) {
    console.warn('[shishi] 環境マップ生成を省略しました。', err);
    return null;
  }
}
