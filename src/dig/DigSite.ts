import * as THREE from 'three';
import { clamp, clamp01, fbm2, lerp, smoothstep } from '../util/math';
import { soilTexture, soilRough } from '../util/textures';
import { PATCH_LIFT, SOIL_REPEAT_PER_M } from '../util/ground';
import { PipeSpec, buildPipe, pipeClearanceY } from './Pipes';

export type SoilType = 'sandy' | 'clay' | 'gravel';

interface SoilProfile {
  /** [depth, r, g, b] stops, top to bottom. */
  layers: Array<[number, number, number, number]>;
  /** How readily the soil lets go when suction is applied. */
  looseness: number;
  /** How fast water soaks in. */
  soak: number;
  base: [number, number, number];
}

/**
 * Layer tints multiply the shared soil map, and the topmost layer is
 * deliberately near-neutral so an untouched patch is indistinguishable from
 * the surrounding lot. The strata only announce themselves once dug into.
 */
const SOILS: Record<SoilType, SoilProfile> = {
  sandy: {
    layers: [
      [0.0, 1.0, 0.98, 0.95],
      [0.09, 1.16, 1.06, 0.86],
      [0.26, 1.3, 1.15, 0.85],
      [0.48, 0.94, 0.93, 0.94],
    ],
    looseness: 1.18,
    soak: 1.25,
    base: [104, 90, 68],
  },
  clay: {
    layers: [
      [0.0, 1.0, 0.96, 0.92],
      [0.09, 1.1, 0.83, 0.63],
      [0.28, 1.26, 0.85, 0.56],
      [0.5, 0.9, 0.88, 0.86],
    ],
    looseness: 0.72,
    soak: 0.72,
    base: [104, 90, 68],
  },
  gravel: {
    layers: [
      [0.0, 1.0, 0.99, 0.96],
      [0.1, 1.08, 1.05, 1.0],
      [0.28, 0.92, 0.91, 0.9],
      [0.48, 1.02, 1.0, 0.97],
    ],
    looseness: 0.95,
    soak: 1.0,
    base: [104, 90, 68],
  },
};

export interface DigSiteOptions {
  origin: THREE.Vector3;
  size: number;
  resolution: number;
  soil: SoilType;
  pipes: PipeSpec[];
  quality: number;
}

/** Result of one suction stroke, used to drive particles and audio. */
export interface SuctionReport {
  volume: number;
  wetness: number;
  gritty: boolean;
}

const PIPE_MARGIN = 0.022;
const MAX_DEPTH = 0.72;
const MAX_WALL_STEP = 0.042;
/** How close to the buried surface soil starts lifting off rather than digging. */
const CUT_BAND = 0.075;

export class DigSite {
  readonly group = new THREE.Group();
  readonly origin: THREE.Vector3;
  readonly size: number;
  readonly n: number;
  readonly cell: number;
  readonly pipes: PipeSpec[];
  readonly soil: SoilType;

  readonly depth: Float32Array;
  readonly wet: Float32Array;
  readonly cap: Float32Array;
  readonly base: Float32Array;
  /** 0..1 per vertex: soil actually cleared off the buried surface. */
  readonly cut: Float32Array;
  private grain: Float32Array;

  private mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private wetAttr: THREE.BufferAttribute;
  private cutAttr: THREE.BufferAttribute;
  private dirty = true;
  private profile: SoilProfile;
  private pipeGroup = new THREE.Group();
  private samples: Array<{ x: number; z: number }> = [];
  private flowAccum = 0;

  /** 0..1 fraction of the buried run whose crown is uncovered. */
  exposure = 0;
  /** Set the first time any part of the artificial surface becomes visible. */
  firstSighting = false;

