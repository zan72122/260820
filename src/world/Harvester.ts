import * as THREE from 'three';
import {
  dustyTop,
  muddyRubber,
  oilStain,
  paintedSteel,
  polishedSteel,
  soilAlbedo,
} from '../gfx/textures';

const UPV = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Three point hitch geometry. A real lift moves the implement up and down and
 * only changes its pitch a little — the top link holds the attitude — so the
 * shares travel about half a metre while the conveyor stays where it belongs.
 */
const LIFT_Y_RAISED = 0.33;
const LIFT_Y_LOWERED = -0.185;
const LIFT_PITCH_RAISED = -0.03;
const LIFT_PITCH_LOWERED = 0.022;

/**
 * A tractor rear end towing a peanut digger-shaker-inverter.
 *
 * Local space: +X is the direction of travel, the implement hangs behind the
 * tractor between x = +0.6 and x = -2.3, and the whole implement pivots about
 * the lower hitch pins so that lowering the lever really does drive the shares
 * under the ridge.
 */
export class Harvester {
  readonly group = new THREE.Group();
  readonly implement = new THREE.Group();
  readonly tractor = new THREE.Group();
  readonly leverPivot = new THREE.Group();
  readonly leverKnob = new THREE.Object3D();
  readonly bladeTip = new THREE.Object3D();
  readonly conveyorAnchor = new THREE.Object3D();
  readonly inverterAnchor = new THREE.Object3D();

  private wheels: THREE.Object3D[] = [];
  private rods!: THREE.InstancedMesh;
  private rodBase: number[] = [];
  private kickers: THREE.Object3D[] = [];
  private cylBody!: THREE.Mesh;
  private cylRod!: THREE.Mesh;
  private liftArm = new THREE.Group();
  private hose!: THREE.Mesh;
  private hoseAnchorA = new THREE.Vector3(3.05, 1.32, 0.42);
  private lowerLinks: { mesh: THREE.Mesh; z: number; base: number }[] = [];
  private topLinkMesh?: THREE.Mesh;
  private liftRods: { mesh: THREE.Mesh; z: number; base: number }[] = [];
  private driverHead = new THREE.Group();
  private driverArm = new THREE.Group();
  private conveyorRunFront = new THREE.Vector3(0.16, 0.3, 0);
  private conveyorRunRear = new THREE.Vector3(-1.68, 0.88, 0);
  private implementBaseY = 0.4;

  lift = 0; // 0 raised .. 1 lowered
  conveyorSpeed = 0;
  private conveyorPhase = 0;
  private engineT = 0;
  lookAtLever = 0; // 0 ahead .. 1 driver is staring at the lever

  constructor() {
    this.group.add(this.tractor, this.implement);
    this.buildTractor();
    this.buildImplement();
    this.applyLift(0);
  }

  /* ------------------------------------------------------------ tractor */

