import { clamp } from '../core/math';

export interface SwipeResult {
  strength: number;
  /** Screen-space direction of the swipe, normalised. */
  dx: number;
  dy: number;
  /** 0..1 – how curved the stroke was. Arcs read as fuller pumps than straight drags. */
  arcness: number;
  /** Viewport coordinates of the finger when the stroke ended. */
  x: number;
  y: number;
}

interface Sample {
  x: number;
  y: number;
  t: number;
}

const MAX_SAMPLES = 48;

/**
 * One finger, one gesture: a broad arc drawn along the way the swing is already
 * going. Pinch, two-finger rotate and any secondary pointer are ignored outright
 * so the camera can never be taken over by accident.
 */
export class SwipeInput {
  private activeId: number | null = null;
  private samples: Sample[] = [];
  private travel = 0;
  private sinceEmit = 0;
  private onSwipe: (s: SwipeResult) => void;
  private onFirstTouch: () => void;
  private touched = false;
  /** Set while a finger is down – used to keep the guide gesture in sync. */
  pointerDown = false;
  lastX = 0;
  lastY = 0;

  constructor(el: HTMLElement, onSwipe: (s: SwipeResult) => void, onFirstTouch: () => void) {
    this.onSwipe = onSwipe;
    this.onFirstTouch = onFirstTouch;

    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    el.addEventListener('pointerleave', this.up, { passive: false });
    // Belt and braces on iOS: kill pinch zoom and double-tap zoom.
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e) => e.preventDefault() as unknown as void);
    el.addEventListener('dblclick', (e) => e.preventDefault());
  }

  private unit(): number {
    return Math.min(window.innerWidth, window.innerHeight);
  }

  private down = (e: PointerEvent): void => {
    if (this.activeId !== null) return; // second finger: ignored, never a gesture
    // Controls sitting over the stage keep their own taps: preventing the default
    // here would swallow the click that follows.
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    this.travel = 0;
    this.sinceEmit = 0;
    this.pointerDown = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (!this.touched) {
      this.touched = true;
      this.onFirstTouch();
    }
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const prev = this.samples[this.samples.length - 1];
    const d = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (d < 1.5) return;
    this.travel += d;
    this.sinceEmit += d;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();

    // A long, continuous scribble keeps feeding pumps instead of waiting for release.
    if (this.sinceEmit > this.unit() * 0.5) {
      this.emit(false);
      this.sinceEmit = 0;
      this.samples = this.samples.slice(-6);
    }
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    this.activeId = null;
    this.pointerDown = false;
    if (this.sinceEmit > this.unit() * 0.06) this.emit(true);
    this.samples = [];
  };

  private emit(released: boolean): void {
    const s = this.samples;
    if (s.length < 2) return;
    const a = s[0];
    const b = s[s.length - 1];
    const chord = Math.hypot(b.x - a.x, b.y - a.y);
    if (chord < 4) return;

    let path = 0;
    for (let i = 1; i < s.length; i++) path += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);

    const unit = this.unit();
    // Length maps generously: even a short, wobbly toddler stroke is worth something.
    const lengthTerm = clamp((path / unit - 0.10) / 0.42, 0, 1);
    const arcness = clamp((path / Math.max(chord, 1) - 1.0) / 0.45, 0, 1);
    const dtSec = Math.max(0.016, (b.t - a.t) / 1000);
    const speedTerm = clamp(path / unit / dtSec / 1.6, 0.35, 1.2);

    const strength = clamp(
      (0.24 + 0.70 * lengthTerm) * (0.82 + 0.28 * arcness) * (0.72 + 0.32 * speedTerm) *
        (released ? 1 : 0.92),
      0.14,
      1,
    );

    this.onSwipe({
      strength,
      dx: (b.x - a.x) / chord,
      dy: (b.y - a.y) / chord,
      arcness,
      x: b.x,
      y: b.y,
    });
  }
}
