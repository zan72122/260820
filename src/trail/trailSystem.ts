import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Scene,
  ShaderMaterial,
  Sphere,
  Texture,
  Vector3,
} from 'three';
import type { Settings } from '../core/settings';
import { clamp } from '../core/math';
import { createRibbonMaterial } from './ribbonMaterial';

interface RibbonSlot {
  mesh: Mesh;
  geo: BufferGeometry;
  pos: Float32Array;
  side: Float32Array;
  birth: Float32Array;
  drop: Float32Array;
  density: Float32Array;
  drift: Float32Array;
  count: number;
  open: boolean;
  used: boolean;
  startedAt: number;
  order: number;
  lastPoint: Vector3;
  history: Vector3[];
}

export interface ArcRecord {
  amplitude: number;
  width: number;
  startedAt: number;
  span: number;
  dir: number;
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpBinormal = new Vector3();
const WORLD_Z = new Vector3(0, 0, 1);

function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 65536) / 65536;
}

function buildStripIndices(samples: number, vertexOffset: number, out: Uint16Array, at: number): number {
  let k = at;
  for (let i = 0; i < samples - 1; i++) {
    const a = vertexOffset + i * 2;
    out[k++] = a;
    out[k++] = a + 1;
    out[k++] = a + 2;
    out[k++] = a + 1;
    out[k++] = a + 3;
    out[k++] = a + 2;
  }
  return k;
}

/**
 * World-space ribbon geometry generated from where the seat edges really went.
 *
 * Nothing here is drawn in screen space: every vertex is a point in the park, so
 * the arcs sit behind the seat, occlude correctly against the frame and the mist
 * arch, and move with the camera like the physical wake they represent.
 */
export class TrailSystem {
  readonly group: Mesh[] = [];
  readonly arcs: ArcRecord[] = [];

  private scene: Scene;
  private settings: Settings;
  private material: ShaderMaterial;
  private archiveMaterial: ShaderMaterial;
  private slots: RibbonSlot[] = [];
  private archiveGeo: BufferGeometry;
  private archive: {
    pos: Float32Array;
    side: Float32Array;
    birth: Float32Array;
    drop: Float32Array;
    density: Float32Array;
    drift: Float32Array;
    mesh: Mesh;
  };
  private archiveCursor = 0;
  private archiveFilled = 0;
  private orderCounter = 0;
  private maxSamples: number;
  private lifetime: number;
  private time = 0;

  /** Per-pass state shared by the two seat-edge ribbons. */
  private passWidth = 1;
  private passSeed = 1;
  private passSamples = 0;
  private passDir = 1;
  private passStartAmp = 0;

  constructor(scene: Scene, settings: Settings, spectrum: Texture) {
    this.scene = scene;
    this.settings = settings;
    this.maxSamples = settings.arcSegments;
    this.lifetime = settings.tier === 'low' ? 30 : settings.tier === 'mid' ? 42 : 48;

    this.material = createRibbonMaterial(spectrum, this.lifetime);
    this.archiveMaterial = createRibbonMaterial(spectrum, this.lifetime);
    this.archiveMaterial.uniforms.uIntensity.value = 1.05;

    for (let i = 0; i < settings.activeArcs; i++) this.slots.push(this.makeSlot());

    // One consolidated mesh holds every retired arc: a single draw call, fixed size.
    const slotsN = settings.archiveArcs;
    const verts = slotsN * this.maxSamples * 2;
    const pos = new Float32Array(verts * 3);
    const side = new Float32Array(verts);
    const birth = new Float32Array(verts);
    const drop = new Float32Array(verts);
    const density = new Float32Array(verts);
    const drift = new Float32Array(verts);
    const idx = new Uint16Array(slotsN * (this.maxSamples - 1) * 6);
    let at = 0;
    for (let s = 0; s < slotsN; s++) at = buildStripIndices(this.maxSamples, s * this.maxSamples * 2, idx, at);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSide', new BufferAttribute(side, 1));
    geo.setAttribute('aBirth', new BufferAttribute(birth, 1));
    geo.setAttribute('aDrop', new BufferAttribute(drop, 1));
    geo.setAttribute('aDensity', new BufferAttribute(density, 1));
    geo.setAttribute('aDrift', new BufferAttribute(drift, 1));
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new Sphere(new Vector3(0, 1.2, 0), 14);

    const mesh = new Mesh(geo, this.archiveMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);

    this.archiveGeo = geo;
    this.archive = { pos, side, birth, drop, density, drift, mesh };
    this.group.push(mesh);
  }