  private buildTractor() {
    const paint = new THREE.MeshStandardMaterial({
      map: paintedSteel('#8d3a2a', 5),
      roughness: 0.62,
      metalness: 0.25,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c2b28, roughness: 0.7, metalness: 0.3 });
    const dusty = new THREE.MeshStandardMaterial({ map: dustyTop(), roughness: 0.95, metalness: 0.05 });
    const oily = new THREE.MeshStandardMaterial({ map: oilStain(), roughness: 0.55, metalness: 0.45 });
    const rubber = new THREE.MeshStandardMaterial({ map: muddyRubber(), roughness: 0.95, metalness: 0 });

    // rear axle housing and body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.86, 1.06), paint);
    body.position.set(3.5, 1.0, 0);
    body.castShadow = true;
    this.tractor.add(body);

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.7, 14), paint);
    bell.rotation.z = Math.PI / 2;
    bell.position.set(4.3, 0.95, 0);
    bell.castShadow = true;
    this.tractor.add(bell);

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.9, 10), oily);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(3.3, 0.82, 0);
    axle.castShadow = true;
    this.tractor.add(axle);

    // top link bracket, so the linkage does not end in mid air
    const tlBracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.14), paint);
    tlBracket.position.set(2.62, 1.24, 0);
    tlBracket.castShadow = true;
    this.tractor.add(tlBracket);

    // top deck collects dust because it faces the sky
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.96), dusty);
    deck.position.set(3.55, 1.46, 0);
    deck.castShadow = true;
    this.tractor.add(deck);

    // wheels: a rounded carcass with real bar lugs, not a black disc
    const tyreProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.34, -0.26),
      new THREE.Vector2(0.56, -0.26),
      new THREE.Vector2(0.72, -0.245),
      new THREE.Vector2(0.8, -0.17),
      new THREE.Vector2(0.825, -0.05),
      new THREE.Vector2(0.825, 0.05),
      new THREE.Vector2(0.8, 0.17),
      new THREE.Vector2(0.72, 0.245),
      new THREE.Vector2(0.56, 0.26),
      new THREE.Vector2(0.34, 0.26),
    ];
    const tyreGeo = new THREE.LatheGeometry(tyreProfile, 24);
    tyreGeo.computeVertexNormals();
    const rimGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.5, 18);
    const hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.58, 10);
    const lugGeo = new THREE.BoxGeometry(0.09, 0.055, 0.44);
    for (const z of [0.86, -0.86]) {
      const w = new THREE.Group();
      const tyre = new THREE.Mesh(tyreGeo, rubber);
      tyre.rotation.x = Math.PI / 2;
      tyre.castShadow = true;
      tyre.receiveShadow = true;
      const rim = new THREE.Mesh(rimGeo, paint);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, oily);
      hub.rotation.x = Math.PI / 2;
      const lug = new THREE.InstancedMesh(lugGeo, rubber, 22);
      const m = new THREE.Matrix4();
      const e = new THREE.Euler();
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        // alternating bars, angled like a real tractor tread
        e.set(0, i % 2 === 0 ? 0.34 : -0.34, a);
        const q = new THREE.Quaternion().setFromEuler(e);
        const p = new THREE.Vector3(Math.cos(a) * 0.845, Math.sin(a) * 0.845, (i % 2 === 0 ? 1 : -1) * 0.06);
        lug.setMatrixAt(i, m.compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
      lug.instanceMatrix.needsUpdate = true;
      lug.castShadow = true;
      w.add(tyre, rim, hub, lug);
      w.position.set(3.3, 0.83, z);
      this.tractor.add(w);
      this.wheels.push(w);

      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(0.99, 0.99, 0.7, 18, 1, true, Math.PI * 0.02, Math.PI * 0.92),
        dusty
      );
      fender.rotation.x = Math.PI / 2;
      fender.position.set(3.3, 0.83, z);
      fender.castShadow = true;
      fender.receiveShadow = true;
      this.tractor.add(fender);
    }

    // operator platform, seat, control stand
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.5), dusty);
    floor.position.set(4.05, 1.14, 0);
    floor.receiveShadow = true;
    this.tractor.add(floor);

    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.5), dark);
    seatBase.position.set(4.05, 1.62, 0);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.5), dark);
    seatBack.position.set(4.28, 1.86, 0);
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.44, 8), dark);
    seatPost.position.set(4.05, 1.36, 0);
    seatBase.castShadow = seatBack.castShadow = true;
    this.tractor.add(seatBase, seatBack, seatPost);

    this.buildDriver();
    this.buildLever();

    // three point linkage: draft links, lift rods and top link, all pinned to
    // the tractor and re-aimed at the implement every time the lever moves
    for (const z of [0.52, -0.52]) {
      const link = new THREE.Mesh(new THREE.BoxGeometry(1, 0.085, 0.085), dark);
      link.castShadow = true;
      this.tractor.add(link);
      this.lowerLinks.push({ mesh: link, z, base: 1 });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1, 6), dark);
      rod.castShadow = true;
      this.tractor.add(rod);
      this.liftRods.push({ mesh: rod, z: z * 1.12, base: 1 });
    }
    this.topLinkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1, 8), dark);
    this.topLinkMesh.castShadow = true;
    this.tractor.add(this.topLinkMesh);

    // lift arm: rotates with the hitch and drives the cylinder length
    this.liftArm.position.set(3.0, 1.16, 0);
    this.tractor.add(this.liftArm);
    for (const z of [0.56, -0.56]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.1), paint);
      arm.position.set(-0.39, 0, z);
      arm.castShadow = true;
      this.liftArm.add(arm);
    }

    // hydraulic cylinder
    this.cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.46, 12), oily);
    this.cylBody.castShadow = true;
    this.cylRod = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.5, 10), new THREE.MeshStandardMaterial({
      map: polishedSteel(),
      roughness: 0.22,
      metalness: 0.95,
    }));
    this.cylRod.castShadow = true;
    this.tractor.add(this.cylBody, this.cylRod);

    // hoses out of the remote block
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.85, metalness: 0.05 });
    this.hose = new THREE.Mesh(new THREE.BufferGeometry(), hoseMat);
    this.hose.castShadow = true;
    this.tractor.add(this.hose);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.24), oily);
    block.position.copy(this.hoseAnchorA).add(new THREE.Vector3(0.06, 0.02, 0));
    this.tractor.add(block);
  }

  private buildDriver() {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x4b5c72, roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.8 });
    const cap = new THREE.MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 4, 8), cloth);
    torso.position.set(4.16, 1.95, 0);
    torso.rotation.z = 0.12;
    torso.castShadow = true;

    const legs = new THREE.Group();
    for (const lz of [0.12, -0.12]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), cloth);
      thigh.position.set(3.86, 1.76, lz);
      thigh.rotation.z = Math.PI / 2;
      thigh.castShadow = true;
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 4, 8), cloth);
      shin.position.set(3.66, 1.46, lz);
      shin.rotation.z = 0.18;
      shin.castShadow = true;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.11), new THREE.MeshStandardMaterial({
        color: 0x2a241d,
        roughness: 0.95,
      }));
      boot.position.set(3.68, 1.22, lz);
      legs.add(thigh, shin, boot);
    }
    const legs2 = new THREE.Group();

    this.driverHead.position.set(4.1, 2.32, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
    head.castShadow = true;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.1, 12), cap);
    hat.position.y = 0.1;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.018, 12), cap);
    brim.position.set(-0.08, 0.06, 0);
    this.driverHead.add(head, hat, brim);

    // right arm: hangs, then reaches for the lever when it is being used
    this.driverArm.position.set(4.0, 2.16, 0.34);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 3, 6), cloth);
    upper.position.set(0, -0.14, 0);
    upper.castShadow = true;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 6), skin);
    fore.position.set(0, -0.36, 0);
    this.driverArm.add(upper, fore);

    this.tractor.add(torso, legs, legs2, this.driverHead, this.driverArm);
  }

  /** The one control the player ever touches. */
  private buildLever() {
    const steel = new THREE.MeshStandardMaterial({ map: polishedSteel(), roughness: 0.32, metalness: 0.9 });
    // worn safety orange, the colour these controls actually are
    const gripKnob = new THREE.MeshStandardMaterial({ color: 0xb3502a, roughness: 0.72 });
    const paint = new THREE.MeshStandardMaterial({
      map: paintedSteel('#8d3a2a', 9),
      roughness: 0.6,
      metalness: 0.3,
    });

    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), paint);
    stand.position.set(3.72, 1.42, 0.6);
    stand.castShadow = true;
    this.tractor.add(stand);

    const quadrant = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 16, 1, false, 0, Math.PI), paint);
    quadrant.rotation.x = Math.PI / 2;
    quadrant.rotation.z = -Math.PI / 2;
    quadrant.position.set(3.72, 1.66, 0.66);
    this.tractor.add(quadrant);

    this.leverPivot.position.set(3.72, 1.66, 0.68);
    this.tractor.add(this.leverPivot);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.6, 8), steel);
    shaft.position.y = 0.3;
    shaft.castShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), gripKnob);
    knob.position.y = 0.62;
    knob.castShadow = true;
    // worn ring where a hand has gripped it for twenty seasons
    const wear = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.013, 6, 14), new THREE.MeshStandardMaterial({
      color: 0x4b463f,
      roughness: 0.55,
      metalness: 0.4,
    }));
    wear.position.y = 0.552;
    wear.rotation.x = Math.PI / 2;
    this.leverKnob.position.y = 0.62;
    this.leverPivot.add(shaft, knob, wear, this.leverKnob);
  }

  /* ---------------------------------------------------------- implement */

  private buildImplement() {
    const frameMat = new THREE.MeshStandardMaterial({
      map: paintedSteel('#4c5f43', 21),
      roughness: 0.7,
      metalness: 0.24,
    });
    const dusty = new THREE.MeshStandardMaterial({ map: dustyTop(), roughness: 0.96, metalness: 0.05 });
    const steel = new THREE.MeshStandardMaterial({ map: polishedSteel(), roughness: 0.26, metalness: 0.95 });
    const oily = new THREE.MeshStandardMaterial({ map: oilStain(), roughness: 0.5, metalness: 0.5 });
    const crust = new THREE.MeshStandardMaterial({ map: soilAlbedo(), color: 0x8b7350, roughness: 1 });

    // main toolbar: 100 mm box section, and it looks like it
    const toolbar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 1.95), frameMat);
    toolbar.position.set(0.42, 0.86, 0);
    toolbar.castShadow = true;
    this.implement.add(toolbar);
    const tbTop = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.012, 1.952), dusty);
    tbTop.position.set(0.42, 0.932, 0);
    this.implement.add(tbTop);

    // A-frame mast for the top link
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), frameMat);
    mast.position.set(0.42, 1.12, 0);
    mast.castShadow = true;
    this.implement.add(mast);
    for (const z of [0.3, -0.3]) {
      const stay = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), frameMat);
      stay.position.set(0.42, 1.09, z * 0.7);
      stay.rotation.x = z > 0 ? -0.42 : 0.42;
      this.implement.add(stay);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(0.42, 1.34, 0);
    this.implement.add(pin);

    for (const z of [0.52, -0.52]) {
      const lowerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 8), steel);
      lowerPin.rotation.x = Math.PI / 2;
      lowerPin.position.set(0.55, 0.41, z);
      this.implement.add(lowerPin);
    }

    // Side channels: the implement has a body, not a pile of plates. The
    // conveyor lives between them and stays visible from behind and above.
    const railTop = (x: number) => 1.06 + (0.62 - x) * 0.1;
    const railBot = (x: number) => 0.4 + (0.62 - x) * 0.17;
    for (const z of [0.62, -0.62]) {
      for (const [ya, yb, th] of [
        [railTop(0.62), railTop(-2.15), 0.085],
        [railBot(0.62), railBot(-2.15), 0.1],
      ] as [number, number, number][]) {
        const len = Math.hypot(2.77, yb - ya);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, th, 0.07), frameMat);
        rail.position.set((0.62 - 2.15) / 2, (ya + yb) / 2, z);
        rail.rotation.z = Math.atan2(yb - ya, -2.77) + Math.PI;
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.implement.add(rail);
      }
      for (const px of [0.5, -0.25, -1.0, -1.75, -2.1]) {
        const h = railTop(px) - railBot(px);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.062), frameMat);
        post.position.set(px, (railTop(px) + railBot(px)) / 2, z);
        post.castShadow = true;
        this.implement.add(post);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6), steel);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(px, railTop(px), z * 1.06);
        this.implement.add(bolt);
      }
      // lower skirt keeps soil off the chain, and collects a crust of it
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 0.026), frameMat);
      skirt.position.set(-0.75, railBot(-0.75) - 0.03, z * 1.03);
      skirt.rotation.z = Math.atan2(railBot(-2.15) - railBot(0.62), -2.77) + Math.PI;
      skirt.castShadow = true;
      this.implement.add(skirt);
      const mud = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.032), crust);
      mud.position.set(-0.55, railBot(-0.55) - 0.08, z * 1.06);
      mud.rotation.z = skirt.rotation.z;
      this.implement.add(mud);
    }
    // cross braces tying the two channels together
    for (const px of [-0.25, -1.75]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.3), frameMat);
      brace.position.set(px, railTop(px) - 0.02, 0);
      brace.castShadow = true;
      this.implement.add(brace);
    }

    this.buildShares(steel, frameMat, crust);
    this.buildConveyor(steel, frameMat, oily);
    this.buildInverter(steel, oily);

    // depth wheel: sets how deep the shares run
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14), new THREE.MeshStandardMaterial({
      map: muddyRubber(),
      roughness: 0.95,
    }));
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.62, 0.26, -0.82);
    gauge.castShadow = true;
    this.implement.add(gauge);
    const gaugeArm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.07), frameMat);
    gaugeArm.position.set(0.56, 0.55, -0.82);
    gaugeArm.rotation.z = -0.52;
    gaugeArm.castShadow = true;
    const gaugeCross = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.36), frameMat);
    gaugeCross.position.set(0.44, 0.82, -0.66);
    this.implement.add(gaugeArm, gaugeCross);

    this.bladeTip.position.set(0.2, 0.055, 0);
    this.implement.add(this.bladeTip);
    this.conveyorAnchor.position.copy(this.conveyorRunFront);
    this.inverterAnchor.position.set(-2.0, 0.86, 0);
    this.implement.add(this.conveyorAnchor, this.inverterAnchor);
  }

  /** Two V shares, 12 mm plate, polished only where the soil rubs. */
  private buildShares(steel: THREE.Material, frameMat: THREE.Material, crust: THREE.Material) {
    const bladeMat = new THREE.MeshStandardMaterial({
      map: polishedSteel(),
      color: 0xa8a9a3,
      roughness: 0.46,
      metalness: 0.6,
    });
    // the bevel that does the cutting is kept bright by the soil itself
    const edgeMat = new THREE.MeshStandardMaterial({
      map: polishedSteel(),
      color: 0xdedcd2,
      roughness: 0.24,
      metalness: 0.78,
    });
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      // main plate: thick, not a sheet of paper
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.019, 0.52), bladeMat);
      plate.castShadow = true;
      plate.receiveShadow = true;
      g.add(plate);
      // the bevel that actually cuts, kept bright by the soil
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.021, 0.53), edgeMat);
      edge.position.set(0.37, -0.003, 0);
      edge.rotation.z = -0.12;
      g.add(edge);
      // rear stiffener and the shank that bolts it to the toolbar
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.085, 0.035), bladeMat);
      rib.position.set(-0.2, 0.05, side * 0.2);
      g.add(rib);
      g.position.set(0.28, 0.075, side * 0.26);
      g.rotation.set(0, side * 0.32, -0.22);
      this.implement.add(g);
      // the curved wing that hands the lifted row to the conveyor
      const wing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.4, 10, 1, true, Math.PI * 1.02, Math.PI * 0.55),
        bladeMat
      );
      wing.rotation.set(Math.PI / 2, 0, 0.3);
      wing.position.set(-0.04, 0.16, side * 0.27);
      wing.castShadow = true;
      this.implement.add(wing);

      const shank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.06), frameMat);
      shank.position.set(0.44, 0.46, side * 0.34);
      shank.rotation.z = 0.1;
      shank.castShadow = true;
      this.implement.add(shank);
      // packed soil where the shank meets the ground
      const packed = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.07), crust);
      packed.position.set(0.42, 0.15, side * 0.34);
      this.implement.add(packed);
    }
    void steel;
  }

  /** Rattler conveyor: rod chain that lifts the vines and drops the soil. */
  private buildConveyor(steel: THREE.Material, frameMat: THREE.Material, oily: THREE.Material) {
    const rodMat = new THREE.MeshStandardMaterial({
      map: polishedSteel(),
      color: 0xadaea8,
      roughness: 0.5,
      metalness: 0.55,
    });
    const N = 30;
    const rodGeo = new THREE.CylinderGeometry(0.023, 0.023, 1.12, 6);
    this.rods = new THREE.InstancedMesh(rodGeo, rodMat, N);
    this.rods.castShadow = true;
    this.rods.receiveShadow = true;
    this.rods.frustumCulled = false;
    this.implement.add(this.rods);
    for (let i = 0; i < N; i++) this.rodBase.push(i / N);

    // chain rails
    for (const z of [0.53, -0.53]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.05, 0.03), frameMat);
      const mid = this.conveyorRunFront.clone().add(this.conveyorRunRear).multiplyScalar(0.5);
      rail.position.set(mid.x, mid.y - 0.02, z);
      rail.rotation.z = Math.atan2(
        this.conveyorRunRear.y - this.conveyorRunFront.y,
        this.conveyorRunRear.x - this.conveyorRunFront.x
      );
      rail.castShadow = true;
      this.implement.add(rail);
    }
    // drive sprockets, oily where they turn
    for (const [x, y, r] of [
      [this.conveyorRunFront.x, this.conveyorRunFront.y, 0.11],
      [this.conveyorRunRear.x, this.conveyorRunRear.y, 0.15],
    ] as [number, number, number][]) {
      for (const z of [0.53, -0.53]) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 12), oily);
        s.rotation.x = Math.PI / 2;
        s.position.set(x, y, z);
        s.castShadow = true;
        this.implement.add(s);
      }
    }
    void steel;
  }

  /** Two counter rotating kickers that turn the vine mass over. */
  private buildInverter(steel: THREE.Material, oily: THREE.Material) {
    for (const side of [1, -1]) {
      const hub = new THREE.Group();
      hub.position.set(-2.0, 0.84, side * 0.42);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), oily);
      disc.rotation.x = Math.PI / 2;
      hub.add(disc);
      for (let i = 0; i < 4; i++) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.4, 6), steel);
        const a = (i / 4) * Math.PI * 2;
        rod.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0);
        rod.rotation.z = a + Math.PI / 2;
        rod.castShadow = true;
        hub.add(rod);
      }
      this.implement.add(hub);
      this.kickers.push(hub);
    }
    // rear deflector: the vines slide off it into the row
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.026, 0.96),
      new THREE.MeshStandardMaterial({ map: dustyTop(), color: 0x6b6455, roughness: 0.94, metalness: 0.15 })
    );
    hood.position.set(-2.26, 0.74, 0);
    hood.rotation.z = 0.52;
    hood.castShadow = true;
    this.implement.add(hood);
    for (const z of [0.55, -0.55]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.05), oily);
      bracket.position.set(-2.16, 0.82, z);
      this.implement.add(bracket);
    }
  }

  /* -------------------------------------------------------------- state */

  /** 0 = shares clear of the ground, 1 = shares running under the pods. */
  applyLift(v: number) {
    this.lift = Math.min(1, Math.max(0, v));
    const y = LIFT_Y_RAISED + (LIFT_Y_LOWERED - LIFT_Y_RAISED) * this.lift;
    const pitch = LIFT_PITCH_RAISED + (LIFT_PITCH_LOWERED - LIFT_PITCH_RAISED) * this.lift;
    this.implement.position.set(0, y, 0);
    this.implement.rotation.z = pitch;
    this.implementBaseY = y;
    this.implement.updateMatrix();

    this.leverPivot.rotation.z = 0.42 - this.lift * 0.95;
    this.liftArm.rotation.z = -0.3 + this.lift * 0.46;
    this.updateLinkage(y, pitch);
    this.updateCylinder();
    this.updateHose();
    this.updateDriver();
  }

  /** Aim each link at the pin it is actually attached to. */
  private updateLinkage(y: number, pitch: number) {
    const e = new THREE.Euler(0, 0, pitch);
    const armEnd = new THREE.Vector3(-0.72, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), this.liftArm.rotation.z);
    armEnd.add(this.liftArm.position);
    for (let i = 0; i < this.lowerLinks.length; i++) {
      const { mesh, z } = this.lowerLinks[i];
      const pin = new THREE.Vector3(0.55, 0.41, z).applyEuler(e).add(new THREE.Vector3(0, y, 0));
      const a = new THREE.Vector3(2.78, 0.44, z);
      this.aim(mesh, a, pin, 1, false);
      // lift rod: tractor arm down to a point along the draft link
      const grab = a.clone().lerp(pin, 0.62);
      const rod = this.liftRods[i];
      this.aim(rod.mesh, new THREE.Vector3(armEnd.x, armEnd.y, rod.z), grab.setZ(rod.z), 1, true);
    }
    if (this.topLinkMesh) {
      const pin = new THREE.Vector3(0.42, 1.34, 0).applyEuler(e).add(new THREE.Vector3(0, y, 0));
      this.aim(this.topLinkMesh, new THREE.Vector3(2.62, 1.3, 0), pin, 1, true);
    }
  }

  /** Stretch a unit-long part between two points. */
  private aim(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, base: number, alongY: boolean) {
    const dir = b.clone().sub(a);
    const len = Math.max(0.05, dir.length());
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    if (alongY) {
      mesh.quaternion.setFromUnitVectors(UPV, dir.clone().normalize());
      mesh.scale.set(1, len / base, 1);
    } else {
      mesh.rotation.set(0, 0, Math.atan2(dir.y, dir.x));
      mesh.scale.set(len / base, 1, 1);
    }
  }

  private updateCylinder() {
    const a = new THREE.Vector3(3.28, 1.62, 0.42);
    const armEnd = new THREE.Vector3(-0.72, 0, 0.56).applyAxisAngle(new THREE.Vector3(0, 0, 1), this.liftArm.rotation.z);
    // (the arm swings up as the implement goes down: rod extends, frame drops)
    const b = armEnd.add(this.liftArm.position);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UPV, dir.clone().normalize());
    this.cylBody.quaternion.copy(q);
    this.cylBody.position.copy(a).addScaledVector(dir.clone().normalize(), 0.23);
    this.cylRod.quaternion.copy(q);
    const rodLen = Math.max(0.05, len - 0.42);
    this.cylRod.scale.set(1, rodLen / 0.5, 1);
    this.cylRod.position.copy(b).addScaledVector(dir.clone().normalize(), -rodLen * 0.5);
  }

  private updateHose() {
    const a = this.hoseAnchorA;
    const b = this.cylBody.position.clone().add(new THREE.Vector3(0, 0.1, 0.06));
    const sag = 0.22 + this.lift * 0.1;
    const curve = new THREE.CatmullRomCurve3([
      a.clone(),
      a.clone().lerp(b, 0.35).add(new THREE.Vector3(-0.05, -sag, 0.1)),
      a.clone().lerp(b, 0.7).add(new THREE.Vector3(0, -sag * 0.6, 0.05)),
      b,
    ]);
    const geo = new THREE.TubeGeometry(curve, 14, 0.018, 5, false);
    this.hose.geometry.dispose();
    this.hose.geometry = geo;
  }

  private updateDriver() {
    // head turns to the lever when hinting, and while the lever is moving
    const look = Math.max(this.lookAtLever, this.lift > 0 && this.lift < 1 ? 1 : 0);
    this.driverHead.rotation.y = -0.85 * look;
    this.driverHead.rotation.z = -0.18 * look;
    // the right hand rests on the lever knob and travels down with it
    const knob = new THREE.Vector3(0, 0.62, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), this.leverPivot.rotation.z)
      .add(this.leverPivot.position);
    const dir = knob.sub(this.driverArm.position);
    const len = Math.max(0.28, dir.length());
    this.driverArm.quaternion.setFromUnitVectors(DOWN, dir.normalize());
    this.driverArm.scale.set(1, len / 0.5, 1);
  }

  /** World position of the lever knob, used for the touch hot spot. */
  leverWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.leverKnob.getWorldPosition(target);
  }

  bladeWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.bladeTip.getWorldPosition(target);
  }

  /** Point on the conveyor run, u = 0 at the shares, u = 1 at the kickers. */
  conveyorPoint(u: number, target: THREE.Vector3): THREE.Vector3 {
    const t = Math.min(1, Math.max(0, u));
    target.lerpVectors(this.conveyorRunFront, this.conveyorRunRear, t);
    target.y += 0.075 + Math.sin(t * Math.PI) * 0.03;
    return this.implement.localToWorld(target);
  }

  update(dt: number, travelSpeed: number) {
    this.engineT += dt;
    for (const w of this.wheels) w.rotation.z -= (travelSpeed / 0.82) * dt;

    // idle shake: the whole machine breathes with the diesel
    const idle = Math.sin(this.engineT * 27.5) * 0.0016 + Math.sin(this.engineT * 13.1) * 0.0009;
    this.tractor.position.y = idle;
    this.implement.position.y = this.implementBaseY + idle * 0.4;

    this.conveyorPhase = (this.conveyorPhase + dt * this.conveyorSpeed) % 1;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3(1, 1, 1);
    const front = this.conveyorRunFront;
    const rear = this.conveyorRunRear;
    for (let i = 0; i < this.rods.count; i++) {
      const t = (this.rodBase[i] + this.conveyorPhase) % 1;
      if (t < 0.62) {
        // carrying run
        const k = t / 0.62;
        p.lerpVectors(front, rear, k);
        p.y += 0.02 + Math.sin((this.engineT * 18 + i) * 1.0) * 0.004 * Math.min(1, this.conveyorSpeed);
      } else {
        // return run underneath
        const k = (t - 0.62) / 0.38;
        p.lerpVectors(rear, front, k);
        p.y -= 0.11;
      }
      this.rods.setMatrixAt(i, m.compose(p, q, sc));
    }
    this.rods.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.kickers.length; i++) {
      this.kickers[i].rotation.z += dt * this.conveyorSpeed * (i === 0 ? 9 : -9);
    }
    this.updateDriver();
  }

  /** Small vibration used as the first, wordless invitation. */
  nudgeLever(amount: number) {
    this.leverPivot.rotation.z = 0.42 - this.lift * 0.95 + amount;
  }
}
