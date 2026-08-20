import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { MaterialLibrary } from '../render/materials';
import { roundedBox } from '../objects/geometry';
import { Prop } from '../objects/prop';
import { OBJECT_ORDER, type ObjectId } from '../objects/profiles';
import { damp } from '../core/math';

export type ToolId = 'cloth' | 'dropper' | 'sand' | 'strip';

export interface Slot {
  id: ObjectId;
  anchor: Object3D;
  grab: Mesh;
  prop: Prop | null;
  available: boolean;
}

export interface ToolSlot {
  id: ToolId;
  anchor: Object3D;
  grab: Mesh;
  model: Object3D;
  available: boolean;
}

let invisibleMat: MeshBasicMaterial | null = null;
const invisible = (): MeshBasicMaterial =>
  (invisibleMat ??= new MeshBasicMaterial({ visible: false, depthWrite: false }));

/**
 * The experiment trolley. Objects live on the top shelf in shallow dishes and
 * the surface tools on the lower one — everything the child can choose is a
 * real thing sitting somewhere, never a menu.
 */
export class Wagon {
  readonly root = new Group();
  readonly slots: Slot[] = [];
  readonly tools: ToolSlot[] = [];
  private yaw = 0;
  private lowerShelf = new Group();
  private shelfOut = 0;

