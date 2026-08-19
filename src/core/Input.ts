/**
 * One finger, that's the whole contract.
 *
 *  - touch and hold  -> the harvester drives forward
 *  - slide sideways  -> it leans onto the neighbouring rice row
 *  - flick upward    -> "open the back"
 *
 * Mouse events are mapped onto the same paths so the game is testable
 * and playable on a desktop browser.
 */
export class Input {
  /** finger currently down */
  held = false;
  /** -1 .. 1 across the viewport, 0 in the middle */
  nx = 0;
  ny = 0;
  /** horizontal travel since touch-down, in viewport widths */
  dragX = 0;
  dragY = 0;
  /** set for one frame after a quick tap */
  tapped = false;
  /** set for one frame after an upward flick */
  swipedUp = false;
  /** seconds the current touch has been held */
  heldFor = 0;
  /** seconds since any input at all */
  idleFor = 0;

  private startX = 0;
  private startY = 0;
  private startT = 0;
  private lastY = 0;
  private lastT = 0;
  private velY = 0;
  private pointerId: number | null = null;
  private el: HTMLElement;
  private blocked = false;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    el.addEventListener('pointerleave', this.up, { passive: false });
    // iOS: kill rubber-banding, double-tap zoom and the magnifier.
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.release());
  }

  /** Ignore the canvas while a full-screen overlay owns the input. */
  setBlocked(v: boolean) {
    this.blocked = v;
    if (v) this.release();
  }

  private norm(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    this.nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    this.ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  }

  private down = (e: PointerEvent) => {
    if (this.blocked) return;
    e.preventDefault();
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    this.held = true;
    this.heldFor = 0;
    this.idleFor = 0;
    this.norm(e);
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = performance.now();
    this.lastY = e.clientY;
    this.lastT = this.startT;
    this.velY = 0;
    this.dragX = 0;
    this.dragY = 0;
  };

  private move = (e: PointerEvent) => {
    if (this.blocked || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.norm(e);
    this.idleFor = 0;
    const r = this.el.getBoundingClientRect();
    this.dragX = (e.clientX - this.startX) / Math.max(1, r.width);
    this.dragY = (e.clientY - this.startY) / Math.max(1, r.height);
    const now = performance.now();
    const dt = Math.max(1, now - this.lastT);
    this.velY = ((e.clientY - this.lastY) / dt) * 1000 / Math.max(1, r.height);
    this.lastY = e.clientY;
    this.lastT = now;
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault?.();
    const dur = performance.now() - this.startT;
    const moved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
    if (dur < 320 && moved < 22) this.tapped = true;
    // upward flick: travelled up over a fifth of the screen, or fast at release
    if (this.dragY < -0.11 || this.velY < -0.75) this.swipedUp = true;
    this.release();
  };

  private release() {
    if (this.pointerId !== null) this.el.releasePointerCapture?.(this.pointerId);
    this.pointerId = null;
    this.held = false;
    this.heldFor = 0;
    this.velY = 0;
  }

  /** Fake a hold from code (used by the title screen hand-off and tests). */
  forceHold(v: boolean) {
    this.held = v;
    if (v) this.idleFor = 0;
  }

  forceSwipeUp() {
    this.swipedUp = true;
  }

  /** Call once per frame AFTER the game has read the flags. */
  endFrame(dt: number) {
    this.tapped = false;
    this.swipedUp = false;
    if (this.held) {
      this.heldFor += dt;
      this.idleFor = 0;
    } else {
      this.idleFor += dt;
    }
  }
}
