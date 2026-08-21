import * as THREE from 'three';
import { RaftView } from './RaftView';
import { rubberMaps } from '../world/Textures';
import { Rng, approach, clamp } from '../core/Rng';

export type BagState = 'bench' | 'deck' | 'dragging';

export interface BallastBag {
  id: number;
  mesh: THREE.Mesh;
  state: BagState;
  slot: number;
  benchPosition: THREE.Vector3;
  /** Eased position used while the bag is in the world. */
  worldTarget: THREE.Vector3;
  settle: number;
}

const SNAP_RADIUS = 1.75;
const DECK_SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.34, 0.3, 0.0],
  [-0.36, 0.3, 0.0],
  [0.0, 0.3, 0.42],
];

/** Soft test-ballast bag: water inside a heavy vinyl skin. Not a cloth sim -
 *  three moulded shapes, blended by what the bag is doing. */
function bagGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.34, 20, 14);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const rng = new Rng(0x7b3a);
  const base = new Float32Array(pos.count * 3);
  const flat = new Float32Array(pos.count * 3);
  const carry = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const fold = 1 + (rng.next() - 0.5) * 0.06;
    v.x *= 1.28 * fold;
    v.z *= 1.05 * fold;
    v.y *= 0.78;
    // Sits down on whatever it is resting on.
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.35;
    base[i * 3] = v.x;
    base[i * 3 + 1] = v.y + 0.16;
    base[i * 3 + 2] = v.z;

    const spread = clamp(1 - (v.y + 0.2) * 0.8, 0.8, 1.5);
    flat[i * 3] = v.x * (1 + 0.12 * spread);
    flat[i * 3 + 1] = v.y * 0.66 + 0.12;
    flat[i * 3 + 2] = v.z * (1 + 0.14 * spread);

    const pinch = clamp((v.y + 0.2) * 1.6, 0, 1.4);
    carry[i * 3] = v.x * (1 - pinch * 0.22);
    carry[i * 3 + 1] = v.y * 1.22 + 0.16 + pinch * 0.06;
    carry[i * 3 + 2] = v.z * (1 - pinch * 0.24);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.morphAttributes.position = [
    new THREE.BufferAttribute(flat, 3),
    new THREE.BufferAttribute(carry, 3),
  ];
  geo.computeVertexNormals();
  return geo;
}

/**
 * The ballast rig at the test bench. The child can drag bags onto the raft's
 * deck; between runs the rig itself changes exactly one bag, so every run
 * differs from the last in one readable way.
 */
