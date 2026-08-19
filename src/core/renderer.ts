import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGPURenderer,
} from 'three/webgpu';
import type { RuntimeFlags } from './config';

export interface RendererBundle {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  backend: 'webgpu' | 'webgl2';
}

function freshCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  // A canvas can only ever hand out one context type, so a failed WebGPU
  // attempt has to be thrown away before we can ask for WebGL2.
  const next = document.createElement('canvas');
  next.id = old.id;
  next.className = old.className;
  old.replaceWith(next);
  return next;
}

/**
 * Creates a WebGPURenderer, which drives WebGPU where the browser has it
 * (Safari 26+ on iOS/iPadOS) and transparently falls back to its WebGL2
 * backend everywhere else. Both paths render the exact same scene graph, so
 * the headline moment never depends on which one we got.
 */
export async function createRenderer(
  canvasEl: HTMLCanvasElement,
  flags: RuntimeFlags,
): Promise<RendererBundle> {
  const hasWebGPU =
    typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as never as { gpu: unknown }).gpu;
  const wantWebGPU = hasWebGPU && !flags.forceWebGL;

  let canvas = canvasEl;
  let backend: 'webgpu' | 'webgl2' = wantWebGPU ? 'webgpu' : 'webgl2';

  const build = (forceWebGL: boolean, c: HTMLCanvasElement): WebGPURenderer =>
    new WebGPURenderer({
      canvas: c,
      antialias: !flags.fast,
      alpha: false,
      forceWebGL,
      powerPreference: 'high-performance',
    });

  let renderer = build(!wantWebGPU, canvas);
  try {
    await renderer.init();
  } catch (err) {
    console.warn('[butai] WebGPU init failed, falling back to WebGL2', err);
    try {
      renderer.dispose();
    } catch {
      /* ignore */
    }
    canvas = freshCanvas(canvas);
    backend = 'webgl2';
    renderer = build(true, canvas);
    await renderer.init();
  }

  if (backend === 'webgpu' && (renderer.backend as { isWebGLBackend?: boolean })?.isWebGLBackend) {
    backend = 'webgl2';
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x050305, 1);

  return { renderer, canvas, backend };
}
