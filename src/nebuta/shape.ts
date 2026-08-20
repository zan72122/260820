/**
 * The parametric definition of the goldfish-and-waves mini nebuta.
 *
 * One shape description drives everything: the bamboo/wood/wire frame is built by sampling
 * these surfaces along rings and ribs, and the paper panels are patches of the very same
 * surfaces offset a couple of millimetres outward. That is why the paper lands exactly on
 * the frame, and why the frame reads through the paper in the right places.
 *
 * Design is original: a round-bellied fantail goldfish riding two curling waves. It copies
 * no existing nebuta, character or artwork.
 */

import { Vector3 } from 'three';
import { clamp, smoothstep } from '../util/math';

export const NEBUTA = {
  /** Height of the cart deck the whole sculpture stands on. */
  deckY: 0.42,
  bodyNoseX: 0.74,
  bodyTailX: -0.34,
};

/* --------------------------------------------------------------- body profile */

function keyed(u: number, keys: readonly [number, number][]): number {
  const t = clamp(u, 0, 1);
  for (let i = 0; i < keys.length - 1; i++) {
    const [ka, va] = keys[i];
    const [kb, vb] = keys[i + 1];
    if (t <= kb) {
      const s = smoothstep(ka, kb, t);
      return va + (vb - va) * s;
    }
  }
  return keys[keys.length - 1][1];
}

/** Radius of the body cross-section. Deep round belly around u = 0.36. */
export function bodyRadius(u: number): number {
  return keyed(u, [
    [0.0, 0.103],
    [0.08, 0.209],
    [0.2, 0.29],
    [0.36, 0.332],
    [0.52, 0.306],
    [0.7, 0.227],
    [0.86, 0.135],
    [1.0, 0.065],
  ]);
}

/**
 * Centre height of the cross-section. Sits so the belly clears the cart deck and the back
 * ends up above a four year old's head: the whole point of the low camera at the light-up.
 */
export function bodyAxisY(u: number): number {
  return 0.92 + 0.04 * Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.8)) + 0.09 * smoothstep(0.72, 1.0, u);
}

export function bodyAxisX(u: number): number {
  return NEBUTA.bodyNoseX + (NEBUTA.bodyTailX - NEBUTA.bodyNoseX) * clamp(u, 0, 1);
}

/** How far the belly sags below the axis. */
function bellyDrop(u: number): number {
  return 0.062 * smoothstep(0.06, 0.42, u) * (1 - smoothstep(0.58, 0.96, u));
}

/** Vertical / horizontal squash of the section: goldfish are deeper than they are wide. */
function sectionScales(u: number): [number, number] {
  const ky = 1.02 + 0.24 * smoothstep(0.02, 0.34, u) * (1 - 0.35 * smoothstep(0.66, 1.0, u));
  const kz = 1.0 - 0.16 * smoothstep(0.05, 0.4, u) - 0.18 * smoothstep(0.7, 1.0, u);
  return [ky, kz];
}

/** Two big round cheeks. Also gives the ink stage a curved surface to draw the eye on. */
function eyeBulge(u: number, v: number): number {
  const ue = 0.115;
  let amt = 0;
  for (const ve of [0.225, 0.775]) {
    let dv = Math.abs(v - ve);
    dv = Math.min(dv, 1 - dv);
    const du = (u - ue) / 0.085;
    const d2 = du * du + (dv / 0.115) * (dv / 0.115);
    amt += Math.exp(-d2 * 1.35) * 0.048;
  }
  return amt;
}

/**
 * Point on the body surface.
 * @param u 0 at the snout, 1 at the tail root
 * @param v 0 at the top ridge, 0.25 right flank, 0.5 belly, 0.75 left flank
 */
