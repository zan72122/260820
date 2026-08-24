import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { flags } from '../core/runtimeFlags';

export function createRenderer(container: HTMLElement): WebGLRenderer {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !flags.fast,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = !flags.fast;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x1a1712, 1);
  return renderer;
}
