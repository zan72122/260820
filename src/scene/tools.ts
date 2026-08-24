import * as THREE from 'three';

/**
 * Hand tools. Each is modeled so its shape explains its use: a bristle brush
 * you could actually hold, a rinse wand connected by hose to its water flask,
 * a glass resin syringe with a visible fill level, a soft cloth, a small
 * mirror on a friction joint, and the quartz prism riding its wall rail.
 *
 * Every tool has a rest pose on the table and an "in hand" pose that floats
 * slightly above the finger, tip toward the work.
 */

const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a774f, roughness: 0.7 });
const wornWoodMat = new THREE.MeshStandardMaterial({ color: 0x86653f, roughness: 0.85 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9bec2, metalness: 0.85, roughness: 0.35 });
const brassDullMat = new THREE.MeshStandardMaterial({ color: 0xa08b62, metalness: 0.7, roughness: 0.5 });

export class Tool {
  readonly group = new THREE.Group();
  readonly restPos = new THREE.Vector3();
  readonly restQuat = new THREE.Quaternion();
  held = false;
  private t = 0;

  constructor(build: (g: THREE.Group) => void) {
    build(this.group);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  setRest(pos: THREE.Vector3, euler: THREE.Euler) {
    this.restPos.copy(pos);
    this.restQuat.setFromEuler(euler);
    this.group.position.copy(pos);
    this.group.quaternion.copy(this.restQuat);
  }

  /** Move toward a work point with the tip oriented along `aim`. */
  holdAt(tip: THREE.Vector3, aim: THREE.Vector3, dt: number) {
    this.held = true;
    this.t = Math.min(1, this.t + dt * 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim.clone().normalize());
    this.group.position.lerp(tip, 1 - Math.pow(0.0001, dt));
    this.group.quaternion.slerp(q, 1 - Math.pow(0.001, dt));
  }

  release(dt: number) {
    this.held = false;
    this.t = Math.max(0, this.t - dt * 3);
    this.group.position.lerp(this.restPos, 1 - Math.pow(0.02, dt));
    this.group.quaternion.slerp(this.restQuat, 1 - Math.pow(0.02, dt));
  }

  /** Snap home (phase change): no tool lingers in the air. */
  reset() {
    this.held = false;
    this.group.position.copy(this.restPos);
    this.group.quaternion.copy(this.restQuat);
  }
}

/** Soft bristle brush: turned handle, ferrule, splayed tuft. Tip at local -Y. */
export function makeBrush(): Tool {
  return new Tool((g) => {
    const handlePts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      handlePts.push(new THREE.Vector2(0.008 + 0.005 * Math.sin(t * Math.PI) + 0.002 * t, t * 0.11));
    }
    const handle = new THREE.Mesh(new THREE.LatheGeometry(handlePts, 14), wornWoodMat);
    handle.position.y = 0.035;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0125, 0.028, 12), brassDullMat);
    ferrule.position.y = 0.024;
    const tuftGeo = new THREE.CylinderGeometry(0.004, 0.0115, 0.035, 10, 4);
    {
      const p = tuftGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const splay = y < -0.01 ? 1 + (-y - 0.01) * 9 : 1;
        p.setX(i, p.getX(i) * splay + Math.sin(p.getZ(i) * 300) * 0.0008);
        p.setZ(i, p.getZ(i) * splay);
      }
      tuftGeo.computeVertexNormals();
    }
    const tuft = new THREE.Mesh(
      tuftGeo,
      new THREE.MeshStandardMaterial({ color: 0xd9c9a5, roughness: 0.95 })
    );
    tuft.position.y = -0.007;
    g.add(handle, ferrule, tuft);
  });
}

/** Rinse wand: slim tapered nozzle; hose runs back to the flask on the table. */
export class RinseTool extends Tool {
  hose: THREE.Mesh | null = null;
  flaskPos = new THREE.Vector3();
  private hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  private hoseMat = new THREE.MeshStandardMaterial({ color: 0x5d5148, roughness: 0.8 });

