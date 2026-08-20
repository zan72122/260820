export interface PointerState {
  active: boolean;
  x: number;
  y: number;
  /** raw start position, in CSS pixels */
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** px per second */
  speed: number;
  downTime: number;
  moved: number;
}

type Handler = (p: PointerState) => void;

export class Input {
  readonly p: PointerState = {
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    speed: 0,
    downTime: 0,
    moved: 0,
  };

  onDown: Handler = () => {};
  onMove: Handler = () => {};
  onUp: Handler = () => {};

  private id = -1;
  private lastT = 0;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    el.addEventListener('lostpointercapture', this.up, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private down = (e: PointerEvent) => {
    if (this.p.active) return;
    e.preventDefault();
    this.id = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
    const p = this.p;
    p.active = true;
    p.x = p.startX = e.clientX;
    p.y = p.startY = e.clientY;
    p.dx = 0;
    p.dy = 0;
    p.speed = 0;
    p.moved = 0;
    p.downTime = performance.now();
    this.lastT = p.downTime;
    this.onDown(p);
  };

  private move = (e: PointerEvent) => {
    if (!this.p.active || e.pointerId !== this.id) return;
    e.preventDefault();
    const p = this.p;
    const now = performance.now();
    const dt = Math.max(0.008, (now - this.lastT) / 1000);
    this.lastT = now;
    p.dx = e.clientX - p.x;
    p.dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const dist = Math.hypot(p.dx, p.dy);
    p.moved += dist;
    p.speed = p.speed * 0.55 + (dist / dt) * 0.45;
    this.onMove(p);
  };

  private up = (e: PointerEvent) => {
    if (!this.p.active || e.pointerId !== this.id) return;
    e.preventDefault();
    this.p.active = false;
    this.id = -1;
    this.onUp(this.p);
  };

  /** Called every frame so speed decays when the finger is held still. */
  tick() {
    if (!this.p.active) {
      this.p.speed *= 0.7;
      return;
    }
    if (performance.now() - this.lastT > 60) this.p.speed *= 0.6;
  }

  get heldMs() {
    return this.p.active ? performance.now() - this.p.downTime : 0;
  }
}
