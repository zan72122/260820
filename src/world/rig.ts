import * as THREE from 'three';
import { MaterialLibrary } from '../materials/library';
import { anodised, cableRubber, galvanised, gripRubber, paintedSteel } from '../materials/recipes';
import { clamp01, damp, lerp } from '../util/math';
import {
  CARRIAGE_MIN_Y,
  GANTRY_TOP_Y,
  GANTRY_X,
  GANTRY_Z,
  RING_TRAVEL,
  RING_X,
  RING_Z,
} from './layout';
import { boltField } from './pavilion';

const _tip = new THREE.Vector3();

/**
 * The drop rig.
 *
 * A two-column gantry with a crosshead that slides up and down the columns, a
 * telescoping arm that carries the clamp out over whichever surface is being
 * tested, and a release lanyard hanging within easy reach — deliberately off to
 * one side, so a finger on the ring never covers the place the ball lands.
 */

export const RING_REST_Y = 1.18;

export class DropRig {
  readonly group = new THREE.Group();
  readonly carriage = new THREE.Group();
  readonly arm = new THREE.Group();
  readonly head = new THREE.Group();
  readonly ring = new THREE.Group();

  /** Meshes the input layer raycasts against. */
  readonly ringHandle: THREE.Mesh;
  readonly carriageHandle: THREE.Mesh;

  private jaws: THREE.Group[] = [];
  private armBody: THREE.Mesh;
  private handleMesh!: THREE.Mesh;
  private lanyard: THREE.Mesh;
  private magnetFace: THREE.Mesh;
  private outrigger!: THREE.Object3D;
  private indicator: THREE.MeshStandardMaterial;

  private carriageY = 1.8;
  private targetCarriageY = 1.8;
  private armReach = 0.32;
  private targetArmReach = 0.32;
  private jawOpen = 0;
  private targetJawOpen = 0;
  /** 0 = ring at rest, 1 = fully pulled. */
  ringPull = 0;
  /** 0..1 hint bob on the height handle. */
  handleNudge = 0;
  private ringVisual = 0;
  private ringZ = RING_Z;
  private targetRingZ = RING_Z;
  private time = 0;