  constructor() {
    super((g) => {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.075, 12), steelMat);
      grip.position.y = 0.05;
      const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0075, 0.05, 10), steelMat);
      taper.position.y = -0.012;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0022, 0.02, 8), steelMat);
      tip.position.y = -0.046;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0025, 8, 14), brassDullMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.09;
      g.add(grip, taper, tip, collar);
    });
  }

  /** Build the flask that stays on the table; hose connects flask → wand. */
  buildFlask(parent: THREE.Object3D, pos: THREE.Vector3) {
    const flask = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0x7f8a8e, metalness: 0.75, roughness: 0.45 })
    );
    body.position.y = 0.08;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.055, 0.035, 18), steelMat);
    shoulder.position.y = 0.175;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.03, 10), brassDullMat);
    spout.position.y = 0.2;
    // hand pump plunger on top: explains where pressure comes from
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), woodMat);
    pump.position.set(0.028, 0.2, 0);
    flask.add(body, shoulder, spout, pump);
    flask.position.copy(pos);
    flask.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    parent.add(flask);
    this.flaskPos = pos.clone().add(new THREE.Vector3(0, 0.21, 0));
    const hoseGeo = new THREE.TubeGeometry(this.hoseCurve, 24, 0.004, 8);
    this.hose = new THREE.Mesh(hoseGeo, this.hoseMat);
    this.hose.frustumCulled = false;
    parent.add(this.hose);
    this.updateHose();
  }

  private lastHoseEnd = new THREE.Vector3(Infinity, 0, 0);

  /** Diagnostic: current hose control points. */
  hosePoints(): number[][] {
    return this.hoseCurve.points.map((p) => p.toArray().map((v) => Math.round(v * 1000) / 1000));
  }

  updateHose() {
    if (!this.hose) return;
    // matrixWorld can be a frame stale (or just reset) — refresh it first,
    // otherwise the hose ends hang in the air where the wand used to be
    this.group.updateWorldMatrix(true, false);
    const wandEnd = new THREE.Vector3(0, 0.1, 0).applyMatrix4(this.group.matrixWorld);
    // rebuilding a TubeGeometry uploads fresh GPU buffers; only do it when
    // the wand has actually moved
    if (wandEnd.distanceToSquared(this.lastHoseEnd) < 0.008 * 0.008) return;
    this.lastHoseEnd.copy(wandEnd);
    const p = this.hoseCurve.points;
    p[0].copy(this.flaskPos);
    p[3].copy(wandEnd);
    const mid = this.flaskPos.clone().lerp(wandEnd, 0.5);
    // hose sags, but rests on the tabletop rather than passing through it
    mid.y = Math.max(0.775, Math.min(this.flaskPos.y, wandEnd.y) - 0.12);
    p[1].copy(this.flaskPos.clone().lerp(mid, 0.6));
    p[1].y = Math.max(0.775, p[1].y - 0.05);
    p[2].copy(mid.clone().lerp(wandEnd, 0.5));
    // the curve caches arc lengths — refresh or the tube collapses to a point
    this.hoseCurve.updateArcLengths();
    this.hose.geometry.dispose();
    this.hose.geometry = new THREE.TubeGeometry(this.hoseCurve, 24, 0.004, 8);
  }
}

/** Glass resin syringe: visible moon-resin level, fine tip at -Y. */
export class ResinTool extends Tool {
  private resinFill: THREE.Mesh;
  private plunger: THREE.Mesh;
  level = 1;

