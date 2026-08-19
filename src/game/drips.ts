import * as THREE from 'three';
import { makeLiquidMaterial } from './glazeMesh';
import { CAKE_R } from './profile';
import { Rng, clamp } from '../core/util';

const MAX_DRIPS = 26;
const MAX_DROPS = 34;
const DRIP_UNIT = 0.022;
const DRIP_RAD = 0.0046;

function dripGeometry(low: boolean) {
  const prof: [number, number][] = [
    [0.0, -1.0],
    [0.2, -0.955],
    [0.4, -0.885],
    [0.5, -0.76],
    [0.45, -0.56],
    [0.37, -0.34],
    [0.33, -0.14],
    [0.36, 0.0],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, low ? 8 : 12);
}

interface Drip {
  active: boolean;
  col: number;
  len: number;
  want: number;
  vel: number;
  color: THREE.Color;
  age: number;
  starve: number;
}

interface Drop {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  color: THREE.Color;
}

export type SplashFn = (x: number, z: number, r: number, color: THREE.Color) => void;

/**
 * Side drips and the droplets they shed. Driven entirely by the coverage field's
 * rim readback, so what falls is exactly what the child poured.
 */
export class DripSystem {
  readonly group = new THREE.Group();
  private drips: Drip[] = [];
  private drops: Drop[] = [];
  private dripMesh: THREE.InstancedMesh;
  private dropMesh: THREE.InstancedMesh;
  private rng = new Rng(7);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private tmpCol = new THREE.Color();
  private cols: number;

