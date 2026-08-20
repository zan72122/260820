// The pile of shaved ice.
//
// A height field the size of the bowl. Flakes deposit into it, it slumps toward
// its angle of repose every frame, and a displaced grid mesh renders it. The
// bowl's own inner surface is baked in as the floor so the snow beds down into
// the glass instead of floating above it.

import { Mesh, PlaneGeometry, DataTexture, RGBAFormat, HalfFloatType, LinearFilter, ClampToEdgeWrapping } from 'three';
import { toHalf } from '../util/half.js';
import { createMoundMaterial } from '../materials/mound.js';
import { BOWL } from './Bowl.js';
import { M } from './Machine.js';

const BOWL_PROFILE = [
  [0.0000, 0.0140], [0.0180, 0.0136], [0.0360, 0.0156], [0.0520, 0.0216],
  [0.0660, 0.0316], [0.0745, 0.0430], [0.0775, 0.0508],
];

function bowlInner(r) {
  if (r <= BOWL_PROFILE[0][0]) return BOWL_PROFILE[0][1];
  for (let i = 1; i < BOWL_PROFILE.length; i++) {
    if (r <= BOWL_PROFILE[i][0]) {
      const [r0, y0] = BOWL_PROFILE[i - 1], [r1, y1] = BOWL_PROFILE[i];
      const t = (r - r0) / (r1 - r0);
      return y0 + (y1 - y0) * t;
    }
  }
  return BOWL_PROFILE[BOWL_PROFILE.length - 1][1];
}