  constructor() {
    const holder: { resin?: THREE.Mesh; plunger?: THREE.Mesh } = {};
    super((g) => {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.085, 16, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: 0xf4f8f8,
          transparent: true,
          opacity: 0.25,
          roughness: 0.05,
          envMapIntensity: 1.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      barrel.position.y = 0.05;
      barrel.renderOrder = 3;
      const resin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0105, 0.0105, 0.08, 14),
        new THREE.MeshPhysicalMaterial({
          color: 0xe8ecf2,
          transparent: true,
          opacity: 0.75,
          roughness: 0.08,
          envMapIntensity: 1.2,
          emissive: 0x2a3038,
          emissiveIntensity: 0.15,
        })
      );
      resin.position.y = 0.048;
      resin.renderOrder = 2;
      holder.resin = resin;
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.011, 0.03, 12), steelMat);
      nose.position.y = -0.005;
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0018, 0.024, 8), steelMat);
      needle.position.y = -0.026;
      const flangeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 16), steelMat);
      flangeTop.position.y = 0.094;
      const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 12), wornWoodMat);
      plunger.position.y = 0.115;
      holder.plunger = plunger;
      const thumbPad = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14), wornWoodMat);
      thumbPad.position.y = 0.142;
      g.add(barrel, resin, nose, needle, flangeTop, plunger, thumbPad);
    });
    this.resinFill = holder.resin!;
    this.plunger = holder.plunger!;
  }

  setLevel(v: number) {
    this.level = THREE.MathUtils.clamp(v, 0.12, 1);
    this.resinFill.scale.y = this.level;
    this.resinFill.position.y = 0.008 + 0.04 * this.level;
    this.plunger.position.y = 0.115 - (1 - this.level) * 0.045;
  }
}

/** Polishing cloth: a softly creased pad. */
export function makeCloth(): Tool {
  return new Tool((g) => {
    const geo = new THREE.BoxGeometry(0.085, 0.02, 0.065, 10, 2, 8);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      p.setY(i, y + 0.006 * Math.sin(x * 90) * Math.sin(z * 70) - x * x * 0.55);
    }
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 1.0 })
    );
    // folded edge seam
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.086, 0.006, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xcac2b2, roughness: 1 })
    );
    seam.position.set(0, 0.008, 0.03);
    g.add(cloth, seam);
  });
}

/** Small polished mirror on a friction ball joint; redirects the window sun. */
export class MirrorTool {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  /** 0..1 user aim parameter (drag), mapped to sun-spot travel along the horn */
  aim = 0.5;

  constructor() {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 16), woodMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.11, 10), steelMat);
    stem.position.y = 0.065;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), brassDullMat);
    ball.position.y = 0.125;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 10, 24), brassDullMat);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.044, 24),
      new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 1.0, roughness: 0.03, envMapIntensity: 2.2 })
    );
    face.position.z = 0.002;
    const back = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 24),
      new THREE.MeshStandardMaterial({ color: 0x6d5a42, roughness: 0.8 })
    );
    back.rotation.y = Math.PI;
    this.head.add(rim, face, back);
    this.head.position.y = 0.125;
    this.group.add(base, stem, ball, this.head);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  update(windowPos: THREE.Vector3, targetPos: THREE.Vector3) {
    // half-vector orientation: mirror bisects window→mirror and target→mirror
    const m = this.group.getWorldPosition(new THREE.Vector3());
    m.y += 0.125;
    const a = windowPos.clone().sub(m).normalize();
    const b = targetPos.clone().sub(m).normalize();
    const h = a.add(b).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), h);
    const parentQ = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.head.quaternion.slerpQuaternions(this.head.quaternion, parentQ.multiply(q), 0.2);
  }
}

/** Articulated inspection lamp: clamp, two arm segments, shade, spotlight. */
export class InspectionLamp {
  readonly group = new THREE.Group();
  readonly light: THREE.SpotLight;
  readonly head = new THREE.Group();
  private arm1: THREE.Group;
  private arm2: THREE.Group;
  /** 0..1: sweep position along the horn axis */
  sweep = 0.25;
  private targetObj = new THREE.Object3D();

