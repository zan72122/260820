export interface Pointer {
  /** CSS pixels, relative to the canvas box */
  x: number;
  y: number;
  /** previous frame position */
  px: number;
  py: number;
  /** normalised device coords, -1..1 */
  nx: number;
  ny: number;
  /** CSS px per second */
  vx: number;
  vy: number;
  speed: number;
  down: boolean;
  /** ms since this press started */
  heldMs: number;
  /** total CSS px travelled since press */
  travel: number;
  downX: number;
  downY: number;
}

export interface InputHandlers {
  onDown?: (p: Pointer) => void;
  onMove?: (p: Pointer) => void;
  onUp?: (p: Pointer) => void;
  /** Fired for pointercancel, pointer leaving the window, tab hide, blur or
   *  an orientation change. Everything dangerous (the flame) shuts off here. */
  onAbort?: (reason: string) => void;
  onResize?: () => void;
}

/**
 * One-finger input, normalised and hardened: secondary touches are ignored, and
 * every way a press can silently die on mobile Safari routes through onAbort.
 */
export class Input {
  readonly pointer: Pointer = {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    nx: 0,
    ny: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    down: false,
    heldMs: 0,
    travel: 0,
    downX: 0,
    downY: 0,
  };

  private activeId: number | null = null;
  private lastMoveTime = 0;
  private el: HTMLElement;
  private h: InputHandlers;
  private disposers: Array<() => void> = [];
  /** When locked (camera moves, cut-scenes) presses are swallowed. */
  locked = false;

  constructor(el: HTMLElement, handlers: InputHandlers) {
    this.el = el;
    this.h = handlers;

    const add = <K extends keyof WindowEventMap>(
      target: EventTarget,
      type: K | string,
      fn: (e: never) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    add(el, 'pointerdown', this.onDown as (e: never) => void, { passive: false });
    add(window, 'pointermove', this.onMove as (e: never) => void, { passive: false });
    add(window, 'pointerup', this.onUp as (e: never) => void);
    add(window, 'pointercancel', this.onCancel as (e: never) => void);
    add(window, 'pointerleave', this.onCancel as (e: never) => void);
    add(window, 'blur', () => this.abort('blur'));
    add(document, 'visibilitychange', () => {
      if (document.visibilityState !== 'visible') this.abort('hidden');
    });
    add(window, 'contextmenu', (e: Event) => e.preventDefault());
    // iOS Safari pinch/zoom gestures must never fight the game.
    add(window, 'gesturestart', (e: Event) => e.preventDefault());
    add(window, 'gesturechange', (e: Event) => e.preventDefault());
    add(window, 'touchmove', (e: Event) => e.preventDefault(), { passive: false } as never);

    const onResize = () => {
      this.abort('resize');
      this.h.onResize?.();
    };
    add(window, 'resize', onResize);
    add(window, 'orientationchange', onResize);
    if (window.visualViewport) add(window.visualViewport, 'resize', onResize);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  /** Advance held/velocity bookkeeping once per frame. */
  tick(dtMs: number): void {
    const p = this.pointer;
    if (p.down) p.heldMs += dtMs;
    // Velocity decays when the finger stops moving but stays down.
    if (performance.now() - this.lastMoveTime > 90) {
      p.vx *= 0.6;
      p.vy *= 0.6;
      p.speed = Math.hypot(p.vx, p.vy);
    }
    p.px = p.x;
    p.py = p.y;
  }

  private setPos(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    const p = this.pointer;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    const dt = Math.max(1, now - this.lastMoveTime) / 1000;
    if (p.down) {
      p.vx = (x - p.x) / dt;
      p.vy = (y - p.y) / dt;
      p.speed = Math.hypot(p.vx, p.vy);
      p.travel += Math.hypot(x - p.x, y - p.y);
    }
    this.lastMoveTime = now;
    p.x = x;
    p.y = y;
    p.nx = (x / Math.max(1, r.width)) * 2 - 1;
    p.ny = -(y / Math.max(1, r.height)) * 2 + 1;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.locked || this.activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.activeId = e.pointerId;
    const p = this.pointer;
    p.down = true;
    p.heldMs = 0;
    p.travel = 0;
    p.vx = 0;
    p.vy = 0;
    p.speed = 0;
    this.lastMoveTime = performance.now();
    this.setPos(e);
    p.px = p.x;
    p.py = p.y;
    p.downX = p.x;
    p.downY = p.y;
    try {
      this.el.setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    e.preventDefault();
    this.h.onDown?.(p);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.setPos(e);
    e.preventDefault();
    this.h.onMove?.(this.pointer);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.setPos(e);
    this.release(e.pointerId);
    this.h.onUp?.(this.pointer);
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.release(e.pointerId);
    this.h.onAbort?.('pointercancel');
  };

  private release(id: number): void {
    this.pointer.down = false;
    this.activeId = null;
    try {
      this.el.releasePointerCapture?.(id);
    } catch {
      /* already released */
    }
  }

  /** Force the current press to end (used on hide, blur, rotate). */
  abort(reason: string): void {
    if (this.activeId !== null) this.release(this.activeId);
    this.pointer.down = false;
    this.h.onAbort?.(reason);
  }
}
