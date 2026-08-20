import {
  BED_HALF_WIDTH,
  SLIDE_LENGTH,
  slideCurvature,
  slidePoint,
  slideSlope,
} from '../world/slideCurve';
import type { SlideSurface } from '../world/surface';
import type { GroundKind, ObjectProfile } from '../objects/profiles';
import { clamp, noise1 } from '../core/math';

export const GRAVITY = 9.81;

export type Phase = 'held' | 'slide' | 'flight' | 'ground' | 'rest';

export interface MatState {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  thickness: number;
  present: boolean;
  /** 0..1 how far the pad is currently pushed down. */
  depression: number;
}

export interface SimWorld {
  surface: SlideSurface;
  mat: MatState;
}

export interface BodyState {
  phase: Phase;
  /** Arc position along the bed while on the slide. */
  s: number;
  /** Speed along the bed (never negative — nothing slides back uphill here). */
  v: number;
  /** Sideways offset from the bed centreline. */
  lateral: number;
  lateralV: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  /** Accumulated rolling angle, radians. */
  spin: number;
  /** Accumulated spin about the surface normal (discs, bags). */
  yaw: number;
  /** Contact compression, 0..1, drives the squash morph. */
  squash: number;
  grounded: boolean;
  /** True while the body is still being carried by the bed. */
  onSlide: boolean;
  restTimer: number;
  /** Seconds since release. */
  age: number;
  seed: number;
  /** Set for one step after any impact; magnitude is the normal speed. */
  impact: number;
  impactKind: GroundKind | 'slide';
  /** Per-attempt friction bias, ~1.0. Keeps repeats similar but not identical. */
  frictionBias: number;
  /** Blended friction the body is feeling right now (debug + audio). */
  mu: number;
  /** Live coverage under the body. */
  cov: { dry: number; wet: number; sand: number; rubber: number };
}

export function createBody(
  s: number,
  lateral: number,
  seed: number,
  frictionBias = 1,
): BodyState {
  const p = slidePoint(s);
  return {
    phase: 'held',
    s,
    v: 0,
    lateral,
    lateralV: 0,
    px: p.x,
    py: p.y,
    pz: lateral,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    yaw: 0,
    squash: 0,
    grounded: false,
    onSlide: true,
    restTimer: 0,
    age: 0,
    seed,
    frictionBias,
    impact: 0,
    impactKind: 'slide',
    mu: 0,
    cov: { dry: 1, wet: 0, sand: 0, rubber: 0 },
  };
}

export function cloneBody(b: BodyState): BodyState {
  return { ...b, cov: { ...b.cov } };
}

export function groundKindAt(world: SimWorld, x: number, z: number): GroundKind {
  const m = world.mat;
  if (m.present && Math.abs(x - m.x) <= m.halfX && Math.abs(z - m.z) <= m.halfZ) return 'mat';
  // Poured safety surfacing forms an oval around the foot of the slide.
  const dx = (x - 5.55) / 3.5;
  const dz = z / 2.45;
  return dx * dx + dz * dz <= 1 ? 'rubberFloor' : 'soil';
}

export function groundHeightAt(world: SimWorld, x: number, z: number): number {
  const m = world.mat;
  if (m.present && Math.abs(x - m.x) <= m.halfX && Math.abs(z - m.z) <= m.halfZ) {
    return m.thickness * (1 - m.depression * 0.75);
  }
  return 0;
}

const SUB_DT = 1 / 180;

/** Advance one body by `dt` seconds. Pure with respect to `world.surface`. */
export function stepBody(
  b: BodyState,
  p: ObjectProfile,
  world: SimWorld,
  dt: number,
): void {
  b.impact = 0;
  let remaining = Math.min(dt, 0.1);
  while (remaining > 0) {
    const h = Math.min(SUB_DT, remaining);
    remaining -= h;
    stepOnce(b, p, world, h);
  }
}