  constructor() {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.06), steelMat);
    clamp.position.y = 0.02;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), brassDullMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, -0.01, 0.04);
    this.group.add(clamp, screw);

    // posed like a working task lamp: first segment leans toward the work,
    // second folds forward so the head hovers near the horn
    this.arm1 = new THREE.Group();
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.34, 10), steelMat);
    seg1.position.y = 0.17;
    this.arm1.add(seg1);
    this.arm1.position.y = 0.06;
    this.arm1.rotation.z = -0.35;
    this.group.add(this.arm1);

    this.arm2 = new THREE.Group();
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), brassDullMat);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.3, 10), steelMat);
    seg2.position.y = 0.15;
    this.arm2.add(joint, seg2);
    this.arm2.position.y = 0.34;
    this.arm2.rotation.z = -0.85;
    this.arm1.add(this.arm2);
    // tension spring between the segments: how these lamps actually hold pose
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), brassDullMat);
    spring.position.set(-0.05, 0.42, 0);
    spring.rotation.z = 0.5;
    this.arm1.add(spring);

    // shade: spun-metal cone, matte inside except the reflector
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.055, 0.075, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x424a4f,
        metalness: 0.6,
        roughness: 0.5,
        side: THREE.DoubleSide,
      })
    );
    const reflectorInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.05, 0.07, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xfff3da,
        emissive: 0xffe9bc,
        emissiveIntensity: 0.9,
        side: THREE.BackSide,
      })
    );
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff4d8 })
    );
    bulb.position.y = -0.012;
    this.head.add(shade, reflectorInner, bulb);
    this.head.position.y = 0.3;
    this.arm2.add(this.head);

    this.light = new THREE.SpotLight(0xffefd2, 0, 2.2, 0.34, 0.65, 1.6);
    this.light.position.set(0, -0.02, 0);
    this.light.target = this.targetObj;
    this.head.add(this.light);
    this.group.add(this.targetObj);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = false; // arm shadows would clutter the work area
    });
  }

  private onState = false;

  /** Fold toward the table when off, reach out over the work when on. */
  update(dt: number) {
    const k = 1 - Math.pow(0.1, dt);
    const t1 = this.onState ? -0.35 : 0.32;
    const t2 = this.onState ? -0.85 : -2.6;
    this.arm1.rotation.z = THREE.MathUtils.lerp(this.arm1.rotation.z, t1, k);
    this.arm2.rotation.z = THREE.MathUtils.lerp(this.arm2.rotation.z, t2, k);
  }

  /** Aim: base yaws a little toward the target, only the head really turns. */
  aimAt(world: THREE.Vector3) {
    this.targetObj.position.copy(this.group.worldToLocal(world.clone()));
    const local = this.group.worldToLocal(world.clone());
    const yaw = Math.atan2(local.z, local.x);
    this.group.rotation.y = THREE.MathUtils.lerp(
      this.group.rotation.y,
      THREE.MathUtils.clamp(-yaw * 0.25, -0.5, 0.5),
      0.12
    );
    this.head.lookAt(world);
    this.head.rotateX(Math.PI / 2); // cone opens along -Y toward target
  }

  setOn(on: boolean, intensity = 0.85) {
    this.onState = on;
    this.light.intensity = THREE.MathUtils.lerp(this.light.intensity, on ? intensity : 0, 0.2);
  }
}

/** Quartz prism riding the wall rail. Sits in a felt-lined wooden cradle. */
export class Prism {
  readonly group = new THREE.Group();
  readonly z = { value: 0.06 };

  constructor() {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.1), woodMat);
    cradle.position.y = -0.035;
    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.008, 0.094),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 })
    );
    felt.position.y = -0.024;
    const prism = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.11, 3, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0xf2f5f7,
        transparent: true,
        opacity: 0.32,
        roughness: 0.02,
        envMapIntensity: 2.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    prism.rotation.z = Math.PI / 2; // axis horizontal along the rail
    prism.rotation.y = Math.PI / 6;
    prism.renderOrder = 4;
    // faint internal edge lines so the prism reads as solid quartz
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(prism.geometry, 20),
      new THREE.LineBasicMaterial({ color: 0xcdd8dc, transparent: true, opacity: 0.5 })
    );
    edges.rotation.copy(prism.rotation);
    this.group.add(cradle, felt, prism, edges);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }
}
