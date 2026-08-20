import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, galvanised, paintedSteel } from '../materials/recipes';
import { FLOORS, FLOOR_ORDER, type FloorId } from '../physics/params';
import { TAU, angleDelta, damp } from '../util/math';
import {
  TRAY_CENTER_Z,
  TRAY_DECK_Y,
  TRAY_OUTER_R,
  TRAY_POCKET_R,
  TRAY_POCKET_RING_R,
  TRAY_SLOTS,
  TRAY_SURFACE_Y,
} from './layout';
import { DeformablePanel, attachWearMap } from './panel';
import { WaterSurface } from './water';

/**
 * The sample tray.
 *
 * A heavy indexing turntable carrying seven interchangeable test surfaces. The
 * child changes floors by swiping it round; the machine does the rest, exactly
 * as it does in the discovery sequence when it presents the second sample by
 * itself. Only the sample at the front is ever under the clamp, so "same ball,
 * same height, different floor" is enforced by the hardware, not by a rule.
 */

export interface TurntableQuality {
  fieldRes: number;
  meshRes: number;
  wearRes: number;
}

export class Turntable {
  readonly group = new THREE.Group();
  readonly disc = new THREE.Group();
  readonly panels: DeformablePanel[] = [];
  readonly water: WaterSurface;
  readonly deck: THREE.Mesh;
  readonly pickables: THREE.Object3D[] = [];
  /** 0..1 hint rock applied on top of the indexed angle. */
  nudge = 0;

  private lib: MaterialLibrary;
  private angle = 0;
  private targetAngle = 0;
  private slotAngles: number[] = [];
  private index = 0;
  private baked = new Set<number>();
  private blankMaterial: THREE.Material;
  /** Fires when the tray finishes indexing to a new sample. */
  onSettled: ((index: number) => void) | null = null;
  private moving = false;