  constructor(lib: MaterialLibrary) {
    const galvMat = lib.get(galvanised, { repeat: 3, normalScale: 1.0 }, 'rig');
    const paintMat = lib.get(paintedSteel, { repeat: 2, normalScale: 0.9 }, 'rig');
    const anodMat = lib.get(anodised, { repeat: 2, normalScale: 0.8 }, 'rig');
    const gripMat = lib.get(gripRubber, { repeat: 3, normalScale: 1.3 }, 'ring');
    const cableMat = lib.get(cableRubber, { repeat: 6, normalScale: 1.0 }, 'rig');

    // --- columns, base plates, top beam ---------------------------------
    const colGeo = new THREE.BoxGeometry(0.13, GANTRY_TOP_Y, 0.13);
    const railGeo = new THREE.BoxGeometry(0.05, GANTRY_TOP_Y - 0.4, 0.05);
    const plateGeo = new THREE.BoxGeometry(0.44, 0.05, 0.44);
    const bolts: Array<{ pos: THREE.Vector3 }> = [];

    for (const sx of [-1, 1]) {
      const x = GANTRY_X * sx;
      const col = new THREE.Mesh(colGeo, galvMat);
      col.position.set(x, GANTRY_TOP_Y / 2, GANTRY_Z);
      col.castShadow = true;
      col.receiveShadow = true;
      this.group.add(col);

      // The polished rail the crosshead actually runs on.
      const rail = new THREE.Mesh(railGeo, anodMat);
      rail.position.set(x - 0.085 * sx, GANTRY_TOP_Y / 2 + 0.1, GANTRY_Z);
      rail.castShadow = false;
      rail.receiveShadow = true;
      this.group.add(rail);

      const plate = new THREE.Mesh(plateGeo, galvMat);
      plate.position.set(x, 0.025, GANTRY_Z);
      plate.castShadow = false;
      plate.receiveShadow = true;
      this.group.add(plate);
      for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
        bolts.push({ pos: new THREE.Vector3(x + dx, 0.055, GANTRY_Z + dz) });
      }

      // Knee brace running back from the column to its own footing, in the
      // plane of the frame so it never crosses the fall line.
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 0.06), galvMat);
      brace.position.set(x, 0.66, GANTRY_Z - 0.42);
      brace.rotation.x = 0.62;
      brace.castShadow = true;
      brace.receiveShadow = true;
      this.group.add(brace);
      const braceFoot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), galvMat);
      braceFoot.position.set(x, 0.025, GANTRY_Z - 0.78);
      braceFoot.receiveShadow = true;
      this.group.add(braceFoot);
    }

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(GANTRY_X * 2 + 0.3, 0.16, 0.16), galvMat);
    topBeam.position.set(0, GANTRY_TOP_Y, GANTRY_Z);
    topBeam.castShadow = true;
    topBeam.receiveShadow = true;
    this.group.add(topBeam);

    // Control box on the near column: the rig has to be plugged into
    // something, and it hides the cable run's origin.
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.16), paintMat);
    box.position.set(GANTRY_X + 0.13, 1.32, GANTRY_Z - 0.06);
    box.castShadow = true;
    box.receiveShadow = true;
    this.group.add(box);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), anodMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(GANTRY_X + 0.13, 1.4, GANTRY_Z + 0.03);
    this.group.add(dial);

    const boltMesh = boltField(galvMat, bolts);
    boltMesh.castShadow = false;
    this.group.add(boltMesh);

    // --- crosshead carriage ---------------------------------------------
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(GANTRY_X * 2 + 0.06, 0.13, 0.15), paintMat);
    crossBeam.castShadow = true;
    crossBeam.receiveShadow = true;
    this.carriage.add(crossBeam);

    for (const sx of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.19), anodMat);
      shoe.position.set(GANTRY_X * sx - 0.085 * sx, 0, 0);
      shoe.castShadow = true;
      this.carriage.add(shoe);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 10), anodMat);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(GANTRY_X * sx + 0.06 * sx, 0, 0.06);
      this.carriage.add(knob);
    }

    // The grab handle for changing the drop height. Big, obvious, and shaped
    // like something you would actually take hold of.
    const handleGeo = new THREE.TorusGeometry(0.12, 0.026, 10, 20, Math.PI);
    const handleMesh = new THREE.Mesh(handleGeo, gripMat);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.rotation.z = Math.PI;
    handleMesh.position.set(-0.5, 0.02, 0.16);
    handleMesh.castShadow = true;
    this.handleMesh = handleMesh;
    this.carriage.add(handleMesh);
    this.carriageHandle = grabProxy(new THREE.BoxGeometry(0.4, 0.3, 0.34), 'carriage');
    this.carriageHandle.position.set(-0.5, 0.02, 0.13);
    this.carriage.add(this.carriageHandle);
    const handlePost = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), anodMat);
    handlePost.position.set(-0.5, 0.0, 0.08);
    this.carriage.add(handlePost);

    this.carriage.position.set(0, this.carriageY, GANTRY_Z);
    this.group.add(this.carriage);

    // --- telescoping arm --------------------------------------------------
    this.armBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 1), paintMat);
    this.armBody.castShadow = true;
    this.armBody.receiveShadow = true;
    this.arm.add(this.armBody);
    const armGuide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.2), anodMat);
    armGuide.position.set(0, 0, 0.02);
    this.arm.add(armGuide);
    this.arm.position.set(0, -0.02, 0);
    this.carriage.add(this.arm);

    // --- clamp head -------------------------------------------------------
    const magnetBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.13, 18), paintMat);
    magnetBody.position.y = -0.05;
    magnetBody.castShadow = true;
    magnetBody.receiveShadow = true;
    this.head.add(magnetBody);

    // Visible coil windings — this reads as an electromagnet, not a blob.
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 8, 22), cableMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = -0.045;
    this.head.add(coil);
    const coil2 = coil.clone();
    coil2.position.y = -0.078;
    this.head.add(coil2);

    this.magnetFace = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.018, 18), anodMat);
    this.magnetFace.position.y = -0.122;
    this.magnetFace.castShadow = true;
    this.head.add(this.magnetFace);

    const indicatorMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a26,
      roughness: 0.35,
      metalness: 0,
      emissive: new THREE.Color(0xffd9a0),
      emissiveIntensity: 0.9,
    });
    this.indicator = indicatorMat;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), indicatorMat);
    led.position.set(0.07, -0.02, 0.05);
    this.head.add(led);

    // Two mechanical safety jaws that cradle the ball and swing clear.
    for (const sx of [-1, 1]) {
      const jaw = new THREE.Group();
      const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.11, 0.05), anodMat);
      arm1.position.set(0.055 * sx, -0.055, 0);
      arm1.castShadow = true;
      jaw.add(arm1);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.05), anodMat);
      tip.position.set(0.035 * sx, -0.108, 0);
      tip.castShadow = true;
      jaw.add(tip);
      jaw.position.set(0, -0.09, 0);
      jaw.userData.side = sx;
      this.jaws.push(jaw);
      this.head.add(jaw);
    }

    // The outrigger that carries the release lanyard clear of the fall line.
    const outBar = new THREE.Mesh(new THREE.BoxGeometry(RING_X, 0.035, 0.035), anodMat);
    outBar.position.set(RING_X / 2, 0.02, RING_Z);
    outBar.castShadow = true;
    this.head.add(outBar);
    const outArm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, RING_Z), anodMat);
    outArm.position.set(0, 0.02, RING_Z / 2);
    this.head.add(outArm);
    this.outrigger = new THREE.Object3D();
    this.outrigger.position.set(RING_X, 0.0, RING_Z);
    this.head.add(this.outrigger);
    const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.009, 6, 14), anodMat);
    sheave.position.copy(this.outrigger.position);
    sheave.rotation.y = Math.PI / 2;
    this.head.add(sheave);

    this.head.position.set(0, -0.06, 0);
    this.arm.add(this.head);

    // --- release lanyard and ring ----------------------------------------
    this.lanyard = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), cableMat);
    this.lanyard.castShadow = false;
    this.group.add(this.lanyard);

    const ringGeo = new THREE.TorusGeometry(0.115, 0.028, 12, 28);
    const ringMesh = new THREE.Mesh(ringGeo, gripMat);
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    this.ring.add(ringMesh);
    // A ring is mostly hole. A four-year-old aiming at it will put a finger in
    // the middle as often as on the rim, so the pick volume is a solid ball
    // covering the whole thing — never drawn, only felt.
    this.ringHandle = grabProxy(new THREE.SphereGeometry(0.16, 10, 8), 'ring');
    this.ring.add(this.ringHandle);
    // The swivel that ties the ring to the lanyard.
    const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.06, 10), anodMat);
    swivel.position.y = 0.145;
    this.ring.add(swivel);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 14), anodMat);
    shackle.position.y = 0.118;
    shackle.rotation.y = Math.PI / 2;
    this.ring.add(shackle);

    this.ring.position.set(RING_X, RING_REST_Y, RING_Z);
    this.group.add(this.ring);

    this.setArmReach(0.32, true);
  }

  /** Where the ball sits while it is held. */
  ballAnchor(target: THREE.Vector3, ballRadius: number) {
    this.head.getWorldPosition(target);
    // Face plate sits at head-local y = -0.122; the ball hangs off it.
    target.y += -0.122 - ballRadius;
    return target;
  }

  /** Distance from the magnet face down to a given surface height. */
  faceHeightAbove(surfaceY: number) {
    const v = new THREE.Vector3();
    this.head.getWorldPosition(v);
    return v.y - 0.122 - surfaceY;
  }

  /**
   * Position the crosshead so the ball's underside is `height` above the
   * surface, whatever the ball's radius happens to be.
   */
  setDropHeight(surfaceY: number, height: number, ballRadius: number, immediate = false) {
    const ballCenterY = surfaceY + height + ballRadius;
    const faceY = ballCenterY + ballRadius;
    // head local y (-0.06) + arm local y (-0.02) + face offset (-0.122)
    const y = faceY + 0.122 + 0.06 + 0.02;
    this.targetCarriageY = Math.max(CARRIAGE_MIN_Y, y);
    if (immediate) {
      this.carriageY = this.targetCarriageY;
      this.carriage.position.y = this.carriageY;
    }
  }

  get carriageHeight() {
    return this.carriageY;
  }

  get carriageTarget() {
    return this.targetCarriageY;
  }

  /** Slide the arm so the clamp sits over a given world Z. */
  setDropZ(z: number, immediate = false) {
    this.setArmReach(z - GANTRY_Z, immediate);
    // The lanyard is cleated to the carriage, so the ring travels out with the
    // arm. It stays the same distance to the side of the drop line, which is
    // what keeps a hand off the landing point in every mode.
    this.targetRingZ = z + RING_Z;
    if (immediate) this.ringZ = this.targetRingZ;
  }

  private setArmReach(reach: number, immediate = false) {
    this.targetArmReach = Math.max(0.2, reach);
    if (immediate) {
      this.armReach = this.targetArmReach;
      this.applyArm();
    }
  }

  private applyArm() {
    this.armBody.scale.z = this.armReach + 0.16;
    this.armBody.position.z = (this.armReach + 0.16) / 2 - 0.08;
    this.head.position.z = this.armReach;
  }

  openClamp() {
    this.targetJawOpen = 1;
    this.indicator.emissiveIntensity = 0.05;
  }

  closeClamp() {
    this.targetJawOpen = 0;
    this.indicator.emissiveIntensity = 0.9;
  }

  get clampOpen() {
    return this.jawOpen > 0.5;
  }

  update(dt: number) {
    this.time += dt;

    this.carriageY = damp(this.carriageY, this.targetCarriageY, 7, dt);
    this.carriage.position.y = this.carriageY;
    this.handleMesh.position.y = 0.02 + Math.sin(this.time * 3.1) * 0.018 * this.handleNudge;

    this.armReach = damp(this.armReach, this.targetArmReach, 4.5, dt);
    this.applyArm();

    this.jawOpen = damp(this.jawOpen, this.targetJawOpen, 24, dt);
    for (const jaw of this.jaws) {
      const sx = jaw.userData.side as number;
      jaw.rotation.z = -sx * this.jawOpen * 0.85;
    }

    // The ring lags the finger slightly, so it feels like it has weight.
    this.ringVisual = damp(this.ringVisual, clamp01(this.ringPull), 18, dt);
    this.ringZ = damp(this.ringZ, this.targetRingZ, 4.5, dt);
    const sway = Math.sin(this.time * 1.3) * 0.006 * (1 - this.ringVisual);
    this.ring.position.set(
      RING_X + sway,
      RING_REST_Y - this.ringVisual * RING_TRAVEL,
      this.ringZ + sway * 0.6
    );
    this.ring.rotation.z = sway * 1.4;

    // The lanyard drops straight down from the outrigger on the arm, so it
    // always reads as one plumb line beside the fall line.
    this.outrigger.getWorldPosition(_tip);
    const ringTopY = this.ring.position.y + 0.16;
    const len = Math.max(0.05, _tip.y - ringTopY);
    this.lanyard.scale.y = len;
    this.lanyard.position.set(
      lerp(_tip.x, this.ring.position.x, 0.5),
      ringTopY + len / 2,
      lerp(_tip.z, this.ring.position.z, 0.5)
    );
  }
}

/**
 * An invisible, generously sized pick volume. `Raycaster` ignores the
 * `visible` flag, so these cost nothing to draw while making every control
 * forgiving to aim at.
 */
export function grabProxy(geometry: THREE.BufferGeometry, pick: string) {
  const mesh = new THREE.Mesh(geometry, PROXY_MATERIAL);
  mesh.visible = false;
  mesh.userData.pick = pick;
  return mesh;
}

const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
