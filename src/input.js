/* ------------------------------------------------------------------
   One finger, no reading required.
     swipe up / hold      -> drive forward
     swipe left or right  -> swing the chute
   Everything is forgiving: a toddler poking the screen still moves.
------------------------------------------------------------------- */

export class Input {
  constructor(el) {
    this.el = el;
    this.id = null;
    this.lastX = 0; this.lastY = 0;
    this.startX = 0; this.startY = 0;
    this.downTime = 0;
    this.moved = 0;
    this.isDown = false;

    this.throttle = 0;       // 0..1 drive command
    this.chuteDelta = 0;     // radians consumed each frame
    this.anyInput = false;   // has the player ever touched?
    this.didSwipeUp = false;
    this.didSwipeSide = false;
    this.onFirstTouch = null;

    const opt = { passive: false };
    el.addEventListener('pointerdown', this._down = (e) => this.down(e), opt);
    el.addEventListener('pointermove', this._move = (e) => this.move(e), opt);
    window.addEventListener('pointerup', this._up = (e) => this.up(e), opt);
    window.addEventListener('pointercancel', this._up, opt);
    el.addEventListener('touchstart', (e) => e.preventDefault(), opt);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opt);
    document.addEventListener('gesturestart', (e) => e.preventDefault(), opt);
  }

  down(e) {
    if (this.id !== null) return;
    this.id = e.pointerId;
    this.isDown = true;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.downTime = 0;
    this.moved = 0;
    if (!this.anyInput) {
      this.anyInput = true;
      if (this.onFirstTouch) this.onFirstTouch();
    }
    if (this.el.setPointerCapture) {
      try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  }

  move(e) {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);

    const ax = Math.abs(dx), ay = Math.abs(dy);
    const tot = ax + ay + 0.001;
    const ref = Math.min(window.innerWidth, window.innerHeight);

    // upward drag = go
    if (dy < 0) {
      const vWeight = (ay / tot) ** 1.4;
      this.throttle = Math.min(1, this.throttle + (-dy / ref) * 5.2 * vWeight);
      if (-dy / ref > 0.05) this.didSwipeUp = true;
    } else if (dy > 0) {
      // dragging back eases off (never reverses - kids should not get stuck)
      const vWeight = (ay / tot) ** 1.4;
      this.throttle = Math.max(0, this.throttle - (dy / ref) * 2.0 * vWeight);
    }

    // sideways drag = swing the chute
    const hWeight = (ax / tot) ** 1.4;
    this.chuteDelta += (dx / ref) * 3.6 * hWeight;
    if (Math.abs(dx) / ref > 0.03) this.didSwipeSide = true;
  }

  up(e) {
    if (e.pointerId !== this.id) return;
    this.id = null;
    this.isDown = false;
  }

  /** returns the chute delta accumulated this frame and clears it */
  takeChute() {
    const d = this.chuteDelta;
    this.chuteDelta = 0;
    return d;
  }

  update(dt) {
    if (this.isDown) {
      this.downTime += dt;
      // press-and-hold also drives, so a child who just presses still plays
      if (this.downTime > 0.3) {
        this.throttle = Math.max(this.throttle, Math.min(0.85, (this.downTime - 0.3) * 1.6));
      }
      this.throttle = Math.max(0, this.throttle - dt * 0.22);
    } else {
      this.throttle = Math.max(0, this.throttle - dt * 0.75);
    }
  }
}