  constructor(lib: MaterialLibrary, quality: TurntableQuality) {
    this.lib = lib;
    this.group.position.set(0, 0, TRAY_CENTER_Z);

    const galvMat = lib.get(galvanised, { repeat: 4, normalScale: 1.0 }, 'tray');
    const paintMat = lib.get(paintedSteel, { repeat: 3, normalScale: 0.9 }, 'tray');
    const anodMat = lib.get(anodised, { repeat: 3, normalScale: 0.8 }, 'tray');
    this.blankMaterial = galvMat;

    // --- pedestal, hub and drive ----------------------------------------
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.2, 20), paintMat);
    plinth.position.y = 0.1;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.16, 18), paintMat);
    column.position.y = 0.26;
    column.castShadow = true;
    column.receiveShadow = true;
    this.group.add(column);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 14), paintMat);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(0.5, 0.16, -0.3);
    motor.castShadow = true;
    motor.receiveShadow = true;
    this.group.add(motor);
    const motorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), galvMat);
    motorPlate.position.set(0.5, 0.04, -0.3);
    this.group.add(motorPlate);

    // --- the rotating deck ----------------------------------------------
    this.deck = new THREE.Mesh(new THREE.CylinderGeometry(TRAY_OUTER_R, TRAY_OUTER_R - 0.02, 0.07, 64), galvMat);
    this.deck.position.y = TRAY_DECK_Y - 0.035;
    this.deck.castShadow = true;
    this.deck.receiveShadow = true;
    this.deck.userData.pick = 'tray';
    this.pickables.push(this.deck);
    this.disc.add(this.deck);

    // A worn rubbing strip round the rim: this is what hands push on.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TRAY_OUTER_R - 0.01, 0.022, 8, 64), anodMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TRAY_DECK_Y - 0.01;
    rim.castShadow = true;
    rim.userData.pick = 'tray';
    this.pickables.push(rim);
    this.disc.add(rim);

    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 18), anodMat);
    hubCap.position.y = TRAY_DECK_Y + 0.01;
    hubCap.castShadow = true;
    hubCap.receiveShadow = true;
    this.disc.add(hubCap);

    // --- pockets ----------------------------------------------------------
    const cupGeo = new THREE.CylinderGeometry(TRAY_POCKET_R + 0.012, TRAY_POCKET_R + 0.012, 0.09, 30, 1, true);
    const bezelGeo = new THREE.TorusGeometry(TRAY_POCKET_R + 0.018, 0.016, 8, 34);
    const cups = new THREE.InstancedMesh(cupGeo, paintMat, TRAY_SLOTS);
    const bezels = new THREE.InstancedMesh(bezelGeo, anodMat, TRAY_SLOTS);
    cups.castShadow = false;
    cups.receiveShadow = true;
    bezels.castShadow = true;
    bezels.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const bezelQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

    for (let i = 0; i < TRAY_SLOTS; i++) {
      const a = (i / TRAY_SLOTS) * TAU;
      this.slotAngles.push(a);
      const px = Math.sin(a) * TRAY_POCKET_RING_R;
      const pz = Math.cos(a) * TRAY_POCKET_RING_R;

      m.compose(new THREE.Vector3(px, TRAY_DECK_Y - 0.05, pz), q, one);
      cups.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(px, TRAY_DECK_Y + 0.006, pz), bezelQ, one);
      bezels.setMatrixAt(i, m);

      const floorId = FLOOR_ORDER[i];
      const spec = FLOORS[floorId];
      const panel = new DeformablePanel(spec, {
        shape: 'circle',
        halfX: TRAY_POCKET_R,
        halfZ: TRAY_POCKET_R,
        fieldRes: quality.fieldRes,
        meshRes: quality.meshRes,
        wearRes: quality.wearRes,
      });
      panel.setMaterial(this.blankMaterial);
      panel.mesh.userData.pick = 'tray';
      this.pickables.push(panel.mesh);
      // Counter-rotate so a sample's own axes line up with the world when it
      // is the one under the clamp: craters stay where they were made.
      panel.group.rotation.y = a;
      panel.group.position.set(px, TRAY_SURFACE_Y - spec.surfaceInset, pz);
      this.disc.add(panel.group);
      this.panels.push(panel);
    }
    cups.instanceMatrix.needsUpdate = true;
    bezels.instanceMatrix.needsUpdate = true;
    this.disc.add(cups);
    this.disc.add(bezels);

    // --- the shallow water tray ------------------------------------------
    const waterIndex = FLOOR_ORDER.indexOf('water');
    this.water = new WaterSurface(TRAY_POCKET_R - 0.004);
    const wa = this.slotAngles[waterIndex];
    this.water.mesh.position.set(
      Math.sin(wa) * TRAY_POCKET_RING_R,
      TRAY_SURFACE_Y,
      Math.cos(wa) * TRAY_POCKET_RING_R
    );
    this.disc.add(this.water.mesh);

    this.group.add(this.disc);
  }

  get activeIndex() {
    return this.index;
  }

  get activeFloorId(): FloorId {
    return FLOOR_ORDER[this.index];
  }

  get activePanel() {
    return this.panels[this.index];
  }

  get isMoving() {
    return this.moving;
  }

  /** True once the tray has stopped within a hair of its detent. */
  get atRest() {
    return Math.abs(angleDelta(this.angle, this.targetAngle)) < 0.004;
  }

  /**
   * Bake one pending sample's textures. Called once per frame just after boot
   * so the first trial can start immediately while the rest fill in.
   */
  primeNext(): boolean {
    for (let i = 0; i < TRAY_SLOTS; i++) {
      if (this.baked.has(i)) continue;
      this.bakeSlot(i);
      return true;
    }
    return false;
  }

  bakeSlot(i: number) {
    if (this.baked.has(i)) return;
    const spec = FLOORS[FLOOR_ORDER[i]];
    const isWater = spec.id === 'water';
    const mat = this.lib.get(
      spec.recipe,
      {
        repeat: 1,
        normalScale: spec.id === 'sand' || spec.id === 'felt' ? 1.4 : 1.0,
        aoIntensity: 1.0,
        envMapIntensity: isWater ? 0.7 : spec.id === 'metal' ? 1.35 : 0.9,
        physical: spec.id === 'clay' || spec.id === 'rubber',
        clearcoat: spec.id === 'clay' ? 0.5 : spec.id === 'rubber' ? 0.12 : undefined,
        clearcoatRoughness: spec.id === 'clay' ? 0.28 : 0.6,
      },
      `slot${i}`
    );
    // Each panel owns its wear texture, so marks are per-sample.
    attachWearMap(mat, this.panels[i].wearTexture);
    this.panels[i].setMaterial(mat);
    this.baked.add(i);
  }

  /** Index the tray to a sample. Positive `dir` turns towards higher slots. */
  rotateTo(index: number, immediate = false) {
    const n = TRAY_SLOTS;
    const wrapped = ((index % n) + n) % n;
    this.index = wrapped;
    this.bakeSlot(wrapped);
    const desired = -this.slotAngles[wrapped];
    // Take the short way round, and keep accumulating so the deck never
    // snaps back through a full turn.
    this.targetAngle = this.angle + angleDelta(this.angle, desired);
    if (immediate) {
      this.angle = this.targetAngle;
      this.disc.rotation.y = this.angle;
      this.moving = false;
    } else {
      this.moving = true;
    }
  }

  step(delta: number) {
    this.rotateTo(this.index + delta);
  }

  /** World-space centre of the sample currently under the clamp. */
  activeSurfaceY() {
    const spec = FLOORS[FLOOR_ORDER[this.index]];
    return spec.id === 'water' ? TRAY_SURFACE_Y : TRAY_SURFACE_Y;
  }

  update(dt: number) {
    const was = this.moving;
    // Heavy deck: it takes a moment to come round, and it settles firmly.
    this.angle = damp(this.angle, this.targetAngle, 6.5, dt);
    if (Math.abs(this.targetAngle - this.angle) < 0.0015) {
      this.angle = this.targetAngle;
      if (was) {
        this.moving = false;
        this.onSettled?.(this.index);
      }
    }
    // The hint rock is visual only: it never changes which sample is loaded.
    this.disc.rotation.y = this.angle + Math.sin(performance.now() * 0.004) * 0.045 * this.nudge;
    for (const p of this.panels) p.update(dt);
    this.water.update(dt);
  }

  /** How far through the current indexing move we are, 0..1. */
  get settleProgress() {
    return this.moving ? 0.5 : 1;
  }

  dispose() {
    for (const p of this.panels) p.dispose();
    this.water.dispose();
  }
}
