// ---------------------------------------------------------------------------
// 一本指の入力だけ。ピンチもオービットも用意しない。
// 演出中はカメラを固定するので、同じ指の動きが二つの意味を持つことはない。
// ---------------------------------------------------------------------------

export class Input {
  constructor(el) {
    this.el = el;
    this.down = false;
    this.x = 0; this.y = 0;
    this.startX = 0; this.startY = 0;
    this.prevX = 0; this.prevY = 0;
    this.dx = 0; this.dy = 0;
    this.holdTime = 0;
    this.travel = 0;
    this.downFlag = false;   // このフレームで押された
    this.upFlag = false;     // このフレームで離された
    this.tapFlag = false;    // 短く触れて離した
    this.onFirstInput = null;
    this._first = true;

    const pos = (e) => {
      const r = el.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [t.clientX - r.left, t.clientY - r.top];
    };

    const start = (e) => {
      e.preventDefault();
      const [x, y] = pos(e);
      this.down = true; this.downFlag = true;
      this.x = this.startX = this.prevX = x;
      this.y = this.startY = this.prevY = y;
      this.holdTime = 0; this.travel = 0;
      if (this._first) { this._first = false; this.onFirstInput && this.onFirstInput(); }
    };
    const move = (e) => {
      if (!this.down) return;
      e.preventDefault();
      const [x, y] = pos(e);
      this.travel += Math.hypot(x - this.x, y - this.y);
      this.x = x; this.y = y;
    };
    const end = (e) => {
      if (!this.down) return;
      if (e.cancelable) e.preventDefault();
      this.down = false; this.upFlag = true;
      this.tapFlag = this.travel < 12 && this.holdTime < 0.35;
    };

    if (window.PointerEvent) {
      el.addEventListener('pointerdown', (e) => {
        // 指が画面の端まで動いてもドラッグが切れないように捕まえておく
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        start(e);
      }, { passive: false });
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', end, { passive: false });
      window.addEventListener('pointercancel', end, { passive: false });
    } else {
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchmove', move, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    }
  }

  /** フレーム先頭で呼ぶ */
  begin(dt) {
    this.dx = this.x - this.prevX;
    this.dy = this.y - this.prevY;
    this.prevX = this.x; this.prevY = this.y;
    if (this.down) this.holdTime += dt;
  }

  /** フレーム末尾で呼ぶ */
  end() {
    this.downFlag = false;
    this.upFlag = false;
    this.tapFlag = false;
  }

  get dragDown() { return this.y - this.startY; }
  get dragRight() { return this.x - this.startX; }
}