function stepOnce(b: BodyState, p: ObjectProfile, world: SimWorld, dt: number): void {
  if (b.phase === 'held' || b.phase === 'rest') {
    b.squash += (targetRestSquash(p) - b.squash) * Math.min(1, dt * 6);
    return;
  }
  b.age += dt;

  if (b.phase === 'slide') {
    stepSlide(b, p, world, dt);
    return;
  }
  stepAir(b, p, world, dt);
}

function targetRestSquash(p: ObjectProfile): number {
  return p.squash * 0.28;
}

function stepSlide(b: BodyState, p: ObjectProfile, world: SimWorld, dt: number): void {
  world.surface.sample(b.s, b.cov);
  const theta = slideSlope(b.s);
  const kap = slideCurvature(b.s);
  let mu =
    p.mu.dry * b.cov.dry +
    p.mu.wet * b.cov.wet +
    p.mu.sand * b.cov.sand +
    p.mu.rubber * b.cov.rubber;
  mu *= b.frictionBias;
  b.mu = mu;

  // Normal acceleration: gravity component plus the centripetal term where the
  // bed flattens out. This is what makes a heavy object scrub speed in the
  // curve rather than in a straight line.
  const normal = GRAVITY * Math.cos(theta) + Math.max(0, kap) * b.v * b.v;
  const along = GRAVITY * Math.sin(theta);

  if (b.v <= 0.015) {
    // Static check: does gravity beat stiction at all?
    if (along <= mu * 1.18 * normal) {
      b.v = 0;
      b.restTimer += dt;
      if (b.restTimer > 0.12) {
        b.phase = 'rest';
        b.grounded = true;
      }
      return;
    }
    b.restTimer = 0;
  }

  let a = p.rollFactor * (along - mu * normal);
  a -= p.drag * b.v * b.v;
  // Loose grit jostles rollers and steals a little extra speed.
  a -= b.cov.sand * p.sandJitter * 0.55 * b.v;

  b.v = Math.max(0, b.v + a * dt);
  b.s += b.v * dt;

  // Sideways wander: tiny, deterministic, and bounded by the side rails.
  const wob =
    noise1(b.seed * 0.731 + b.s * 6.3) - 0.5 + (noise1(b.seed * 2.17 + b.s * 21.1) - 0.5) * 0.4;
  const wanderAcc = wob * p.wander * (0.35 + b.cov.sand * 1.6 + b.cov.rubber * 0.5) * b.v;
  b.lateralV = (b.lateralV + wanderAcc * dt) * Math.pow(0.05, dt);
  b.lateral += b.lateralV * dt;
  const lim = BED_HALF_WIDTH - p.radius * 0.7;
  if (b.lateral > lim || b.lateral < -lim) {
    b.lateral = clamp(b.lateral, -lim, lim);
    b.lateralV *= -0.35;
  }

  if (p.motion === 'roll') {
    b.spin += (b.v / p.radius) * dt;
  } else {
    // Sliders creep round: the ice disc pirouettes, the leaf skates sideways.
    b.yaw += p.wander * b.v * 0.55 * (noise1(b.seed * 5.3 + b.s * 1.7) - 0.45) * dt * 6;
  }
  b.squash += (p.squash * (0.28 + Math.min(0.5, b.v * 0.07)) - b.squash) * Math.min(1, dt * 9);

  if (b.s >= SLIDE_LENGTH) {
    // Leave the lip along the tangent.
    const exitTheta = slideSlope(SLIDE_LENGTH);
    const pt = slidePoint(SLIDE_LENGTH);
    b.px = pt.x;
    b.py = pt.y + p.radius * Math.cos(exitTheta);
    b.pz = b.lateral;
    b.vx = Math.cos(exitTheta) * b.v;
    b.vy = -Math.sin(exitTheta) * b.v;
    b.vz = b.lateralV;
    b.phase = 'flight';
    b.grounded = false;
    b.onSlide = false;
  }
}