  private makeSlot(): RibbonSlot {
    const s = this.maxSamples;
    const verts = s * 2;
    const pos = new Float32Array(verts * 3);
    const side = new Float32Array(verts);
    const birth = new Float32Array(verts);
    const drop = new Float32Array(verts);
    const density = new Float32Array(verts);
    const drift = new Float32Array(verts);
    const idx = new Uint16Array((s - 1) * 6);
    buildStripIndices(s, 0, idx, 0);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSide', new BufferAttribute(side, 1));
    geo.setAttribute('aBirth', new BufferAttribute(birth, 1));
    geo.setAttribute('aDrop', new BufferAttribute(drop, 1));
    geo.setAttribute('aDensity', new BufferAttribute(density, 1));
    geo.setAttribute('aDrift', new BufferAttribute(drift, 1));
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new Sphere(new Vector3(0, 1.2, 0), 10);

    const mesh = new Mesh(geo, this.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 11;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.scene.add(mesh);
    this.group.push(mesh);

    return {
      mesh,
      geo,
      pos,
      side,
      birth,
      drop,
      density,
      drift,
      count: 0,
      open: false,
      used: false,
      startedAt: 0,
      order: 0,
      lastPoint: new Vector3(),
      history: [new Vector3(), new Vector3(), new Vector3()],
    };
  }

  get uniforms(): ShaderMaterial['uniforms'] {
    return this.material.uniforms;
  }

  setSun(dir: Vector3, strength: number): void {
    this.material.uniforms.uSunDir.value.copy(dir);
    this.archiveMaterial.uniforms.uSunDir.value.copy(dir);
    this.material.uniforms.uSunStrength.value = strength;
    this.archiveMaterial.uniforms.uSunStrength.value = strength;
  }

  setWind(w: Vector3): void {
    this.material.uniforms.uWind.value.copy(w);
    this.archiveMaterial.uniforms.uWind.value.copy(w);
  }

  advanceTime(t: number): void {
    this.time = t;
    this.material.uniforms.uTime.value = t;
    this.archiveMaterial.uniforms.uTime.value = t;
  }

  get openCount(): number {
    return this.slots.reduce((n, s) => n + (s.open ? 1 : 0), 0);
  }

  get arcCount(): number {
    return this.arcs.length;
  }

  /** Kick off a new pass: both seat edges begin their own ribbon. */
  beginPass(amplitude: number, dir: number, widthBoost: number): void {
    if (this.openCount > 0) return;
    this.passSeed = (this.passSeed * 1103515245 + 12345) & 0x7fffffff;
    this.passWidth = clamp(0.62 + widthBoost * 0.85, 0.5, 1.75);
    this.passSamples = 0;
    this.passDir = dir;
    this.passStartAmp = amplitude;

    for (const k of [-1, 1]) {
      const slot = this.acquire();
      slot.open = true;
      slot.used = true;
      slot.count = 0;
      slot.startedAt = this.time;
      slot.order = this.orderCounter++;
      slot.mesh.visible = true;
      slot.geo.setDrawRange(0, 0);
      slot.lastPoint.set(NaN, NaN, NaN);
      (slot as RibbonSlot & { edge?: number }).edge = k;
    }
  }

  /** Append a sample pair for both open ribbons. */
  appendSeat(
    seat: Vector3,
    tangent: Vector3,
    radial: Vector3,
    speedNorm: number,
    density: number,
    energy: number,
  ): void {
    if (this.openCount === 0) return;
    const open = this.slots.filter((s) => s.open);
    for (const slot of open) {
      const edge = (slot as RibbonSlot & { edge?: number }).edge ?? 1;
      this.appendTo(slot, edge, seat, tangent, radial, speedNorm, density, energy);
    }
    this.passSamples++;
  }

  private appendTo(
    slot: RibbonSlot,
    edge: number,
    seat: Vector3,
    tangent: Vector3,
    radial: Vector3,
    speedNorm: number,
    density: number,
    energy: number,
  ): void {
    if (slot.count >= this.maxSamples) {
      this.close(slot);
      return;
    }
    const i = slot.count;
    const seed = this.passSeed + (edge > 0 ? 7717 : 2137);

    // Centre of this ribbon: the seat edge, plus the wake's lag and outward fling.
    tmpA.copy(seat).addScaledVector(WORLD_Z, edge * 0.205);
    tmpA.addScaledVector(tangent, -(0.05 + 0.10 * speedNorm));
    tmpA.addScaledVector(radial, 0.045 + 0.20 * speedNorm);

    // Smooth, correlated wander along the thread. Per-sample white noise would
    // make the ribbon zig-zag into flames; a wake meanders instead.
    const ph = hash3(seed, 0, 11) * 6.283;
    const jitter = 0.016 + 0.030 * speedNorm;
    tmpA.x += Math.sin(i * 0.21 + ph) * jitter;
    tmpA.y += Math.sin(i * 0.13 + ph * 1.7) * jitter * 0.8;
    tmpA.z += Math.sin(i * 0.17 + ph * 2.3) * jitter * 1.7;

    // Local curvature of the laid-down centre line, sampled from the last points.
    let curvature = 0;
    if (i >= 2) {
      tmpB.subVectors(slot.history[0], slot.history[1]);
      tmpC.subVectors(slot.history[1], slot.history[2]);
      const l1 = tmpB.length();
      const l2 = tmpC.length();
      if (l1 > 1e-4 && l2 > 1e-4) {
        const cosang = clamp(tmpB.dot(tmpC) / (l1 * l2), -1, 1);
        curvature = Math.acos(cosang) / Math.max(l1, 1e-3);
      }
    }
    slot.history[2].copy(slot.history[1]);
    slot.history[1].copy(slot.history[0]);
    slot.history[0].copy(tmpA);

    // Width follows speed and curvature: a fast, tightly turning seat displaces
    // more mist and leaves a broader thread.
    // Two thin threads, one off each edge of the belt. Width answers to speed and
    // to how hard the path is turning, and stays a thread, never a sheet.
    const half =
      (0.034 + 0.088 * speedNorm) *
      (0.82 + 0.50 * clamp(curvature * 1.6, 0, 1)) *
      this.passWidth *
      (0.85 + 0.3 * energy) *
      (0.60 + 0.40 * density);

    // A wake rolls as it is shed, so the ribbon twists slowly along its length.
    const twist = 0.85 * Math.sin(i * 0.075 + hash3(seed, 0, 9) * 6.28) * (0.35 + 0.65 * speedNorm);
    tmpBinormal.set(tangent.y, -tangent.x, 0).normalize();
    tmpBinormal.multiplyScalar(Math.cos(twist)).addScaledVector(WORLD_Z, Math.sin(twist) * 0.85);
    if (tmpBinormal.lengthSq() < 1e-6) tmpBinormal.set(0, 0, 1);
    tmpBinormal.normalize();

    const dropSize = clamp(
      0.5 + Math.sin(i * 0.09 + ph * 3.1) * 0.32 + (speedNorm - 0.5) * 0.40,
      0,
      1,
    );
    const dens = clamp(density * (0.45 + 0.55 * speedNorm), 0, 1);
    // Drift has to vary smoothly along the thread. Per-sample randomness here
    // shears neighbouring vertices apart over time and shatters the ribbon.
    const driftK = 0.55 + 0.45 * Math.sin(i * 0.11 + ph * 4.7);

    const v = i * 2;
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      const o = (v + s) * 3;
      slot.pos[o] = tmpA.x + tmpBinormal.x * half * sign;
      slot.pos[o + 1] = tmpA.y + tmpBinormal.y * half * sign;
      slot.pos[o + 2] = tmpA.z + tmpBinormal.z * half * sign;
      slot.side[v + s] = sign;
      slot.birth[v + s] = this.time;
      slot.drop[v + s] = dropSize;
      slot.density[v + s] = dens;
      slot.drift[v + s] = driftK;
    }

    slot.count = i + 1;
    slot.lastPoint.copy(tmpA);
    slot.geo.setDrawRange(0, Math.max(0, (slot.count - 1) * 6));
    this.markDirty(slot);
  }