  constructor(
    private lib: MaterialLibrary,
    position: Vector3,
    private propOptions: { transmission: boolean; shadows: boolean },
  ) {
    this.root.name = 'wagon';
    this.root.position.copy(position);

    const frame = lib.paint('#b8bcc0', 'wagonFrame');
    const wood = lib.wood();

    const deckY = 0.52;
    const top = new Mesh(new BoxGeometry(1.06, 0.03, 0.4), wood);
    top.position.set(0, deckY, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    this.root.add(top);
    const lip = new Mesh(new BoxGeometry(1.06, 0.05, 0.02), frame);
    lip.position.set(0, deckY + 0.036, 0.2);
    lip.castShadow = true;
    this.root.add(lip);

    for (const x of [-0.46, 0.46]) {
      for (const z of [-0.15, 0.15]) {
        const leg = new Mesh(new CylinderGeometry(0.016, 0.016, deckY, 10), frame);
        leg.position.set(x, deckY / 2, z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.root.add(leg);
        const caster = new Mesh(new SphereGeometry(0.034, 12, 8), lib.matte('#2c3033', 0.72));
        caster.position.set(x, 0.034, z);
        caster.castShadow = true;
        this.root.add(caster);
      }
    }

    const handle = new Mesh(new TorusGeometry(0.13, 0.014, 8, 18, Math.PI), frame);
    handle.position.set(-0.56, deckY + 0.12, 0);
    handle.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    handle.castShadow = true;
    this.root.add(handle);

    // Lower shelf slides out when surface tools are unlocked.
    this.lowerShelf.position.set(0, 0.24, 0);
    this.root.add(this.lowerShelf);
    const shelf = new Mesh(new BoxGeometry(0.98, 0.026, 0.34), wood);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.lowerShelf.add(shelf);
    this.lowerShelf.visible = false;

    this.buildSlots(deckY);
  }

  private buildSlots(deckY: number): void {
    const n = OBJECT_ORDER.length;
    const span = 0.92;
    for (let i = 0; i < n; i++) {
      const id = OBJECT_ORDER[i];
      const x = -span / 2 + (i + 0.5) * (span / n);
      const anchor = new Object3D();
      anchor.position.set(x, deckY + 0.022, 0);
      this.root.add(anchor);

      // A shallow turned dish so nothing rolls off the trolley.
      const dish = new Mesh(new CylinderGeometry(0.052, 0.044, 0.012, 18), this.lib.matte('#cfd3d6', 0.55, 0.1));
      dish.position.set(x, deckY + 0.019, 0);
      dish.receiveShadow = true;
      this.root.add(dish);

      const grab = new Mesh(new SphereGeometry(0.085, 8, 6), invisible());
      grab.position.set(x, deckY + 0.07, 0);
      grab.name = `grab:object:${id}`;
      this.root.add(grab);

      this.slots.push({ id, anchor, grab, prop: null, available: false });
    }
  }

  /** Built the first time the tools are unlocked, not at start-up. */
  private buildTools(): void {
    if (this.tools.length) return;
    const specs: { id: ToolId; x: number; build: () => Object3D }[] = [
      { id: 'cloth', x: -0.36, build: () => this.buildCloth() },
      { id: 'dropper', x: -0.12, build: () => this.buildDropper() },
      { id: 'sand', x: 0.12, build: () => this.buildSandShaker() },
      { id: 'strip', x: 0.37, build: () => this.buildStripRoll() },
    ];
    for (const spec of specs) {
      const anchor = new Object3D();
      anchor.position.set(spec.x, 0.02, 0);
      this.lowerShelf.add(anchor);
      const model = spec.build();
      anchor.add(model);
      const grab = new Mesh(new SphereGeometry(0.095, 8, 6), invisible());
      grab.position.set(spec.x, 0.06, 0);
      grab.name = `grab:tool:${spec.id}`;
      this.lowerShelf.add(grab);
      this.tools.push({ id: spec.id, anchor, grab, model, available: false });
    }
  }

  private buildCloth(): Object3D {
    const g = new Group();
    for (let i = 0; i < 3; i++) {
      const fold = new Mesh(roundedBox(0.13 - i * 0.012, 0.014, 0.1 - i * 0.01, 0.006, 2), this.lib.felt());
      fold.position.set(i * 0.004, 0.008 + i * 0.014, i * 0.003);
      fold.rotation.y = i * 0.12;
      fold.castShadow = true;
      g.add(fold);
    }
    return g;
  }

  private buildDropper(): Object3D {
    const g = new Group();
    const glass = new Mesh(new CylinderGeometry(0.016, 0.016, 0.1, 14), this.lib.ice(false));
    glass.position.y = 0.06;
    glass.castShadow = true;
    g.add(glass);
    const bulb = new Mesh(new SphereGeometry(0.024, 14, 10), this.lib.rubber('#c96f4a'));
    bulb.position.y = 0.125;
    bulb.castShadow = true;
    g.add(bulb);
    const tip = new Mesh(new CylinderGeometry(0.004, 0.009, 0.03, 10), this.lib.ice(false));
    tip.position.y = 0.0;
    g.add(tip);
    return g;
  }

  private buildSandShaker(): Object3D {
    const g = new Group();
    const jar = new Mesh(new CylinderGeometry(0.032, 0.036, 0.09, 16), this.lib.sand());
    jar.position.y = 0.045;
    jar.castShadow = true;
    g.add(jar);
    const cap = new Mesh(new CylinderGeometry(0.034, 0.034, 0.016, 16), this.lib.paint('#c9a24a', 'cap'));
    cap.position.y = 0.098;
    cap.castShadow = true;
    g.add(cap);
    return g;
  }

  private buildStripRoll(): Object3D {
    const g = new Group();
    const roll = new Mesh(new TorusGeometry(0.038, 0.019, 10, 22), this.lib.rubber('#3c3f42'));
    roll.rotation.x = Math.PI / 2;
    roll.position.y = 0.02;
    roll.castShadow = true;
    g.add(roll);
    return g;
  }

  /** Make an object appear on the trolley (lazily building its mesh). */
  setAvailable(id: ObjectId, available: boolean): void {
    const slot = this.slots.find((s) => s.id === id);
    if (!slot) return;
    slot.available = available;
    if (available && !slot.prop) {
      slot.prop = new Prop(id, this.lib, this.propOptions);
      slot.anchor.add(slot.prop.root);
      slot.prop.placeStatic(new Vector3(0, slot.prop.profile.radius, 0), 0.4);
    }
    if (slot.prop) slot.prop.root.visible = available;
    slot.grab.visible = available;
  }

  /** True once anything at all is on the trolley for the child to take. */
  get hasAvailable(): boolean {
    return this.slots.some((s) => s.available);
  }

  setToolsAvailable(available: boolean): void {
    if (available) this.buildTools();
    for (const t of this.tools) t.available = available;
    this.lowerShelf.visible = available;
  }

  /** Hide the trolley copy while that object is out being tested. */
  setInUse(id: ObjectId, inUse: boolean): void {
    const slot = this.slots.find((s) => s.id === id);
    if (slot?.prop) slot.prop.root.visible = slot.available && !inUse;
  }

  toolWorld(id: ToolId, out = new Vector3()): Vector3 {
    const t = this.tools.find((x) => x.id === id);
    if (!t) return out;
    out.set(0, 0.06, 0);
    t.anchor.localToWorld(out);
    return out;
  }

  slotWorld(id: ObjectId, out = new Vector3()): Vector3 {
    const s = this.slots.find((x) => x.id === id);
    if (!s) return out;
    out.set(0, 0, 0);
    s.anchor.localToWorld(out);
    return out;
  }

  faceTowards(cameraPos: Vector3, dt: number): void {
    const want = Math.atan2(cameraPos.x - this.root.position.x, cameraPos.z - this.root.position.z);
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw = damp(this.yaw, this.yaw + d, 0.1, dt);
    this.root.rotation.y = this.yaw;
  }

  update(dt: number): void {
    const want = this.lowerShelf.visible ? 1 : 0;
    this.shelfOut = damp(this.shelfOut, want, 0.14, dt);
    this.lowerShelf.position.z = this.shelfOut * 0.16;
  }
}
