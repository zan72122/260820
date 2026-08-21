import { Vector3 } from 'three';

export type PatternKind = 'rings' | 'stripes' | 'holes';
export const PATTERN_KINDS: PatternKind[] = ['rings', 'stripes', 'holes'];

export type Phase =
  | 'boot'
  | 'dark'          // tunnel dark, one faint streak, shelf panel breathing in the wind
  | 'seated'        // a patterned panel just dropped in -> still pattern inside
  | 'clamped'       // clamps flipped down
  | 'turning'       // rotation ring is the live control
  | 'watered'       // valve pulled -> pattern runs
  | 'lab'           // free workshop play, one variable highlighted per round
  | 'ride'          // raft launched
  | 'runout';       // raft settled, looking back at the running pattern

/**
 * Every optical control in the game funnels through this one object.
 * Nothing else owns panel angle, water rate, sun angle or pattern kind.
 */
export class OpticsState {
  /** which patterned plate sits in the collar (null = opaque blank) */
  panelKind: PatternKind | null = null;
  /** 0..1 seat animation, 1 = fully home in the guide rails */
  seat = 0;
  /** clamps flipped down over the panel edge */
  clamped = false;
  /** the port cover is swung back; with no plate fitted, raw sun gets in */
  lidOpen = false;
  /** collar rotation, radians. Rotates the plate inside its own plane. */
  ringAngle = 0;
  /** 0..1 water valve opening */
  waterFlow = 0;
  /** smoothed flow actually reaching the slide surface */
  wetness = 0;
  /** integrated advection phase, metres of pattern travel down the flume */
  flowPhase = 0;
  /** local ripple phase, keeps running slowly even at low flow */
  ripplePhase = 0;
  /** sun angles, radians */
  sunAzimuth = -2.62;
  sunElevation = 0.93;
  /** 0..1 cloud in front of the sun -> the pattern goes soft */
  cloudCover = 0;
  /** seconds since start */
  time = 0;

  readonly sunDir = new Vector3();

  constructor() {
    this.updateSun();
  }

  updateSun(): void {
    const ce = Math.cos(this.sunElevation);
    this.sunDir
      .set(ce * Math.sin(this.sunAzimuth), Math.sin(this.sunElevation), ce * Math.cos(this.sunAzimuth))
      .normalize();
  }

  /** How strongly light is getting through the port right now (0..1). */
  get transmission(): number {
    if (!this.lidOpen) return 0;
    const cloud = 1 - 0.55 * this.cloudCover;
    if (this.panelKind === null) return cloud;
    const clampBoost = this.clamped ? 1 : 0.9;
    return (0.28 + 0.72 * this.seat) * clampBoost * cloud;
  }

  /** shader pattern index; 3 means "open port, no plate" */
  get patternIndex(): number {
    if (this.panelKind === null) return 3;
    return this.panelKind === 'rings' ? 0 : this.panelKind === 'stripes' ? 1 : 2;
  }

  advance(dt: number): void {
    this.time += dt;
    // Water carries the pattern downstream; flow rate sets the speed.
    const speed = this.wetness * (0.05 + this.wetness * 0.24);
    this.flowPhase += dt * speed;
    this.ripplePhase += dt * (0.25 + this.wetness * 1.6);
  }

  reset(): void {
    this.panelKind = null;
    this.seat = 0;
    this.clamped = false;
    this.lidOpen = false;
    this.ringAngle = 0;
    this.waterFlow = 0;
    this.wetness = 0;
    this.flowPhase = 0;
    this.ripplePhase = 0;
    this.cloudCover = 0;
  }
}

/* ------------------------------------------------------------------ *
 * CPU mirror of the GLSL pattern function.
 * Used for the coloured light the raft picks up, so the bounce colour
 * always matches what the child can see on the wall.
 * ------------------------------------------------------------------ */

function fract(x: number): number {
  return x - Math.floor(x);
}
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Warm dispersion ramp: light that has gone through resin, not an RGB slider. */
export function spectrum(t: number, out: [number, number, number]): void {
  const p = fract(t);
  const a = p * Math.PI * 2;
  out[0] = 0.56 + 0.56 * Math.cos(a + 0.0);
  out[1] = 0.52 + 0.54 * Math.cos(a - 2.1);
  out[2] = 0.6 + 0.54 * Math.cos(a - 4.1);
}

export interface PatternSample {
  intensity: number;
  color: [number, number, number];
}

const _col: [number, number, number] = [0, 0, 0];

/**
 * @param u along the flume axis, metres in plate space
 * @param v across the flume, metres in plate space
 * @param soft penumbra width, grows with the throw distance
 */
export function evalPattern(
  kind: PatternKind,
  u: number,
  v: number,
  soft: number,
  out: PatternSample,
): PatternSample {
  let i = 0;
  let hue = 0;
  const s = Math.max(0.008, soft);
  if (kind === 'rings') {
    const r = Math.hypot(u, v);
    const f = fract(r * 6.2);
    i = 1 - smoothstep(0.05, 0.16 + s * 2, Math.abs(f - 0.24));
    hue = r * 1.55 + f * 0.14;
  } else if (kind === 'stripes') {
    const f = fract(v * 8);
    i = 1 - smoothstep(0.04, 0.14 + s * 2, Math.abs(f - 0.22));
    hue = v * 1.7 + f * 0.18;
  } else {
    const gu = u * 7;
    const gv = v * 7;
    const cu = Math.round(gu);
    const cv = Math.round(gv);
    const jit = fract(Math.sin(cu * 12.9898 + cv * 78.233) * 43758.5453);
    const du = gu - cu + (jit - 0.5) * 0.42;
    const dv = gv - cv + (fract(jit * 7.13) - 0.5) * 0.42;
    const d = Math.hypot(du, dv);
    i = 1 - smoothstep(0.03, 0.17 + s * 2.2, d);
    hue = jit + d * 0.6;
  }
  spectrum(hue, _col);
  out.intensity = Math.max(0, i);
  out.color[0] = _col[0];
  out.color[1] = _col[1];
  out.color[2] = _col[2];
  return out;
}
