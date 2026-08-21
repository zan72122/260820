import { HotspotKind } from '../interact/input';

export interface HintTarget {
  x: number;
  y: number;
  r: number;
  kind: HotspotKind;
}

/**
 * The only 2D layer in the game. No words, no numbers, no score — a breathing
 * ring that says "here", a glyph that says "do this", and two picture buttons
 * that move between the machine room and the top of the tower.
 */
export class Hud {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private hintAlpha = 0;
  private buttonAlpha = 0;
  private pulse = 0;
  hint: HintTarget | null = null;
  buttonsVisible = false;
  activeButton: 'room' | 'tower' | null = null;
  attention: 'room' | 'tower' | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  buttonRect(which: 'room' | 'tower') {
    const r = Math.max(30, Math.min(this.w, this.h) * 0.062);
    const m = r + Math.max(16, this.h * 0.035);
    return which === 'room'
      ? { x: m, y: this.h - m, r }
      : { x: this.w - m, y: this.h - m, r };
  }

  draw(dt: number) {
    const g = this.ctx;
    this.pulse += dt;
    g.clearRect(0, 0, this.w, this.h);

    this.hintAlpha += ((this.hint ? 1 : 0) - this.hintAlpha) * Math.min(1, dt * 3.4);
    this.buttonAlpha += ((this.buttonsVisible ? 1 : 0) - this.buttonAlpha) * Math.min(1, dt * 3);

    if (this.hint && this.hintAlpha > 0.01) this.drawHint(this.hint, this.hintAlpha);
    if (this.buttonAlpha > 0.01) {
      this.drawButton('room', this.buttonAlpha);
      this.drawButton('tower', this.buttonAlpha);
    }
  }

  private drawHint(t: HintTarget, alpha: number) {
    const g = this.ctx;
    const breathe = 0.5 + 0.5 * Math.sin(this.pulse * 2.1);
    const r = t.r * (0.92 + breathe * 0.16);
    g.save();
    g.globalAlpha = alpha * (0.36 + breathe * 0.34);
    g.strokeStyle = '#bfe6ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(t.x, t.y, r, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = alpha * 0.14;
    g.fillStyle = '#8fd0f5';
    g.beginPath();
    g.arc(t.x, t.y, r * 0.95, 0, Math.PI * 2);
    g.fill();

    g.globalAlpha = alpha * (0.6 + breathe * 0.35);
    g.strokeStyle = '#eaf7ff';
    g.fillStyle = '#eaf7ff';
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const s = r * 0.52;
    if (t.kind === 'wheel') {
      const a0 = this.pulse * 1.5;
      g.beginPath();
      g.arc(t.x, t.y, s, a0, a0 + Math.PI * 1.35);
      g.stroke();
      const ae = a0 + Math.PI * 1.35;
      const hx = t.x + Math.cos(ae) * s;
      const hy = t.y + Math.sin(ae) * s;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - Math.cos(ae - 0.9) * s * 0.34, hy - Math.sin(ae - 0.9) * s * 0.34);
      g.lineTo(hx - Math.cos(ae + 0.35) * s * 0.34, hy - Math.sin(ae + 0.35) * s * 0.34);
      g.closePath();
      g.fill();
    } else if (t.kind === 'swipe') {
      const off = Math.sin(this.pulse * 3.2) * s * 0.3;
      g.beginPath();
      g.moveTo(t.x, t.y - s + off);
      g.lineTo(t.x, t.y + s + off);
      g.stroke();
      for (const d of [-1, 1]) {
        const ty = t.y + d * s + off;
        g.beginPath();
        g.moveTo(t.x - s * 0.32, ty - d * s * 0.34);
        g.lineTo(t.x, ty);
        g.lineTo(t.x + s * 0.32, ty - d * s * 0.34);
        g.stroke();
      }
    } else if (t.kind === 'press') {
      const off = (Math.sin(this.pulse * 2.6) * 0.5 + 0.5) * s * 0.5;
      g.beginPath();
      g.arc(t.x, t.y - s * 0.5 + off, s * 0.3, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 2; i++) {
        const y = t.y + s * (0.15 + i * 0.4) + off;
        g.beginPath();
        g.moveTo(t.x - s * 0.4, y - s * 0.2);
        g.lineTo(t.x, y + s * 0.16);
        g.lineTo(t.x + s * 0.4, y - s * 0.2);
        g.stroke();
      }
    } else {
      const k = (this.pulse * 1.1) % 1;
      g.globalAlpha = alpha * (1 - k) * 0.8;
      g.beginPath();
      g.arc(t.x, t.y, s * (0.3 + k * 0.9), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = alpha * 0.85;
      g.beginPath();
      g.arc(t.x, t.y, s * 0.26, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  private drawButton(which: 'room' | 'tower', alpha: number) {
    const g = this.ctx;
    const { x, y, r } = this.buttonRect(which);
    const active = this.activeButton === which;
    const wants = this.attention === which;
    const glow = wants ? 0.5 + 0.5 * Math.sin(this.pulse * 2.4) : 0;
    g.save();
    g.globalAlpha = alpha * (active ? 0.95 : 0.78);
    const grd = g.createLinearGradient(x, y - r, x, y + r);
    grd.addColorStop(0, 'rgba(38,54,68,0.82)');
    grd.addColorStop(1, 'rgba(16,24,32,0.86)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2 + glow * 2;
    g.strokeStyle = wants ? `rgba(180,226,255,${0.5 + glow * 0.5})` : 'rgba(158,196,220,0.55)';
    g.stroke();

    g.globalAlpha = alpha * 0.94;
    g.strokeStyle = '#dff0fb';
    g.fillStyle = '#dff0fb';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (which === 'room') {
      // volute pump silhouette on a baseplate
      g.beginPath();
      g.arc(x - r * 0.12, y - r * 0.04, r * 0.32, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(x + r * 0.2, y - r * 0.06);
      g.lineTo(x + r * 0.48, y - r * 0.06);
      g.stroke();
      g.beginPath();
      g.moveTo(x - r * 0.12, y - r * 0.36);
      g.lineTo(x - r * 0.12, y - r * 0.56);
      g.stroke();
      g.beginPath();
      g.moveTo(x - r * 0.58, y + r * 0.4);
      g.lineTo(x + r * 0.58, y + r * 0.4);
      g.stroke();
      g.beginPath();
      g.arc(x - r * 0.12, y - r * 0.04, r * 0.1, 0, Math.PI * 2);
      g.fill();
    } else {
      // tower with a flume curling off it
      g.beginPath();
      g.moveTo(x - r * 0.34, y + r * 0.5);
      g.lineTo(x - r * 0.34, y - r * 0.5);
      g.lineTo(x - r * 0.02, y - r * 0.5);
      g.lineTo(x - r * 0.02, y + r * 0.5);
      g.stroke();
      g.beginPath();
      g.moveTo(x - r * 0.02, y - r * 0.38);
      g.bezierCurveTo(x + r * 0.6, y - r * 0.3, x + r * 0.16, y + r * 0.16, x + r * 0.52, y + r * 0.5);
      g.stroke();
      g.beginPath();
      g.arc(x + r * 0.5, y + r * 0.56, r * 0.09, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
