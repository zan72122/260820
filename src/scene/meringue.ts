import * as THREE from 'three';
import { DIM, SLICE_MID, type QualityProfile } from '../core/tuning';
import { Rng, clamp, easeOutBack, smoothstep } from '../core/rng';
import { PaintMask } from './paintMask';
import { createPeakMaterial, createShellMaterial, type MeringueUniforms } from './materials';
import { buildDomeShell, domeU, domeV, hemisphereSlots, peakVariants } from './geometry';
import type { Cake } from './cake';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const PHI0 = DIM.sliceStart;
const PHI1 = DIM.sliceStart + DIM.sliceSweep;

const BANDS = 5;
/** Roughly how much of a stroke's world footprint counts as "under the nozzle". */
const PIPE_WORLD_RADIUS = 0.31;
const BAKE_WORLD_RADIUS = 0.30;

interface Slot {
  phi: number;
  elev: number;
  dir: THREE.Vector3;
  u: number;
  v: number;
  band: number;
  front: boolean;
  covered: boolean;
  baked: number;
  /** which instanced mesh owns it */
  mesh: THREE.InstancedMesh;
  index: number;
  spin: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  /** 0 -> 1 pop animation */
  pop: number;
  popping: boolean;
}

export interface PipeResult {
  /** true when this stamp actually put new meringue somewhere */
  fresh: boolean;
  coverage: number;
}

/**
 * The meringue coat. Three things move together:
 *
 *  1. the paint mask (coverage / browning / ridge phase),
 *  2. a swelling, self-shadowing shell driven by that mask, and
 *  3. a few hundred instanced star-nozzle peaks that pop up under the finger.
 *
 * The peaks are real geometry — tips, valleys and overlaps — not a texture on
 * a sphere, which is what makes the browning read as "I burnt *that* ridge".
 */
export class Meringue {
  readonly slots: Slot[] = [];
  readonly shellMain: THREE.Mesh;
  readonly shellSlice: THREE.Mesh;
  readonly guides: THREE.Group;

  private mask: PaintMask;
  private uniforms: MeringueUniforms;
  private meshes: THREE.InstancedMesh[] = [];
  private dirtyMeshes = new Set<THREE.InstancedMesh>();
  private popping: Slot[] = [];
  private guideRings: THREE.Mesh[] = [];

  private bandTotals = new Array<number>(BANDS).fill(0);
  private bandFront = new Array<number>(BANDS).fill(0);
  private bandFrontCovered = new Array<number>(BANDS).fill(0);
  private bandAutoDone = new Array<boolean>(BANDS).fill(false);

  private fillQueue: Slot[] = [];
  private fillTimer = 0;
  private fullFillRequested = false;

  private arc = 0;
  private lastPipeDir: THREE.Vector3 | null = null;

  coveredCount = 0;
  frontCount = 0;
  frontCovered = 0;
  frontBaked = 0;

  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();

  constructor(mask: PaintMask, uniforms: MeringueUniforms, quality: QualityProfile) {
    this.mask = mask;
    this.uniforms = uniforms;
    uniforms.uMask.value = mask.texture;

    const shellMat = createShellMaterial(uniforms);
    this.shellMain = new THREE.Mesh(
      buildDomeShell({
        radius: DIM.shellRadius,
        phiStart: PHI1,
        phiLength: TAU - DIM.sliceSweep,
        segU: Math.round(quality.shellSegU * (1 - DIM.sliceSweep / TAU)),
        segV: quality.shellSegV,
      }),
      shellMat,
    );
    this.shellSlice = new THREE.Mesh(
      buildDomeShell({
        radius: DIM.shellRadius,
        phiStart: PHI0,
        phiLength: DIM.sliceSweep,
        segU: Math.max(8, Math.round((quality.shellSegU * DIM.sliceSweep) / TAU)),
        segV: quality.shellSegV,
      }),
      shellMat,
    );
    for (const m of [this.shellMain, this.shellSlice]) {
      // The shell is displaced in the vertex shader, so it never casts — the
      // ice dome underneath carries the contact shadow instead.
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
    }

    /* ------------------------------ peaks ------------------------------ */
    const rng = new Rng(0x7ea5c0);
    const variants = peakVariants(rng, 3);
    const peakMat = createPeakMaterial(uniforms);
    const raw = hemisphereSlots(quality.peakBudget, rng);

    // Peaks are whole instances, so keep their footprints off the pre-split
    // planes — a peak that straddled the cut would tear when the wedge moves.
    const clearCut = (phi: number, elev: number): number => {
      const arc = Math.max(Math.cos(elev), 0.15) * DIM.meringueRadius;
      const need = 0.105 / arc;
      for (const plane of [PHI0, PHI1]) {
        const d = ((phi - plane + Math.PI * 3) % TAU) - Math.PI;
        if (Math.abs(d) < need) phi = plane + (d >= 0 ? need : -need);
      }
      return (phi + TAU) % TAU;
    };

    // Bucket first so each InstancedMesh is sized exactly.
    const buckets = new Map<string, Array<{ phi: number; elev: number; variant: number }>>();
    raw.forEach((s, i) => {
      const phi = clearCut(s.phi, s.elev);
      const inSlice = phi >= PHI0 && phi < PHI1;
      const variant = i % variants.length;
      const key = `${inSlice ? 's' : 'm'}${variant}`;
      const list = buckets.get(key) ?? [];
      list.push({ phi, elev: s.elev, variant });
      buckets.set(key, list);
    });

    for (const [key, list] of buckets) {
      if (list.length === 0) continue;
      const variant = Number(key.slice(1));
      const geo = variants[variant].clone();
      const domeUv = new Float32Array(list.length * 2);
      const seed = new Float32Array(list.length);
      for (let i = 0; i < list.length; i++) {
        domeUv[i * 2] = domeU(list[i].phi);
        domeUv[i * 2 + 1] = domeV(list[i].elev);
        seed[i] = rng.next();
      }
      geo.setAttribute('aDomeUv', new THREE.InstancedBufferAttribute(domeUv, 2));
      geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));

