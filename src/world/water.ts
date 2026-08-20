import { clamp, valueNoise2 } from '../core/util';
import type { Terrain } from './terrain';
import { CELL, NX, NZ, WORLD_D, WORLD_W, type Layout } from './layout';

const N = NX * NZ;
const G = 9.81;

/* Tuned so a 4-year-old sees a response inside one breath, and so the same
   terrain plus the same gate movement reproduces the same run. */
const FLOW_GAIN = 0.9;
const FLUX_DAMP = 0.96;
const SUBSTEPS = 2;
const MIN_DEPTH = 2.5e-5;

const GATE_C = 0.15;
const GATE_GAP_MAX = 0.16;

const SOAK_RATE = 0.011; // m/s of water the dry sand can drink
const SOAK_CAPACITY = 0.0045; // metres of water that saturates one cell
const DRY_RATE = 0.028; // wetness lost per second on bare sand
const WET_SPREAD = 0.9; // capillary creep beyond the waterline

const EROSION = 0.09;
const EROSION_START = 0.30;
const MAX_EROSION_PER_CELL = 0.085;

export interface WaterEvent {
  type: 'breach' | 'arrive';
  x: number;
  y: number;
  z: number;
  power: number;
}

export class Water {
  readonly depth = new Float32Array(N);
  readonly velX = new Float32Array(N);
  readonly velZ = new Float32Array(N);
  private fL = new Float32Array(N);
  private fR = new Float32Array(N);
  private fU = new Float32Array(N);
  private fD = new Float32Array(N);
  private eroded = new Float32Array(N);
  private readonly noise = new Float32Array(N);

  /** notch cells: [downstreamIdx, upstreamIdx] pairs of the sluice face */
  private gateDown: Int32Array = new Int32Array(0);
  private gateUp: Int32Array = new Int32Array(0);

  private resRow1 = 0;
  private pondCells: Int32Array = new Int32Array(0);
  private pondArea = 1;

  gateOpen = 0;
  totalFlow = 0;
  gateFlow = 0;
  pondDepth = 0;
  pondFill = 0;
  wetArea = 0;
  reachedPond = false;

  readonly events: WaterEvent[] = [];
  private breachCooldown = 0;

  constructor(private terrain: Terrain) {
    for (let i = 0; i < N; i++) this.noise[i] = valueNoise2((i % NX) * 0.7, ((i / NX) | 0) * 0.7, 99);
  }

  load(layout: Layout) {
    this.depth.fill(0);
    this.fL.fill(0);
    this.fR.fill(0);
    this.fU.fill(0);
    this.fD.fill(0);
    this.velX.fill(0);
    this.velZ.fill(0);
    this.eroded.fill(0);
    this.events.length = 0;
    this.reachedPond = false;
    this.pondFill = 0;
    this.gateOpen = 0;

    const notchRow = layout.notchRow;
    this.resRow1 = layout.resRow;

    const gx = layout.gateU * (NX - 1);
    const half = layout.gateHalfCells;
    const down: number[] = [];
    const up: number[] = [];
    for (let x = Math.round(gx - half); x <= Math.round(gx + half); x++) {
      if (x < 1 || x >= NX - 1) continue;
      down.push(notchRow * NX + x);
      up.push(layout.resRow * NX + x);
    }
    this.gateDown = Int32Array.from(down);
    this.gateUp = Int32Array.from(up);
    this.resFloorSurface = layout.reservoirSurface;

    // Pre-fill the upper reservoir: the mystery is that water is already there.
    for (let z = 1; z <= this.resRow1; z++) {
      for (let x = 1; x < NX - 1; x++) {
        const i = z * NX + x;
        if (this.terrain.height[i] < layout.reservoirSurface) {
          this.depth[i] = layout.reservoirSurface - this.terrain.height[i];
        }
      }
    }

    const pc: number[] = [];
    for (let z = 0; z < NZ; z++) {
      const v = z / (NZ - 1);
      for (let x = 0; x < NX; x++) {
        const u = x / (NX - 1);
        const d = Math.hypot((u - layout.pondU) / layout.pondRU, (v - layout.pondV) / layout.pondRV);
        if (d < 0.85) pc.push(z * NX + x);
      }
    }
    this.pondCells = Int32Array.from(pc);
    this.pondArea = Math.max(1, pc.length);

    // After rain the low ground is still damp: it reads as where water belongs.
    for (let k = 0; k < this.pondCells.length; k++) this.terrain.wet[this.pondCells[k]] = 0.42;
    const hx = Math.round(layout.hollowU * (NX - 1));
    const hz = Math.round(layout.hollowV * (NZ - 1));
    for (let z = hz - 4; z <= hz + 4; z++) {
      for (let x = hx - 6; x <= hx + 6; x++) {
        if (x < 0 || x >= NX || z < 0 || z >= NZ) continue;
        const f = 1 - Math.hypot((x - hx) / 6, (z - hz) / 4);
        if (f > 0) this.terrain.wet[z * NX + x] = Math.max(this.terrain.wet[z * NX + x], f * 0.45);
      }
    }

    // Seed the tell-tale: one damp patch under the leaking gate.
    for (let k = 0; k < this.gateDown.length; k++) {
      const i = this.gateDown[k];
      this.terrain.wet[i] = 0.55;
      this.terrain.wet[i + NX] = 0.35;
    }
  }

