/**
 * One-finger control scheme.
 *
 * No joystick, no buttons, no camera stick — a four-year-old gets exactly three
 * gestures, all of them large and forgiving:
 *
 *   drag sideways   → the body turns, slowly and continuously (live feedback)
 *   short flick up  → walk a few steps forward
 *   big swipe down  → swing the stick
 *
 * The gesture is classified once, after a dead zone, so a sloppy diagonal can
 * never turn and step at the same time. Only the first finger down is tracked,
 * so a palm resting on the screen does nothing.
 */

const DEADZONE = 12;

export class TouchControls {
  constructor(el, handlers = {}) {
    this.el = el;
    this.h = handlers;
    this.pointerId = null;
    this.mode = 'none';
    this.turnRate = 0;          // rad/s, damped towards zero when idle
    this.enabled = true;
    this.allowStrike = false;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onKey = this._onKey.bind(this);

    el.addEventListener('pointerdown', this._onDown, { passive: false });
    el.addEventListener('pointermove', this._onMove, { passive: false });
    el.addEventListener('pointerup', this._onUp, { passive: false });
    el.addEventListener('pointercancel', this._onCancel, { passive: false });
    el.addEventListener('lostpointercapture', this._onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', this._onCancel);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._onCancel();
    });
    // keyboard mirror: desktop play and deterministic automated runs
    window.addEventListener('keydown', this._onKey);
  }

  get shortSide() { return Math.min(window.innerWidth, window.innerHeight); }
  /** Full-width drag ≈ 125°: slow enough to aim, fast enough to reach anything. */
  get turnPerPixel() { return 2.2 / window.innerWidth; }
  get stepThreshold() { return Math.max(34, this.shortSide * 0.075); }
  get strikeThreshold() { return Math.max(64, this.shortSide * 0.16); }

  _onDown(e) {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.startT = performance.now();
    this.mode = 'undecided';
    this.h.onGestureStart?.();
  }

  _onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const stepX = e.clientX - this.lastX;

    if (this.mode === 'undecided') {
      if (Math.abs(dx) > DEADZONE && Math.abs(dx) >= Math.abs(dy)) {
        this.mode = 'turn';
        // apply what the finger has already travelled so nothing feels lost
        this.h.onTurn?.(-dx * this.turnPerPixel);
      } else if (Math.abs(dy) > DEADZONE && Math.abs(dy) > Math.abs(dx) * 1.15) {
        this.mode = 'vertical';
      }
    } else if (this.mode === 'turn') {
      this.h.onTurn?.(-stepX * this.turnPerPixel);
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  _onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dy = e.clientY - this.startY;
    const dx = e.clientX - this.startX;
    const dt = Math.max(1, performance.now() - this.startT);
    const release = () => { this.pointerId = null; this.mode = 'none'; };

    if (this.mode === 'vertical' || (this.mode === 'undecided' && Math.abs(dy) > Math.abs(dx))) {
      const speed = Math.abs(dy) / dt;            // px per ms
      if (dy < -this.stepThreshold) {
        this.h.onStep?.(Math.min(1.35, Math.abs(dy) / (this.stepThreshold * 2.2) + 0.55));
        release();
        return;
      }
      if (dy > this.strikeThreshold && (speed > 0.35 || dy > this.strikeThreshold * 1.8)) {
        if (this.allowStrike) this.h.onStrike?.(Math.min(1, speed / 1.6));
        else this.h.onStrikeTooEarly?.();
        release();
        return;
      }
    }
    if (this.mode === 'undecided' && Math.hypot(dx, dy) < DEADZONE) {
      this.h.onTap?.(e.clientX, e.clientY);
    }
    release();
    this.h.onGestureEnd?.();
  }

  _onCancel() {
    if (this.pointerId === null) return;
    this.pointerId = null;
    this.mode = 'none';
    this.h.onGestureEnd?.();
  }

  _onKey(e) {
    if (!this.enabled) return;
    switch (e.key) {
      case 'ArrowLeft': this.h.onTurn?.(0.09); break;
      case 'ArrowRight': this.h.onTurn?.(-0.09); break;
      case 'ArrowUp': this.h.onStep?.(1); break;
      case 'ArrowDown':
      case ' ':
        if (this.allowStrike) this.h.onStrike?.(0.8);
        else this.h.onStrikeTooEarly?.();
        break;
      default: return;
    }
    e.preventDefault();
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this._onDown);
    this.el.removeEventListener('pointermove', this._onMove);
    this.el.removeEventListener('pointerup', this._onUp);
    this.el.removeEventListener('pointercancel', this._onCancel);
    window.removeEventListener('keydown', this._onKey);
  }
}
