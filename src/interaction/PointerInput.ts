import { Vector2 } from 'three';

export interface PointerState {
  active: boolean;
  /** CSS pixels, relative to the canvas. */
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** Seconds since this press began. */
  held: number;
  /** Pixels per second. */
  speed: number;
  movedTotal: number;
}

type TapHandler = (x: number, y: number) => void;

/**
 * One finger is all the game ever needs.
 *
 * A press is a press-and-hold; sliding while held is the drag; a short press
 * that barely moves is a tap. Multi-touch, pinch and any browser gesture are
 * swallowed so the chest never zooms away under a small hand.
 */
export class PointerInput {
  readonly state: PointerState = {
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    held: 0,
    speed: 0,
    movedTotal: 0,
  };

  readonly ndc = new Vector2();
  private lastX = 0;
  private lastY = 0;
  private lastMoveTime = 0;
  private activeId: number | null = null;
  private onTap: TapHandler | null = null;
  private onPress: TapHandler | null = null;
  private onRelease: TapHandler | null = null;

  constructor(private element: HTMLElement) {
    element.addEventListener('pointerdown', this.handleDown, { passive: false });
    element.addEventListener('pointermove', this.handleMove, { passive: false });
    window.addEventListener('pointerup', this.handleUp, { passive: false });
    window.addEventListener('pointercancel', this.handleUp, { passive: false });
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    element.addEventListener('gesturestart', (e) => e.preventDefault());
    element.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  setHandlers(handlers: { tap?: TapHandler; press?: TapHandler; release?: TapHandler }): void {
    this.onTap = handlers.tap ?? null;
    this.onPress = handlers.press ?? null;
    this.onRelease = handlers.release ?? null;
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private handleDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    const p = this.local(e);
    const s = this.state;
    s.active = true;
    s.x = s.startX = this.lastX = p.x;
    s.y = s.startY = this.lastY = p.y;
    s.held = 0;
    s.speed = 0;
    s.movedTotal = 0;
    this.lastMoveTime = performance.now();
    this.element.setPointerCapture?.(e.pointerId);
    this.onPress?.(p.x, p.y);
  };

  private handleMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const p = this.local(e);
    const s = this.state;
    const now = performance.now();
    const dt = Math.max(0.008, (now - this.lastMoveTime) / 1000);
    const dist = Math.hypot(p.x - this.lastX, p.y - this.lastY);
    s.speed = dist / dt;
    s.movedTotal += dist;
    s.x = p.x;
    s.y = p.y;
    this.lastX = p.x;
    this.lastY = p.y;
    this.lastMoveTime = now;
  };

  private handleUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const s = this.state;
    const wasTap = s.held < 0.55 && s.movedTotal < 14;
    this.activeId = null;
    s.active = false;
    s.speed = 0;
    this.onRelease?.(s.x, s.y);
    if (wasTap) this.onTap?.(s.x, s.y);
  };

  /** Convert a point in CSS pixels to normalised device coordinates. */
  toNdc(x: number, y: number, out = this.ndc): Vector2 {
    const r = this.element.getBoundingClientRect();
    out.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    return out;
  }

  update(dt: number): void {
    const s = this.state;
    if (s.active) s.held += dt;
    // Speed decays when the finger stops without lifting.
    s.speed *= Math.exp(-dt * 7);
  }

  get size(): { width: number; height: number } {
    const r = this.element.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }
}
