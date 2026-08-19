import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { mergeGeometries, roundedBox } from '../gfx/geo';
import { makeRng } from '../gfx/noise';
import { rowX } from '../game/config';

export const CRATE_CAPACITY = 34;
const INNER = new THREE.Vector3(0.5, 0.32, 0.68);
const WALL = 0.016;

let crateGeo: THREE.BufferGeometry | null = null;

function buildCrateGeometry(): THREE.BufferGeometry {
  if (crateGeo) return crateGeo;
  const parts: THREE.BufferGeometry[] = [];
  const ow = INNER.x + WALL * 2;
  const od = INNER.z + WALL * 2;
  const h = INNER.y;

  const floor = roundedBox(ow, WALL, od, 0.006);
  floor.translate(0, WALL / 2, 0);
  parts.push(floor);

  // slatted walls: reads as a farm container and lets the white roots show through
  const slatsX = 7;
  const slatsZ = 9;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < slatsX; i++) {
      const x = (i / (slatsX - 1) - 0.5) * (ow - 0.05);
      const p = roundedBox(0.022, h, WALL, 0.004);
      p.translate(x, h / 2, sz * (od / 2 - WALL / 2));
      parts.push(p);
    }
    const railTop = roundedBox(ow, 0.026, WALL + 0.006, 0.006);
    railTop.translate(0, h - 0.013, sz * (od / 2 - WALL / 2));
    parts.push(railTop);
    const railMid = roundedBox(ow, 0.016, WALL, 0.004);
    railMid.translate(0, h * 0.45, sz * (od / 2 - WALL / 2));
    parts.push(railMid);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < slatsZ; i++) {
      const z = (i / (slatsZ - 1) - 0.5) * (od - 0.05);
      const p = roundedBox(WALL, h, 0.022, 0.004);
      p.translate(sx * (ow / 2 - WALL / 2), h / 2, z);
      parts.push(p);
    }
    const railTop = roundedBox(WALL + 0.006, 0.026, od, 0.006);
    railTop.translate(sx * (ow / 2 - WALL / 2), h - 0.013, 0);
    parts.push(railTop);
    const railMid = roundedBox(WALL, 0.016, od, 0.004);
    railMid.translate(sx * (ow / 2 - WALL / 2), h * 0.45, 0);
    parts.push(railMid);
  }
  // corner posts
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = roundedBox(0.03, h + 0.014, 0.03, 0.006);
      p.translate(sx * (ow / 2 - 0.014), (h + 0.014) / 2, sz * (od / 2 - 0.014));
      parts.push(p);
    }
  crateGeo = mergeGeometries(parts, false)!;
  return crateGeo;
}

/**
 * Where root #i comes to rest inside the crate. The root's own origin is its
 * crown, so it is laid down from one end of the crate — never centred, or half
 * of it would stick out through the wall.
 */
function slot(i: number, rng: () => number): { pos: THREE.Vector3; rot: THREE.Euler } {
  const perLayer = 5;
  const layer = Math.floor(i / perLayer);
  const k = i % perLayer;
  const flip = layer % 2 === 1;
  const x = ((k + 0.5) / perLayer - 0.5) * (INNER.x - 0.1) + (rng() - 0.5) * 0.018;
  const y = WALL + 0.042 + layer * 0.058 + (rng() - 0.5) * 0.008;
  const z = (flip ? 1 : -1) * (INNER.z * 0.5 - 0.06) + (rng() - 0.5) * 0.03;
  const yaw = (rng() - 0.5) * 0.34;
  const tilt = (rng() - 0.5) * 0.22;
  return {
    pos: new THREE.Vector3(x, y, z),
    // root local -Y is the tip: lay it flat, pointing across the crate
    rot: new THREE.Euler((flip ? 1 : -1) * (Math.PI / 2) + tilt * 0.2, yaw, tilt),
  };
}

export class CrateUnit {
  readonly group = new THREE.Group();
  private pile: THREE.InstancedMesh;
  count = 0;

  constructor(mats: Materials, rootGeo: THREE.BufferGeometry) {
    const body = new THREE.Mesh(buildCrateGeometry(), mats.crate);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    this.pile = new THREE.InstancedMesh(rootGeo, mats.daikon, CRATE_CAPACITY);
    this.pile.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pile.count = 0;
    this.pile.castShadow = true;
    this.pile.receiveShadow = true;
    this.pile.frustumCulled = false;
    this.group.add(this.pile);
  }

  /** Local rest transform of the next root, so the falling one can aim at it. */
  peekSlot(): { pos: THREE.Vector3; rot: THREE.Euler } {
    const i = Math.min(this.count, CRATE_CAPACITY - 1);
    return slot(i, makeRng(4242 + i * 977));
  }

  add(): boolean {
    if (this.count >= CRATE_CAPACITY) return false;
    const s = slot(this.count, makeRng(4242 + this.count * 977));
    const m = new THREE.Matrix4();
    m.compose(s.pos, new THREE.Quaternion().setFromEuler(s.rot), new THREE.Vector3(1, 1, 1));
    this.pile.setMatrixAt(this.count, m);
    this.count++;
    this.pile.count = this.count;
    this.pile.instanceMatrix.needsUpdate = true;
    return true;
  }

  get full(): boolean {
    return this.count >= CRATE_CAPACITY;
  }

  reset() {
    this.count = 0;
    this.pile.count = 0;
  }

  /** Height of the top of the pile, for framing the reveal shot. */
  get pileTop(): number {
    const layers = Math.ceil(this.count / 5);
    return WALL + 0.042 + Math.max(0, layers - 1) * 0.058;
  }
}

/** Full crates left standing at the headland — a visible record of the work done. */
const YARD_MAX = 12;

export class CrateYard {
  readonly group = new THREE.Group();
  private mats: Materials;
  private rootGeo: THREE.BufferGeometry;
  private units: CrateUnit[] = [];
  private next = 0;

  constructor(mats: Materials, rootGeo: THREE.BufferGeometry) {
    this.mats = mats;
    this.rootGeo = rootGeo;
  }

  /** Park a filled crate at the end of the row that produced it. */
  park(rowIndex: number, filled: number): void {
    // the yard is finite: once it is full the oldest crate has been carted away
    if (this.units.length >= YARD_MAX) {
      const old = this.units.shift()!;
      this.group.remove(old.group);
    }
    const unit = new CrateUnit(this.mats, this.rootGeo);
    for (let i = 0; i < filled; i++) unit.add();
    const stackIndex = this.next++ % YARD_MAX;
    const bay = stackIndex % 4;
    const tier = Math.floor(stackIndex / 4);
    // stacked on the headland, in view from the start of every row
    unit.group.position.set(
      rowX(0) - 2.15 - tier * 0.06,
      tier * 0.345,
      -3.15 - bay * 0.82,
    );
    unit.group.rotation.y = 0.12 + stackIndex * 0.06;
    void rowIndex;
    this.units.push(unit);
    this.group.add(unit.group);
  }

  clear() {
    for (const u of this.units) this.group.remove(u.group);
    this.units.length = 0;
  }

  get parked(): number {
    return this.units.length;
  }
}
