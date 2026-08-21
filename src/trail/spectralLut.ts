import { DataTexture, LinearFilter, ClampToEdgeWrapping, RGBAFormat, UnsignedByteType, SRGBColorSpace } from 'three';

/** Multi-lobe Gaussian fit of the CIE 1931 colour matching functions (Wyman et al.). */
const g = (x: number, mu: number, s1: number, s2: number): number => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};

const xBar = (l: number): number =>
  1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
const yBar = (l: number): number => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
const zBar = (l: number): number => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);

/**
 * A continuous spectral look-up table, not seven equal stripes.
 *
 * The strip runs 395 nm -> 705 nm through the real colour matching functions and
 * out through the sRGB primaries, so the violet end stays dim and slightly blue-
 * purple, the green shoulder stays broad, and the red end rolls off — exactly how
 * dispersed sunlight in water droplets behaves.
 */
export function buildSpectralLut(width = 256): DataTexture {
  const data = new Uint8Array(width * 4);
  let peak = 0;
  const rgb = new Float32Array(width * 3);

  for (let i = 0; i < width; i++) {
    const l = 395 + (705 - 395) * (i / (width - 1));
    const X = xBar(l);
    const Y = yBar(l);
    const Z = zBar(l);

    // XYZ -> linear sRGB (D65)
    let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;

    // Desaturate out-of-gamut spectral colours instead of clipping them to walls.
    const minC = Math.min(r, gg, b);
    if (minC < 0) {
      r -= minC;
      gg -= minC;
      b -= minC;
    }
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = gg;
    rgb[i * 3 + 2] = b;
    peak = Math.max(peak, r, gg, b);
  }

  const inv = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < width; i++) {
    // Photopic weighting: the eye's own response is part of what a rainbow looks like.
    const l = 395 + (705 - 395) * (i / (width - 1));
    const lum = Math.max(0.0, yBar(l));
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, rgb[i * 3 + c] * inv);
      data[i * 4 + c] = Math.round(255 * Math.min(1, Math.pow(v, 1 / 2.2)));
    }
    // The violet and deep-red ends are dimmer than the middle, but they are not
    // absent: keep enough of them that the full order of the spectrum is visible.
    data[i * 4 + 3] = Math.round(255 * Math.min(1, 0.58 + 0.42 * lum));
  }

  const tex = new DataTexture(data, width, 1, RGBAFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
