/**
 * One finger, nothing else. No multi-touch, no gestures to learn, no precision
 * targets — a four-year-old gets exactly one verb per screen.
 */
export interface PointerFrame {
  active: boolean;
  /** Normalised device coords, -1..1, y up. */
  x: number;
  y: number;
  /** CSS pixels. */
  px: number;
  py: number;
  /** NDC movement accumulated since the last frame. */
  dx: number;
  dy: number;
  /** NDC/second, smoothed. */
  vx: number;
  vy: number;
  /** Seconds the finger has been down. */
  heldFor: number;
  /** Total NDC path length since press. */
  travel: number;
  justPressed: boolean;
  justReleased: boolean;
  /** True on the frame a short, still press was released. */
  tapped: boolean;
  /** True on the frame a quick directional flick was released. */
  flicked: boolean;
  flickX: number;
  flickY: number;
}

const TAP_TIME = 0.36;
const TAP_TRAVEL = 0.055;
const FLICK_SPEED = 0.55;

export class Input {
  readonly frame: PointerFrame = {
    active: false, x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, vx: 0, vy: 0,
    heldFor: 0, travel: 0, justPressed: false, justReleased: false,
    tapped: false, flicked: false, flickX: 0, flickY: 0,
  };

  /** Seconds since the player last did anything. Drives the hint system. */
  idleFor = 0;

  private el: HTMLElement;
  private pointerId: number | null = null;
  private pendingPress = false;
  private pendingRelease = false;
  private accX = 0;
  private accY = 0;
  private lastX = 0;
  private lastY = 0;
  private rectW = 1;
  private rectH = 1;
  private rectL = 0;
  private rectT = 0;
  private detach: (() => void)[] = [];

  constructor(el: HTMLElement) {
    this.el = el;
    this.measure();

    const onDown = (e: PointerEvent) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      this.measure();
      this.setFromEvent(e);
      this.lastX = this.frame.x;
      this.lastY = this.frame.y;
      this.pendingPress = true;
      this.frame.travel = 0;
      this.frame.heldFor = 0;
      this.accX = 0;
      this.accY = 0;
      this.idleFor = 0;
      try { el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.setFromEvent(e);
      this.idleFor = 0;
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.setFromEvent(e);
      this.pendingRelease = true;
      this.pointerId = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
      e.preventDefault();
    };

    const opts = { passive: false } as const;
    el.addEventListener('pointerdown', onDown, opts);
    el.addEventListener('pointermove', onMove, opts);
    el.addEventListener('pointerup', onUp, opts);
    el.addEventListener('pointercancel', onUp, opts);
    // iOS still fires these under some conditions (e.g. gesture recognisers);
    // swallowing them stops the page from rubber-banding under the canvas.
    const swallow = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', swallow, opts);
    el.addEventListener('touchmove', swallow, opts);
    el.addEventListener('gesturestart', swallow, opts);
    el.addEventListener('contextmenu', swallow, opts);

    this.detach.push(() => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('touchstart', swallow);
      el.removeEventListener('touchmove', swallow);
      el.removeEventListener('gesturestart', swallow);
      el.removeEventListener('contextmenu', swallow);
    });
  }

  measure(): void {
    const r = this.el.getBoundingClientRect();
    this.rectW = Math.max(1, r.width);
    this.rectH = Math.max(1, r.height);
    this.rectL = r.left;
    this.rectT = r.top;
  }

  private setFromEvent(e: { clientX: number; clientY: number }): void {
    const px = e.clientX - this.rectL;
    const py = e.clientY - this.rectT;
    const x = (px / this.rectW) * 2 - 1;
    const y = -((py / this.rectH) * 2 - 1);
    this.accX += x - this.frame.x;
    this.accY += y - this.frame.y;
    this.frame.x = x;
    this.frame.y = y;
    this.frame.px = px;
    this.frame.py = py;
  }

  /** Injected pointer input for automated tests and the tutorial ghost. */
  simulate(kind: 'down' | 'move' | 'up', px: number, py: number): void {
    const ev = { clientX: this.rectL + px, clientY: this.rectT + py };
    if (kind === 'down') {
      this.measure();
      this.setFromEvent(ev);
      this.lastX = this.frame.x;
      this.lastY = this.frame.y;
      this.pendingPress = true;
      this.frame.travel = 0;
      this.frame.heldFor = 0;
      this.pointerId = -999;
    } else if (kind === 'move') {
      this.setFromEvent(ev);
    } else {
      this.setFromEvent(ev);
      this.pendingRelease = true;
      this.pointerId = null;
    }
    this.idleFor = 0;
  }

  /** Call once per frame, before the game reads `frame`. */
  update(dt: number): void {
    const f = this.frame;
    f.justPressed = false;
    f.justReleased = false;
    f.tapped = false;
    f.flicked = false;

    if (this.pendingPress) {
      this.pendingPress = false;
      f.active = true;
      f.justPressed = true;
      f.vx = 0;
      f.vy = 0;
    }

    f.dx = this.accX;
    f.dy = this.accY;
    this.accX = 0;
    this.accY = 0;

    const k = 1 - Math.exp(-16 * dt);
    f.vx += (f.dx / Math.max(dt, 1e-4) - f.vx) * k;
    f.vy += (f.dy / Math.max(dt, 1e-4) - f.vy) * k;

    if (f.active) {
      f.heldFor += dt;
      f.travel += Math.hypot(f.x - this.lastX, f.y - this.lastY);
      this.lastX = f.x;
      this.lastY = f.y;
      if (Math.hypot(f.dx, f.dy) > 0.0006) this.idleFor = 0;
    } else {
      this.idleFor += dt;
    }

    if (this.pendingRelease) {
      this.pendingRelease = false;
      f.justReleased = true;
      f.active = false;
      f.tapped = f.heldFor <= TAP_TIME && f.travel <= TAP_TRAVEL;
      const speed = Math.hypot(f.vx, f.vy);
      if (!f.tapped && speed >= FLICK_SPEED) {
        f.flicked = true;
        f.flickX = f.vx;
        f.flickY = f.vy;
      }
    }
  }

  dispose(): void {
    for (const d of this.detach) d();
    this.detach.length = 0;
  }
}