function stepAir(b: BodyState, p: ObjectProfile, world: SimWorld, dt: number): void {
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  const dragA = p.drag * speed;
  b.vx -= b.vx * dragA * dt;
  b.vz -= b.vz * dragA * dt;
  b.vy -= (GRAVITY + b.vy * dragA * Math.sign(b.vy)) * dt;

  b.px += b.vx * dt;
  b.py += b.vy * dt;
  b.pz += b.vz * dt;

  const kind = groundKindAt(world, b.px, b.pz);
  const gh = groundHeightAt(world, b.px, b.pz);
  const floor = gh + p.radius;

  if (b.py <= floor) {
    const resp = p.ground[kind];
    const hitSpeed = Math.max(0, -b.vy);
    b.py = floor;
    if (hitSpeed > 0.25) {
      b.impact = hitSpeed;
      b.impactKind = kind;
      b.squash = Math.min(1, b.squash + p.squash * clamp(hitSpeed * 0.35, 0, 1));
      // One-off tangential scrub: a real touchdown costs forward speed, but
      // simply resting on the floor must not.
      const scrub = clamp(1 - resp.mu * hitSpeed * 0.075, 0.55, 1);
      b.vx *= scrub;
      b.vz *= scrub;
    }
    b.vy = hitSpeed * resp.bounce;
    if (b.vy < 0.32) {
      b.vy = 0;
      b.grounded = true;
      b.phase = 'ground';
    } else {
      b.grounded = false;
      b.phase = 'flight';
    }
  } else {
    b.grounded = false;
    if (b.phase !== 'flight') b.phase = 'flight';
  }

  if (b.grounded) {
    const resp = p.ground[kind];
    const hv = Math.hypot(b.vx, b.vz);
    if (hv > 1e-4) {
      const decel = p.rollFactor * resp.mu * b.frictionBias * GRAVITY;
      const nv = Math.max(0, hv - decel * dt);
      const k = nv / hv;
      b.vx *= k;
      b.vz *= k;
    }
    if (p.motion === 'roll') b.spin += (Math.hypot(b.vx, b.vz) / p.radius) * dt;
    else b.yaw += p.wander * Math.hypot(b.vx, b.vz) * 0.4 * dt;

    if (Math.hypot(b.vx, b.vz) < 0.06) {
      b.restTimer += dt;
      if (b.restTimer > 0.22) {
        b.phase = 'rest';
        b.vx = 0;
        b.vz = 0;
      }
    } else {
      b.restTimer = 0;
    }
  }
  b.squash += (targetRestSquash(p) - b.squash) * Math.min(1, dt * (b.grounded ? 7 : 4));
}

export interface Prediction {
  x: number;
  y: number;
  z: number;
  /** Arc position if it stops on the bed, otherwise null. */
  arc: number | null;
  onSlide: boolean;
  /** Where the object first touches down, for the landing camera. */
  landingX: number;
  landingZ: number;
  landed: boolean;
  time: number;
}

/**
 * Run a copy of the body forward to rest. Used for the landing camera (so the
 * shot is in place before the impact rather than cutting to it) and for the
 * debug read-out.
 */
export function predict(b: BodyState, p: ObjectProfile, world: SimWorld, maxTime = 14): Prediction {
  const c = cloneBody(b);
  if (c.phase === 'held') c.phase = 'slide';
  let t = 0;
  let landingX = 0;
  let landingZ = 0;
  let landed = false;
  const dt = 1 / 120;
  while (t < maxTime && c.phase !== 'rest') {
    stepOnce(c, p, world, dt);
    t += dt;
    if (!landed && (c.phase === 'ground' || (c.impact > 0 && c.phase !== 'slide'))) {
      landed = true;
      landingX = c.px;
      landingZ = c.pz;
    }
  }
  const onSlide = c.phase === 'rest' && c.s < SLIDE_LENGTH && !landed;
  const pos = onSlide ? slidePoint(c.s) : { x: c.px, y: c.py, z: c.pz };
  return {
    x: onSlide ? pos.x : c.px,
    y: onSlide ? pos.y : c.py,
    z: onSlide ? c.lateral : c.pz,
    arc: onSlide ? c.s : null,
    onSlide,
    landingX: landed ? landingX : c.px,
    landingZ: landed ? landingZ : c.pz,
    landed,
    time: t,
  };
}
