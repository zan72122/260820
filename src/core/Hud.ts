import { clamp01 } from '../util/math';

export type GestureKind = 'swipe' | 'hold' | 'trace' | 'down' | 'none';

/**
 * The only screen overlay in the game: a wordless hand that appears when the
 * player has been idle, showing the gesture the current tool wants.
 */
export class Hud {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private kind: GestureKind = 'none';
  private alpha = 0;
  private target = 0;
  private t = 0;
  private ax = 0.5;
  private ay = 0.6;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
  }

  /** anchorX/Y are 0..1 viewport fractions of the point the gesture acts on. */
  set(kind: GestureKind, anchorX: number, anchorY: number, visible: boolean) {
    this.kind = kind;
    this.ax = clamp01(anchorX);
    this.ay = clamp01(anchorY);
    this.target = visible && kind !== 'none' ? 1 : 0;
  }

  update(dt: number) {
    this.t += dt;
    this.alpha += (this.target - this.alpha) * Math.min(1, dt * 3.2);
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (this.alpha < 0.01) return;

    const s = Math.min(w, h);
    // The hand is drawn below the anchor, mirroring the real finger offset.
    const baseX = this.ax * w;
    const baseY = this.ay * h + s * 0.13;
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.9;

    const phase = (this.t * 0.62) % 1;
    let ox = 0;
    let oy = 0;
    let ring = 0;
    if (this.kind === 'swipe') {
      ox = Math.sin(phase * Math.PI * 2) * s * 0.15;
      this.trail(baseX, baseY, s, 'h');
    } else if (this.kind === 'down') {
      oy = (phase < 0.7 ? phase / 0.7 : 1) * s * 0.14;
      this.trail(baseX, baseY, s, 'v');
    } else if (this.kind === 'trace') {
      ox = Math.cos(phase * Math.PI * 2) * s * 0.09;
      oy = Math.sin(phase * Math.PI * 2) * s * 0.05;
      this.trail(baseX, baseY, s, 'o');
    } else if (this.kind === 'hold') {
      ring = 1;
    }

    const x = baseX + ox;
    const y = baseY + oy;
    if (ring) {
      const r = s * 0.05 * (1 + Math.sin(this.t * 4) * 0.16);
      ctx.beginPath();
      ctx.arc(x, y, r + s * 0.022, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = s * 0.006;
      ctx.stroke();
    }
    this.drawFinger(x, y, s);
    ctx.restore();
  }

  private trail(x: number, y: number, s: number, mode: 'h' | 'v' | 'o') {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = s * 0.009;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mode === 'h') {
      ctx.moveTo(x - s * 0.16, y);
      ctx.lineTo(x + s * 0.16, y);
    } else if (mode === 'v') {
      ctx.moveTo(x, y - s * 0.02);
      ctx.lineTo(x, y + s * 0.15);
    } else {
      ctx.ellipse(x, y, s * 0.095, s * 0.055, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  private drawFinger(x: number, y: number, s: number) {
    const ctx = this.ctx;
    const r = s * 0.036;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = s * 0.005;
    ctx.stroke();
    // knuckle, so it reads as a fingertip rather than a UI dot
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.5, r * 0.62, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
}