  /** World position of the leak / jet mouth, for particles and audio. */
  gateMouth(out: { x: number; y: number; z: number }) {
    const i = this.gateDown[(this.gateDown.length / 2) | 0] ?? 0;
    const x = i % NX;
    const z = (i / NX) | 0;
    out.x = (x / (NX - 1) - 0.5) * WORLD_W;
    out.z = (z / (NZ - 1) - 0.5) * WORLD_D;
    out.y = this.terrain.height[i] + this.depth[i] + 0.01;
    return out;
  }

  step(dt: number) {
    this.breachCooldown -= dt;
    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) this.simulate(sub);
    this.exchangeWithSand(dt);
    this.applyErosion(dt);
    this.measure();
  }

  private simulate(dt: number) {
    const h = this.terrain.height;
    const d = this.depth;
    const { fL, fR, fU, fD } = this;
    const A = CELL * CELL;
    const k = (dt * A * G * FLOW_GAIN) / CELL;
    const invA = 1 / A;

    // 1. flux update from hydraulic head differences
    for (let z = 0; z < NZ; z++) {
      const row = z * NX;
      for (let x = 0; x < NX; x++) {
        const i = row + x;
        if (d[i] < MIN_DEPTH && fL[i] === 0 && fR[i] === 0 && fU[i] === 0 && fD[i] === 0) continue;
        const H = h[i] + d[i];
        fL[i] = x > 0 ? Math.max(0, fL[i] * FLUX_DAMP + k * (H - (h[i - 1] + d[i - 1]))) : 0;
        fR[i] = x < NX - 1 ? Math.max(0, fR[i] * FLUX_DAMP + k * (H - (h[i + 1] + d[i + 1]))) : 0;
        fU[i] = z > 0 ? Math.max(0, fU[i] * FLUX_DAMP + k * (H - (h[i - NX] + d[i - NX]))) : 0;
        fD[i] = z < NZ - 1 ? Math.max(0, fD[i] * FLUX_DAMP + k * (H - (h[i + NX] + d[i + NX]))) : 0;
      }
    }

    // 2. the sluice face is solid: only the orifice moves water through it
    for (let g = 0; g < this.gateDown.length; g++) {
      const dn = this.gateDown[g];
      fU[dn] = 0;
      fD[dn - NX] = 0;
    }

    // 3. scale outflow so no cell can give away more than it holds
    for (let i = 0; i < N; i++) {
      const out = fL[i] + fR[i] + fU[i] + fD[i];
      if (out <= 0) continue;
      const avail = d[i] * A;
      const need = out * dt;
      if (need > avail) {
        const s = avail / need;
        fL[i] *= s;
        fR[i] *= s;
        fU[i] *= s;
        fD[i] *= s;
      }
    }

    // 4. integrate depth and derive velocity
    for (let z = 0; z < NZ; z++) {
      const row = z * NX;
      for (let x = 0; x < NX; x++) {
        const i = row + x;
        const inL = x > 0 ? fR[i - 1] : 0;
        const inR = x < NX - 1 ? fL[i + 1] : 0;
        const inU = z > 0 ? fD[i - NX] : 0;
        const inD = z < NZ - 1 ? fU[i + NX] : 0;
        const net = inL + inR + inU + inD - (fL[i] + fR[i] + fU[i] + fD[i]);
        const nd = d[i] + net * dt * invA;
        const avg = Math.max(0.004, (d[i] + Math.max(0, nd)) * 0.5);
        d[i] = nd > MIN_DEPTH ? nd : 0;
        this.velX[i] = (inL - fL[i] + fR[i] - inR) / (2 * CELL * avg);
        this.velZ[i] = (inU - fU[i] + fD[i] - inD) / (2 * CELL * avg);
      }
    }

    this.runGate(dt);
    this.refillReservoir(dt);
  }

  private runGate(dt: number) {
    const h = this.terrain.height;
    const d = this.depth;
    const gap = this.gateOpen * GATE_GAP_MAX;
    let moved = 0;
    if (gap > 1e-4) {
      const A = CELL * CELL;
      for (let g = 0; g < this.gateDown.length; g++) {
        const up = this.gateUp[g];
        const dn = this.gateDown[g];
        const sill = h[dn];
        const su = h[up] + d[up];
        const sd = Math.max(h[dn] + d[dn], sill);
        const head = su - sd;
        if (head <= 1e-4 || d[up] <= MIN_DEPTH) continue;
        const opening = Math.min(gap, Math.max(0, su - sill));
        const q = GATE_C * opening * CELL * Math.sqrt(2 * G * head);
        const vol = Math.min(q * dt, d[up] * A * 0.4);
        d[up] -= vol / A;
        d[dn] += vol / A;
        this.velZ[dn] += (vol / A / dt) * 0.5;
        moved += vol;
      }
    }
    this.gateFlow = moved / dt;
  }

  private refillReservoir(dt: number) {
    const h = this.terrain.height;
    const d = this.depth;
    let budget = 0.05 * dt; // m^3 per step, the spring feeding the pool
    for (let z = 1; z <= this.resRow1 && budget > 0; z++) {
      for (let x = 1; x < NX - 1; x++) {
        const i = z * NX + x;
        const want = this.resFloorSurface - (h[i] + d[i]);
        if (want <= 0) continue;
        const add = Math.min(want, budget / (CELL * CELL), 0.004);
        d[i] += add;
        budget -= add * CELL * CELL;
        if (budget <= 0) break;
      }
    }
  }

  resFloorSurface = 0.06;

  /** Sand drinks water; wet sand dries out slowly and creeps outward. */
  private exchangeWithSand(dt: number) {
    const d = this.depth;
    const wet = this.terrain.wet;
    let wetCount = 0;
    for (let i = 0; i < N; i++) {
      const w = wet[i];
      if (d[i] > MIN_DEPTH) {
        if (w < 1) {
          const soak = Math.min(d[i], SOAK_RATE * dt * (1 - w));
          d[i] -= soak;
          wet[i] = clamp(w + soak / SOAK_CAPACITY, 0, 1);
        } else wet[i] = 1;
        wetCount++;
      } else if (w > 0) {
        wet[i] = Math.max(0, w - DRY_RATE * dt * (0.55 + this.noise[i] * 0.9));
      }
    }
    this.wetArea = wetCount;

    // capillary creep: a damp halo that is never a clean circle
    const spread = WET_SPREAD * dt;
    for (let z = 1; z < NZ - 1; z++) {
      const row = z * NX;
      for (let x = 1; x < NX - 1; x++) {
        const i = row + x;
        const w = wet[i];
        if (w < 0.55) continue;
        const give = w * spread * (0.4 + this.noise[i] * 0.8);
        const nb = [i - 1, i + 1, i - NX, i + NX];
        for (let n = 0; n < 4; n++) {
          const j = nb[n];
          if (wet[j] < w) wet[j] = Math.min(w * 0.92, wet[j] + give * 0.25);
        }
      }
    }
  }

  private applyErosion(dt: number) {
    const h = this.terrain.height;
    const d = this.depth;
    const mud = this.terrain.mud;
    let changed = false;
    let worst = 0;
    let worstIdx = -1;
    for (let z = 1; z < NZ - 1; z++) {
      const row = z * NX;
      for (let x = 1; x < NX - 1; x++) {
        const i = row + x;
        if (d[i] < 0.0025) continue;
        const sp = Math.hypot(this.velX[i], this.velZ[i]);
        if (sp <= EROSION_START) continue;
        if (this.eroded[i] >= MAX_EROSION_PER_CELL) continue;
        // packed mud resists; loose dry sand gives way fastest
        const resist = 1 - mud[i] * 0.88;
        const cut = Math.min(
          EROSION * (sp - EROSION_START) * dt * resist,
          MAX_EROSION_PER_CELL - this.eroded[i],
        );
        if (cut <= 0) continue;
        h[i] -= cut;
        this.eroded[i] += cut;
        changed = true;
        // a ridge losing material fast is a breach, not just scouring
        const ridge = h[i] - Math.min(h[i - NX], h[i + NX], h[i - 1], h[i + 1]);
        const score = cut * (0.4 + ridge * 6);
        if (score > worst) {
          worst = score;
          worstIdx = i;
        }
      }
    }
    if (changed) this.terrain.markShapeDirty();
    if (worstIdx >= 0 && worst > 0.0009 && this.breachCooldown <= 0) {
      this.breachCooldown = 2.2;
      this.pushEvent('breach', worstIdx, clamp(worst * 260, 0.3, 1));
    }
  }

  private pushEvent(type: WaterEvent['type'], i: number, power: number) {
    const x = i % NX;
    const z = (i / NX) | 0;
    this.events.push({
      type,
      x: (x / (NX - 1) - 0.5) * WORLD_W,
      y: this.terrain.height[i] + this.depth[i],
      z: (z / (NZ - 1) - 0.5) * WORLD_D,
      power,
    });
  }

  private measure() {
    let sum = 0;
    let deep = 0;
    for (let k = 0; k < this.pondCells.length; k++) {
      const dd = this.depth[this.pondCells[k]];
      sum += dd;
      if (dd > 0.012) deep++;
    }
    this.pondDepth = sum / this.pondArea;
    this.pondFill = deep / this.pondArea;
    let flow = 0;
    for (let i = 0; i < N; i += 3) flow += this.depth[i] > 0.002 ? Math.hypot(this.velX[i], this.velZ[i]) : 0;
    this.totalFlow = flow / (N / 3);

    if (!this.reachedPond && this.pondFill > 0.34 && this.pondDepth > 0.016) {
      this.reachedPond = true;
      const i = this.pondCells[(this.pondCells.length / 2) | 0];
      this.pushEvent('arrive', i, 1);
    }
  }

  /** Sample surface height and flow for props floating on the water. */
  sample(gx: number, gz: number) {
    const x = clamp(Math.round(gx), 0, NX - 1);
    const z = clamp(Math.round(gz), 0, NZ - 1);
    const i = z * NX + x;
    return { depth: this.depth[i], vx: this.velX[i], vz: this.velZ[i], surface: this.terrain.height[i] + this.depth[i] };
  }

  /** Debug visualisation of the water field. */
  debugInto(data: Uint8ClampedArray) {
    for (let i = 0; i < N; i++) {
      const d = this.depth[i];
      const sp = Math.min(1, Math.hypot(this.velX[i], this.velZ[i]) * 1.6);
      data[i * 4] = Math.min(255, sp * 255);
      data[i * 4 + 1] = Math.min(255, this.terrain.wet[i] * 190);
      data[i * 4 + 2] = Math.min(255, d * 2400);
      data[i * 4 + 3] = 255;
    }
  }
}
