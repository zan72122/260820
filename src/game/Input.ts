/**
 * One finger, no buttons, no aiming. A drag steers; a tap is the only discrete
 * action in the game. Nothing here can put the player into a stuck state.
 */
export class Input {
  /** accumulated lateral request in metres, consumed by the game each frame */
  steer = 0;
  dragging = false;
  /** set for exactly one frame after a tap */
  tapped = false;

  private id: number | null = null;
  private lastX = 0;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private moved = 0;
  private keyLeft = false;
  private keyRight = false;
  private gain = 0.004;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari still fires these for pinch/double-tap zoom
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.resize();
  }

  resize() {
    // a full-width drag should be worth about two and a half ridges
    this.gain = 3.6 / Math.max(240, this.el.clientWidth);
  }

  private onDown = (e: PointerEvent) => {
    if (this.id !== null) return;
    e.preventDefault();
    this.id = e.pointerId;
    this.lastX = e.clientX;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = performance.now();
    this.moved = 0;
    this.dragging = true;
    (this.el as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.id) return;
    e.preventDefault();
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.startX, e.clientY - this.startY));
    // dragging right slides the machine to screen-right, which is -X in world
    this.steer -= dx * this.gain;
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.id) return;
    e.preventDefault();
    this.id = null;
    this.dragging = false;
    if (this.moved < 16 && performance.now() - this.startT < 400) this.tapped = true;
  };

  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft' || e.key === 'a') this.keyLeft = down;
    else if (e.key === 'ArrowRight' || e.key === 'd') this.keyRight = down;
    else if (down && (e.key === ' ' || e.key === 'Enter')) this.tapped = true;
    else return;
    e.preventDefault();
  };

  /** Metres of lateral request accumulated since the last call. */
  takeSteer(dt: number): number {
    let s = this.steer;
    this.steer = 0;
    if (this.keyLeft) s += 1.6 * dt;
    if (this.keyRight) s -= 1.6 * dt;
    return s;
  }

  takeTap(): boolean {
    const t = this.tapped;
    this.tapped = false;
    return t;
  }

  get active(): boolean {
    return this.dragging || this.keyLeft || this.keyRight;
  }
}
