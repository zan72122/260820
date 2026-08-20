import { clamp, fbm, smoothstep } from '../core/util';

export interface Stone {
  u: number; // 0..1 across grid X
  v: number; // 0..1 along grid Z
  r: number; // radius in world units
  rot: number;
  seed: number;
}

export interface Layout {
  id: number;
  height: Float32Array;
  /** grid-space position of the sluice notch centre */
  gateU: number;
  gateV: number;
  gateHalfCells: number;
  sillY: number;
  crestY: number;
  reservoirFloor: number;
  reservoirTargetDepth: number;
  pondU: number;
  pondV: number;
  pondRU: number;
  pondRV: number;
  pondFloor: number;
  stones: Stone[];
}

export const NX = 96;
export const NZ = 128;
export const WORLD_W = 6.0;
export const WORLD_D = 8.0;
export const CELL = WORLD_W / (NX - 1);
export const FLOOR_Y = -0.34;

export const gridToWorldX = (x: number) => (x / (NX - 1) - 0.5) * WORLD_W;
export const gridToWorldZ = (z: number) => (z / (NZ - 1) - 0.5) * WORLD_D;
export const worldToGridX = (wx: number) => (wx / WORLD_W + 0.5) * (NX - 1);
export const worldToGridZ = (wz: number) => (wz / WORLD_D + 0.5) * (NZ - 1);

const RES_V0 = 0.035;
const RES_V1 = 0.165;
const DAM_V0 = 0.165;
const DAM_V1 = 0.222;

/** Smooth elliptical basin carve. */
function basin(u: number, v: number, cu: number, cv: number, ru: number, rv: number) {
  const d = Math.hypot((u - cu) / ru, (v - cv) / rv);
  return 1 - smoothstep(0.55, 1.0, d);
}

/** Distance from a point to a segment, in normalised grid space. */
function segDist(u: number, v: number, au: number, av: number, bu: number, bv: number) {
  const dx = bu - au;
  const dy = bv - av;
  const l2 = dx * dx + dy * dy || 1e-6;
  const t = clamp(((u - au) * dx + (v - av) * dy) / l2, 0, 1);
  return Math.hypot(u - (au + dx * t), v - (av + dy * t));
}

export function buildLayout(id: number): Layout {
  const h = new Float32Array(NX * NZ);
  const crestY = 0.2;
  const sillY = -0.055;
  const reservoirFloor = -0.16;
  const pondFloor = -0.235;

  const gateU = id === 1 ? 0.36 : 0.5;
  const gateV = (DAM_V0 + DAM_V1) * 0.5;
  const pondU = id === 1 ? 0.62 : 0.5;
  const pondV = 0.885;
  const pondRU = 0.27;
  const pondRV = 0.085;

  const seed = 1000 + id * 977;

  for (let z = 0; z < NZ; z++) {
    const v = z / (NZ - 1);
    for (let x = 0; x < NX; x++) {
      const u = x / (NX - 1);
      const i = z * NX + x;

      // Gentle downstream fall so water has somewhere to want to go.
      let y = 0.045 - smoothstep(DAM_V1, 0.95, v) * 0.075;

      // Natural sand undulation.
      const n = fbm(u * 5.2, v * 6.6, 4, seed) - 0.5;
      const n2 = fbm(u * 13.0, v * 15.0, 3, seed + 7) - 0.5;
      y += n * 0.052 + n2 * 0.016;

      // Raised rim near the sandbox border so water stays in the box.
      const border = Math.min(u, 1 - u, v, 1 - v);
      y += smoothstep(0.075, 0.0, border) * 0.2;

      // Upper reservoir basin.
      const res = basin(u, v, 0.5, (RES_V0 + RES_V1) * 0.5, 0.42, (RES_V1 - RES_V0) * 0.72);
      y = y * (1 - res) + reservoirFloor * res;

      // Dam wall across the top.
      const dam = smoothstep(DAM_V0 - 0.012, DAM_V0 + 0.014, v) * smoothstep(DAM_V1 + 0.012, DAM_V1 - 0.014, v);
      y = Math.max(y, crestY * dam + y * (1 - dam));

      // Sluice notch cut through the wall.
      const notch = smoothstep(0.055, 0.018, Math.abs(u - gateU)) * dam;
      y = y * (1 - notch) + sillY * notch;

      // The short, already-dug groove that stops halfway.
      const gd = segDist(u, v, gateU, DAM_V1, gateU + (id === 1 ? 0.06 : 0.0), 0.335);
      const groove = smoothstep(0.052, 0.014, gd) * smoothstep(DAM_V1 - 0.005, DAM_V1 + 0.02, v);
      y = y * (1 - groove) + (sillY - 0.012) * groove;

      // First hollow the groove empties into.
      const hollow = basin(u, v, gateU + (id === 1 ? 0.07 : 0.0), 0.372, 0.085, 0.042);
      y = y * (1 - hollow) + -0.105 * hollow;

      // Downstream pond, still dry and waiting.
      const pond = basin(u, v, pondU, pondV, pondRU, pondRV);
      y = y * (1 - pond) + pondFloor * pond;

      if (id === 0) {
        // A low ridge with an off-centre saddle: water will find the weak spot.
        const ridge = smoothstep(0.048, 0.0, Math.abs(v - 0.63));
        const saddle = smoothstep(0.2, 0.06, Math.abs(u - 0.68));
        y += ridge * (0.105 - saddle * 0.055);
      } else if (id === 1) {
        // Two shallow shelves that split the flow if the child lets them.
        const b1 = smoothstep(0.042, 0.0, segDist(u, v, 0.18, 0.52, 0.62, 0.58));
        const b2 = smoothstep(0.042, 0.0, segDist(u, v, 0.86, 0.5, 0.5, 0.72));
        y += (b1 + b2) * 0.085;
      } else {
        // Open plain: nothing but sand to shape.
        y += smoothstep(0.6, 0.0, Math.abs(v - 0.55)) * 0.012;
      }

      h[i] = clamp(y, FLOOR_Y + 0.01, 0.42);
    }
  }

  const stones: Stone[] =
    id === 2
      ? [{ u: 0.2, v: 0.74, r: 0.2, rot: 0.7, seed: 3 }]
      : [
          { u: 0.3, v: 0.52, r: 0.26, rot: 0.4, seed: 1 },
          { u: 0.74, v: 0.72, r: 0.19, rot: 1.9, seed: 2 },
          { u: 0.58, v: 0.46, r: 0.14, rot: 2.7, seed: 5 },
        ];

  return {
    id,
    height: h,
    gateU,
    gateV,
    gateHalfCells: Math.round(0.05 * (NX - 1)),
    sillY,
    crestY,
    reservoirFloor,
    reservoirTargetDepth: 0.2,
    pondU,
    pondV,
    pondRU,
    pondRV,
    pondFloor,
    stones,
  };
}