  constructor(opts: DigSiteOptions) {
    this.origin = opts.origin.clone();
    this.size = opts.size;
    this.n = opts.resolution;
    this.cell = this.size / (this.n - 1);
    this.pipes = opts.pipes;
    this.soil = opts.soil;
    this.profile = SOILS[opts.soil];

    const count = this.n * this.n;
    this.depth = new Float32Array(count);
    this.wet = new Float32Array(count);
    this.cap = new Float32Array(count);
    this.base = new Float32Array(count);
    this.cut = new Float32Array(count);
    this.grain = new Float32Array(count);

    this.geo = new THREE.PlaneGeometry(this.size, this.size, this.n - 1, this.n - 1);
    this.geo.rotateX(-Math.PI / 2);
    this.posAttr = this.geo.getAttribute('position') as THREE.BufferAttribute;
    this.colAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.wetAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    this.cutAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    this.geo.setAttribute('color', this.colAttr);
    this.geo.setAttribute('aWet', this.wetAttr);
    this.geo.setAttribute('aCut', this.cutAttr);

    this.initField();

    // Same texel density as the surrounding lot: no seam at the patch border.
    const map = soilTexture(512, this.profile.base);
    map.repeat.set(this.size * SOIL_REPEAT_PER_M, this.size * SOIL_REPEAT_PER_M);
    const rough = soilRough(256);
    rough.repeat.set(this.size * SOIL_REPEAT_PER_M * 1.7, this.size * SOIL_REPEAT_PER_M * 1.7);

    const mat = new THREE.MeshStandardMaterial({
      map,
      roughnessMap: rough,
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    patchWetShader(mat);

    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.position.y = PATCH_LIFT;
    this.mesh.renderOrder = 1;

    const seg = opts.quality >= 2 ? 24 : opts.quality >= 1 ? 16 : 10;
    for (const p of this.pipes) this.pipeGroup.add(buildPipe(p, seg));

    this.group.position.copy(this.origin);
    this.group.add(this.pipeGroup);
    this.group.add(this.mesh);

    this.buildSamples();
    this.refreshColors();
    this.applyHeights();
  }

  private initField() {
    const half = this.size / 2;
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const i = r * this.n + c;
        const x = -half + c * this.cell;
        const z = -half + r * this.cell;
        // micro relief, faded out at the patch border so it meets the flat lot
        const edge = smoothstep(half, half * 0.72, Math.max(Math.abs(x), Math.abs(z)));
        this.base[i] = (fbm2(x * 5.5 + this.origin.x, z * 5.5 + this.origin.z, 3, 5) - 0.5) * 0.028 * edge;
        this.grain[i] = 0.96 + fbm2(c, r, 2, 3) * 0.09;
        const clearance = pipeClearanceY(this.pipes, x, z, PIPE_MARGIN);
        this.cap[i] = clearance === -Infinity ? MAX_DEPTH : Math.min(MAX_DEPTH, -clearance);
        if (this.cap[i] < 0) this.cap[i] = 0;
      }
    }
  }

  /**
   * Exposure is measured over a window around the middle of each run, not the
   * whole length: the job is done when a readable stretch of the pipe is bared,
   * not when the entire service has been dug out.
   */
  private buildSamples() {
    const WINDOW = 0.46; // metres either side of the run's midpoint
    for (const p of this.pipes) {
      const len = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
      if (len < 1e-4) continue;
      const half = this.size / 2 - this.cell * 2;
      const span = Math.min(WINDOW / len, 0.5);
      const steps = Math.max(6, Math.round((span * 2 * len) / 0.075));
      for (let s = 0; s <= steps; s++) {
        const t = 0.5 - span + (2 * span * s) / steps;
        const x = lerp(p.a.x, p.b.x, t);
        const z = lerp(p.a.z, p.b.z, t);
        if (Math.abs(x) > half || Math.abs(z) > half) continue;
        this.samples.push({ x, z });
      }
    }
  }

  private idx(c: number, r: number) {
    return r * this.n + c;
  }

  /** Convert a world position to fractional grid coordinates. */
  private toGrid(worldX: number, worldZ: number): [number, number] {
    const half = this.size / 2;
    return [
      (worldX - this.origin.x + half) / this.cell,
      (worldZ - this.origin.z + half) / this.cell,
    ];
  }

  contains(worldX: number, worldZ: number, pad = 0): boolean {
    const half = this.size / 2 - pad;
    return (
      Math.abs(worldX - this.origin.x) <= half && Math.abs(worldZ - this.origin.z) <= half
    );
  }

