import * as THREE from 'three';

/**
 * A hand-painted HDR studio: one big soft box on the left-front, a cool window
 * behind, a warm bounce card on the right and a dark floor. Mirror glaze only
 * reads as a mirror when the environment has large, clean light/dark shapes —
 * so this is authored, not noise.
 */
function shape(
  dir: THREE.Vector3,
  azDeg: number,
  elDeg: number,
  wDeg: number,
  hDeg: number,
  soft: number
) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const c = new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az)
  );
  // angular offsets in a local frame
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(c, up).normalize();
  const top = new THREE.Vector3().crossVectors(right, c).normalize();
  const dx = (Math.asin(THREE.MathUtils.clamp(dir.dot(right), -1, 1)) * 180) / Math.PI;
  const dy = (Math.asin(THREE.MathUtils.clamp(dir.dot(top), -1, 1)) * 180) / Math.PI;
  if (dir.dot(c) < 0) return 0;
  const fx = 1 - THREE.MathUtils.smoothstep(Math.abs(dx), wDeg * (1 - soft), wDeg);
  const fy = 1 - THREE.MathUtils.smoothstep(Math.abs(dy), hDeg * (1 - soft), hDeg);
  return fx * fy;
}

export function buildStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const W = 256;
  const H = 128;
  const data = new Float32Array(W * H * 4);
  const dir = new THREE.Vector3();

  for (let j = 0; j < H; j++) {
    const el = ((j + 0.5) / H - 0.5) * Math.PI; // -PI/2 .. PI/2
    const ce = Math.cos(el);
    const sy = Math.sin(el);
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2;
      dir.set(ce * Math.cos(phi), sy, ce * Math.sin(phi));

      let r = 0;
      let g = 0;
      let b = 0;

      // ambient sky/ceiling gradient
      const upness = THREE.MathUtils.smoothstep(dir.y, -0.35, 0.9);
      r += 0.045 + upness * 0.26;
      g += 0.043 + upness * 0.27;
      b += 0.042 + upness * 0.30;

      // dark bench / floor below
      const down = THREE.MathUtils.smoothstep(-dir.y, 0.15, 0.75);
      r += down * 0.055;
      g += down * 0.046;
      b += down * 0.040;

      // key soft box, left-front and high — small and hot so it reads as a
      // crisp reflection in the glaze rather than a wash
      const key = shape(dir, -58, 44, 21, 14, 0.32);
      r += key * 30.0;
      g += key * 29.0;
      b += key * 27.0;

      // long strip light overhead: draws a clean streak across the dome
      const strip = shape(dir, 16, 64, 62, 3.5, 0.4);
      r += strip * 9.0;
      g += strip * 8.8;
      b += strip * 8.4;

      // small practical to the right
      const pract = shape(dir, 76, 26, 9, 7, 0.4);
      r += pract * 7.0;
      g += pract * 5.6;
      b += pract * 4.2;

      // its spill
      const keySpill = shape(dir, -58, 44, 70, 55, 0.95);
      r += keySpill * 0.75;
      g += keySpill * 0.73;
      b += keySpill * 0.7;

      // cool window behind
      const win = shape(dir, 132, 22, 42, 30, 0.7);
      r += win * 1.5;
      g += win * 1.85;
      b += win * 2.5;

      // warm room bounce, right side, low
      const warm = shape(dir, 46, 6, 55, 34, 0.95);
      r += warm * 0.62;
      g += warm * 0.42;
      b += warm * 0.26;

      // narrow dark band right at the horizon behind the set: gives the glaze
      // a crisp horizon line to reflect
      const band = 1 - THREE.MathUtils.smoothstep(Math.abs(dir.y), 0.02, 0.14);
      const behind = THREE.MathUtils.smoothstep(Math.cos(phi - Math.PI), 0.1, 0.9);
      const dark = band * behind * 0.75;
      r *= 1 - dark * 0.7;
      g *= 1 - dark * 0.7;
      b *= 1 - dark * 0.68;

      const o = (j * W + i) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 1;
    }
  }

  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);

  const tex = new THREE.DataTexture(half, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return rt.texture;
}
