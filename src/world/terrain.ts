import * as THREE from 'three';
import { clamp01, fbm, noise2, smoothstep, turbulence } from '../core/util';
import { soilTextures } from '../gfx/textures';
import { addSoilDetail } from '../gfx/soilDetail';

export const RIDGE_PERIOD = 0.98;
export const RIDGE_HEIGHT = 0.21;
export const RIDGE_HALF_W = 0.335;

/** Old workings the player did not make: the field has a history. */
export type Hole = { x: number; z: number; r: number; depth: number };

const holes: Hole[] = [
  { x: 0, z: 4.35, r: 0.42, depth: 0.2 },
  { x: -0.98, z: 1.1, r: 0.36, depth: 0.16 },
  { x: 0.98, z: 5.6, r: 0.3, depth: 0.13 },
];

/** Cross-section of a hilled row, plus the slow roll of the field itself. */
export function ridgeProfile(x: number) {
  const u = ((((x + RIDGE_PERIOD * 0.5) % RIDGE_PERIOD) + RIDGE_PERIOD) % RIDGE_PERIOD) - RIDGE_PERIOD * 0.5;
  const k = clamp01(Math.abs(u) / RIDGE_HALF_W);
  return RIDGE_HEIGHT * (0.5 + 0.5 * Math.cos(Math.PI * k)) * (k < 1 ? 1 : 0);
}

export function terrainHeight(x: number, z: number) {
  // rows run along +Z; the crown wanders a little so it never reads extruded
  const wander = (fbm(z * 0.09, 3.7, 2, 91) - 0.5) * 0.10;
  let h = ridgeProfile(x + wander);
  h += (fbm(x * 0.06 + 10, z * 0.05, 3, 3) - 0.5) * 0.20; // field undulation
  h += (fbm(x * 1.6, z * 1.6, 3, 21) - 0.5) * 0.042; // tilth
  h += (turbulence(x * 4.5, z * 4.5, 3, 47) - 0.5) * 0.018; // clods
  h += (noise2(x * 11, z * 11, 33) - 0.5) * 0.009; // grit
  for (const hole of holes) {
    const d = Math.hypot(x - hole.x, z - hole.z) / hole.r;
    if (d < 1.4) {
      h -= hole.depth * (1 - smoothstep(d / 1.15)) ;
      h += hole.depth * 0.28 * smoothstep((d - 0.85) * 2.2) * (1 - smoothstep((d - 1.0) * 2.4)); // spoil rim
    }
  }
  return h;
}

/** Sample spacing tightens near the play area and relaxes toward the horizon. */
function makeAxis(nearHalf: number, nearStep: number, growth: number, far: number) {
  const half: number[] = [];
  let v = 0;
  let step = nearStep;
  while (v < far) {
    half.push(v);
    if (v > nearHalf) step *= growth;
    v += step;
  }
  half.push(far);
  const out: number[] = [];
  for (let i = half.length - 1; i > 0; i--) out.push(-half[i]);
  for (let i = 0; i < half.length; i++) out.push(half[i]);
  return out;
}

export type Terrain = {
  mesh: THREE.Mesh;
  /** Open the soil under hill `i` so its own patch can be dug into. */
  openCut: (i: number) => void;
  /** Close it again once that hill is far behind the player. */
  closeCut: (i: number) => void;
};

/**
 * One static field mesh. Openings are punched only under hills that
 * actually have a soil patch covering them, otherwise a hole in the ground
 * would show the sky through the ridge.
 */
export function buildTerrain(cutouts: Array<{ x: number; z: number; r: number }> = []): Terrain {
  const xs = makeAxis(2.6, 0.075, 1.105, 62);
  const zs = makeAxis(3.2, 0.085, 1.1, 74);
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const col = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  const far = new THREE.Color(0.88, 0.86, 0.8);

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i];
      const z = zs[j];
      pos[k * 3] = x;
      pos[k * 3 + 1] = terrainHeight(x, z);
      pos[k * 3 + 2] = z;
      uv[k * 2] = x * 1.15;
      uv[k * 2 + 1] = z * 1.15;

      // furrows stay damp and dark; crowns dry out pale
      const rel = clamp01(ridgeProfile(x) / RIDGE_HEIGHT);
      const damp = 1 - rel;
      const patchy = fbm(x * 0.35 + 5, z * 0.35, 3, 63);
      const dry = clamp01(rel * 0.9 + patchy * 0.35);
      c.setRGB(
        0.62 + dry * 0.5 - damp * 0.16,
        0.60 + dry * 0.44 - damp * 0.16,
        0.58 + dry * 0.36 - damp * 0.14,
      );
      // distant rows lift in value: cheap aerial perspective on top of fog
      c.lerp(far, clamp01((Math.abs(z) - 14) / 40) * 0.35);
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
  }

  /** Which cutout, if any, swallows each quad. */
  const quadCut = new Int16Array((nx - 1) * (nz - 1)).fill(-1);
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) * 0.5;
      const cz = (zs[j] + zs[j + 1]) * 0.5;
      for (let n = 0; n < cutouts.length; n++) {
        const cut = cutouts[n];
        if ((cx - cut.x) * (cx - cut.x) + (cz - cut.z) * (cz - cut.z) < cut.r * cut.r) {
          quadCut[j * (nx - 1) + i] = n;
          break;
        }
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const open = new Set<number>();
  const rebuild = () => {
    const idx: number[] = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const cut = quadCut[j * (nx - 1) + i];
        if (cut >= 0 && open.has(cut)) continue;
        const a = j * nx + i;
        const b = a + 1;
        const cIdx = a + nx;
        const d = cIdx + 1;
        idx.push(a, cIdx, b, b, cIdx, d);
      }
    }
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  rebuild();

  const tex = soilTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    roughnessMap: tex.roughnessMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });
  addSoilDetail(mat);

  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  return {
    mesh,
    openCut: (i: number) => {
      if (i < 0 || i >= cutouts.length || open.has(i)) return;
      open.add(i);
      rebuild();
    },
    closeCut: (i: number) => {
      if (!open.delete(i)) return;
      rebuild();
    },
  };
}

export { holes as fieldHoles };