  private markDirty(slot: RibbonSlot): void {
    for (const name of ['position', 'aSide', 'aBirth', 'aDrop', 'aDensity', 'aDrift']) {
      const attr = slot.geo.getAttribute(name) as BufferAttribute;
      attr.needsUpdate = true;
    }
  }

  /** Finish the current pass and taper both threads so they have no cut ends. */
  endPass(): void {
    for (const slot of this.slots) if (slot.open) this.close(slot);
  }

  private close(slot: RibbonSlot): void {
    if (!slot.open) return;
    slot.open = false;
    const n = slot.count;
    if (n < 4) {
      slot.used = false;
      slot.mesh.visible = false;
      slot.geo.setDrawRange(0, 0);
      return;
    }
    const taper = Math.min(6, Math.floor(n / 3));
    for (let i = 0; i < taper; i++) {
      const f = i / taper;
      for (let s = 0; s < 2; s++) {
        slot.density[i * 2 + s] *= f;
        slot.density[(n - 1 - i) * 2 + s] *= f;
      }
    }
    this.markDirty(slot);

    if ((slot as RibbonSlot & { edge?: number }).edge === 1) {
      this.arcs.push({
        amplitude: this.passStartAmp,
        width: this.passWidth,
        startedAt: slot.startedAt,
        span: this.passSamples,
        dir: this.passDir,
      });
      if (this.arcs.length > 200) this.arcs.shift();
    }
  }

  private acquire(): RibbonSlot {
    const free = this.slots.find((s) => !s.used);
    if (free) return free;

    // No free thread: retire the oldest finished one into the consolidated mesh.
    let oldest: RibbonSlot | null = null;
    for (const s of this.slots) {
      if (s.open) continue;
      if (!oldest || s.order < oldest.order) oldest = s;
    }
    if (!oldest) {
      oldest = this.slots[0];
      this.close(oldest);
    }
    this.bake(oldest);
    return oldest;
  }