  /** Bilinear sample of an array over the grid. */
  private sample(arr: Float32Array, worldX: number, worldZ: number): number {
    const [gx, gz] = this.toGrid(worldX, worldZ);
    const c0 = clamp(Math.floor(gx), 0, this.n - 1);
    const r0 = clamp(Math.floor(gz), 0, this.n - 1);
    const c1 = Math.min(c0 + 1, this.n - 1);
    const r1 = Math.min(r0 + 1, this.n - 1);
    const fx = clamp01(gx - c0);
    const fz = clamp01(gz - r0);
    const a = arr[this.idx(c0, r0)];
    const b = arr[this.idx(c1, r0)];
    const c = arr[this.idx(c0, r1)];
    const d = arr[this.idx(c1, r1)];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  }

  depthAt(worldX: number, worldZ: number) {
    return this.sample(this.depth, worldX, worldZ);
  }

  wetAt(worldX: number, worldZ: number) {
    return this.sample(this.wet, worldX, worldZ);
  }

  /** World-space ground height, including the excavated hole. */
  surfaceY(worldX: number, worldZ: number): number {
    return (
      this.origin.y +
      PATCH_LIFT +
      this.sample(this.base, worldX, worldZ) -
      this.sample(this.depth, worldX, worldZ)
    );
  }

  /**
   * Lowest height a tool tip is allowed to reach. Near buried plant this rises
   * above the soil so the nozzle slides away instead of touching the pipe.
   */
  safeToolY(worldX: number, worldZ: number, standoff = 0.055): number {
    const surf = this.surfaceY(worldX, worldZ) + standoff;
    const clr = pipeClearanceY(
      this.pipes,
      worldX - this.origin.x,
      worldZ - this.origin.z,
      PIPE_MARGIN
    );
    if (clr === -Infinity) return surf;
    return Math.max(surf, this.origin.y + clr + 0.085);
  }

