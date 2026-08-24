import * as THREE from 'three';
import { clamp, lerp, makeThreadMaterial, releaseThreadMaterial, DynamicTube } from './core';
import type { HornSpec } from './unicorn';

/**
 * Rainbow threads: the one impossible thing in this world.
 * After rain, at the right sun angle, refracted light can be drawn out of a
 * raindrop as a thin fibre with real tension. Everything else obeys physics.
 */

export interface ThreadColorDef {
  idx: number;
  name: string;
  color: THREE.Color;
}

export const THREAD_COLORS: ThreadColorDef[] = [
  { idx: 0, name: 'red', color: new THREE.Color(0xff5a4d) },
  { idx: 1, name: 'amber', color: new THREE.Color(0xffb347) },
  { idx: 2, name: 'teal', color: new THREE.Color(0x3fd6c0) }
];

const TURNS_PER_DROPLET = 3;
const SAMPLES_PER_TURN = 36;

// ------------------------------------------------------------------ droplet

const HANG_SEGS = 12;

export class Droplet {
  pos: THREE.Vector3;
  colorDef: ThreadColorDef;
  turnsLeft = TURNS_PER_DROPLET;
  hooked = false;
  dead = false;
  mesh: THREE.Mesh;
  private hang: DynamicTube;
  private hangMat: THREE.ShaderMaterial;
  private baseR = 0.028;
  private sway: number;
  /** 0..1 — used by the wind-gust hint to lean the fibre toward the horn. */
  gustLean = 0;
  gustTarget: THREE.Vector3 | null = null;
  private tip = new THREE.Vector3();
  private hangPts: THREE.Vector3[] = [];
  private spark: THREE.Mesh;

  constructor(private scene: THREE.Scene, pos: THREE.Vector3, colorDef: ThreadColorDef, seed: number) {
    this.pos = pos.clone();
    this.colorDef = colorDef;
    this.sway = seed * 12.9;

    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xdceefc, roughness: 0.03, metalness: 0.12,
      transparent: true, opacity: 0.42, envMapIntensity: 3.2
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.baseR, 12, 10), dropMat);
    this.mesh.scale.y = 1.15; // gravity-stretched drop, not a balloon
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    // bright refraction spark inside the drop
    this.spark = new THREE.Mesh(
      new THREE.SphereGeometry(this.baseR * 0.32, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.9 })
    );
    this.spark.position.set(-this.baseR * 0.25, this.baseR * 0.2, this.baseR * 0.2);
    this.mesh.add(this.spark);

    // the dangling few centimetres of light-fibre (fixed topology, no churn)
    this.hangMat = makeThreadMaterial(colorDef.color, { opacity: 0.8 });
    this.hang = new DynamicTube(this.hangMat, HANG_SEGS, 5, 0.0032);
    for (let i = 0; i <= HANG_SEGS; i++) this.hangPts.push(new THREE.Vector3());
    scene.add(this.hang.mesh);
    this.rebuildHang(0);
  }

  tipWorld(out = new THREE.Vector3()): THREE.Vector3 { return out.copy(this.tip); }

  private static end = new THREE.Vector3();
  private static mid = new THREE.Vector3();

  private rebuildHang(t: number): void {
    const len = 0.075;
    const sx = Math.sin(t * 1.7 + this.sway) * 0.006;
    const sz = Math.cos(t * 1.3 + this.sway * 2) * 0.006;
    const end = Droplet.end.set(this.pos.x + sx * 2, this.pos.y - len, this.pos.z + sz * 2);
    if (this.gustLean > 0.01 && this.gustTarget) {
      end.lerp(this.gustTarget, this.gustLean);
    }
    const mid = Droplet.mid.set(
      (this.pos.x + end.x) / 2 + sx, (this.pos.y + end.y) / 2, (this.pos.z + end.z) / 2 + sz
    );
    // quadratic bezier through pos → mid → end, sampled without allocation
    for (let i = 0; i <= HANG_SEGS; i++) {
      const u = i / HANG_SEGS;
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      this.hangPts[i].set(
        a * this.pos.x + b * mid.x + c * end.x,
        a * this.pos.y + b * mid.y + c * end.y,
        a * this.pos.z + b * mid.z + c * end.z
      );
    }
    this.hang.update(this.hangPts);
    this.tip.copy(end);
  }

  update(t: number): void {
    if (this.dead) return;
    // gentle wobble on its stalk
    const w = 1 + Math.sin(t * 2.1 + this.sway) * 0.03;
    const frac = this.turnsLeft / TURNS_PER_DROPLET;
    const s = this.baseR / 0.028 * lerp(0.35, 1, Math.pow(frac, 0.7));
    this.mesh.scale.set(s * w, s * 1.15 / w, s * w);
    this.hang.mesh.visible = !this.hooked && this.turnsLeft > 0.05;
    if (this.hang.mesh.visible) {
      this.rebuildHang(t);
      // rare, quiet glints as the fibre catches the sun — the only invitation
      const glint = Math.pow(Math.max(0, Math.sin(t * 0.9 + this.sway * 3)), 12);
      this.hangMat.uniforms.uBoost.value = 1 + glint * 1.6;
    }
  }

  /** Called when its thread is exhausted: the drop is spent water again. */
  die(): void {
    this.dead = true;
    this.hooked = false;
    this.scene.remove(this.hang.mesh);
    this.hang.mesh.geometry.dispose();
    releaseThreadMaterial(this.hangMat);
    this.mesh.remove(this.spark);
    (this.spark.material as THREE.Material).dispose();
    this.spark.geometry.dispose();
    (this.mesh.material as THREE.MeshStandardMaterial).opacity = 0.25;
    this.mesh.scale.setScalar(0.3);
  }
}

