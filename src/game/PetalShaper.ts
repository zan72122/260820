import * as THREE from 'three';
import type { PetalSpec } from './PetalGeometry';
import { CONE, coneRadiusAt, type LayerDef } from './flowerParams';
import { clamp, fbm1, lerp, smoothstep, Rng } from '../util/math';

export interface TrailSample {
  /** Flower-nail local position of the piping tip. */
  x: number;
  z: number;
  /** Milliseconds since the stroke started. */
  t: number;
  /** Screen speed in CSS px/s at the moment of sampling. */
  speed: number;
}

export interface PetalMetrics {
  spanRadians: number;
  durationMs: number;
  meanSpeed: number;
}

/**
 * Turns the raw finger path into a petal.
 *
 * The path is never rejected. It is smoothed, pulled gently onto the ring of
 * the layer being piped, and given a sensible angular span, so a four year old
 * scribbling roughly sideways still gets a petal that belongs to the flower.
 */
export class PetalShaper {
  constructor(private nu: number) {}

  private base = new Float32Array(0);
  private rise = new Float32Array(0);
  private thick = new Float32Array(0);
  private curl = new Float32Array(0);
  private lean = new Float32Array(0);
  private metrics: PetalMetrics = { spanRadians: 0, durationMs: 0, meanSpeed: 0 };

  private ensure() {
    if (this.base.length === this.nu * 3) return;
    this.base = new Float32Array(this.nu * 3);
    this.rise = new Float32Array(this.nu);
    this.thick = new Float32Array(this.nu);
    this.curl = new Float32Array(this.nu);
    this.lean = new Float32Array(this.nu);
  }

  lastMetrics() {
    return this.metrics;
  }

  build(
    samples: TrailSample[],
    layer: LayerDef,
    coneHeight: number,
    seed: number,
    finished: boolean,
    indexInLayer: number,
  ): PetalSpec {
    this.ensure();
    const nu = this.nu;
    const rng = new Rng(seed);
    const baseY = coneHeight * layer.baseFrac;
    const ringR = coneRadiusAt(baseY, coneHeight) + layer.radiusOffset;

    // --- polar path, unwrapped so a stroke crossing +/-PI stays continuous ---
    const n = Math.max(1, samples.length);
    const th: number[] = new Array(n);
    const rr: number[] = new Array(n);
    const sp: number[] = new Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const s = samples[Math.min(i, samples.length - 1)];
      let a = Math.atan2(s.z, s.x);
      if (i > 0) {
        while (a - prev > Math.PI) a -= Math.PI * 2;
        while (a - prev < -Math.PI) a += Math.PI * 2;
      }
      prev = a;
      th[i] = a;
      const raw = Math.hypot(s.x, s.z);
      rr[i] = clamp(lerp(raw, ringR, layer.correction), ringR * 0.72, ringR * 1.4);
      sp[i] = s.speed;
    }