  constructor(cols: number, low: boolean) {
    this.cols = cols;
    const mat = makeLiquidMaterial(0xffffff);
    this.dripMesh = new THREE.InstancedMesh(dripGeometry(low), mat, MAX_DRIPS);
    this.dripMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dripMesh.frustumCulled = false;
    this.dripMesh.count = MAX_DRIPS;
    this.group.add(this.dripMesh);

    const dropMat = makeLiquidMaterial(0xffffff);
    this.dropMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, low ? 7 : 10, low ? 5 : 7),
      dropMat,
      MAX_DROPS
    );
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.frustumCulled = false;
    this.dropMesh.count = MAX_DROPS;
    this.group.add(this.dropMesh);

    for (let i = 0; i < MAX_DRIPS; i++) {
      this.drips.push({
        active: false,
        col: 0,
        len: 0,
        want: 0,
        vel: 0,
        color: new THREE.Color(1, 1, 1),
        age: 0,
        starve: 0,
      });
      this.dripMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    for (let i = 0; i < MAX_DROPS; i++) {
      this.drops.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        r: 0.003,
        color: new THREE.Color(1, 1, 1),
      });
      this.dropMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.hideAll();
  }

  reset(seed: number) {
    this.rng = new Rng(seed || 7);
    for (const d of this.drips) {
      d.active = false;
      d.len = 0;
      d.want = 0;
      d.vel = 0;
      d.starve = 0;
    }
    for (const d of this.drops) d.active = false;
    this.hideAll();
  }

  private hideAll() {
    this.s.set(0, 0, 0);
    this.m.compose(new THREE.Vector3(0, -99, 0), this.q, this.s);
    for (let i = 0; i < MAX_DRIPS; i++) this.dripMesh.setMatrixAt(i, this.m);
    for (let i = 0; i < MAX_DROPS; i++) this.dropMesh.setMatrixAt(i, this.m);
    this.dripMesh.instanceMatrix.needsUpdate = true;
    this.dropMesh.instanceMatrix.needsUpdate = true;
  }

  get activeCount() {
    let n = 0;
    for (const d of this.drips) if (d.active) n++;
    return n;
  }

  update(
    dt: number,
    rim: Float32Array,
    rimColor: Float32Array,
    trayLocalY: number,
    splash: SplashFn,
    onDrop: () => void,
    allowNew: boolean
  ) {
    const threshold = 0.56;

    // ---- spawn -----------------------------------------------------------
    if (allowNew) {
      for (let c = 0; c < this.cols; c++) {
        if (rim[c] < threshold) continue;
        let busy = false;
        for (const d of this.drips) {
          if (!d.active) continue;
          const dc = Math.abs(d.col - c);
          if (Math.min(dc, this.cols - dc) < 2) {
            busy = true;
            break;
          }
        }
        if (busy) continue;
        if (this.rng.next() > 0.3) continue;
        const slot = this.drips.find((d) => !d.active);
        if (!slot) break;
        slot.active = true;
        slot.col = c;
        slot.len = 0.002;
        slot.vel = 0;
        slot.age = 0;
        slot.starve = 0;
        slot.color.setRGB(
          rimColor[c * 3],
          rimColor[c * 3 + 1],
          rimColor[c * 3 + 2]
        );
      }
    }

    // ---- grow / release --------------------------------------------------
    for (let i = 0; i < MAX_DRIPS; i++) {
      const d = this.drips[i];
      if (!d.active) continue;
      d.age += dt;
      const supply = rim[d.col];
      if (supply > threshold) {
        d.starve = 0;
        d.want = clamp(0.016 + (supply - threshold) * 0.11, 0.012, 0.062);
        this.tmpCol.setRGB(
          rimColor[d.col * 3],
          rimColor[d.col * 3 + 1],
          rimColor[d.col * 3 + 2]
        );
        d.color.lerp(this.tmpCol, Math.min(1, dt * 2));
      } else {
        d.starve += dt;
        d.want = Math.max(0, d.want - dt * 0.004);
      }

      // a drip accelerates as it lengthens — surface tension losing the fight
      const pull = (d.want - d.len) * 1.4 + (d.len > 0.02 ? 0.02 : 0);
      d.vel = d.vel * 0.88 + pull * dt * 9;
      d.len = clamp(d.len + d.vel * dt, 0, 0.072);

      const release = d.len > 0.036 && (d.vel > 0.004 || d.starve > 0.25);
      if (release) {
        this.spawnDrop(d);
        d.len *= 0.42;
        d.vel = 0;
      }
      if (d.starve > 0.6 && d.len < 0.012) {
        d.len = Math.max(0, d.len - dt * 0.02);
        if (d.len <= 0.0015) {
          d.active = false;
          d.len = 0;
        }
      }

      const a = ((d.col + 0.5) / this.cols) * Math.PI * 2;
      const rr = CAKE_R + 0.0022;
      this.v.set(Math.cos(a) * rr, 0.0012, Math.sin(a) * rr);
      const stretch = d.len / DRIP_UNIT;
      const thin = clamp(1.25 - stretch * 0.16, 0.55, 1.3);
      this.s.set(DRIP_RAD * thin, DRIP_UNIT * stretch, DRIP_RAD * thin);
      this.m.compose(this.v, this.q, this.s);
      this.dripMesh.setMatrixAt(i, this.m);
      this.dripMesh.setColorAt(i, d.color);
    }
    for (let i = 0; i < MAX_DRIPS; i++) {
      if (this.drips[i].active) continue;
      this.s.set(0, 0, 0);
      this.m.compose(this.v.set(0, -99, 0), this.q, this.s);
      this.dripMesh.setMatrixAt(i, this.m);
    }
    this.dripMesh.instanceMatrix.needsUpdate = true;
    if (this.dripMesh.instanceColor) this.dripMesh.instanceColor.needsUpdate = true;

    // ---- falling droplets ------------------------------------------------
    for (let i = 0; i < MAX_DROPS; i++) {
      const p = this.drops[i];
      if (p.active) {
        p.vel.y -= 4.2 * dt;
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y <= trayLocalY) {
          p.active = false;
          splash(p.pos.x, p.pos.z, p.r * 3.4, p.color);
          onDrop();
        }
      }
      if (p.active) {
        const sq = 1 + clamp(-p.vel.y * 0.35, 0, 0.8);
        this.s.set(p.r / sq, p.r * sq, p.r / sq);
        this.m.compose(p.pos, this.q, this.s);
        this.dropMesh.setColorAt(i, p.color);
      } else {
        this.s.set(0, 0, 0);
        this.m.compose(this.v.set(0, -99, 0), this.q, this.s);
      }
      this.dropMesh.setMatrixAt(i, this.m);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }

  private spawnDrop(d: Drip) {
    const p = this.drops.find((x) => !x.active);
    if (!p) return;
    const a = ((d.col + 0.5) / this.cols) * Math.PI * 2;
    const rr = CAKE_R + 0.0022;
    p.active = true;
    p.pos.set(Math.cos(a) * rr, -d.len, Math.sin(a) * rr);
    p.vel.set(
      (this.rng.next() - 0.5) * 0.01,
      -0.02,
      (this.rng.next() - 0.5) * 0.01
    );
    p.r = 0.0026 + this.rng.next() * 0.0016;
    p.color.copy(d.color);
  }
}