export class DropletField {
  list: Droplet[] = [];
  constructor(scene: THREE.Scene, mounts: { pos: THREE.Vector3; onWeb: boolean }[], rng: () => number) {
    // shuffle colours so every playthrough striping differs
    const colors: ThreadColorDef[] = [];
    for (let i = 0; i < mounts.length; i++) colors.push(THREAD_COLORS[i % 3]);
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    mounts.forEach((m, i) => {
      this.list.push(new Droplet(scene, m.pos, colors[i], rng()));
    });
  }

  nearestHookable(p: THREE.Vector3, maxDist: number): Droplet | null {
    let best: Droplet | null = null;
    let bd = maxDist;
    const tip = new THREE.Vector3();
    for (const d of this.list) {
      if (d.dead || d.hooked || d.turnsLeft <= 0.05) continue;
      const dist = d.tipWorld(tip).distanceTo(p);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  remainingTurns(): number {
    return this.list.reduce((s, d) => s + (d.dead ? 0 : d.turnsLeft), 0);
  }

  update(t: number): void {
    for (const d of this.list) d.update(t);
  }
}

// ------------------------------------------------------------------ horn spool

export interface Coil {
  colorIdx: number;
  turns: number;              // current wound turns (fraction while active)
  wav: number[];              // waviness per sample, appended as it winds
  tube: THREE.Mesh | null;
  startTurn: number;          // spool position where this coil begins (turns from tip)
  dirty: boolean;
}

export class HornSpool {
  coils: Coil[] = [];
  /** dangling unwound loop (after reversing when nothing is hooked) */
  loose = 0;
  looseColorIdx = -1;
  private looseMesh: THREE.Mesh | null = null;
  private looseDirty = false;
  capacityTurns = 14;

  constructor(private spec: HornSpec) {}

  get totalTurns(): number {
    return this.coils.reduce((s, c) => s + c.turns, 0);
  }
  get active(): Coil | null {
    return this.coils.length ? this.coils[this.coils.length - 1] : null;
  }

  /** Radius of the horn core cone at param t (0 base → 1 tip). */
  private coreR(t: number): number {
    return lerp(this.spec.r0 * 0.88, this.spec.r1 * 0.8, t);
  }

  /** Spool-local position for a given absolute wound-turn coordinate (0 = first catch). */
  private helixPoint(turnsFromTip: number, wav: number, out: THREE.Vector3): THREE.Vector3 {
    const { length } = this.spec;
    // first wrap catches high on the horn, later wraps stack toward the base
    const t = clamp(0.78 - (turnsFromTip / this.capacityTurns) * 0.52, 0.2, 0.95);
    const a = turnsFromTip * Math.PI * 2;
    // seated on the cone surface: core radius + thread radius + ridge clearance
    const rr = this.coreR(t) + 0.0045 + 0.002 + wav * 0.004 * Math.sin(a * 7.3);
    out.set(Math.cos(a) * rr, length * t + wav * 0.003 * Math.sin(a * 11.1), Math.sin(a) * rr);
    return out;
  }

  private buildCoilGeometry(coil: Coil): THREE.BufferGeometry | null {
    const n = coil.wav.length;
    if (n < 3) return null;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const turns = coil.startTurn + i / SAMPLES_PER_TURN;
      pts.push(this.helixPoint(turns, coil.wav[i], new THREE.Vector3()));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, Math.max(8, n), 0.0045, 6);
  }

  private refreshCoil(coil: Coil): void {
    coil.dirty = true;
  }

  /** Rebuild at most one dirty coil (and the loose loop) per frame — GC friendly. */
  flush(): void {
    for (const coil of this.coils) {
      if (!coil.dirty) continue;
      coil.dirty = false;
      const geo = this.buildCoilGeometry(coil);
      if (!geo) {
        if (coil.tube) coil.tube.visible = false;
        continue;
      }
      if (!coil.tube) {
        const mat = makeThreadMaterial(THREAD_COLORS[coil.colorIdx].color, { opacity: 0.95, boost: 1.05 });
        coil.tube = new THREE.Mesh(geo, mat);
        coil.tube.frustumCulled = false;
        this.spec.group.add(coil.tube);
      } else {
        coil.tube.geometry.dispose();
        coil.tube.geometry = geo;
        coil.tube.visible = true;
      }
      break; // one heavy rebuild per frame is plenty
    }
    if (this.looseDirty) {
      this.looseDirty = false;
      this.rebuildLoose();
    }
  }

  begin(colorIdx: number): void {
    const a = this.active;
    if (a && a.colorIdx === colorIdx && a.turns < 0.02) return; // reuse empty stub
    this.coils.push({
      colorIdx, turns: 0, wav: [], tube: null, startTurn: this.totalTurns, dirty: false
    });
  }

  /** Wind dTurns onto the active coil. speed shapes the lay: fast → wavy. */
  wind(dTurns: number, speed: number): number {
    const coil = this.active;
    if (!coil || dTurns <= 0) return 0;
    const room = this.capacityTurns - this.totalTurns;
    const amt = Math.min(dTurns, room);
    if (amt <= 0) return 0;
    const wav = clamp((speed - 1.6) / 2.5, 0, 1);   // slow circles lie flat and tidy
    const targetSamples = Math.round((coil.turns + amt) * SAMPLES_PER_TURN);
    while (coil.wav.length < targetSamples) coil.wav.push(wav);
    coil.turns += amt;
    this.refreshCoil(coil);
    return amt;
  }

  /** Reverse while still hooked: thread returns toward its droplet. */
  unwindActive(dTurns: number): number {
    const coil = this.active;
    if (!coil || dTurns <= 0) return 0;
    const amt = Math.min(dTurns, coil.turns);
    coil.turns -= amt;
    coil.wav.length = Math.max(0, Math.round(coil.turns * SAMPLES_PER_TURN));
    if (coil.turns <= 0.005) {
      this.removeCoil(coil);
    } else {
      this.refreshCoil(coil);
    }
    return amt;
  }

  private removeCoil(coil: Coil): void {
    if (coil.tube) {
      this.spec.group.remove(coil.tube);
      coil.tube.geometry.dispose();
      releaseThreadMaterial(coil.tube.material as THREE.Material);
    }
    const i = this.coils.indexOf(coil);
    if (i >= 0) this.coils.splice(i, 1);
  }

  /** Reverse when nothing is hooked: the top loop comes loose and dangles. */
  unwindTop(dTurns: number): number {
    const coil = this.active;
    if (!coil || dTurns <= 0) return 0;
    const amt = Math.min(dTurns, coil.turns, 1.2 - this.loose);
    if (amt <= 0) return 0;
    coil.turns -= amt;
    coil.wav.length = Math.max(0, Math.round(coil.turns * SAMPLES_PER_TURN));
    this.loose += amt;
    this.looseColorIdx = coil.colorIdx;
    this.refreshCoil(coil);
    this.looseDirty = true;
    return amt;
  }

  /** Forward again: the dangling loop winds back on first. */
  rewindLoose(dTurns: number, speed: number): number {
    if (this.loose <= 0) return 0;
    const coil = this.active;
    if (!coil) return 0;
    const amt = Math.min(dTurns, this.loose);
    this.loose -= amt;
    const wav = clamp((speed - 1.6) / 2.5, 0, 1);
    coil.turns += amt;
    const targetSamples = Math.round(coil.turns * SAMPLES_PER_TURN);
    while (coil.wav.length < targetSamples) coil.wav.push(wav);
    this.refreshCoil(coil);
    this.looseDirty = true;
    return amt;
  }

  private rebuildLoose(): void {
    if (this.loose <= 0.02) {
      if (this.looseMesh) this.looseMesh.visible = false;
      return;
    }
    const { length } = this.spec;
    const top = new THREE.Vector3(0.02, length * 0.55, 0.02);
    const len = 0.05 + this.loose * 0.16;
    const pts = [
      top,
      new THREE.Vector3(0.05, length * 0.55 - len * 0.5, 0.04),
      new THREE.Vector3(0.02, length * 0.55 - len, 0.06),
      new THREE.Vector3(-0.02, length * 0.55 - len * 0.75, 0.02)
    ];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0042, 5);
    if (!this.looseMesh) {
      const mat = makeThreadMaterial(THREAD_COLORS[Math.max(0, this.looseColorIdx)].color, { opacity: 0.9 });
      this.looseMesh = new THREE.Mesh(geo, mat);
      this.looseMesh.frustumCulled = false;
      this.spec.group.add(this.looseMesh);
    } else {
      this.looseMesh.geometry.dispose();
      this.looseMesh.geometry = geo;
      this.looseMesh.visible = true;
      (this.looseMesh.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(
        THREAD_COLORS[Math.max(0, this.looseColorIdx)].color
      );
    }
  }

  /**
   * Consume turns from the top of the spool (LIFO — physically, the last
   * thread wound is the first paid out). Returns colour segments consumed.
   */
  takeTurns(n: number): { colorIdx: number; turns: number }[] {
    const out: { colorIdx: number; turns: number }[] = [];
    let left = n;
    while (left > 0.001 && this.coils.length > 0) {
      const coil = this.coils[this.coils.length - 1];
      const amt = Math.min(left, coil.turns);
      coil.turns -= amt;
      coil.wav.length = Math.max(0, Math.round(coil.turns * SAMPLES_PER_TURN));
      left -= amt;
      out.push({ colorIdx: coil.colorIdx, turns: amt });
      if (coil.turns <= 0.01) this.removeCoil(coil);
      else this.refreshCoil(coil);
    }
    return out;
  }

  /** Colour order base→tip: the child's collecting order, kept for the deck pattern. */
  colorSequence(): number[] {
    return this.coils.map(c => c.colorIdx);
  }
}

// ------------------------------------------------------------------ live thread (droplet → horn)

const LIVE_SEGS = 16;

export class ActiveThread {
  private tube: DynamicTube;
  private mat: THREE.ShaderMaterial;
  private pts: THREE.Vector3[] = [];
  visible = false;

