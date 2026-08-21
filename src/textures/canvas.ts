import * as THREE from 'three';

export interface Ctx2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function makeCanvas(w: number, h: number): Ctx2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  return { canvas, ctx, w, h };
}

export function colorTexture(c: Ctx2D): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** roughness等の線形データ用テクスチャ */
export function dataTexture(c: Ctx2D): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c.canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** h∈[0,360], s,l∈[0,1] → css色 */
export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h.toFixed(1)},${(s * 100).toFixed(1)}%,${(l * 100).toFixed(1)}%,${a})`;
}

/** グレースケール値 v∈[0,1] → css色 */
export function gray(v: number, a = 1): string {
  const g = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255);
  return `rgba(${g},${g},${g},${a})`;
}
