import { clamp, fbm, smoothstep } from '../core/util';

export interface Stone {
  u: number; // 0..1 across grid X
  v: number; // 0..1 along grid Z
  r: number; // radius in world units
  rot: number;
}

export interface Layout {
  id: number;
  height: Float32Array;
  /** grid-space position of the sluice notch centre */
  gateU: number;
  gateV: number;
  gateHalfCells: number;
  /** row just upstream of the dam, inside the reservoir */
  resRow: number;
  /** first row of the dam band, where water enters the notch */
  notchRow: number;
  sillY: number;
  crestY: number;
  reservoirFloor: number;
  reservoirSurface: number;
  hollowU: number;
  hollowV: number;
  pondU: number;
  pondV: number;
  pondRU: number;
  pondRV: number;
  stones: Stone[];
}

/* A long, narrow sandbox: the same footprint reads as a channel in portrait
   and as a cross-section in landscape, and it actually fills a phone screen. */
export const NX = 72;
export const NZ = 153;
export const WORLD_W = 4.2;
export const WORLD_D = 9.0;
export const CELL = WORLD_W / (NX - 1);
export const FLOOR_Y = -0.4;

export const gridToWorldX = (x: number) => (x / (NX - 1) - 0.5) * WORLD_W;
export const gridToWorldZ = (z: number) => (z / (NZ - 1) - 0.5) * WORLD_D;
export const worldToGridX = (wx: number) => (wx / WORLD_W + 0.5) * (NX - 1);
export const worldToGridZ = (wz: number) => (wz / WORLD_D + 0.5) * (NZ - 1);

const DAM_V0 = 0.176;
const DAM_V1 = 0.243;
const RES_FLOOR = -0.2;
const RES_SURFACE = 0.06;
const SILL_Y = -0.09;
const CREST_Y = 0.26;

function basin(u: number, v: number, cu: number, cv: number, ru: number, rv: number) {
  const d = Math.hypot((u - cu) / ru, (v - cv) / rv);
  return 1 - smoothstep(0.62, 1.0, d);
}

function segDist(u: number, v: number, au: number, av: number, bu: number, bv: number) {
  const dx = bu - au;
  const dy = bv - av;
  const l2 = dx * dx + dy * dy || 1e-6;
  const t = clamp(((u - au) * dx + (v - av) * dy) / l2, 0, 1);
  return Math.hypot(u - (au + dx * t), v - (av + dy * t));
}

export function buildLayout(id: number): Layout {
  const h = new Float32Array(NX * NZ);

  const gateU = id === 1 ? 0.37 : 0.5;
  const gateV = (DAM_V0 + DAM_V1) * 0.5;
  const hollowU = gateU + (id === 1 ? 0.09 : 0.0);
  const hollowV = 0.375;
  const pondU = id === 1 ? 0.6 : 0.5;
  const pondV = 0.878;
  const pondRU = 0.3;
  const pondRV = 0.082;
  const seed = 1000 + id * 977;

  for (let z = 0; z < NZ; z++) {
    const v = z / (NZ - 1);
    for (let x = 0; x < NX; x++) {
      const u = x / (NX - 1);
      const i = z * NX + x;

      // A gentle, steady fall from the dam to the far end.
      let y = 0.05 - smoothstep(DAM_V1, 0.94, v) * 0.125;

      const n = fbm(u * 4.4, v * 7.4, 4, seed) - 0.5;
      const n2 = fbm(u * 11.0, v * 17.0, 3, seed + 7) - 0.5;
      y += n * 0.05 + n2 * 0.015;

      // Raised lip so the sandbox holds its own water.
      const border = Math.min(u, 1 - u, v, 1 - v);
      y += smoothstep(0.05, 0.0, border) * 0.15;

      // Upper reservoir: a flat pool reaching right up to the dam.
      const resV = smoothstep(0.022, 0.06, v) * smoothstep(DAM_V0 + 0.004, DAM_V0 - 0.03, v);
      const resU = smoothstep(0.035, 0.13, u) * smoothstep(0.965, 0.87, u);
      const res = resV * resU;
      y = y * (1 - res) + RES_FLOOR * res;

      // Dam wall, near vertical faces so the notch is unambiguous.
      const dam =
        smoothstep(DAM_V0 - 0.009, DAM_V0 + 0.003, v) * smoothstep(DAM_V1 + 0.009, DAM_V1 - 0.003, v);
      y = Math.max(y, CREST_Y * dam + y * (1 - dam));

      // Sluice notch cut clean through the wall.
      const notch = smoothstep(0.085, 0.058, Math.abs(u - gateU)) * dam;
      y = y * (1 - notch) + SILL_Y * notch;

      // The short groove that already exists, and stops halfway.
      const gd = segDist(u, v, gateU, DAM_V1 - 0.004, hollowU, hollowV - 0.02);
      const groove = smoothstep(0.07, 0.028, gd) * smoothstep(DAM_V1 - 0.012, DAM_V1 + 0.004, v);
      const grooveY = SILL_Y - 0.015 - (v - DAM_V1) * 0.12;
      y = y * (1 - groove) + grooveY * groove;

      // The first hollow the groove empties into.
      const hollow = basin(u, v, hollowU, hollowV, 0.115, 0.038);
      y = y * (1 - hollow) + -0.15 * hollow;

      // Downstream pond, dry and waiting for water.
      const pond = basin(u, v, pondU, pondV, pondRU, pondRV) * 1.0;
      y = y * (1 - pond) + -0.3 * pond;

      if (id === 0) {
        // A low ridge with one weak, off-centre saddle.
        // A bank across the sand with one deliberately weak, off-centre spot.
        const ridge = smoothstep(0.052, 0.0, Math.abs(v - 0.63));
        const saddle = smoothstep(0.22, 0.05, Math.abs(u - 0.7));
        y += ridge * (0.075 - saddle * 0.068);
      } else if (id === 1) {
        // Two shelves: the flow splits if the child lets it.
        const b1 = smoothstep(0.05, 0.0, segDist(u, v, 0.14, 0.5, 0.66, 0.57));
        const b2 = smoothstep(0.05, 0.0, segDist(u, v, 0.9, 0.49, 0.46, 0.71));
        y += (b1 + b2) * 0.082;
      } else {
        // Open plain: nothing but sand to shape.
        y += smoothstep(0.55, 0.0, Math.abs(v - 0.55)) * 0.012;
      }

      h[i] = clamp(y, FLOOR_Y + 0.01, 0.42);
    }
  }

  const stones: Stone[] =
    id === 2
      ? [{ u: 0.22, v: 0.72, r: 0.15, rot: 0.7 }]
      : [
          { u: 0.3, v: 0.5, r: 0.19, rot: 0.4 },
          { u: 0.74, v: 0.71, r: 0.14, rot: 1.9 },
          { u: 0.58, v: 0.45, r: 0.1, rot: 2.7 },
        ];

  return {
    id,
    height: h,
    gateU,
    gateV,
    gateHalfCells: 4,
    resRow: Math.round((DAM_V0 - 0.038) * (NZ - 1)),
    notchRow: Math.round((DAM_V0 + 0.008) * (NZ - 1)),
    sillY: SILL_Y,
    crestY: CREST_Y,
    reservoirFloor: RES_FLOOR,
    reservoirSurface: RES_SURFACE,
    hollowU,
    hollowV,
    pondU,
    pondV,
    pondRU,
    pondRV,
    stones,
  };
}
