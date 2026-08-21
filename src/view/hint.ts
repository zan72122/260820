import { clamp, damp, easeInOut } from '../core/math';

/**
 * The single piece of guidance in the game: one broad arc stroke, drawn once, in
 * the direction the swing is already going, offset clear of the point where the
 * colour appears so a finger following it never covers the thing it reveals.
 */
export class SwipeHint {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private opacity = 0;
  private target = 0;
  private t = 0;
  private dirX = 1;
  private dirY = 0;
  private anchorX = 0;
  private anchorY = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private retired = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(width: number, height: number, dpr: number): void {
    this.dpr = dpr;
    this.w = width;
    this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  show(): void {
    if (this.retired) return;
    this.target = 1;
  }

  /** Once the child has made a big arc of their own, the guide never comes back. */
  retire(): void {
    this.retired = true;
    this.target = 0;
  }

  get visible(): boolean {
    return this.opacity > 0.01;
  }

  setAnchor(x: number, y: number, dirX: number, dirY: number, portrait: boolean): void {
    // Sit the stroke below (portrait) or beside (landscape) the place the colour
    // is born, so the guide and the reveal never occupy the same pixels.
    const offY = portrait ? this.h * 0.235 : this.h * 0.20;
    const offX = portrait ? 0 : this.w * 0.06 * -Math.sign(dirX || 1);
    this.anchorX = clamp(x + offX, this.w * 0.26, this.w * 0.74);
    this.anchorY = clamp(y + offY, this.h * 0.42, this.h * 0.84);
    const len = Math.hypot(dirX, dirY) || 1;
    this.dirX = dirX / len;
    this.dirY = dirY / len;
  }

  update(dt: number): void {
    this.opacity = damp(this.opacity, this.target, 2.2, dt);
    this.t += dt;
  }

  draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.opacity < 0.01) return;

    const span = Math.min(this.w, this.h) * 0.46;
    // Perpendicular gives the stroke its bow, matching the shape of the swing's path.
    const px = -this.dirY;
    const py = this.dirX;

    const ax = this.anchorX - this.dirX * span * 0.5;
    const ay = this.anchorY - this.dirY * span * 0.5;
    const bx = this.anchorX + this.dirX * span * 0.5;
    const by = this.anchorY + this.dirY * span * 0.5;
    const bow = span * 0.28;
    const cx = (ax + bx) / 2 + px * bow;
    const cy = (ay + by) / 2 + py * bow;

    const cycle = 3.1;
    const local = this.t % cycle;
    const play = clamp(local / 1.9, 0, 1);
    const k = easeInOut(play);
    const tail = clamp(k - 0.30, 0, 1);
    const alpha = this.opacity * (local > 2.35 ? clamp((cycle - local) / 0.55, 0, 1) : 1);

    const pt = (u: number): [number, number] => {
      const iu = 1 - u;
      return [iu * iu * ax + 2 * iu * u * cx + u * u * bx, iu * iu * ay + 2 * iu * u * cy + u * u * by];
    };

    // Faint full path, so the shape of the gesture is legible before it animates.
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = `rgba(255, 238, 220, ${0.13 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();

    // The travelling stroke.
    const steps = 26;
    ctx.lineWidth = 9;
    for (let i = 0; i < steps; i++) {
      const u0 = tail + (k - tail) * (i / steps);
      const u1 = tail + (k - tail) * ((i + 1) / steps);
      if (u1 <= u0) continue;
      const [x0, y0] = pt(u0);
      const [x1, y1] = pt(u1);
      const fade = (i / steps) ** 1.4;
      ctx.strokeStyle = `rgba(255, 242, 226, ${0.42 * fade * alpha})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    const [hx, hy] = pt(k);
    const r = 15 + Math.sin(this.t * 6) * 1.2;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
    g.addColorStop(0, `rgba(255, 247, 236, ${0.62 * alpha})`);
    g.addColorStop(0.55, `rgba(255, 235, 214, ${0.22 * alpha})`);
    g.addColorStop(1, 'rgba(255,235,214,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  clear(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  reset(): void {
    this.retired = false;
    this.target = 0;
    this.opacity = 0;
    this.t = 0;
  }
}
