export interface PointerState {
  active: boolean;
  /** CSS pixels */
  x: number;
  y: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** seconds since press */
  held: number;
  moved: number;
  justPressed: boolean;
  justReleased: boolean;
}

export class Input {
  readonly p: PointerState = {
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    held: 0,
    moved: 0,
    justPressed: false,
    justReleased: false,
  };

  private id: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private pendingPress = false;
  private pendingRelease = false;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp, { passive: false });
    window.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari still fires these for double-tap zoom on some versions
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent) => {
    if (this.id !== null) return;
    this.id = e.pointerId;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.p.x = this.p.startX = this.lastX = x;
    this.p.y = this.p.startY = this.lastY = y;
    this.p.dx = this.p.dy = 0;
    this.p.moved = 0;
    this.p.held = 0;
    this.p.active = true;
    this.pendingPress = true;
  };

  private onMove = (e: PointerEvent) => {
    if (this.id !== e.pointerId) return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.p.x = e.clientX - r.left;
    this.p.y = e.clientY - r.top;
  };

  private onUp = (e: PointerEvent) => {
    if (this.id !== e.pointerId) return;
    this.id = null;
    this.p.active = false;
    this.pendingRelease = true;
  };

  /** Call once per frame before the game reads the state. */
  begin(dt: number) {
    this.p.justPressed = this.pendingPress;
    this.p.justReleased = this.pendingRelease;
    this.pendingPress = false;
    this.pendingRelease = false;
    if (this.p.active) {
      this.p.dx = (this.p.x - this.lastX) / Math.max(dt, 1e-3);
      this.p.dy = (this.p.y - this.lastY) / Math.max(dt, 1e-3);
      this.p.moved = Math.max(
        this.p.moved,
        Math.hypot(this.p.x - this.p.startX, this.p.y - this.p.startY)
      );
      this.p.held += dt;
    } else {
      this.p.dx = 0;
      this.p.dy = 0;
    }
    this.lastX = this.p.x;
    this.lastY = this.p.y;
  }

  cancel() {
    this.id = null;
    this.p.active = false;
    this.pendingPress = false;
    this.pendingRelease = true;
  }
}
