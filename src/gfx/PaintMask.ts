import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, RepeatWrapping, Vector3 } from 'three';
import { clamp } from '../core/Easing';

const _d = new Vector3();

export type MaskMode = 'erode' | 'accum';

export interface MaskOptions {
  /** Texture width; height is width/2 for equirect masks, width for disc masks. */
  width?: number;
  /** Equirect masks must tile across the u seam; disc masks must not. */
  wrap?: boolean;
  /** 2 for equirect (2:1), 1 for the square disc projection used on cavities. */
  aspect?: 1 | 2;
  /**
   * For disc masks: the uv radius that actually lies on the surface. Coverage
   * ignores everything outside it, so "all clean" really means zero.
   */
  discRadius?: number;
}

/**
 * A paint-on-the-object mask stored as an equirectangular canvas.
 *
 * The geode is never UV-unwrapped: both the shader and this painter map a
 * direction to the same equirect uv, so a finger stroke lands exactly where it
 * touched. Only the alpha channel is meaningful.
 *
 *  - 'erode'  starts opaque and is worn away  (mud, powder)
 *  - 'accum'  starts empty and is built up    (wetness)
 */
export class PaintMask {
  readonly texture: CanvasTexture;
  readonly size: number;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private probe: HTMLCanvasElement;
  private probeCtx: CanvasRenderingContext2D;
  private mode: MaskMode;
  private wrap: boolean;
  /** Equal-area weighting only applies to the equirect projection. */
  private equirect: boolean = true;
  private discRadius: number;
  private dirty = false;
  private uploadAcc = 0;
  private coverageAcc = 0;
  private cachedCoverage = 1;

  constructor(mode: MaskMode, opts: MaskOptions = {}) {
    const size = opts.width ?? 256;
    const aspect = opts.aspect ?? 2;
    this.mode = mode;
    this.size = size;
    this.wrap = opts.wrap ?? aspect === 2;
    this.equirect = aspect === 2;
    this.discRadius = opts.discRadius ?? 0;

    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = Math.round(size / aspect);
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;

    this.probe = document.createElement('canvas');
    this.probe.width = 32;
    this.probe.height = Math.round(32 / aspect);
    const pctx = this.probe.getContext('2d', { willReadFrequently: true });
    if (!pctx) throw new Error('2d context unavailable');
    this.probeCtx = pctx;

    this.texture = new CanvasTexture(this.canvas);
    this.texture.wrapS = this.wrap ? RepeatWrapping : ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.minFilter = LinearFilter;    // no mipmaps: avoids a seam line
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;

    this.reset();
  }

  reset(): void {
    const { ctx, canvas } = this;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.mode === 'erode') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.cachedCoverage = 1;
    } else {
      this.cachedCoverage = 0;
    }
    this.dirty = true;
    this.texture.needsUpdate = true;
  }

  /** Fill the whole mask to a value in [0,1] (used for partially-dirty stones). */
  fill(amount: number): void {
    const { ctx, canvas } = this;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(255,255,255,${clamp(amount)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.cachedCoverage = clamp(amount);
    this.dirty = true;
  }

  /**
   * Paint at an object-space direction (equirect projection).
   * `radius` is in v units — a fraction of the 180 degree vertical span.
   */
  paintEquirect(dir: Vector3, radius: number, strength: number): void {
    const d = _d.copy(dir).normalize();
    const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(clamp(d.y, -1, 1)) / Math.PI + 0.5;
    // Equirect stretches horizontally toward the poles; widen the brush so the
    // footprint on the actual surface stays round.
    const lat = (v - 0.5) * Math.PI;
    const stretch = 1 / Math.max(Math.cos(lat), 0.16);
    this.paintUV(u, v, radius * stretch, radius, strength);
  }

  /** Paint an ellipse directly in uv space (v=0 is the bottom of the texture). */
  paintUV(u: number, v: number, radiusU: number, radiusV: number, strength: number): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = u * W;
    const cy = (1 - v) * H; // canvas y is flipped relative to texture v
    const rx = Math.max(1, radiusU * W);
    const ry = Math.max(1, radiusV * H);

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = this.mode === 'erode' ? 'destination-out' : 'source-over';

    const R = Math.max(rx, ry);
    const a = clamp(strength);

    // Draw three times so strokes wrap across the u seam.
    for (const off of this.wrap ? [-W, 0, W] : [0]) {
      const x = cx + off;
      if (x + rx < 0 || x - rx > W) continue;
      ctx.save();
      // Transform first, then build the gradient: gradient coordinates are
      // resolved with whatever transform is current when the fill happens.
      ctx.translate(x, cy);
      ctx.scale(rx / R, ry / R);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.78})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    this.dirty = true;
  }

  /** Multiplicative fade of the whole mask (wetness drying off). */
  decay(amount: number): void {
    if (amount <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${clamp(amount)})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    this.dirty = true;
  }

  /**
   * Throttled GPU upload + coverage recompute. Uploading a 256x128 canvas every
   * frame is wasteful on a phone; 30 Hz is well under the perceptual threshold
   * for mud vanishing under a finger.
   */
  update(dt: number): void {
    this.uploadAcc += dt;
    if (this.dirty && this.uploadAcc >= 1 / 30) {
      this.uploadAcc = 0;
      this.dirty = false;
      this.texture.needsUpdate = true;
    }
    this.coverageAcc += dt;
    if (this.coverageAcc >= 0.14) {
      this.coverageAcc = 0;
      this.cachedCoverage = this.measure();
    }
  }

  /** Average alpha across the mask, weighted by cos(latitude) for equal area. */
  private measure(): number {
    const pw = this.probe.width, ph = this.probe.height;
    this.probeCtx.clearRect(0, 0, pw, ph);
    this.probeCtx.drawImage(this.canvas, 0, 0, pw, ph);
    const data = this.probeCtx.getImageData(0, 0, pw, ph).data;
    let sum = 0, wsum = 0;
    for (let y = 0; y < ph; y++) {
      const v = 1 - (y + 0.5) / ph;
      const w = this.equirect ? Math.cos((v - 0.5) * Math.PI) : 1;
      for (let x = 0; x < pw; x++) {
        if (this.discRadius > 0) {
          const uu = (x + 0.5) / pw - 0.5;
          const vv = v - 0.5;
          if (Math.hypot(uu, vv) > this.discRadius) continue;
        }
        sum += (data[(y * pw + x) * 4 + 3] / 255) * w;
        wsum += w;
      }
    }
    return wsum > 0 ? sum / wsum : 0;
  }

  /** Cached area coverage in [0,1]. */
  get coverage(): number {
    return this.cachedCoverage;
  }

  /** Force an immediate recompute (used at step transitions and in tests). */
  refresh(): number {
    this.cachedCoverage = this.measure();
    this.texture.needsUpdate = true;
    this.dirty = false;
    return this.cachedCoverage;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
