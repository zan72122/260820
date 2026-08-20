import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, galvanised, timber } from '../materials/recipes';
import { BALLS, BALL_ORDER, type BallId, type BallSpec } from '../physics/params';
import { SHELF_POS, SHELF_TOP_Y } from './layout';

/**
 * The ball rack.
 *
 * Six specimens sitting in turned cradles, at a height a child can reach. The
 * balls are told apart by how they take the light — the steel one throws a
 * hard reflection, the foam one swallows it — never by a colour code.
 */
export class BallShelf {
  readonly group = new THREE.Group();
  readonly displays: THREE.Mesh[] = [];
  private lib: MaterialLibrary;
  private baked = new Set<number>();
  private blank: THREE.Material;
  private activeIndex = 0;
  private lift: number[] = [];
  private homes: THREE.Vector3[] = [];
  private carrying = -1;
  /** 0..1 hint lift applied to the first unused specimen. */
  nudge = 0;
  nudgeIndex = 1;

  constructor(lib: MaterialLibrary, segments = 32) {
    this.lib = lib;
    const timberMat = lib.get(timber, { repeat: 2, normalScale: 1.2 }, 'shelf');
    const galvMat = lib.get(galvanised, { repeat: 3, normalScale: 0.9 }, 'shelf');
    const anodMat = lib.get(anodised, { repeat: 2, normalScale: 0.8 }, 'shelf');
    this.blank = galvMat;

    this.group.position.set(SHELF_POS.x, SHELF_POS.y, SHELF_POS.z);
    // Angled so the specimens face the working side of the rig.
    this.group.rotation.y = 0.42;

    const width = BALL_ORDER.length * 0.24 + 0.12;

    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.34), timberMat);
    top.position.y = SHELF_TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    this.group.add(top);

    const shelfLow = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.3), timberMat);
    shelfLow.position.set(0, SHELF_TOP_Y - 0.42, 0);
    shelfLow.castShadow = true;
    shelfLow.receiveShadow = true;
    this.group.add(shelfLow);

    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, SHELF_TOP_Y, 0.07), timberMat);
      leg.position.set((width / 2 - 0.07) * sx, SHELF_TOP_Y / 2, -0.1);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.group.add(leg);
      const legF = leg.clone();
      legF.position.z = 0.1;
      this.group.add(legF);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.32), galvMat);
      foot.position.set((width / 2 - 0.07) * sx, 0.01, 0);
      foot.receiveShadow = true;
      this.group.add(foot);
    }

    const cradleGeo = new THREE.TorusGeometry(0.045, 0.011, 8, 20);
    const cradles = new THREE.InstancedMesh(cradleGeo, anodMat, BALL_ORDER.length);
    cradles.castShadow = true;
    cradles.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < BALL_ORDER.length; i++) {
      const spec = BALLS[BALL_ORDER[i]];
      const x = (i - (BALL_ORDER.length - 1) / 2) * 0.24;
      m.compose(new THREE.Vector3(x, SHELF_TOP_Y + 0.028, 0), q, one);
      cradles.setMatrixAt(i, m);

      const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, segments, Math.round(segments * 0.6)), this.blank);
      mesh.position.set(x, SHELF_TOP_Y + 0.03 + spec.radius * 0.82, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.pick = 'ball';
      mesh.userData.ballIndex = i;
      this.group.add(mesh);
      this.displays.push(mesh);
      this.lift.push(0);
      this.homes.push(mesh.position.clone());
    }
    cradles.instanceMatrix.needsUpdate = true;
    this.group.add(cradles);
  }

  material(index: number): THREE.Material {
    this.bake(index);
    const spec = BALLS[BALL_ORDER[index]];
    return this.lib.get(spec.recipe, ballOptions(spec), 'ball');
  }

  bake(index: number) {
    if (this.baked.has(index)) return;
    const spec = BALLS[BALL_ORDER[index]];
    const mat = this.lib.get(spec.recipe, ballOptions(spec), 'ball');
    this.displays[index].material = mat;
    this.baked.add(index);
  }

  /** Bake one pending specimen; returns false when they are all done. */
  primeNext(): boolean {
    for (let i = 0; i < this.displays.length; i++) {
      if (this.baked.has(i)) continue;
      this.bake(i);
      return true;
    }
    return false;
  }

  /** The specimen now loaded in the clamp leaves an empty cradle behind. */
  setActive(index: number) {
    this.activeIndex = index;
    for (let i = 0; i < this.displays.length; i++) {
      this.displays[i].visible = i !== index;
    }
  }

  get active() {
    return this.activeIndex;
  }

  ballIdAt(index: number): BallId {
    return BALL_ORDER[index];
  }

  worldPositionOf(index: number, target: THREE.Vector3) {
    return this.displays[index].getWorldPosition(target);
  }

  /** Carry a specimen with the finger; pass null to just lift it in place. */
  carry(index: number, world: THREE.Vector3 | null) {
    this.carrying = index;
    const mesh = this.displays[index];
    if (!world) {
      mesh.position.copy(this.homes[index]);
      mesh.position.y += 0.035;
      return;
    }
    this.group.worldToLocal(mesh.position.copy(world));
  }

  restore(index: number) {
    this.carrying = -1;
    this.displays[index].position.copy(this.homes[index]);
  }

  get carriedIndex() {
    return this.carrying;
  }

  update(dt: number) {
    // The specimens breathe a little in their cradles when idle — enough to
    // read as "these can be picked up", not enough to distract.
    for (let i = 0; i < this.displays.length; i++) {
      const d = this.displays[i];
      if (!d.visible) continue;
      this.lift[i] += dt;
      d.rotation.y += dt * 0.06;
      if (i === this.carrying) continue;
      const hint = i === this.nudgeIndex ? this.nudge * 0.028 : 0;
      d.position.y = this.homes[i].y + hint;
    }
  }
}

export function ballOptions(spec: BallSpec) {
  return {
    repeat: 1,
    normalScale: spec.id === 'foam' ? 1.5 : 1.0,
    envMapIntensity: spec.envIntensity ?? 1,
    physical: spec.physical,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: spec.clearcoatRoughness,
    sheen: spec.sheen,
    sheenColor: spec.sheen ? 0xb9b2a2 : undefined,
    transmission: spec.transmission,
    ior: spec.transmission ? 1.33 : undefined,
    thickness: spec.transmission ? spec.radius * 2 : undefined,
    transparent: spec.transmission ? true : false,
    opacity: 1,
  };
}
