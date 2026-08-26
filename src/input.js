import { clamp } from './util/math.js';

/**
 * One finger, read for intent.
 *
 * A four-year-old cannot aim. So nothing here measures accuracy; it measures
 * *character*: how far, how fast, how straight, how wobbly. Every one of those
 * produces a good cast — a different one.
 */
export class Input {
  constructor(el, onGesture) {
    this.el = el;
    this.onGesture = onGesture;
    this.active = false;
    this.path = [];
    this.startT = 0;
    this.live = null;

    const opts = { passive: false };
    el.addEventListener('pointerdown', this._down = (e) => this._onDown(e), opts);
    el.addEventListener('pointermove', this._move = (e) => this._onMove(e), opts);
    el.addEventListener('pointerup', this._up = (e) => this._onUp(e), opts);
    el.addEventListener('pointercancel', this._up, opts);
    el.addEventListener('touchstart', (e) => e.preventDefault(), opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this._down);
    this.el.removeEventListener('pointermove', this._move);
    this.el.removeEventListener('pointerup', this._up);
    this.el.removeEventListener('pointercancel', this._up);
  }

  _pt(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() / 1000 };
  }

  _onDown(e) {
    if (this.active) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    const p = this._pt(e);
    this.path = [p];
    this.startT = p.t;
    this.live = { x: p.x, y: p.y, dx: 0, dy: 0, len: 0 };
    if (this.el.setPointerCapture) { try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
  }

  _onMove(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const p = this._pt(e);
    const last = this.path[this.path.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 1.5) return;
    this.path.push(p);
    if (this.path.length > 220) this.path.shift();
    const a = this.path[0];
    this.live.x = p.x; this.live.y = p.y;
    this.live.dx = p.x - a.x; this.live.dy = p.y - a.y;
    this.live.len += d;
  }

  _onUp(e) {
    if (!this.active || (e.pointerId !== undefined && e.pointerId !== this.pointerId)) return;
    e.preventDefault();
    this.active = false;
    const g = this.analyse();
    this.live = null;
    this.path = [];
    if (g) this.onGesture(g);
  }

  analyse() {
    const path = this.path;
    if (path.length === 0) return null;
    const a = path[0], b = path[path.length - 1];
    const rect = this.el.getBoundingClientRect();
    const diag = Math.hypot(rect.width, rect.height) || 1;

    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const dx = b.x - a.x, dy = b.y - a.y;
    const disp = Math.hypot(dx, dy);
    const dur = Math.max(0.045, b.t - a.t);

    if (disp < diag * 0.035 && len < diag * 0.07) {
      return { kind: 'tap', x: b.x, y: b.y, nx: b.x / rect.width, ny: b.y / rect.height };
    }

    // Wobble: how much the finger changed its mind along the way.
    let wob = 0, n = 0;
    for (let i = 2; i < path.length; i++) {
      const a1 = Math.atan2(path[i - 1].y - path[i - 2].y, path[i - 1].x - path[i - 2].x);
      const a2 = Math.atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x);
      let d = a2 - a1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      wob += Math.abs(d);
      n++;
    }
    const meanTurn = n > 0 ? wob / n : 0;

    // A deliberate arc curves steadily; a scribble reverses. Separate the two.
    const efficiency = disp / Math.max(len, 1e-3);
    const speed = (disp / diag) / dur;                       // screens per second

    return {
      kind: 'swipe',
      dx, dy, disp, len, dur,
      up: -dy / Math.max(disp, 1e-3),
      right: dx / Math.max(disp, 1e-3),
      nDisp: disp / diag,
      speed,
      efficiency,
      meanTurn,
      startNx: a.x / rect.width,
      startNy: a.y / rect.height,
      endNx: b.x / rect.width,
      endNy: b.y / rect.height,
      width: rect.width,
      height: rect.height
    };
  }
}

/** Swipe → cast. Deliberately generous: there is no wrong swipe, only a different flower. */
export function gestureToCast(g) {
  const speed = clamp(g.speed, 0, 2.6);
  const reach = clamp(g.nDisp, 0, 1.1);

  const sharpness = clamp(speed / 1.5, 0, 1);
  const smoothness = clamp(1 - (g.meanTurn - 0.06) / 0.42, 0, 1) * clamp(g.efficiency * 1.15, 0, 1);
  const wobble = clamp(1 - smoothness, 0, 1);

  // Far is fast *or* long. Either intention alone is enough.
  const distance = clamp(2.8 + reach * 8.0 + speed * 4.6, 2.8, 15.5);

  // Sideways component of the swipe steers, softly and within a comfortable cone.
  const lateral = clamp(g.dx / (g.width * 0.55), -1, 1);
  const azimuth = lateral * 0.60;

  return { distance, azimuth, sharpness, smoothness, wobble };
}