export function bodyPoint(u: number, v: number, out = new Vector3()): Vector3 {
  const uu = clamp(u, 0, 1);
  const ang = v * Math.PI * 2;
  const cy = Math.cos(ang);
  const cz = Math.sin(ang);
  const r = bodyRadius(uu);
  const [ky, kz] = sectionScales(uu);
  const yScale = ky * (1 + 0.11 * (0.5 - 0.5 * cy));
  const bulge = eyeBulge(uu, ((v % 1) + 1) % 1);
  const rr = r + bulge;
  const x = bodyAxisX(uu) + bulge * 0.35 * (1 - uu * 2);
  const y = bodyAxisY(uu) - bellyDrop(uu) + rr * yScale * cy;
  const z = rr * kz * cz;
  return out.set(x, y, z);
}

/* --------------------------------------------------------------- tail (fantail veil) */

function tailCenter(s: number, side: number, out = new Vector3()): Vector3 {
  const x = NEBUTA.bodyTailX - 0.7 * Math.pow(s, 0.94);
  const y = bodyAxisY(1) + 0.1 * Math.sin(s * 2.5) - 0.3 * Math.pow(s, 1.75);
  const z = side * (0.035 + 0.26 * Math.pow(s, 1.05));
  return out.set(x, y, z);
}

function tailWidth(s: number): number {
  return 0.1 + 0.47 * Math.pow(s, 0.8);
}

/** The veil twists from vertical at the root to nearly flat at the trailing edge. */
function tailSpan(s: number, side: number, out = new Vector3()): Vector3 {
  const twist = 0.22 + 1.02 * s;
  return out.set(0, Math.cos(twist), side * Math.sin(twist) * 0.55).normalize();
}

const _tc = new Vector3();
const _ts = new Vector3();

/**
 * Point on one tail lobe.
 * @param s 0 at the tail root, 1 at the trailing edge
 * @param t 0..1 across the lobe
 */
export function tailPoint(s: number, t: number, side: number, out = new Vector3()): Vector3 {
  // Scalloped trailing edge: three soft lobes cut into the veil.
  const scallop = 1 - 0.14 * (0.5 + 0.5 * Math.cos(clamp(t, 0, 1) * Math.PI * 2 * 2.5));
  const ss = clamp(s, 0, 1) * scallop;
  tailCenter(ss, side, _tc);
  tailSpan(ss, side, _ts);
  const half = (t - 0.5) * tailWidth(ss);
  const ripple = 0.042 * Math.sin(t * Math.PI * 2 * 1.6 + ss * 3.1) * ss;
  return out.set(
    _tc.x + _ts.x * half + ripple * 0.25,
    _tc.y + _ts.y * half + ripple * 0.5,
    _tc.z + _ts.z * half + ripple * side * 0.7,
  );
}

/* --------------------------------------------------------------- fins */

export function pectoralPoint(s: number, t: number, side: number, out = new Vector3()): Vector3 {
  const ss = clamp(s, 0, 1);
  const rootU = 0.3;
  const base = bodyPoint(rootU, side > 0 ? 0.33 : 0.67, out.clone());
  const len = 0.34;
  const x = base.x - 0.05 - len * Math.pow(ss, 0.9);
  const spread = (t - 0.5) * (0.08 + 0.26 * Math.pow(ss, 0.8));
  const y = base.y - 0.08 * ss + spread * 0.85 - 0.024 * Math.sin(t * 9.4) * ss;
  const z = base.z + side * (0.025 + 0.13 * ss) + spread * 0.18 * side;
  return out.set(x, y, z);
}

export function dorsalPoint(s: number, t: number, out = new Vector3()): Vector3 {
  const ss = clamp(s, 0, 1);
  const u = 0.4 + 0.34 * clamp(t, 0, 1);
  const base = bodyPoint(u, 0, out.clone());
  const h = 0.22 * Math.sin(Math.PI * clamp(t, 0, 1)) + 0.03;
  const x = base.x - 0.04 * ss;
  const y = base.y + h * Math.pow(ss, 0.85);
  const z = base.z + 0.028 * Math.sin(t * 7.0) * ss;
  return out.set(x, y, z);
}

/* --------------------------------------------------------------- waves */