  constructor(scene: THREE.Scene) {
    this.mat = makeThreadMaterial(new THREE.Color(0xffffff), { opacity: 0.9 });
    this.tube = new DynamicTube(this.mat, LIVE_SEGS, 5, 0.0035);
    this.tube.mesh.visible = false;
    for (let i = 0; i <= LIVE_SEGS; i++) this.pts.push(new THREE.Vector3());
    scene.add(this.tube.mesh);
  }

  setColor(c: THREE.Color): void {
    (this.mat.uniforms.uColor.value as THREE.Color).copy(c);
  }

  /** tension 0 = saggy, 1 = taut. No allocation — safe to call per frame. */
  set(a: THREE.Vector3, b: THREE.Vector3, tension: number): void {
    const dist = a.distanceTo(b);
    const sag = lerp(dist * 0.22, dist * 0.015, clamp(tension, 0, 1));
    const kCosh = Math.cosh(1.2) - 1;
    for (let i = 0; i <= LIVE_SEGS; i++) {
      const t = i / LIVE_SEGS;
      const p = this.pts[i];
      p.lerpVectors(a, b, t);
      const dip = (Math.cosh((t - 0.5) * 2.4) - 1) / kCosh;
      p.y -= sag * (1 - dip);
    }
    this.tube.update(this.pts);
    this.tube.mesh.visible = true;
    this.visible = true;
  }

  hide(): void {
    this.tube.mesh.visible = false;
    this.visible = false;
  }
}
