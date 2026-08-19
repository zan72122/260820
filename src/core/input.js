// 1本指だけで完結する入力。ポインタの生ストリームを配って、
// 「はらう」「ぐるぐる」「ひっぱる」の判定はゲーム側の各フェーズが行う。

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.active = false;
    this.pointerId = null;
    this.start = { x: 0, y: 0, t: 0 };
    this.pos = { x: 0, y: 0 };
    this.prev = { x: 0, y: 0 };
    this.delta = { x: 0, y: 0 };
    this.ndc = { x: 0, y: 0 };
    this.startNdc = { x: 0, y: 0 };
    this.travel = 0; // 押してからの総移動距離(px)
    this.moveEnergy = 0; // 直近の動きの強さ(はらう判定用)
    this.upVelocity = 0; // 上方向の速度(px/s)。ひっぱる判定用
    this.listeners = { down: [], move: [], up: [], tap: [] };
    this._bind();
  }

  on(name, fn) {
    this.listeners[name].push(fn);
    return this;
  }

  _emit(name, arg) {
    for (const fn of this.listeners[name]) fn(arg);
  }

  _point(e) {
    const r = this.dom.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return {
      x,
      y,
      ndcX: (x / r.width) * 2 - 1,
      ndcY: -(y / r.height) * 2 + 1,
    };
  }

  _bind() {
    const dom = this.dom;
    const down = (e) => {
      if (this.active) return;
      this.active = true;
      this.pointerId = e.pointerId;
      const p = this._point(e);
      this.start = { x: p.x, y: p.y, t: performance.now() };
      this.startNdc = { x: p.ndcX, y: p.ndcY };
      this.pos = { x: p.x, y: p.y };
      this.prev = { x: p.x, y: p.y };
      this.delta = { x: 0, y: 0 };
      this.ndc = { x: p.ndcX, y: p.ndcY };
      this.travel = 0;
      this.upVelocity = 0;
      if (dom.setPointerCapture) {
        try { dom.setPointerCapture(e.pointerId); } catch { /* iOS で稀に失敗する */ }
      }
      this._emit('down', this.snapshot());
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      const p = this._point(e);
      this.prev = { x: this.pos.x, y: this.pos.y };
      this.pos = { x: p.x, y: p.y };
      this.ndc = { x: p.ndcX, y: p.ndcY };
      this.delta = { x: p.x - this.prev.x, y: p.y - this.prev.y };
      const d = Math.hypot(this.delta.x, this.delta.y);
      this.travel += d;
      this.moveEnergy = Math.min(1, this.moveEnergy + d / 120);
      this._emit('move', this.snapshot());
      e.preventDefault();
    };
    const up = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      const dt = (performance.now() - this.start.t) / 1000;
      const snap = this.snapshot();
      snap.duration = dt;
      snap.isTap = this.travel < 24 && dt < 0.7;
      this.active = false;
      this.pointerId = null;
      this._emit('up', snap);
      if (snap.isTap) this._emit('tap', snap);
      e.preventDefault();
    };
    dom.addEventListener('pointerdown', down, { passive: false });
    dom.addEventListener('pointermove', move, { passive: false });
    dom.addEventListener('pointerup', up, { passive: false });
    dom.addEventListener('pointercancel', up, { passive: false });
    dom.addEventListener('pointerleave', up, { passive: false });
    // iOS Safari のダブルタップズーム/スクロール連動を殺す
    dom.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    dom.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    dom.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  snapshot() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      ndcX: this.ndc.x,
      ndcY: this.ndc.y,
      dx: this.delta.x,
      dy: this.delta.y,
      travel: this.travel,
      startX: this.start.x,
      startY: this.start.y,
      duration: (performance.now() - this.start.t) / 1000,
      isTap: false,
    };
  }

  update(dt) {
    this.moveEnergy = Math.max(0, this.moveEnergy - dt * 2.5);
    if (this.active) {
      // 上方向の速度(px/s)。上へ動くほど正
      const v = -this.delta.y / Math.max(dt, 1 / 120);
      this.upVelocity = this.upVelocity * 0.6 + v * 0.4;
    } else {
      this.upVelocity *= 0.5;
    }
    this.delta.x = 0;
    this.delta.y = 0;
  }
}

/**
 * 画面上の中心点まわりに指がぐるぐる回った角度を積算する。
 * 半径がずれていても角度だけ見るので、多少ずれても正しい円周に吸着する。
 */
export class CircleTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.prevAngle = null;
    this.total = 0;
    this.signedTotal = 0;
    this.lastAngle = 0;
  }

  /** @returns {number} 今回の更新で進んだ角度(ラジアン, 符号付き) */
  update(px, py, cx, cy) {
    const a = Math.atan2(py - cy, px - cx);
    if (this.prevAngle === null) {
      this.prevAngle = a;
      this.lastAngle = a;
      return 0;
    }
    let d = a - this.prevAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // 指が中心を飛び越えた瞬間の暴発を防ぐ
    if (Math.abs(d) > 1.2) d = 0;
    this.prevAngle = a;
    this.lastAngle = a;
    this.total += Math.abs(d);
    this.signedTotal += d;
    return d;
  }
}