export interface WaveSpec {
  pivot: Vector3;
  theta0: number;
  sweep: number;
  radius: number;
  width: number;
  yaw: number;
  side: number;
}

/** Two crests flanking the fish: one breaking forward on the right, one trailing left. */
export const WAVES: WaveSpec[] = [
  {
    pivot: new Vector3(0.46, 0.62, 0.56),
    theta0: -0.55,
    sweep: 3.05,
    radius: 0.3,
    width: 0.32,
    yaw: -0.55,
    side: 1,
  },
  {
    pivot: new Vector3(-0.36, 0.6, -0.56),
    theta0: -0.35,
    sweep: 2.85,
    radius: 0.28,
    width: 0.3,
    yaw: 2.62,
    side: -1,
  },
];

/**
 * Point on a curling wave crest: a spiral in the vertical plane, swept sideways into a sheet
 * and rippled so the paper reads as moving water rather than a flat card.
 */
export function wavePoint(spec: WaveSpec, s: number, t: number, out = new Vector3()): Vector3 {
  const ss = clamp(s, 0, 1);
  const th = spec.theta0 + spec.sweep * ss;
  const rho = spec.radius * (1 - 0.6 * ss);
  const px = Math.cos(th) * rho;
  const py = Math.sin(th) * rho * 1.15 + 0.26 * ss;
  const w = spec.width * (1 - 0.52 * Math.pow(ss, 1.25));
  const span = (t - 0.5) * w;
  const ripple = 0.04 * Math.sin(t * Math.PI * 2 * 1.4 + ss * 4.2) * (0.35 + ss);
  // local frame: crest runs in (x,y), sheet spans mostly along z with a lean
  const lx = px + span * 0.18 * spec.side + ripple * 0.2;
  const ly = py + ripple * 0.55 - Math.abs(span) * 0.12;
  const lz = span + ripple * 0.3 * spec.side;
  const c = Math.cos(spec.yaw);
  const sn = Math.sin(spec.yaw);
  return out.set(
    spec.pivot.x + lx * c - lz * sn,
    spec.pivot.y + ly,
    spec.pivot.z + lx * sn + lz * c,
  );
}

/* --------------------------------------------------------------- patch registry */

export type PatchFn = (a: number, b: number, out: Vector3) => Vector3;

export interface PatchSpec {
  id: string;
  /** Child-facing name, plain hiragana. */
  label: string;
  tile: number;
  segA: number;
  segB: number;
  doubleSided: boolean;
  /** Teacher-prepared small parts start already papered. */
  preAttached: boolean;
  /** Outward offset so the paper floats just off the frame. */
  offset: number;
  point: PatchFn;
  /** Where the child's paper flies in from, and the order hint for the first sheet. */
  firstChoice: boolean;
}

function bodyPatch(u0: number, u1: number, v0: number, v1: number): PatchFn {
  return (a, b, out) => bodyPoint(u0 + (u1 - u0) * a, v0 + (v1 - v0) * b, out);
}

