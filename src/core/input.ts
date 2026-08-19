/**
 * One finger. That is the whole contract.
 *
 * No pinch, no two-finger rotate, no virtual stick. Drags are reported in
 * normalised screen units (fraction of the short screen edge) so the same
 * gesture feels identical on an iPhone SE held upright and an iPad Pro on its
 * side. Handlers fire synchronously inside the pointer event, so the cloth and
 * the child start reacting on the very frame the finger moves.
 */

export interface SwipeInfo {
  /** Unit direction in screen space, +x right, +y DOWN. */
  dx: number;
  dy: number;
  /** Normalised units per second. */
  speed: number;
}

interface Sample {
  t: number;
  x: number;
  y: number;
}

export class Input {
  /** Fraction-of-short-edge delta for this pointermove. */
  onDrag: ((dx: number, dy: number, nx: number, ny: number) => void) | null = null;
  onDown: ((nx: number, ny: number) => void) | null = null;
  onUp: ((swipe: SwipeInfo | null) => void) | null = null;
  onTap: ((nx: number, ny: number) => void) | null = null;
  /** Fires as soon as a decisive flick is detected, without waiting for lift. */
  onFlick: ((swipe: SwipeInfo) => void) | null = null;

  /** Seconds since the last time the player touched anything. */
  idleTime = 0;
  isDown = false;
  /** Pointer position in normalised device coords (-1..1, +y up). */
  pointerNdcX = 0;
  pointerNdcY = 0;

  private el: HTMLElement;
  private activeId: number | null = null;
  private samples: Sample[] = [];
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private lastX = 0;
  private lastY = 0;
  private travelled = 0;
  private flickFired = false;
  private scale = 1;

  constructor(el: HTMLElement) {
    this.el = el;
    this.measure();
    el.addEventListener('pointerdown', this.handleDown, { passive: false });
    el.addEventListener('pointermove', this.handleMove, { passive: false });
    el.addEventListener('pointerup', this.handleUp, { passive: false });
    el.addEventListener('pointercancel', this.handleUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Belt and braces for older iOS Safari, which can still rubber-band the
    // page even with touch-action: none.
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  measure(): void {
    const r = this.el.getBoundingClientRect();
    this.scale = Math.max(1, Math.min(r.width, r.height));
  }

  update(dt: number): void {
    this.idleTime += dt;
  }

  resetIdle(): void {
    this.idleTime = 0;
  }

  private toNorm(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  private handleDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return; // strictly one finger
    e.preventDefault();
    this.activeId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    this.isDown = true;
    this.idleTime = 0;
    this.travelled = 0;
    this.flickFired = false;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.startT = performance.now();
    this.samples.length = 0;
    this.samples.push({ t: this.startT, x: e.clientX, y: e.clientY });
    const n = this.toNorm(e);
    this.pointerNdcX = n.x * 2 - 1;
    this.pointerNdcY = 1 - n.y * 2;
    this.onDown?.(n.x, n.y);
  };

  private handleMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const dxPx = e.clientX - this.lastX;
    const dyPx = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.travelled += Math.hypot(dxPx, dyPx);
    this.idleTime = 0;

    const now = performance.now();
    this.samples.push({ t: now, x: e.clientX, y: e.clientY });
    while (this.samples.length > 2 && now - this.samples[0].t > 130) this.samples.shift();

    const n = this.toNorm(e);
    this.pointerNdcX = n.x * 2 - 1;
    this.pointerNdcY = 1 - n.y * 2;
    this.onDrag?.(dxPx / this.scale, dyPx / this.scale, n.x, n.y);

    if (!this.flickFired) {
      const s = this.velocity();
      if (s && s.speed > 1.35) {
        this.flickFired = true;
        this.onFlick?.(s);
      }
    }
  };

  private handleUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    this.activeId = null;
    this.isDown = false;
    this.idleTime = 0;
    const dur = performance.now() - this.startT;
    const swipe = this.velocity();
    this.onUp?.(swipe);
    if (this.travelled < 16 && dur < 380) {
      const n = this.toNorm(e);
      this.onTap?.(n.x, n.y);
    }
    this.samples.length = 0;
  };

  private velocity(): SwipeInfo | null {
    if (this.samples.length < 2) return null;
    const a = this.samples[0];
    const b = this.samples[this.samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0.001) return null;
    const dx = (b.x - a.x) / this.scale;
    const dy = (b.y - a.y) / this.scale;
    const len = Math.hypot(dx, dy);
    if (len < 1e-5) return null;
    return { dx: dx / len, dy: dy / len, speed: len / dt };
  }

  /** Total distance from press point, in normalised units. */
  get dragFromStartX(): number {
    return (this.lastX - this.startX) / this.scale;
  }

  get dragFromStartY(): number {
    return (this.lastY - this.startY) / this.scale;
  }
}