export class BallastRig {
  readonly group = new THREE.Group();
  readonly bags: BallastBag[] = [];
  private dragging: BallastBag | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly raft: RaftView, benchOrigin: THREE.Vector3, count = 3) {
    const maps = rubberMaps();
    const geo = bagGeometry();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i === 0 ? 0xd0762f : i === 1 ? 0xc0652c : 0xc97a35,
        roughness: 0.78,
        metalness: 0.0,
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        envMapIntensity: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const benchPosition = benchOrigin.clone().add(new THREE.Vector3(0, 0, i * 0.86 - 0.86));
      mesh.position.copy(benchPosition);
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = 1;
      this.group.add(mesh);
      this.bags.push({
        id: i,
        mesh,
        state: 'bench',
        slot: -1,
        benchPosition,
        worldTarget: benchPosition.clone(),
        settle: 0,
      });
    }
  }

  get deckCount(): number {
    return this.bags.filter((b) => b.state === 'deck').length;
  }

  get isDragging(): boolean {
    return this.dragging !== null;
  }

  meshes(): THREE.Mesh[] {
    return this.bags.map((b) => b.mesh);
  }

  /** Put exactly `count` bags on the deck, leaving the rest on the bench. */
  applyPreset(count: number): void {
    let onDeck = 0;
    for (const bag of this.bags) {
      if (onDeck < count) {
        this.placeOnDeck(bag);
        onDeck++;
      } else {
        this.placeOnBench(bag);
      }
    }
  }

  private freeSlot(except?: BallastBag): number {
    const used = new Set(
      this.bags.filter((b) => b.state === 'deck' && b !== except).map((b) => b.slot),
    );
    for (let i = 0; i < DECK_SLOTS.length; i++) if (!used.has(i)) return i;
    return -1;
  }

  private placeOnDeck(bag: BallastBag): void {
    const slot = bag.state === 'deck' ? bag.slot : this.freeSlot(bag);
    if (slot < 0) {
      this.placeOnBench(bag);
      return;
    }
    bag.state = 'deck';
    bag.slot = slot;
    bag.settle = 1;
    if (bag.mesh.parent !== this.raft.group) this.raft.group.add(bag.mesh);
    const [x, y, z] = DECK_SLOTS[slot];
    bag.mesh.position.set(x, y, z);
    bag.mesh.rotation.set(0, slot * 0.6, 0);
  }

  private placeOnBench(bag: BallastBag): void {
    bag.state = 'bench';
    bag.slot = -1;
    if (bag.mesh.parent !== this.group) this.group.add(bag.mesh);
    bag.mesh.position.copy(bag.benchPosition);
    bag.worldTarget.copy(bag.benchPosition);
    bag.mesh.rotation.set(0, 0.3, 0);
  }

  beginDrag(bag: BallastBag): void {
    this.dragging = bag;
    bag.state = 'dragging';
    bag.mesh.getWorldPosition(this.tmp);
    if (bag.mesh.parent !== this.group) this.group.add(bag.mesh);
    bag.mesh.position.copy(this.tmp);
    bag.worldTarget.copy(this.tmp);
  }

  moveDrag(worldPoint: THREE.Vector3): void {
    if (!this.dragging) return;
    const deck = this.raft.deckPoint(this.tmp);
    const bag = this.dragging;
    // Magnetic: near the deck the bag is pulled onto it, no precision needed.
    const d = worldPoint.distanceTo(deck);
    if (d < SNAP_RADIUS && this.freeSlot(bag) >= 0) {
      bag.worldTarget.copy(worldPoint).lerp(deck, clamp(1 - d / SNAP_RADIUS, 0, 1) * 0.8);
    } else {
      bag.worldTarget.copy(worldPoint);
    }
  }

  endDrag(): void {
    const bag = this.dragging;
    if (!bag) return;
    this.dragging = null;
    const deck = this.raft.deckPoint(this.tmp);
    if (bag.mesh.position.distanceTo(deck) < SNAP_RADIUS && this.freeSlot(bag) >= 0) {
      this.placeOnDeck(bag);
    } else {
      this.placeOnBench(bag);
    }
  }

  pick(raycaster: THREE.Raycaster): BallastBag | null {
    const hits = raycaster.intersectObjects(this.meshes(), false);
    if (!hits.length) return null;
    return this.bags.find((b) => b.mesh === hits[0].object) ?? null;
  }

  update(dt: number): void {
    for (const bag of this.bags) {
      const carrying = bag.state === 'dragging';
      if (carrying || bag.state === 'bench') {
        bag.mesh.position.x = approach(bag.mesh.position.x, bag.worldTarget.x, 0.06, dt);
        bag.mesh.position.y = approach(bag.mesh.position.y, bag.worldTarget.y, 0.06, dt);
        bag.mesh.position.z = approach(bag.mesh.position.z, bag.worldTarget.z, 0.06, dt);
      }
      if (bag.state === 'deck' && bag.settle > 0) {
        bag.settle = approach(bag.settle, 0, 0.2, dt);
        bag.mesh.position.y = DECK_SLOTS[bag.slot][1] + bag.settle * 0.16;
      }
      const infl = bag.mesh.morphTargetInfluences;
      if (infl) {
        // Resting flat on a surface, or pinched while being carried.
        infl[0] = approach(infl[0], carrying ? 0.15 : 1, 0.12, dt);
        infl[1] = approach(infl[1], carrying ? 1 : 0, 0.12, dt);
      }
    }
  }
}