      const mesh = new THREE.InstancedMesh(geo, peakMat, list.length);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.slice = key[0] === 's';
      this.meshes.push(mesh);

      for (let i = 0; i < list.length; i++) {
        const { phi, elev } = list[i];
        const dir = new THREE.Vector3(
          Math.cos(elev) * Math.cos(phi),
          Math.sin(elev),
          Math.cos(elev) * Math.sin(phi),
        );
        const dPhi = Math.abs(((phi - SLICE_MID + Math.PI * 3) % TAU) - Math.PI);
        const slot: Slot = {
          phi,
          elev,
          dir,
          u: domeU(phi),
          v: domeV(elev),
          band: clamp(Math.floor(domeV(elev) * BANDS), 0, BANDS - 1),
          front: dPhi < 1.85,
          covered: false,
          baked: 0,
          mesh,
          index: i,
          spin: rng.range(0, TAU),
          tiltX: rng.range(-0.16, 0.16),
          tiltZ: rng.range(-0.16, 0.16),
          scale: rng.range(0.86, 1.16),
          pop: 0,
          popping: false,
        };
        this.slots.push(slot);
        this.writeMatrix(slot, 0.0001);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (const s of this.slots) {
      this.bandTotals[s.band]++;
      if (s.front) {
        this.bandFront[s.band]++;
        this.frontCount++;
      }
    }

    /* ------------------------- piping guide rings ---------------------- */
    this.guides = new THREE.Group();
    const guideMat = new THREE.MeshBasicMaterial({
      color: 0xfff0d8,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    });
    for (let b = 0; b < BANDS; b++) {
      const v = (b + 0.5) / BANDS;
      const elev = v * HALF_PI;
      const r = (DIM.shellRadius + 0.05) * Math.cos(elev);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(0.08, r), 0.055, 6, 44),
        guideMat.clone(),
      );
      ring.rotation.x = HALF_PI;
      ring.position.y = (DIM.shellRadius + 0.05) * Math.sin(elev);
      ring.renderOrder = 2;
      this.guideRings.push(ring);
      this.guides.add(ring);
    }
    this.guides.visible = false;
  }

  attach(cake: Cake): void {
    cake.domeMain.add(this.shellMain);
    cake.domeSlice.add(this.shellSlice);
    for (const m of this.meshes) {
      (m.userData.slice ? cake.domeSlice : cake.domeMain).add(m);
    }
    cake.domeMain.add(this.guides);
  }

  get coverage(): number {
    return this.slots.length ? this.coveredCount / this.slots.length : 0;
  }

  /** How much of what the player can actually see is browned. */
  get bakedFraction(): number {
    return this.frontCovered > 0 ? this.frontBaked / this.frontCovered : 0;
  }

  get frontCoverage(): number {
    return this.frontCount > 0 ? this.frontCovered / this.frontCount : 0;
  }

  showGuides(on: boolean): void {
    this.guides.visible = on;
  }

  /* ------------------------------------------------------------------ *
   * Painting helpers
   * ------------------------------------------------------------------ */

  /** Convert a round world-space footprint into the dome's stretched UV space. */
  private stamp(
    dir: THREE.Vector3,
    worldRadius: number,
    cover: number,
    bake: number,
    ridge: number,
  ): void {
    const elev = Math.asin(clamp(dir.y, -1, 1));
    const phi = Math.atan2(dir.z, dir.x);
    const u = ((phi / TAU) % 1 + 1) % 1;
    const v = domeV(elev);
    const cosT = Math.max(Math.cos(elev), 0.001);
    const ry = worldRadius / (HALF_PI * DIM.meringueRadius);
    let rx = worldRadius / (TAU * DIM.meringueRadius * cosT);

    if (rx > 0.30) {
      // Near the pole every azimuth is the same place: sweep the whole cap.
      for (let k = 0; k < 3; k++) {
        this.mask.add({
          u: (u + k / 3) % 1,
          v,
          rx: 0.34,
          ry,
          cover,
          bake,
          ridge,
        });
      }
      return;
    }
    rx = Math.max(rx, ry * 0.25);
    this.mask.add({ u, v, rx, ry, cover, bake, ridge });
  }

  private markCovered(slot: Slot, scale: number): void {
    if (slot.covered) return;
    slot.covered = true;
    slot.scale *= scale;
    slot.popping = true;
    slot.pop = 0;
    this.popping.push(slot);
    this.coveredCount++;
    if (slot.front) {
      this.frontCovered++;
      this.bandFrontCovered[slot.band]++;
    }
  }

  private writeMatrix(slot: Slot, scale: number): void {
    const lift = DIM.shellRadius + DIM.meringueSwell * 0.82 - 0.03;
    this.tmpV.copy(slot.dir).multiplyScalar(lift);
    this.tmpQ.setFromUnitVectors(Y_AXIS, slot.dir);
    this.tmpQ2.setFromEuler(new THREE.Euler(slot.tiltX, slot.spin, slot.tiltZ));
    this.tmpQ.multiply(this.tmpQ2);
    this.tmpS.setScalar(scale);
    this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
    slot.mesh.setMatrixAt(slot.index, this.tmpM);
    this.dirtyMeshes.add(slot.mesh);
  }

  /* ------------------------------------------------------------------ *
   * Piping
   * ------------------------------------------------------------------ */

  beginStroke(): void {
    this.lastPipeDir = null;
  }

  /**
   * Lay meringue at a point on the dome. `dir` is a unit vector in dome space.
   * Returns whether this dab covered anything new, which the caller turns into
   * the little squeeze sound.
   */
  pipeAt(dir: THREE.Vector3, dtScale: number): PipeResult {
    const prev = this.lastPipeDir;
    const gap = prev ? prev.angleTo(dir) : 0;
    // A finger that outruns the frame rate still leaves one unbroken rope.
    const steps = clamp(Math.ceil(gap / 0.055), 1, 12);
    let fresh = false;
    const cosLimit = Math.cos(PIPE_WORLD_RADIUS / DIM.meringueRadius);
    const scratch = this.tmpV;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (prev) scratch.copy(prev).lerp(dir, t).normalize();
      else scratch.copy(dir);

      this.arc += (gap * DIM.meringueRadius) / steps;
      // A periodic ridge along the travel direction gives the star-nozzle wave.
      const wave = 0.5 + 0.5 * Math.sin(this.arc * 24);
      const ridge = Math.pow(wave, 2.2);
      const k = dtScale / steps;
      this.stamp(scratch, PIPE_WORLD_RADIUS, 1.8 * k, 0, 1.6 * ridge * k);

      for (const s of this.slots) {
        if (s.covered) continue;
        if (s.dir.dot(scratch) > cosLimit) {
          this.markCovered(s, 1);
          fresh = true;
        }
      }
    }

    this.lastPipeDir = prev ? prev.copy(dir) : dir.clone();
    return { fresh, coverage: this.coverage };
  }

  /* ------------------------------------------------------------------ *
   * Baking
   * ------------------------------------------------------------------ */

  /** `heat` is 0..1: how close the flame tip is to the surface. */
  bakeAt(dir: THREE.Vector3, heat: number, dt: number): number {
    const amount = clamp(heat, 0, 1) * dt;
    if (amount <= 0) return 0;
    this.stamp(dir, BAKE_WORLD_RADIUS, 0, 1.1 * amount, 0);

    const cosLimit = Math.cos((BAKE_WORLD_RADIUS * 1.15) / DIM.meringueRadius);
    let touched = 0;
    for (const s of this.slots) {
      if (!s.covered) continue;
      const d = s.dir.dot(dir);
      if (d > cosLimit) {
        const before = s.baked;
        s.baked = clamp(s.baked + amount * 1.2, 0, 1);
        if (s.front && before < 0.45 && s.baked >= 0.45) this.frontBaked++;
        touched++;
      }
    }
    return touched;
  }

  /* ------------------------------------------------------------------ *
   * Gap filling — nobody has to be neat
   * ------------------------------------------------------------------ */

  /** Queue every remaining gap in bands the player has mostly covered. */
  private considerBandAutoFill(): void {
    for (let b = 0; b < BANDS; b++) {
      if (this.bandAutoDone[b]) continue;
      const front = this.bandFront[b];
      if (front === 0) continue;
      if (this.bandFrontCovered[b] / front < 0.4) continue;
      this.bandAutoDone[b] = true;
      for (const s of this.slots) {
        if (s.band === b && !s.covered) this.fillQueue.push(s);
      }
      const ring = this.guideRings[b];
      if (ring) ring.userData.fading = true;
    }
  }

  /** Fill everything that is left, used when the player says they are done. */
  requestFullFill(): void {
    if (this.fullFillRequested) return;
    this.fullFillRequested = true;
    for (let b = 0; b < BANDS; b++) this.bandAutoDone[b] = true;
    for (const s of this.slots) if (!s.covered) this.fillQueue.push(s);
    for (const r of this.guideRings) r.userData.fading = true;
  }

  get filling(): boolean {
    return this.fillQueue.length > 0;
  }

  private stepFill(dt: number): void {
    if (this.fillQueue.length === 0) return;
    this.fillTimer += dt;
    // ~110 gap peaks a second: fast enough to feel automatic, slow enough to see.
    const per = 1 / 110;
    while (this.fillTimer >= per && this.fillQueue.length > 0) {
      this.fillTimer -= per;
      const s = this.fillQueue.pop();
      if (!s || s.covered) continue;
      this.stamp(s.dir, PIPE_WORLD_RADIUS * 0.62, 0.5, 0, 0.42);
      this.markCovered(s, 0.82);
    }
  }

  /* ------------------------------------------------------------------ */

  update(dt: number, phase: 'pipe' | 'other'): void {
    if (phase === 'pipe') this.considerBandAutoFill();
    this.stepFill(dt);

    // pop animations
    for (let i = this.popping.length - 1; i >= 0; i--) {
      const s = this.popping[i];
      s.pop = Math.min(1, s.pop + dt * 5.2);
      this.writeMatrix(s, s.scale * easeOutBack(s.pop));
      if (s.pop >= 1) {
        s.popping = false;
        this.popping.splice(i, 1);
      }
    }
    for (const m of this.dirtyMeshes) m.instanceMatrix.needsUpdate = true;
    this.dirtyMeshes.clear();

    // guide rings fade out as their band is finished
    for (let b = 0; b < BANDS; b++) {
      const ring = this.guideRings[b];
      const mat = ring.material as THREE.MeshBasicMaterial;
      const want = ring.userData.fading ? 0 : 0.13 + 0.06 * Math.sin(performance.now() * 0.003 + b);
      mat.opacity += (want - mat.opacity) * Math.min(1, dt * 4);
      ring.visible = mat.opacity > 0.005;
    }
  }

  /** Slightly dry the surface globally once the torch is done. */
  setDryness(v: number): void {
    this.uniforms.uSSS.value = 0.3 * (1 - 0.35 * clamp(v, 0, 1));
  }

  reset(): void {
    this.mask.clear();
    this.coveredCount = 0;
    this.frontCovered = 0;
    this.frontBaked = 0;
    this.arc = 0;
    this.lastPipeDir = null;
    this.fillQueue.length = 0;
    this.fullFillRequested = false;
    this.popping.length = 0;
    this.bandFrontCovered.fill(0);
    this.bandAutoDone.fill(false);
    for (const s of this.slots) {
      s.covered = false;
      s.baked = 0;
      s.pop = 0;
      s.popping = false;
      this.writeMatrix(s, 0.0001);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.dirtyMeshes.clear();
    for (const r of this.guideRings) {
      r.userData.fading = false;
      (r.material as THREE.MeshBasicMaterial).opacity = 0.13;
      r.visible = true;
    }
    this.uniforms.uSSS.value = 0.3;
  }

  /** Coverage-weighted hint for the HUD ("almost there"). */
  get progressHint(): number {
    return smoothstep(0.1, 0.9, this.frontCoverage);
  }

  dispose(): void {
    this.shellMain.geometry.dispose();
    this.shellSlice.geometry.dispose();
    (this.shellMain.material as THREE.Material).dispose();
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.dispose();
    }
    (this.meshes[0]?.material as THREE.Material | undefined)?.dispose();
    for (const r of this.guideRings) {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    }
  }
}