export const PATCHES: PatchSpec[] = [
  {
    id: 'head-r',
    label: 'あたま みぎ',
    tile: 0,
    segA: 14,
    segB: 16,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.0, 0.345, 0.0, 0.5),
    firstChoice: true,
  },
  {
    id: 'head-l',
    label: 'あたま ひだり',
    tile: 1,
    segA: 14,
    segB: 16,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.0, 0.345, 1.0, 0.5),
    firstChoice: true,
  },
  {
    id: 'belly-r',
    label: 'おなか みぎ',
    tile: 2,
    segA: 14,
    segB: 16,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.345, 0.7, 0.0, 0.5),
    firstChoice: true,
  },
  {
    id: 'belly-l',
    label: 'おなか ひだり',
    tile: 3,
    segA: 14,
    segB: 16,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.345, 0.7, 1.0, 0.5),
    firstChoice: true,
  },
  {
    id: 'back-r',
    label: 'せなか みぎ',
    tile: 4,
    segA: 12,
    segB: 14,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.7, 1.0, 0.0, 0.5),
    firstChoice: false,
  },
  {
    id: 'back-l',
    label: 'せなか ひだり',
    tile: 5,
    segA: 12,
    segB: 14,
    doubleSided: false,
    preAttached: false,
    offset: 0.012,
    point: bodyPatch(0.7, 1.0, 1.0, 0.5),
    firstChoice: false,
  },
  {
    id: 'tail-r',
    label: 'おびれ みぎ',
    tile: 6,
    segA: 16,
    segB: 16,
    doubleSided: true,
    preAttached: false,
    offset: 0.0,
    point: (a, b, out) => tailPoint(a, b, 1, out),
    firstChoice: true,
  },
  {
    id: 'tail-l',
    label: 'おびれ ひだり',
    tile: 7,
    segA: 16,
    segB: 16,
    doubleSided: true,
    preAttached: false,
    offset: 0.0,
    point: (a, b, out) => tailPoint(a, b, -1, out),
    firstChoice: false,
  },
  {
    id: 'wave-f',
    label: 'なみ まえ',
    tile: 8,
    segA: 16,
    segB: 14,
    doubleSided: true,
    preAttached: false,
    offset: 0.0,
    point: (a, b, out) => wavePoint(WAVES[0], a, b, out),
    firstChoice: true,
  },
  {
    id: 'wave-b',
    label: 'なみ うしろ',
    tile: 9,
    segA: 16,
    segB: 14,
    doubleSided: true,
    preAttached: false,
    offset: 0.0,
    point: (a, b, out) => wavePoint(WAVES[1], a, b, out),
    firstChoice: false,
  },
  {
    id: 'fin-r',
    label: 'ひれ みぎ',
    tile: 10,
    segA: 10,
    segB: 10,
    doubleSided: true,
    preAttached: true,
    offset: 0.0,
    point: (a, b, out) => pectoralPoint(a, b, 1, out),
    firstChoice: false,
  },
  {
    id: 'fin-l',
    label: 'ひれ ひだり',
    tile: 11,
    segA: 10,
    segB: 10,
    doubleSided: true,
    preAttached: true,
    offset: 0.0,
    point: (a, b, out) => pectoralPoint(a, b, -1, out),
    firstChoice: false,
  },
  {
    id: 'dorsal',
    label: 'せびれ',
    tile: 12,
    segA: 10,
    segB: 12,
    doubleSided: true,
    preAttached: true,
    offset: 0.0,
    point: (a, b, out) => dorsalPoint(a, b, out),
    firstChoice: false,
  },
];

/** Panels the child actually pastes (the teacher-made fins are excluded). */
export const CHILD_PATCHES = PATCHES.filter((p) => !p.preAttached);

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;

/** Panels overlap their neighbours by this much of the patch domain, like real pasted sheets. */
export const PATCH_MARGIN = 0.02;

/** Patch-parametric coordinate -> tile coordinate, accounting for that overlap. */
export const localToTile = (g: number): number => (g + PATCH_MARGIN) / (1 + 2 * PATCH_MARGIN);

/** Atlas rectangle for a tile, with a small gutter so bleeding never crosses tiles. */
export function tileRect(tile: number): { x: number; y: number; w: number; h: number } {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const gw = 1 / ATLAS_COLS;
  const gh = 1 / ATLAS_ROWS;
  const pad = 0.012;
  return { x: col * gw + gw * pad, y: row * gh + gh * pad, w: gw * (1 - pad * 2), h: gh * (1 - pad * 2) };
}

/** Interior lamp positions (in nebuta local space) prepared by the teacher. */
export const LAMP_POSITIONS: Vector3[] = [
  new Vector3(0.55, bodyAxisY(0.18) - 0.03, 0),
  new Vector3(0.05, bodyAxisY(0.45) - 0.06, 0),
  new Vector3(-0.35, bodyAxisY(0.82) - 0.02, 0),
];
