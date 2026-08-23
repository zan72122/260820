import { closestOnSegment } from './math';
import { CAPSULE_R, NET_Y, PHYS_DT } from './constants';

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Contact {
  nx: number;
  ny: number;
  x: number;
  y: number;
  depth: number;
  impulse: number;
}

export interface CapsuleBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** true while resting on the safety net. */
  onNet: boolean;
  /** contacts from the last step (for squash deformation + foam). */
  contacts: Contact[];
}

export interface StepOptions {
  /** gentle pull toward the channel center path (only in the 'ok' band). */
  assist?: { x: number; strength: number } | null;
  /** horizontal water-current force (LT foot), m/s^2. */
  flowAccel?: number;
  /** x range of the safety net. */
  netMinX: number;
  netMaxX: number;
  /**
   * terminal fall speed (m/s) — the capsule descends with the water, so the
   * fall stays readable instead of a physics-perfect blur.
   */
  maxFall?: number;
}

const GRAVITY = -9.81;
const RESTITUTION = 0.3;
const FRICTION = 0.035;

export function makeCapsule(x: number, y: number): CapsuleBody {
  return { x, y, vx: 0, vy: 0, r: CAPSULE_R, onNet: false, contacts: [] };
}

/**
 * Build world-space collision segments from glyph contours.
 * All contours (outer + holes) become segment loops.
 */
export function contoursToSegments(
  contours: { x: number; y: number }[][],
  offsetX: number,
  offsetY: number,
  scale: number,
): Segment[] {
  const segs: Segment[] = [];
  for (const loop of contours) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      segs.push({
        ax: offsetX + a.x * scale,
        ay: offsetY + a.y * scale,
        bx: offsetX + b.x * scale,
        by: offsetY + b.y * scale,
      });
    }
  }
  return segs;
}

/**
 * One deterministic fixed step (PHYS_DT). Circle vs segment soup with
 * positional correction and impulse response. Intentionally simple: clear
 * cause and effect beats full physical freedom here.
 */
export function stepCapsule(b: CapsuleBody, segments: Segment[], opts: StepOptions): void {
  const dt = PHYS_DT;
  b.contacts = [];

  // forces
  let ax = 0;
  let ay = GRAVITY;
  if (opts.assist) {
    ax += (opts.assist.x - b.x) * opts.assist.strength - b.vx * 2.2;
  }
  if (opts.flowAccel) ax += opts.flowAccel;

  b.vx += ax * dt;
  b.vy += ay * dt;
  if (opts.maxFall !== undefined && b.vy < -opts.maxFall) b.vy = -opts.maxFall;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // collide with letter outlines (3 relaxation iterations)
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const s of segments) {
      const c = closestOnSegment(b.x, b.y, s.ax, s.ay, s.bx, s.by);
      const dx = b.x - c.x;
      const dy = b.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r || d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const depth = b.r - d;
      b.x += nx * depth;
      b.y += ny * depth;
      const vn = b.vx * nx + b.vy * ny;
      let impulse = 0;
      if (vn < 0) {
        impulse = -(1 + RESTITUTION) * vn;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
      }
      // tangential friction
      const tx = -ny;
      const ty = nx;
      const vt = b.vx * tx + b.vy * ty;
      b.vx -= tx * vt * FRICTION;
      b.vy -= ty * vt * FRICTION;
      if (iter === 0) {
        b.contacts.push({ nx, ny, x: c.x, y: c.y, depth, impulse });
      }
      any = true;
    }
    if (!any) break;
  }

  // pinched from both sides (gap narrower than the capsule): the capsule
  // wedges gently right where it is — it must not extrude through
  let pushL = false;
  let pushR = false;
  for (const c of b.contacts) {
    if (c.nx > 0.3) pushR = true;
    if (c.nx < -0.3) pushL = true;
  }
  if (pushL && pushR) {
    b.vx = 0;
    b.vy = Math.max(b.vy * 0.1, -0.05);
  }

  // safety net: soft catch plane
  b.onNet = false;
  if (b.x > opts.netMinX && b.x < opts.netMaxX && b.y < NET_Y + b.r + 0.02) {
    const sag = NET_Y + b.r;
    if (b.y < sag) {
      b.y = sag;
      if (b.vy < 0) b.vy *= -0.18;
      b.vx *= 0.92;
      if (Math.abs(b.vy) < 0.25) b.vy = 0;
    }
    b.onNet = true;
  }
}

export function capsuleSpeed(b: CapsuleBody): number {
  return Math.hypot(b.vx, b.vy);
}