export class Mound {
  constructor(scene, opts) {
    const { quality, syrupSurf, syrupSoak, iceNormal, sparkle, clump, envMap, sun } = opts;
    const N = quality.moundGrid;
    this.N = N;
    this.extent = 0.172;
    this.cell = this.extent / (N - 1);
    this.cellArea = this.cell * this.cell;
    this.baseY = 0.0130;
    this.cx = BOWL.center.x;
    this.cz = BOWL.center.z;
    this.wallR = 0.0772;
    this.maxTotal = 0.105;

    this.snow = new Float32Array(N * N);
    this.tmp = new Float32Array(N * N);
    this.floor = new Float32Array(N * N);
    this.active = new Uint8Array(N * N);
    this.data = new Uint16Array(N * N * 4);

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const dx = (i / (N - 1) - 0.5) * this.extent;
        const dz = -(j / (N - 1) - 0.5) * this.extent;
        const r = Math.hypot(dx, dz);
        this.active[k] = r <= this.wallR ? 1 : 0;
        // floor measured from baseY; outside the bowl it is the rim, an impassable wall
        this.floor[k] = this.active[k]
          ? Math.max(0, bowlInner(r) - 0.0130)
          : 0.058;
      }
    }

    this.tex = new DataTexture(this.data, N, N, RGBAFormat, HalfFloatType);
    this.tex.minFilter = this.tex.magFilter = LinearFilter;
    this.tex.wrapS = this.tex.wrapT = ClampToEdgeWrapping;
    this.tex.needsUpdate = true;
    this._upload();

    const geo = new PlaneGeometry(this.extent, this.extent, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    this.material = createMoundMaterial({
      heightTex: this.tex, syrupSurf, syrupSoak, iceNormal, sparkle, clump, envMap, sun,
      cellSize: this.cell, gridSize: N, maxHeight: this.maxTotal, quality,
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.position.set(this.cx, this.baseY, this.cz);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);

    this.volume = 0;
    this.capacity = 0.00063;       // a full bowl, domed well over the rim
    this.dirty = true;
    this.peak = 0;
    this._acc = 0;
  }

  reset() {
    this.snow.fill(0);
    this.volume = 0;
    this.peak = 0;
    this.mesh.visible = false;
    this.dirty = true;
  }

  /** world (x,z) -> fractional grid coords */
  gridOf(x, z) {
    return [
      ((x - this.cx) / this.extent + 0.5) * (this.N - 1),
      (0.5 - (z - this.cz) / this.extent) * (this.N - 1),
    ];
  }

  uvOf(x, z) {
    return [
      (x - this.cx) / this.extent + 0.5,
      0.5 - (z - this.cz) / this.extent,
    ];
  }

  /** Height of the top of the snow (world y) at a world x,z. */
  surfaceY(x, z) {
    const [gi, gj] = this.gridOf(x, z);
    const i = Math.round(gi), j = Math.round(gj);
    if (i < 0 || j < 0 || i >= this.N || j >= this.N) return this.baseY;
    const k = j * this.N + i;
    return this.baseY + this.floor[k] + this.snow[k];
  }

  /** Drops `vol` cubic metres onto the pile around world (x, z). */
  deposit(x, z, vol) {
    if (vol <= 0) return;
    const [gi, gj] = this.gridOf(x, z);
    const N = this.N;
    const R = 2;
    let wsum = 0;
    const i0 = Math.max(0, Math.floor(gi) - R), i1 = Math.min(N - 1, Math.floor(gi) + R);
    const j0 = Math.max(0, Math.floor(gj) - R), j1 = Math.min(N - 1, Math.floor(gj) + R);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (!this.active[j * N + i]) continue;
        const d2 = (i - gi) * (i - gi) + (j - gj) * (j - gj);
        wsum += Math.exp(-d2 / 2.2);
      }
    }
    if (wsum <= 0) return;
    const hAdd = vol / (this.cellArea * wsum);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        if (!this.active[k]) continue;
        const d2 = (i - gi) * (i - gi) + (j - gj) * (j - gj);
        this.snow[k] += hAdd * Math.exp(-d2 / 2.2);
      }
    }
    this.volume += vol;
    this.dirty = true;
    if (!this.mesh.visible) this.mesh.visible = true;
  }

  /** Angle-of-repose relaxation. Shaved ice stands steeply; it is not sand. */
  settle(dt, iterations = 1) {
    const N = this.N, snow = this.snow, floor = this.floor, act = this.active;
    const maxDrop = 0.74 * this.cell;      // tan(36.5 deg)
    const rate = Math.min(0.55, dt * 26);
    for (let it = 0; it < iterations; it++) {
      const tmp = this.tmp;
      tmp.set(snow);
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
          const k = j * N + i;
          if (!act[k]) continue;
          const s = snow[k];
          if (s <= 1e-6) continue;
          const h = floor[k] + s;
          let give = 0;
          const nb = [k - 1, k + 1, k - N, k + N];
          const d = [0, 0, 0, 0];
          for (let n = 0; n < 4; n++) {
            const kn = nb[n];
            if (!act[kn]) continue;
            const diff = h - (floor[kn] + snow[kn]) - maxDrop;
            if (diff > 0) { d[n] = diff; give += diff; }
          }
          if (give <= 0) continue;
          let move = Math.min(s * 0.5, give * 0.28) * rate;
          if (move <= 0) continue;
          for (let n = 0; n < 4; n++) {
            if (d[n] <= 0) continue;
            tmp[nb[n]] += move * (d[n] / give);
          }
          tmp[k] -= move;
        }
      }
      snow.set(tmp);
    }
    this.dirty = true;
  }

  update(dt) {
    // a long frame drops a lot of snow at once, so it has to slump proportionally
    // harder or the pile grows a spire the repose angle would never allow
    if (this.volume > 0) this.settle(dt, Math.max(1, Math.min(4, Math.round(dt * 90))));
    if (this.dirty) this._upload();
  }

  _upload() {
    const N = this.N, d = this.data, snow = this.snow, floor = this.floor;
    let peak = 0;
    for (let k = 0; k < N * N; k++) {
      let s = snow[k];
      const total = floor[k] + s;
      if (s > peak) peak = s;
      const o = k * 4;
      d[o] = toHalf(total);
      d[o + 1] = toHalf(s);
      d[o + 2] = 0;
      d[o + 3] = toHalf(1);
    }
    this.peak = peak;
    this.tex.needsUpdate = true;
    this.dirty = false;
  }

  get fill() { return Math.min(1, this.volume / this.capacity); }

  /** Highest point of the pile, in world space — where the camera and bottle aim. */
  peakWorld(out) {
    const N = this.N;
    let best = -1, bi = N >> 1, bj = N >> 1;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const v = this.floor[k] + this.snow[k];
        if (this.snow[k] > 0.001 && v > best) { best = v; bi = i; bj = j; }
      }
    }
    return out.set(
      this.cx + (bi / (N - 1) - 0.5) * this.extent,
      this.baseY + Math.max(best, 0),
      this.cz - (bj / (N - 1) - 0.5) * this.extent
    );
  }
}