  private bake(slot: RibbonSlot): void {
    const s = this.maxSamples;
    const base = this.archiveCursor * s * 2;
    const n = slot.count;
    const a = this.archive;

    for (let i = 0; i < s; i++) {
      const src = Math.min(i, Math.max(0, n - 1));
      for (let e = 0; e < 2; e++) {
        const di = base + i * 2 + e;
        const si = src * 2 + e;
        a.pos[di * 3] = slot.pos[si * 3];
        a.pos[di * 3 + 1] = slot.pos[si * 3 + 1];
        a.pos[di * 3 + 2] = slot.pos[si * 3 + 2];
        a.side[di] = slot.side[si];
        a.birth[di] = slot.birth[si];
        a.drop[di] = slot.drop[si];
        // Samples past the end collapse to a zero-area, zero-density tail.
        a.density[di] = i < n ? slot.density[si] : 0;
        a.drift[di] = slot.drift[si];
      }
    }

    this.archiveCursor = (this.archiveCursor + 1) % this.settings.archiveArcs;
    this.archiveFilled = Math.min(this.archiveFilled + 1, this.settings.archiveArcs);
    this.archiveGeo.setDrawRange(0, this.archiveFilled * (s - 1) * 6);
    for (const name of ['position', 'aSide', 'aBirth', 'aDrop', 'aDensity', 'aDrift']) {
      (this.archiveGeo.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }

    slot.used = false;
    slot.count = 0;
    slot.mesh.visible = false;
    slot.geo.setDrawRange(0, 0);
  }

  /** Hide threads that have completely faded so they stop costing fill rate. */
  cull(): void {
    for (const slot of this.slots) {
      if (!slot.used || slot.open) continue;
      if (this.time - slot.startedAt > this.lifetime) {
        slot.used = false;
        slot.mesh.visible = false;
        slot.geo.setDrawRange(0, 0);
      }
    }
  }

  clear(): void {
    for (const slot of this.slots) {
      slot.open = false;
      slot.used = false;
      slot.count = 0;
      slot.mesh.visible = false;
      slot.geo.setDrawRange(0, 0);
    }
    this.archiveCursor = 0;
    this.archiveFilled = 0;
    this.archiveGeo.setDrawRange(0, 0);
    this.arcs.length = 0;
    this.orderCounter = 0;
  }

  /** Rough centre and radius of everything currently woven, for the camera pull-back. */
  bounds(out: { center: Vector3; radius: number }): boolean {
    let n = 0;
    out.center.set(0, 0, 0);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const slot of this.slots) {
      if (!slot.used) continue;
      for (let i = 0; i < slot.count; i += 4) {
        const o = i * 2 * 3;
        const x = slot.pos[o];
        const y = slot.pos[o + 1];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        out.center.x += x;
        out.center.y += y;
        n++;
      }
    }
    if (n === 0) return false;
    out.center.divideScalar(n);
    out.center.z = 0;
    out.radius = Math.max(0.9, 0.5 * Math.max(maxX - minX, maxY - minY));
    return true;
  }

  /** Vertex-level facts about the woven geometry, used by the automated checks. */
  stats(): {
    activeVerts: number;
    zMin: number;
    zMax: number;
    yMin: number;
    yMax: number;
    xMin: number;
    xMax: number;
    archiveFilled: number;
    visibleMeshes: number;
  } {
    let activeVerts = 0;
    let zMin = Infinity;
    let zMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    let xMin = Infinity;
    let xMax = -Infinity;
    let visibleMeshes = this.archiveFilled > 0 ? 1 : 0;
    for (const slot of this.slots) {
      if (!slot.used) continue;
      visibleMeshes++;
      for (let i = 0; i < slot.count * 2; i++) {
        const o = i * 3;
        activeVerts++;
        xMin = Math.min(xMin, slot.pos[o]);
        xMax = Math.max(xMax, slot.pos[o]);
        yMin = Math.min(yMin, slot.pos[o + 1]);
        yMax = Math.max(yMax, slot.pos[o + 1]);
        zMin = Math.min(zMin, slot.pos[o + 2]);
        zMax = Math.max(zMax, slot.pos[o + 2]);
      }
    }
    return {
      activeVerts,
      zMin: activeVerts ? zMin : 0,
      zMax: activeVerts ? zMax : 0,
      yMin: activeVerts ? yMin : 0,
      yMax: activeVerts ? yMax : 0,
      xMin: activeVerts ? xMin : 0,
      xMax: activeVerts ? xMax : 0,
      archiveFilled: this.archiveFilled,
      visibleMeshes,
    };
  }

  get lifetimeSeconds(): number {
    return this.lifetime;
  }
}