  /** Wet the soil under the water jet. Only the sprayed footprint changes. */
  applyWater(worldX: number, worldZ: number, radius: number, dt: number): number {
    const [gx, gz] = this.toGrid(worldX, worldZ);
    const rg = radius / this.cell;
    const c0 = Math.max(0, Math.floor(gx - rg));
    const c1 = Math.min(this.n - 1, Math.ceil(gx + rg));
    const r0 = Math.max(0, Math.floor(gz - rg));
    const r1 = Math.min(this.n - 1, Math.ceil(gz + rg));
    let added = 0;
    const rate = dt * 2.35 * this.profile.soak;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(c - gx, r - gz) / rg;
        if (d > 1) continue;
        const i = this.idx(c, r);
        const f = 1 - d * d;
        const before = this.wet[i];
        this.wet[i] = clamp01(before + rate * f);
        added += this.wet[i] - before;
      }
    }
    if (added > 0) this.dirty = true;
    return added;
  }

  /**
   * Suck soil at the nozzle. Dry ground barely yields, so softening with water
   * is what makes the hole progress.
   */
  applyVacuum(worldX: number, worldZ: number, radius: number, dt: number): SuctionReport {
    const [gx, gz] = this.toGrid(worldX, worldZ);
    const rg = radius / this.cell;
    const c0 = Math.max(0, Math.floor(gx - rg));
    const c1 = Math.min(this.n - 1, Math.ceil(gx + rg));
    const r0 = Math.max(0, Math.floor(gz - rg));
    const r1 = Math.min(this.n - 1, Math.ceil(gz + rg));
    let volume = 0;
    let wetSum = 0;
    let wetCount = 0;
    let deepest = 0;
    const rate = dt * 0.5 * this.profile.looseness;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(c - gx, r - gz) / rg;
        if (d > 1) continue;
        const i = this.idx(c, r);
        const f = (1 - d * d) * (1 - d * 0.35);
        const w = this.wet[i];
        // 0.06 on bone-dry ground: the hose alone will not open a hole.
        const yield_ = 0.06 + 0.94 * Math.pow(w, 1.25);
        const take = rate * f * yield_;
        const room = this.cap[i] - this.depth[i];
        const dug = Math.min(take, Math.max(0, room));
        if (dug > 0) {
          this.depth[i] += dug;
          volume += dug;
          if (this.depth[i] > deepest) deepest = this.depth[i];
        }
        // Close to buried plant the suction stops driving the hole deeper and
        // starts lifting the last skin of soil off the surface instead. The
        // band means a whole arc of the crown bares, not a hairline.
        if (this.cap[i] < MAX_DEPTH - 0.01 && room < CUT_BAND && this.cut[i] < 1) {
          const nearness = 1 - Math.max(0, room) / CUT_BAND;
          this.cut[i] = Math.min(1, this.cut[i] + take * 13 * nearness);
          volume += take * 0.35 * nearness;
        }
        if (dug > 0 || this.cut[i] > 0) {
          this.wet[i] = Math.max(0, w - take * 2.4);
          wetSum += w;
          wetCount++;
        }
      }
    }
    if (volume > 0) {
      this.dirty = true;
      this.crumble(c0, r0, c1, r1);
      this.smooth(c0, r0, c1, r1);
    }
    return {
      volume,
      wetness: wetCount ? wetSum / wetCount : 0,
      gritty: deepest > 0.42 || this.soil === 'gravel',
    };
  }

  /** Walls that get too steep shed a little material back into the hole. */
  private crumble(c0: number, r0: number, c1: number, r1: number) {
    const pad = 2;
    const cc0 = Math.max(1, c0 - pad);
    const cc1 = Math.min(this.n - 2, c1 + pad);
    const rr0 = Math.max(1, r0 - pad);
    const rr1 = Math.min(this.n - 2, r1 + pad);
    for (let r = rr0; r <= rr1; r++) {
      for (let c = cc0; c <= cc1; c++) {
        const i = this.idx(c, r);
        const di = this.depth[i];
        for (let k = 0; k < 4; k++) {
          const nc = c + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const nr = r + (k === 2 ? 1 : k === 3 ? -1 : 0);
          const j = this.idx(nc, nr);
          const excess = di - this.depth[j] - MAX_WALL_STEP;
          if (excess > 0) {
            const move = excess * 0.09;
            const room = this.cap[j] - this.depth[j];
            const give = Math.min(move, room);
            if (give > 0) {
              this.depth[j] += give;
              this.depth[i] -= give * 0.5;
              // wet crumbs carry their moisture down the wall
              const wm = this.wet[j] * 0.25;
              this.wet[j] -= wm;
              this.wet[i] = clamp01(this.wet[i] + wm);
            }
          }
        }
      }
    }
  }

  /** Light relaxation so repeated crumbling leaves a bowl, not a staircase. */
  private smooth(c0: number, r0: number, c1: number, r1: number) {
    const cc0 = Math.max(1, c0 - 2);
    const cc1 = Math.min(this.n - 2, c1 + 2);
    const rr0 = Math.max(1, r0 - 2);
    const rr1 = Math.min(this.n - 2, r1 + 2);
    for (let r = rr0; r <= rr1; r++) {
      for (let c = cc0; c <= cc1; c++) {
        const i = this.idx(c, r);
        if (this.depth[i] < 0.004) continue;
        const avg =
          (this.depth[this.idx(c + 1, r)] +
            this.depth[this.idx(c - 1, r)] +
            this.depth[this.idx(c, r + 1)] +
            this.depth[this.idx(c, r - 1)]) *
          0.25;
        const next = this.depth[i] + (avg - this.depth[i]) * 0.16;
        this.depth[i] = Math.min(next, this.cap[i]);
      }
    }
  }

  /** Surface water creeps toward the low ground of the hole. */
  private flow(dt: number) {
    const step = Math.min(dt, 0.05);
    for (let r = 1; r < this.n - 1; r += 1) {
      for (let c = 1; c < this.n - 1; c += 1) {
        const i = this.idx(c, r);
        const w = this.wet[i];
        if (w < 0.06) continue;
        const hi = this.base[i] - this.depth[i];
        let bj = -1;
        let bh = hi;
        for (let k = 0; k < 4; k++) {
          const j = this.idx(c + (k === 0 ? 1 : k === 1 ? -1 : 0), r + (k === 2 ? 1 : k === 3 ? -1 : 0));
          const h = this.base[j] - this.depth[j];
          if (h < bh) {
            bh = h;
            bj = j;
          }
        }
        if (bj >= 0 && hi - bh > 0.006) {
          // only a little creep toward the low ground; the sprayed footprint
          // must stay recognisably where the player put it
          const move = Math.min(w * 0.22, (hi - bh) * 1.1) * step * 1.3;
          if (move > 0.0006) {
            this.wet[i] = w - move;
            this.wet[bj] = clamp01(this.wet[bj] + move * 0.9);
            this.dirty = true;
          }
        }
        // slow drying keeps the player working the water/suction rhythm
        this.wet[i] -= step * 0.03;
        if (this.wet[i] < 0) this.wet[i] = 0;
      }
    }
  }

  private layerColor(d: number, out: THREE.Color) {
    const L = this.profile.layers;
    let i = 0;
    while (i < L.length - 1 && d >= L[i + 1][0]) i++;
    const cur = L[i];
    const nxt = L[Math.min(i + 1, L.length - 1)];
    const span = Math.max(0.001, nxt[0] - cur[0]);
    const t = i === L.length - 1 ? 0 : smoothstep(nxt[0] - Math.min(0.05, span * 0.5), nxt[0], d);
    out.setRGB(lerp(cur[1], nxt[1], t), lerp(cur[2], nxt[2], t), lerp(cur[3], nxt[3], t));
  }

  private tmpColor = new THREE.Color();

  private refreshColors() {
    const arr = this.colAttr.array as Float32Array;
    const wa = this.wetAttr.array as Float32Array;
    const ca = this.cutAttr.array as Float32Array;
    for (let i = 0; i < this.depth.length; i++) {
      ca[i] = this.cut[i];
      this.layerColor(this.depth[i], this.tmpColor);
      const grain = this.grain[i];
      arr[i * 3] = this.tmpColor.r * grain;
      arr[i * 3 + 1] = this.tmpColor.g * grain;
      arr[i * 3 + 2] = this.tmpColor.b * grain;
      wa[i] = this.wet[i];
    }
    this.colAttr.needsUpdate = true;
    this.wetAttr.needsUpdate = true;
    this.cutAttr.needsUpdate = true;
  }

  private applyHeights() {
    const p = this.posAttr.array as Float32Array;
    for (let i = 0; i < this.depth.length; i++) {
      p[i * 3 + 1] = this.base[i] - this.depth[i];
    }
    this.posAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  private measureExposure() {
    if (!this.samples.length) return;
    let hit = 0;
    let peak = 0;
    for (const s of this.samples) {
      const c = this.cut[this.nearestIndex(s.x, s.z)];
      if (c > 0.72) hit++;
      if (c > peak) peak = c;
    }
    this.exposure = hit / this.samples.length;
    // wait until a real window is open, not just the first dissolving fragment
    if (!this.firstSighting && peak > 0.55) this.firstSighting = true;
  }

  private nearestIndex(localX: number, localZ: number) {
    const half = this.size / 2;
    const c = clamp(Math.round((localX + half) / this.cell), 0, this.n - 1);
    const r = clamp(Math.round((localZ + half) / this.cell), 0, this.n - 1);
    return this.idx(c, r);
  }

  update(dt: number) {
    this.flowAccum += dt;
    if (this.flowAccum > 1 / 20) {
      this.flow(this.flowAccum);
      this.flowAccum = 0;
    }
    if (this.dirty) {
      this.dirty = false;
      this.refreshColors();
      this.applyHeights();
      this.measureExposure();
    }
  }

  /** Highest wetness anywhere on the patch; used by the automated checks. */
  peakWet(): number {
    let m = 0;
    for (let i = 0; i < this.wet.length; i++) if (this.wet[i] > m) m = this.wet[i];
    return m;
  }

  /** Total moisture held in a disc of soil; drives the water/suction rhythm. */
  wetAround(worldX: number, worldZ: number, radius: number): number {
    const [gx, gz] = this.toGrid(worldX, worldZ);
    const rg = radius / this.cell;
    const c0 = Math.max(0, Math.floor(gx - rg));
    const c1 = Math.min(this.n - 1, Math.ceil(gx + rg));
    const r0 = Math.max(0, Math.floor(gz - rg));
    const r1 = Math.min(this.n - 1, Math.ceil(gz + rg));
    let sum = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (Math.hypot(c - gx, r - gz) > rg) continue;
        sum += this.wet[this.idx(c, r)];
      }
    }
    return sum * this.cell * this.cell;
  }

  /** Deepest point of the hole, used to frame the depth-rod shot. */
  deepest(): { x: number; z: number; depth: number } {
    let best = 0;
    let bi = 0;
    for (let i = 0; i < this.depth.length; i++) {
      if (this.depth[i] > best) {
        best = this.depth[i];
        bi = i;
      }
    }
    const half = this.size / 2;
    return {
      x: this.origin.x - half + (bi % this.n) * this.cell,
      z: this.origin.z - half + Math.floor(bi / this.n) * this.cell,
      depth: best,
    };
  }

  /** Back to untouched ground (used by the replay path). */
  reset() {
    this.depth.fill(0);
    this.wet.fill(0);
    this.cut.fill(0);
    this.exposure = 0;
    this.firstSighting = false;
    this.refreshColors();
    this.applyHeights();
  }

  /** First point where the buried surface has been bared, in world space. */
  firstCutPoint(out: THREE.Vector3): THREE.Vector3 {
    let best = 0;
    let bi = -1;
    for (let i = 0; i < this.cut.length; i++) {
      if (this.cut[i] > best) {
        best = this.cut[i];
        bi = i;
      }
    }
    if (bi < 0) return out.copy(this.origin);
    const half = this.size / 2;
    const x = this.origin.x - half + (bi % this.n) * this.cell;
    const z = this.origin.z - half + Math.floor(bi / this.n) * this.cell;
    return out.set(x, this.origin.y - this.depth[bi], z);
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Wet soil is darker and less rough than dry soil. The per-vertex wetness
 * attribute drives both, so only the sprayed footprint changes.
 */
function patchWetShader(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSoilScale = { value: SOIL_REPEAT_PER_M };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aWet;
attribute float aCut;
varying float vWet;
varying float vCut;
varying vec2 vGrit;
varying vec3 vWPos;
varying vec3 vWNrm;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vWet = aWet;
  vCut = aCut;
  vGrit = uv * 137.0;
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWNrm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uSoilScale;
varying float vWet;
varying float vCut;
varying vec2 vGrit;
varying vec3 vWPos;
varying vec3 vWNrm;`
      )
      .replace(
        'void main() {',
        `void main() {
  // ragged, position-stable dissolve rather than a clean circular cut
  float grit = fract(sin(dot(floor(vGrit), vec2(12.9898, 78.233))) * 43758.5453);
  if (vCut > 0.28 + grit * 0.34) discard;`
      )
      .replace(
        '#include <map_fragment>',
        `{
    // triplanar, so hole walls keep their grain instead of smearing
    vec3 tw = pow(abs(normalize(vWNrm)), vec3(4.0));
    tw /= (tw.x + tw.y + tw.z);
    vec4 soil =
      texture2D(map, vWPos.xz * uSoilScale) * tw.y +
      texture2D(map, vec2(vWPos.z, vWPos.y) * uSoilScale) * tw.x +
      texture2D(map, vec2(vWPos.x, vWPos.y) * uSoilScale) * tw.z;
    diffuseColor *= soil;
  }
  diffuseColor.rgb *= mix(1.0, 0.36, clamp(vWet, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.95, 1.03), clamp(vWet, 0.0, 1.0));`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.28, clamp(vWet, 0.0, 1.0));`
      );
  };
  mat.customProgramCacheKey = () => 'wetsoil';
}
