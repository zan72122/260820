import { makeRng } from './math';

/** タイル可能な値ノイズ。テクスチャは全て手続き生成し、外部アセットを持たない。 */
export function makeValueNoise(size: number, seed: number): (x: number, y: number) => number {
  const rng = makeRng(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (x: number, y: number): number => g[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  lac = 2,
  gain = 0.5,
): number {
  let amp = 1;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** 高さ場から法線マップ画像データを作る。 */
export function heightToNormal(
  height: Float32Array,
  w: number,
  h: number,
  strength: number,
): ImageData {
  const img = new ImageData(w, h);
  const at = (x: number, y: number): number =>
    height[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  return img;
}
