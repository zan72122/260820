import { describe, expect, it, beforeAll } from 'vitest';
import { Vector3 } from 'three';

/**
 * PaintMask runs on a real 2D canvas. node-canvas is not available here, so a
 * small analytic stub stands in: it records what would be painted and lets the
 * coverage maths be verified exactly.
 */
class StubCtx {
  pixels: Float32Array;
  private w: number;
  private h: number;
  private op = 'source-over';
  private tx = 0; private ty = 0; private sx = 1; private sy = 1;
  private stack: number[][] = [];
  private grad: { stops: [number, number][] } | null = null;
  private solid: number | null = null;

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.pixels = new Float32Array(w * h);
  }
  set globalCompositeOperation(v: string) { this.op = v; }
  get globalCompositeOperation(): string { return this.op; }
  set fillStyle(v: unknown) {
    if (typeof v === 'string') {
      const m = /rgba?\([^)]*?([\d.]+)\)/.exec(v);
      this.solid = v === '#ffffff' ? 1 : m ? Number(m[1]) : 1;
      this.grad = null;
    } else {
      this.grad = v as { stops: [number, number][] };
      this.solid = null;
    }
  }
  save() { this.stack.push([this.tx, this.ty, this.sx, this.sy]); }
  restore() { const s = this.stack.pop(); if (s) [this.tx, this.ty, this.sx, this.sy] = s; }
  translate(x: number, y: number) { this.tx += x * this.sx; this.ty += y * this.sy; }
  scale(x: number, y: number) { this.sx *= x; this.sy *= y; }
  createRadialGradient(_x0: number, _y0: number, _r0: number, x1: number, y1: number, r1: number) {
    const stops: [number, number][] = [];
    // Per spec a gradient's coordinates are resolved with the transform that is
    // current when the shape is *painted*, not when the gradient is created —
    // so a gradient built before a translate lands somewhere else entirely.
    return {
      r: r1, stops, x: x1, y: y1,
      addColorStop: (o: number, c: string) => {
        const m = /rgba?\([^)]*?([\d.]+)\)/.exec(c);
        stops.push([o, m ? Number(m[1]) : 1]);
      },
    };
  }
  beginPath() { /* shape is implied by arc/fillRect */ }
  arc(_x: number, _y: number, r: number) { this.pendingR = r; }
  private pendingR = 0;
  fill() {
    const g = this.grad as unknown as
      { r: number; x: number; y: number; stops: [number, number][] } | null;
    const cx = this.tx, cy = this.ty;
    const rx = this.pendingR * this.sx, ry = this.pendingR * this.sy;
    const gcx = g ? this.tx + g.x * this.sx : 0;
    const gcy = g ? this.ty + g.y * this.sy : 0;
    const gr = g ? g.r * Math.max(Math.abs(this.sx), Math.abs(this.sy)) : 1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / Math.max(rx, 1e-6);
        const dy = (y + 0.5 - cy) / Math.max(ry, 1e-6);
        if (Math.hypot(dx, dy) > 1) continue;
        let a: number;
        if (g) {
          const gd = Math.hypot(x + 0.5 - gcx, y + 0.5 - gcy) / Math.max(gr, 1e-6);
          a = sampleStops(g.stops, Math.min(1, gd));
        } else {
          a = this.solid ?? 1;
        }
        this.apply(x, y, a);
      }
    }
  }
  fillRect(x0: number, y0: number, w: number, h: number) {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x0 + w); x++) {
        this.apply(x, y, this.solid ?? 1);
      }
    }
  }
  clearRect(x0: number, y0: number, w: number, h: number) {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x0 + w); x++) this.pixels[y * this.w + x] = 0;
    }
  }
  drawImage(src: { __ctx: StubCtx }, _x: number, _y: number, dw: number, dh: number) {
    const s = src.__ctx;
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const sxp = Math.floor((x / dw) * s.w);
        const syp = Math.floor((y / dh) * s.h);
        this.pixels[y * this.w + x] = s.pixels[syp * s.w + sxp];
      }
    }
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.round(this.pixels[i] * 255);
    return { data };
  }
  private apply(x: number, y: number, a: number) {
    const i = y * this.w + x;
    if (this.op === 'destination-out') this.pixels[i] *= 1 - a;
    else this.pixels[i] = this.pixels[i] + a * (1 - this.pixels[i]);
  }
}

function sampleStops(stops: [number, number][], t: number): number {
  if (stops.length === 0) return 1;
  let prev = stops[0];
  for (const s of stops) {
    if (t <= s[0]) {
      const span = s[0] - prev[0];
      const k = span > 0 ? (t - prev[0]) / span : 0;
      return prev[1] + (s[1] - prev[1]) * k;
    }
    prev = s;
  }
  return prev[1];
}

beforeAll(() => {
  (globalThis as unknown as { document: unknown }).document = {
    createElement() {
      const el = {
        width: 0, height: 0, __ctx: null as StubCtx | null,
        getContext() {
          if (!el.__ctx) el.__ctx = new StubCtx(el.width, el.height);
          return el.__ctx;
        },
      };
      return el;
    },
  };
});

describe('PaintMask', () => {
  it('erodes exactly where the finger touches and nowhere else', async () => {
    const { PaintMask } = await import('../gfx/PaintMask');
    const mask = new PaintMask('erode', { width: 64, aspect: 2 });
    expect(mask.refresh()).toBeCloseTo(1, 2);

    // Scrub the +X face repeatedly.
    for (let i = 0; i < 12; i++) mask.paintEquirect(new Vector3(1, 0, 0), 0.12, 0.6);
    const after = mask.refresh();
    expect(after).toBeLessThan(0.95);
    expect(after).toBeGreaterThan(0.4); // the far side must be untouched
  });

  it('clears completely when scrubbed all over', async () => {
    const { PaintMask } = await import('../gfx/PaintMask');
    const mask = new PaintMask('erode', { width: 64, aspect: 2 });
    for (let lat = -1; lat <= 1; lat += 0.25) {
      for (let lon = 0; lon < Math.PI * 2; lon += 0.3) {
        const c = Math.cos(lat);
        for (let k = 0; k < 4; k++) {
          mask.paintEquirect(new Vector3(c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)), 0.2, 0.9);
        }
      }
    }
    expect(mask.refresh()).toBeLessThan(0.12);
  });

  it('accumulates wetness instead of eroding it', async () => {
    const { PaintMask } = await import('../gfx/PaintMask');
    const mask = new PaintMask('accum', { width: 64, aspect: 2 });
    expect(mask.refresh()).toBeCloseTo(0, 3);
    for (let i = 0; i < 8; i++) mask.paintEquirect(new Vector3(0, 0, 1), 0.25, 0.7);
    expect(mask.refresh()).toBeGreaterThan(0.05);
  });

  it('paints disc-projected masks without wrapping', async () => {
    const { PaintMask } = await import('../gfx/PaintMask');
    const mask = new PaintMask('erode', { width: 64, aspect: 1 });
    const before = mask.refresh();
    for (let i = 0; i < 6; i++) mask.paintUV(0.5, 0.5, 0.15, 0.15, 0.8);
    const after = mask.refresh();
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0.5);
  });
});
