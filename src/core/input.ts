/**
 * One-finger input. Every swipe anywhere on screen is work input for the
 * selector handle (no free camera). Diagonal swipes are projected onto the
 * handle's horizontal axis; taps only wake audio and reset the hint timer.
 */

export interface InputEvents {
  onDragStart(): void;
  /** dx: horizontal drag distance normalised by viewport width (right = +) */
  onDragMove(dx: number): void;
  onDragEnd(): void;
  onTap(): void;
  onAnyPointer(): void;
}

export class Input {
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private active = false;
  private moved = false;
  private pointerId: number | null = null;

  constructor(el: HTMLElement, private ev: InputEvents) {
    el.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return; // ignore multi-touch extras
      this.pointerId = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      this.active = true;
      this.moved = false;
      this.startX = this.lastX = e.clientX;
      this.startY = e.clientY;
      this.ev.onAnyPointer();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      const dxAbs = Math.abs(e.clientX - this.startX);
      const dyAbs = Math.abs(e.clientY - this.startY);
      if (!this.moved && Math.hypot(dxAbs, dyAbs) > 8) {
        this.moved = true;
        this.ev.onDragStart();
      }
      if (this.moved) {
        const dx = (e.clientX - this.lastX) / window.innerWidth;
        this.lastX = e.clientX;
        this.ev.onDragMove(dx);
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      if (!this.active) return;
      this.active = false;
      if (this.moved) this.ev.onDragEnd();
      else this.ev.onTap();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
