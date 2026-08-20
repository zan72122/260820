import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, galvanised, paintedSteel, timber } from '../materials/recipes';
import { BALLS, BALL_ORDER, type BallId, type BallSpec } from '../physics/params';
import { damp } from '../util/math';
import { SHELF_PITCH, SHELF_POS, SHELF_TOP_Y } from './layout';
import { grabProxy } from './rig';

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
  readonly proxies: THREE.Mesh[] = [];
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
  private cover!: THREE.Group;
  private coverOpen = 0;
  private coverTarget = 0;

  constructor(lib: MaterialLibrary, segments = 32) {
    this.lib = lib;
    const timberMat = lib.get(timber, { repeat: 2, normalScale: 1.2 }, 'shelf');
    const paintMat = lib.get(paintedSteel, { repeat: 2, normalScale: 0.9 }, 'shelf');
    const galvMat = lib.get(galvanised, { repeat: 3, normalScale: 0.9 }, 'shelf');
    const anodMat = lib.get(anodised, { repeat: 2, normalScale: 0.8 }, 'shelf');
    this.blank = galvMat;

    this.group.position.set(SHELF_POS.x, SHELF_POS.y, SHELF_POS.z);

    const span = BALL_ORDER.length * SHELF_PITCH;

    // A channel rail bolted across the front of the machine, at the height a
    // specimen actually gets picked up from.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span + 0.14, 0.05, 0.15), galvMat);
    rail.position.y = SHELF_TOP_Y - 0.03;
    rail.castShadow = true;
    rail.receiveShadow = true;
    this.group.add(rail);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(span + 0.14, 0.04, 0.02), anodMat);
    lip.position.set(0, SHELF_TOP_Y + 0.005, 0.075);
    lip.castShadow = false;
    lip.receiveShadow = true;
    this.group.add(lip);

    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, SHELF_TOP_Y - 0.05, 0.06), galvMat);
      leg.position.set((span / 2 - 0.02) * sx, (SHELF_TOP_Y - 0.05) / 2, 0);
      leg.castShadow = false;
      leg.receiveShadow = true;
      this.group.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.16), timberMat);
      foot.position.set((span / 2 - 0.02) * sx, 0.01, 0);
      foot.receiveShadow = true;
      this.group.add(foot);
    }

    // A hinged dust cover. Until the specimens are in play the rail is shut,
    // so nothing on screen invites a press that would do nothing.
    this.cover = new THREE.Group();
    this.cover.position.set(0, SHELF_TOP_Y + 0.02, -0.085);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(span + 0.14, 0.018, 0.19), paintMat);
    lid.position.set(0, 0.095, 0.095);
    lid.castShadow = true;
    lid.receiveShadow = true;
    this.cover.add(lid);
    const front = new THREE.Mesh(new THREE.BoxGeometry(span + 0.14, 0.095, 0.018), paintMat);
    front.position.set(0, 0.048, 0.185);
    front.castShadow = true;
    front.receiveShadow = true;
    this.cover.add(front);
    for (const sx of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.095, 0.19), paintMat);
      end.position.set(((span + 0.12) / 2) * sx, 0.048, 0.095);
      end.castShadow = false;
      end.receiveShadow = true;
      this.cover.add(end);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), anodMat);
    knob.position.set(0, 0.048, 0.2);
    this.cover.add(knob);
    this.group.add(this.cover);

    const cradleGeo = new THREE.TorusGeometry(0.042, 0.01, 8, 18);
    const cradles = new THREE.InstancedMesh(cradleGeo, anodMat, BALL_ORDER.length);
    cradles.castShadow = false;
    cradles.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < BALL_ORDER.length; i++) {
      const spec = BALLS[BALL_ORDER[i]];
      const x = (i - (BALL_ORDER.length - 1) / 2) * SHELF_PITCH;
      m.compose(new THREE.Vector3(x, SHELF_TOP_Y + 0.026, 0), q, one);
      cradles.setMatrixAt(i, m);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius, segments, Math.round(segments * 0.6)),
        this.blank
      );
      mesh.position.set(x, SHELF_TOP_Y + 0.028 + spec.radius * 0.8, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      // The steel specimen is barely 6 cm across; the pick volume is sized for
      // a child's aim, not for the geometry.
      const proxy = grabProxy(new THREE.SphereGeometry(0.082, 10, 8), 'ball');
      proxy.userData.ballIndex = i;
      proxy.position.copy(mesh.position);
      this.group.add(proxy);
      this.proxies.push(proxy);
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
      // An empty cradle is not a target: move its pick volume off the
      // raycaster's layer rather than leaving a ghost to grab at.
      this.proxies[i].layers.set(i === index ? 1 : 0);
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

  /** The two ends of the rail, so the camera can keep all of it on screen. */
  extentsInto(a: THREE.Vector3, b: THREE.Vector3) {
    this.displays[0].getWorldPosition(a);
    this.displays[this.displays.length - 1].getWorldPosition(b);
  }

  /** Open the rail's dust cover once specimens become selectable. */
  setOpen(open: boolean) {
    this.coverTarget = open ? 1 : 0;
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
    this.coverOpen = damp(this.coverOpen, this.coverTarget, 5, dt);
    this.cover.rotation.x = -this.coverOpen * 1.85;
    this.cover.visible = this.coverOpen < 0.995;

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