    // --- angular span kept inside a petal-sized window ---
    let lo = th[0];
    let hi = th[0];
    for (const a of th) {
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    const mid = (lo + hi) * 0.5;
    let span = hi - lo;
    const wanted = clamp(span, layer.minSpan, layer.maxSpan);
    if (span < 1e-3) {
      // A tap, or a stroke that never moved: fan it out into a small petal.
      for (let i = 0; i < n; i++) th[i] = mid + ((n === 1 ? 0.5 : i / (n - 1)) - 0.5) * wanted;
      span = wanted;
    } else if (Math.abs(wanted - span) > 1e-4) {
      const k = wanted / span;
      for (let i = 0; i < n; i++) th[i] = mid + (th[i] - mid) * k;
      span = wanted;
    }

    // --- resample uniformly along the corrected arc, then smooth ---
    const px: number[] = [];
    const pz: number[] = [];
    const pv: number[] = [];
    const cum: number[] = [0];
    for (let i = 0; i < n; i++) {
      px.push(Math.cos(th[i]) * rr[i]);
      pz.push(Math.sin(th[i]) * rr[i]);
      pv.push(sp[i]);
      if (i > 0) cum.push(cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]));
    }
    const total = cum[cum.length - 1];
    const rx = new Float32Array(nu);
    const rz = new Float32Array(nu);
    const rv = new Float32Array(nu);
    for (let i = 0; i < nu; i++) {
      const target = total * (i / (nu - 1));
      if (total < 1e-7) {
        rx[i] = px[0];
        rz[i] = pz[0];
        rv[i] = pv[0];
        continue;
      }
      let k = 1;
      while (k < cum.length - 1 && cum[k] < target) k++;
      const t = (target - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
      rx[i] = lerp(px[k - 1], px[k], t);
      rz[i] = lerp(pz[k - 1], pz[k], t);
      rv[i] = lerp(pv[k - 1], pv[k], t);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < nu - 1; i++) {
        rx[i] = rx[i] * 0.5 + (rx[i - 1] + rx[i + 1]) * 0.25;
        rz[i] = rz[i] * 0.5 + (rz[i - 1] + rz[i + 1]) * 0.25;
        rv[i] = rv[i] * 0.5 + (rv[i - 1] + rv[i + 1]) * 0.25;
      }
    }

    // --- profile: press time and travel speed become height and thickness ---
    const durationMs = samples.length ? samples[samples.length - 1].t : 0;
    let meanSpeed = 0;
    for (let i = 0; i < nu; i++) meanSpeed += rv[i];
    meanSpeed /= nu;
    const pressBoost = clamp(0.86 + durationMs / 2000, 0.86, 1.16);
    const lengthBoost = clamp(0.92 + span * 0.1, 0.92, 1.16);
    const openBoost = 1 + indexInLayer * 0.035;
    const wobble = rng.range(-0.06, 0.06);
    const ceiling = coneHeight + 0.007;

    for (let i = 0; i < nu; i++) {
      const u = i / (nu - 1);
      const head = smoothstep(0, 0.17, u);
      const tail = finished ? smoothstep(1, 0.78, u) : smoothstep(1.06, 0.96, u);
      const shape = Math.pow(clamp(head * tail, 0, 1), 0.62);
      const ripple = 1 + 0.1 * fbm1(u * 3.4 + seed * 0.37, seed, 2);
      let rise = layer.rise * (1 + wobble) * pressBoost * lengthBoost * shape * ripple;
      const topY = baseY + rise;
      if (topY > ceiling) rise = Math.max(0.002, ceiling - baseY);
      const fast = clamp(rv[i] / 1500, 0, 1);
      const thick = layer.thick * lerp(1.3, 0.66, fast) * lerp(0.75, 1, shape);
      this.base[i * 3] = rx[i];
      this.base[i * 3 + 1] = baseY + Math.sin(u * Math.PI) * 0.0006;
      this.base[i * 3 + 2] = rz[i];
      this.rise[i] = rise;
      this.thick[i] = thick;
      this.curl[i] = layer.curl * openBoost * (1 + 0.18 * fbm1(u * 2.1 + 11 + seed * 0.11, seed + 3, 2));
      this.lean[i] = layer.lean;
    }

    this.metrics = { spanRadians: span, durationMs, meanSpeed };

    return {
      base: this.base,
      rise: this.rise,
      thick: this.thick,
      curl: this.curl,
      lean: this.lean,
      cup: ringR * 0.3,
      embed: layer.radiusOffset * 0.55 + 0.0008,
      waviness: 0.1,
      seed: seed % 1000,
      finished,
    };
  }
}

/** Ghost path for the next petal: the arc the player is invited to trace. */
export function ghostPath(
  layer: LayerDef,
  coneHeight: number,
  startAngle: number,
  points = 24,
): THREE.Vector3[] {
  const baseY = coneHeight * layer.baseFrac;
  const r = coneRadiusAt(baseY, coneHeight) + layer.radiusOffset;
  const span = lerp(layer.minSpan, layer.maxSpan, 0.45);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) {
    const u = i / (points - 1);
    const a = startAngle - span / 2 + span * u;
    const rise = layer.rise * Math.pow(Math.sin(Math.PI * u), 0.5);
    out.push(new THREE.Vector3(Math.cos(a) * r, baseY + rise * 0.55, Math.sin(a) * r));
  }
  return out;
}

export const CONE_LIMITS = CONE;
