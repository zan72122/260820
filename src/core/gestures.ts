import { clamp } from './mathx';

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export type GestureKind = 'tap' | 'longpress' | 'drag' | 'swipe';

export interface GestureResult {
  kind: GestureKind;
  dx: number;
  dy: number;
  distance: number;
  /** Direction in radians, atan2(dy, dx), screen space (y down). */
  angle: number;
  /** Pixels per second over the last part of the stroke. */
  speed: number;
  durationMs: number;
}

export interface GestureThresholds {
  /** Below this the stroke counts as stationary. */
  tapPx?: number;
  longpressMs?: number;
  swipeSpeed?: number;
}

/**
 * Classifies a completed pointer stroke. Deliberately forgiving: a four year
 * old's "swipe" is slow, curved and often reverses, so direction is taken from
 * the net displacement and speed from the tail of the stroke only.
 */
export function classifyStroke(
  samples: readonly PointerSample[],
  th: GestureThresholds = {},
): GestureResult {
  const tapPx = th.tapPx ?? 18;
  const longpressMs = th.longpressMs ?? 500;
  const swipeSpeed = th.swipeSpeed ?? 550;

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) {
    return { kind: 'tap', dx: 0, dy: 0, distance: 0, angle: 0, speed: 0, durationMs: 0 };
  }
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const distance = Math.hypot(dx, dy);
  const durationMs = Math.max(0, last.t - first.t);

  // Tail speed: last ~120ms of motion.
  let tail = samples.length - 1;
  while (tail > 0 && last.t - samples[tail - 1].t < 120) tail--;
  const tailStart = samples[tail] ?? first;
  const tailMs = Math.max(1, last.t - tailStart.t);
  const speed = (Math.hypot(last.x - tailStart.x, last.y - tailStart.y) / tailMs) * 1000;

  if (distance < tapPx) {
    return {
      kind: durationMs >= longpressMs ? 'longpress' : 'tap',
      dx, dy, distance, angle: Math.atan2(dy, dx), speed: 0, durationMs,
    };
  }
  return {
    kind: speed >= swipeSpeed ? 'swipe' : 'drag',
    dx, dy, distance, angle: Math.atan2(dy, dx), speed, durationMs,
  };
}

/**
 * How well a stroke follows a target direction, 0..1. Used to convert a
 * "pull the net edge that way" gesture into progress without demanding
 * accuracy: anything within ~70 degrees still counts, just a bit less.
 */
export function directionalMatch(dx: number, dy: number, targetAngle: number): number {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return 0;
  const dot = (dx * Math.cos(targetAngle) + dy * Math.sin(targetAngle)) / len;
  return clamp(dot, 0, 1);
}

/** Running sampler kept per active pointer id. */
export class StrokeRecorder {
  readonly samples: PointerSample[] = [];
  private maxSamples: number;

  constructor(maxSamples = 64) {
    this.maxSamples = maxSamples;
  }

  push(x: number, y: number, t: number): void {
    this.samples.push({ x, y, t });
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  reset(): void {
    this.samples.length = 0;
  }

  get lastDelta(): { dx: number; dy: number; dt: number } {
    const n = this.samples.length;
    if (n < 2) return { dx: 0, dy: 0, dt: 0 };
    const a = this.samples[n - 2];
    const b = this.samples[n - 1];
    return { dx: b.x - a.x, dy: b.y - a.y, dt: Math.max(1, b.t - a.t) };
  }

  classify(th?: GestureThresholds): GestureResult {
    return classifyStroke(this.samples, th);
  }
}
