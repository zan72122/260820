import * as THREE from 'three';
import { MaterialLibrary } from '../core/materials';
import { boltRing, flangeJoint, handwheel, indicatorLamp, latheProfile } from './parts';

export interface GateValveRig {
  group: THREE.Group;
  wheel: THREE.Group;
  wheelWorldCenter: THREE.Vector3;
  wheelAxis: THREE.Vector3;
  /** drive with 0..1 openness */
  setOpen(v: number, wheelAngle: number): void;
  hitRadius: number;
}

/**
 * Rising-stem gate valve with the chamber revolved only part-way round, so the
 * wedge lifting off its seat is visible in section without any UI.
 */
export function buildGateValve(
  lib: MaterialLibrary,
  opts: {
    bore: number;
    wheelRadius: number;
    wheelColor: number;
    /** flow axis */
    axis: 'x' | 'z';
    cutaway?: boolean;
    /** lean the bonnet towards the viewer so the wheel reads as a wheel */
    incline?: number;
  },
): GateValveRig {
  const outer = new THREE.Group();
  const group = new THREE.Group();
  outer.add(group);
  const b = opts.bore;
  const body = lib.castIron;
  const cut = opts.cutaway ?? false;
  const phiStart = cut ? 1.0 : 0;
  const phiLen = cut ? Math.PI * 2 - 2.0 : Math.PI * 2;

  const chamber = new THREE.Mesh(
    latheProfile(
      [
        [b * 1.06, -b * 1.5],
        [b * 1.62, -b * 1.42],
        [b * 1.95, -b * 0.55],
        [b * 2.0, b * 0.35],
        [b * 1.72, b * 1.05],
        [b * 1.25, b * 1.45],
        [b * 1.2, b * 1.66],
      ],
      30,
      phiStart,
      phiLen,
    ),
    body,
  );
  chamber.castShadow = true;
  chamber.receiveShadow = true;
  group.add(chamber);

  if (cut) {
    // machined seat and bore revealed by the section
    const seat = new THREE.Mesh(
      latheProfile(
        [
          [b * 0.86, -b * 1.34],
          [b * 1.5, -b * 1.24],
          [b * 1.78, b * 0.3],
          [b * 1.16, b * 1.2],
        ],
        26,
        phiStart,
        phiLen,
      ),
      lib.stainlessRough,
    );
    seat.material.side = THREE.DoubleSide;
    group.add(seat);
    // the bore itself, so the section reads as a hole water goes through
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(b * 0.86, b * 0.86, b * 4.4, 20, 1, true),
      lib.castIronDark,
    );
    bore.material.side = THREE.BackSide;
    bore.rotation.z = Math.PI / 2;
    group.add(bore);
  }

  // ports along the flow axis, a touch fatter than the line they interrupt
  const portLen = b * 3.0;
  for (const s of [-1, 1]) {
    const port = new THREE.Mesh(new THREE.CylinderGeometry(b * 1.06, b * 1.16, portLen, 24), body);
    port.rotation.z = Math.PI / 2;
    port.position.x = (s * portLen) / 2;
    port.castShadow = true;
    port.receiveShadow = true;
    const fl = flangeJoint({
      bore: b * 1.06,
      outer: b * 1.78,
      thickness: b * 0.24,
      bolts: 8,
      material: body,
      boltMaterial: lib.stainlessRough,
      gasketMaterial: lib.rubber,
    });
    fl.rotation.z = Math.PI / 2;
    fl.position.x = s * portLen;
    group.add(port, fl);
  }

  // bonnet, yoke and rising stem
  const bonnet = new THREE.Mesh(
    latheProfile(
      [
        [b * 1.2, b * 1.6],
        [b * 1.56, b * 1.78],
        [b * 1.56, b * 2.0],
        [b * 0.86, b * 2.14],
        [b * 0.82, b * 2.9],
        [b * 0.62, b * 3.02],
      ],
      26,
    ),
    body,
  );
  bonnet.castShadow = true;
  group.add(bonnet);
  group.add(boltRing(6, b * 1.36, b * 0.13, b * 0.3, lib.stainlessRough).translateY(b * 1.86));

  const packing = new THREE.Mesh(new THREE.CylinderGeometry(b * 0.6, b * 0.64, b * 0.3, 18), lib.rubber);
  packing.position.y = b * 3.12;
  group.add(packing);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(b * 0.17, b * 0.17, b * 4.0, 16), lib.stainless);
  stem.position.y = b * 2.8;
  stem.castShadow = true;
  group.add(stem);

  const yoke = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(b * 0.17, b * 0.22, b * 1.85, 12), body);
    arm.position.set(0, b * 3.92, s * b * 0.5);
    arm.rotation.x = -s * 0.22;
    arm.castShadow = true;
    yoke.add(arm);
  }
  const yokeTop = new THREE.Mesh(
    latheProfile(
      [
        [b * 0.26, b * 4.72],
        [b * 0.86, b * 4.78],
        [b * 0.86, b * 5.0],
        [b * 0.26, b * 5.06],
      ],
      20,
    ),
    body,
  );
  yoke.add(yokeTop);
  group.add(yoke);

  // the wedge itself
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(b * 1.32, b * 1.22, b * 0.34, 22), lib.stainlessRough);
  gate.rotation.x = Math.PI / 2;
  gate.rotation.z = Math.PI / 2;
  gate.castShadow = true;
  group.add(gate);

  const wheelMat = lib.retile(lib.paintedCast(opts.wheelColor, 1, 0.26), 6, 1);
  // a handwheel is smooth enamel over cast, not a rough casting
  wheelMat.normalScale.set(0.22, 0.22);
  wheelMat.roughness = 0.72;
  const wheelParts = handwheel(opts.wheelRadius, wheelMat, lib.stainless, 5);
  wheelParts.group.position.y = b * 5.06 + opts.wheelRadius * 0.16;
  group.add(wheelParts.group);

  if (opts.axis === 'z') group.rotation.y = Math.PI / 2;
  if (opts.incline) outer.rotation.x = opts.incline;

  const rig: GateValveRig = {
    group: outer,
    wheel: wheelParts.group,
    wheelWorldCenter: new THREE.Vector3(),
    wheelAxis: new THREE.Vector3(0, 1, 0),
    hitRadius: opts.wheelRadius * 1.5,
    setOpen(v, wheelAngle) {
      // the wedge lifts clear of the seat and the stem rises with it
      gate.position.y = -b * 0.2 + v * b * 1.9;
      stem.position.y = b * 2.8 + v * b * 0.9;
      wheelParts.group.position.y = b * 5.06 + opts.wheelRadius * 0.16 + v * b * 0.9;
      wheelParts.group.rotation.y = wheelAngle;
    },
  };
  rig.setOpen(0, 0);
  return rig;
}

export interface SightGlassRig {
  group: THREE.Group;
  setLevel(fill: number, t: number): void;
}

/** The one place where transparent water is drawn in full: glass, water column, bubbles. */
export function buildSightGlass(lib: MaterialLibrary, radius: number, height: number): SightGlassRig {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28, 1, true), lib.glass);
  glass.renderOrder = 4;
  group.add(glass);

  // heavy machined end fittings with rubber seals
  for (const s of [-1, 1]) {
    const fit = new THREE.Mesh(
      latheProfile(
        [
          [radius * 0.72, 0],
          [radius * 1.5, 0],
          [radius * 1.5, 0.09 * s],
          [radius * 1.08, 0.1 * s],
          [radius * 1.02, 0.18 * s],
          [radius * 0.72, 0.19 * s],
        ],
        22,
      ),
      lib.stainlessRough,
    );
    fit.position.y = (s * height) / 2;
    fit.castShadow = true;
    group.add(fit);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.02, radius * 0.13, 8, 22), lib.rubber);
    seal.rotation.x = Math.PI / 2;
    seal.position.y = (s * (height - 0.03)) / 2;
    group.add(seal);
  }
  // protective rods either side so it reads as plant equipment, not a test tube
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, height * 1.16, 8), lib.stainlessRough);
    rod.position.set(s * radius * 1.5, 0, -radius * 0.5);
    group.add(rod);
  }

  const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 1, 24), lib.waterClear);
  water.renderOrder = 3;
  group.add(water);
  // the surface itself: a bright meniscus is what makes a full glass legible
  const surfaceMat = lib.waterBody.clone();
  surfaceMat.color = new THREE.Color(0x9fdcf4);
  surfaceMat.roughness = 0.05;
  surfaceMat.opacity = 0.95;
  const surface = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.95, radius * 0.9, radius * 0.16, 24, 1, true),
    surfaceMat,
  );
  surface.material.side = THREE.DoubleSide;
  surface.renderOrder = 4;
  group.add(surface);

  const bubbleGeo = new THREE.SphereGeometry(1, 8, 6);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xdff1f9,
    roughness: 0.04,
    metalness: 0.25,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 2.2,
  });
  const BUBBLES = 14;
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLES);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.renderOrder = 5;
  group.add(bubbles);
  const seeds = Array.from({ length: BUBBLES }, (_, i) => ({
    phase: (i / BUBBLES) * 1.7 + Math.random() * 0.4,
    x: (Math.random() - 0.5) * radius * 1.1,
    z: (Math.random() - 0.5) * radius * 1.1,
    r: radius * (0.1 + Math.random() * 0.18),
    speed: 0.5 + Math.random() * 0.5,
  }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();

  return {
    group,
    setLevel(fill, t) {
      const h = Math.max(0.001, fill * height);
      water.scale.y = h;
      water.position.y = -height / 2 + h / 2;
      water.visible = fill > 0.008;
      surface.position.y = -height / 2 + h;
      surface.visible = fill > 0.008 && fill < 0.995;
      // bubbles only while the column is actually rising
      const active = fill > 0.02 && fill < 0.995;
      for (let i = 0; i < BUBBLES; i++) {
        const s = seeds[i];
        const u = ((t * s.speed + s.phase) % 1);
        const y = -height / 2 + u * h;
        const vis = active && u < 0.98;
        p.set(s.x, y, s.z);
        sc.setScalar(vis ? s.r * (0.6 + u * 0.7) : 0.0001);
        bubbles.setMatrixAt(i, m.compose(p, q, sc));
      }
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
}

export interface PumpRig {
  group: THREE.Group;
  impeller: THREE.Group;
  shaft: THREE.Mesh;
  fan: THREE.Group;
  needle: THREE.Object3D;
  lampStandby: THREE.MeshStandardMaterial;
  lampRun: THREE.MeshStandardMaterial;
  update(dt: number, rpm: number, flow: number): void;
}

function gaugeFaceTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e6df';
  g.fillRect(0, 0, s, s);
  const cx = s / 2;
  const cy = s / 2;
  // grey band → blue band, no numerals anywhere
  const start = Math.PI * 0.78;
  const end = Math.PI * 2.22;
  const grad = g.createLinearGradient(0, 0, s, 0);
  grad.addColorStop(0, '#8e9499');
  grad.addColorStop(0.45, '#7e97a8');
  grad.addColorStop(1, '#2f80b4');
  g.strokeStyle = grad;
  g.lineWidth = 26;
  g.beginPath();
  g.arc(cx, cy, s * 0.33, start, end);
  g.stroke();
  g.strokeStyle = '#2a3036';
  g.lineWidth = 3;
  for (let i = 0; i <= 20; i++) {
    const a = start + (i / 20) * (end - start);
    const major = i % 5 === 0;
    const r0 = s * (major ? 0.24 : 0.27);
    const r1 = s * 0.3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineWidth = major ? 4 : 2;
    g.stroke();
  }
  g.fillStyle = '#c9c6bd';
  g.beginPath();
  g.arc(cx, cy, s * 0.075, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Volute pump, close-coupled motor, service window and a needle-only gauge. */
export function buildPumpUnit(lib: MaterialLibrary): PumpRig {
  const group = new THREE.Group();
  // finer cast grain: this thing is looked at from 40 cm away
  const iron = lib.retile(lib.castIron, 5, 5);
  iron.normalScale.set(0.5, 0.5);
  // the impeller sits in a dark casing — lift it so it reads through the window
  const wet = lib.retile(lib.stainless, 2, 2);
  wet.envMapIntensity = 3.2;
  wet.color = new THREE.Color(0xeef2f5);

  // grouted baseplate
  const grout = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 1.7), lib.concrete);
  grout.position.set(0.95, -0.74, 0);
  grout.receiveShadow = true;
  grout.castShadow = true;
  group.add(grout);
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 1.5), lib.castIronDark);
  base.position.set(0.95, -0.58, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  for (const [bx, bz] of [
    [-0.4, -0.62],
    [-0.4, 0.62],
    [2.3, -0.62],
    [2.3, 0.62],
  ]) {
    const anchor = boltRing(1, 0, 0.05, 0.13, lib.stainlessRough);
    anchor.position.set(bx, -0.5, bz);
    group.add(anchor);
  }

  // volute casing
  const volute = new THREE.Mesh(
    latheProfile(
      [
        [0.16, -0.34],
        [0.52, -0.36],
        [0.62, -0.2],
        [0.66, 0.06],
        [0.56, 0.26],
        [0.3, 0.34],
        [0.28, 0.4],
      ],
      30,
    ),
    iron,
  );
  volute.rotation.x = Math.PI / 2;
  volute.position.set(0, 0, 0);
  volute.castShadow = true;
  volute.receiveShadow = true;
  group.add(volute);

  const voluteRim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.075, 10, 32), iron);
  voluteRim.castShadow = true;
  group.add(voluteRim);
  const casingBolts = boltRing(12, 0.6, 0.026, 0.05, lib.stainlessRough);
  casingBolts.rotation.x = Math.PI / 2;
  casingBolts.position.z = 0.31;
  group.add(casingBolts);

  // suction eye (-x) and discharge (+y)
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.46, 22), iron);
  eye.rotation.z = Math.PI / 2;
  eye.position.set(-0.6, 0, 0);
  eye.castShadow = true;
  group.add(eye);
  const eyeFlange = flangeJoint({
    bore: 0.3,
    outer: 0.48,
    bolts: 8,
    material: iron,
    boltMaterial: lib.stainlessRough,
    gasketMaterial: lib.rubber,
  });
  eyeFlange.rotation.z = Math.PI / 2;
  eyeFlange.position.set(-0.82, 0, 0);
  group.add(eyeFlange);

  const disch = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 22), iron);
  disch.position.set(0, 0.55, 0);
  disch.castShadow = true;
  group.add(disch);
  const dischFlange = flangeJoint({
    bore: 0.25,
    outer: 0.42,
    bolts: 8,
    material: iron,
    boltMaterial: lib.stainlessRough,
    gasketMaterial: lib.rubber,
  });
  dischFlange.position.set(0, 0.78, 0);
  group.add(dischFlange);

  // ---- service window: heavy glass port with the impeller behind it ----
  const impeller = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 16), wet);
  hub.rotation.x = Math.PI / 2;
  impeller.add(hub);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.015, 28), wet);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.z = -0.09;
  impeller.add(shroud);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      const r = 0.12 + t * 0.2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.12), wet);
      const aa = a + t * 0.62;
      blade.position.set(Math.cos(aa) * r, Math.sin(aa) * r, -0.02);
      blade.rotation.z = aa + 1.1;
      blade.rotation.x = Math.PI / 2;
      blade.castShadow = true;
      impeller.add(blade);
    }
  }
  impeller.position.z = 0.19;
  group.add(impeller);

  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 28), lib.glass);
  port.rotation.x = Math.PI / 2;
  port.position.z = 0.33;
  port.renderOrder = 3;
  group.add(port);
  const portRing = new THREE.Mesh(
    latheProfile(
      [
        [0.34, 0.3],
        [0.47, 0.3],
        [0.49, 0.38],
        [0.34, 0.38],
      ],
      28,
    ),
    lib.stainlessRough,
  );
  portRing.rotation.x = -Math.PI / 2;
  portRing.position.z = 0.0;
  group.add(portRing);
  const portBolts = boltRing(10, 0.42, 0.022, 0.042, lib.stainlessRough);
  portBolts.rotation.x = -Math.PI / 2;
  portBolts.position.z = 0.37;
  group.add(portBolts);

  // bearing housing + shaft + coupling guard
  const bearing = new THREE.Mesh(
    latheProfile(
      [
        [0.1, -0.34],
        [0.3, -0.34],
        [0.32, -0.12],
        [0.26, 0.18],
        [0.2, 0.2],
      ],
      22,
    ),
    iron,
  );
  bearing.rotation.z = -Math.PI / 2;
  bearing.position.set(0.55, 0, 0);
  bearing.castShadow = true;
  group.add(bearing);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.1, 14), lib.stainless);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0.85, 0, 0);
  shaft.castShadow = true;
  group.add(shaft);

  const guard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.55, 18, 1, true),
    lib.galvanised,
  );
  guard.material.side = THREE.DoubleSide;
  guard.rotation.z = Math.PI / 2;
  guard.position.set(1.0, 0, 0);
  guard.castShadow = true;
  group.add(guard);
  for (let i = 0; i < 5; i++) {
    const slot = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.012, 6, 20), lib.galvanised);
    slot.rotation.y = Math.PI / 2;
    slot.position.set(0.78 + i * 0.11, 0, 0);
    group.add(slot);
  }

  // motor
  const motor = new THREE.Group();
  const mBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.0, 26), lib.paintedCast(0x2c4f63, 1, 0.35));
  mBody.rotation.z = Math.PI / 2;
  mBody.castShadow = true;
  mBody.receiveShadow = true;
  motor.add(mBody);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.075, 0.02), lib.paintedCast(0x2c4f63, 1, 0.35));
    fin.position.set(0, Math.sin(a) * 0.39, Math.cos(a) * 0.39);
    fin.rotation.x = -a;
    fin.castShadow = true;
    motor.add(fin);
  }
  const term = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.3), lib.paintedCast(0x2c4f63, 1, 0.35));
  term.position.set(0, 0.44, 0.05);
  term.castShadow = true;
  motor.add(term);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.14), lib.stainless);
  plate.position.set(0, 0.3, 0.37);
  plate.rotation.x = -0.15;
  motor.add(plate);
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 22), lib.galvanised);
  cowl.rotation.z = Math.PI / 2;
  cowl.position.x = 0.62;
  cowl.castShadow = true;
  motor.add(cowl);
  const fan = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.09), lib.rubber);
    bl.position.set(0, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    bl.rotation.x = -a + 0.5;
    fan.add(bl);
  }
  fan.rotation.z = Math.PI / 2;
  fan.position.x = 0.7;
  motor.add(fan);
  const feet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.62), lib.paintedCast(0x2c4f63, 1, 0.35));
  feet.position.y = -0.4;
  feet.castShadow = true;
  motor.add(feet);
  motor.position.set(1.95, 0.05, 0);
  group.add(motor);

  // gauge on the discharge
  const gaugeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), lib.stainless);
  gaugeStand.position.set(0.22, 0.9, 0.22);
  gaugeStand.rotation.z = -0.3;
  group.add(gaugeStand);
  const gauge = new THREE.Group();
  const gCase = new THREE.Mesh(
    latheProfile(
      [
        [0.0, -0.05],
        [0.19, -0.05],
        [0.2, 0.03],
        [0.185, 0.045],
        [0.0, 0.045],
      ],
      26,
    ),
    lib.stainlessRough,
  );
  gCase.rotation.x = Math.PI / 2;
  gauge.add(gCase);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.175, 30),
    new THREE.MeshStandardMaterial({ map: gaugeFaceTexture(), roughness: 0.55, metalness: 0 }),
  );
  face.position.z = 0.044;
  gauge.add(face);
  const cover = new THREE.Mesh(new THREE.CircleGeometry(0.18, 26), lib.glass);
  cover.position.z = 0.052;
  cover.renderOrder = 3;
  gauge.add(cover);
  const needle = new THREE.Group();
  const nb = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.006), new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 0.4 }));
  nb.position.y = 0.06;
  needle.add(nb);
  needle.position.z = 0.047;
  gauge.add(needle);
  gauge.position.set(0.34, 1.1, 0.34);
  gauge.rotation.y = 0.55;
  gauge.rotation.x = -0.12;
  group.add(gauge);

  // local indicator lamps on the casing
  const l1 = indicatorLamp(0.045, lib.stainlessRough);
  l1.group.position.set(0.5, 0.42, 0.3);
  l1.group.rotation.x = 0.5;
  group.add(l1.group);
  const l2 = indicatorLamp(0.045, lib.stainlessRough);
  l2.group.position.set(0.66, 0.42, 0.3);
  l2.group.rotation.x = 0.5;
  group.add(l2.group);

  let spin = 0;
  // the running vibration is applied relative to wherever the unit is installed
  let baseY: number | null = null;
  return {
    group,
    impeller,
    shaft,
    fan,
    needle,
    lampStandby: l1.lens,
    lampRun: l2.lens,
    update(dt, rpm, flow) {
      spin += dt * rpm * 22;
      impeller.rotation.z = -spin;
      shaft.rotation.x = spin * 0.6;
      fan.rotation.x = spin * 0.8;
      needle.rotation.z = -(-Math.PI * 0.78 + flow * Math.PI * 1.44) - Math.PI;
      // a real vibration, not a wobble: sub-millimetre at running speed
      if (baseY === null) baseY = group.position.y;
      group.position.y = baseY + Math.sin(spin * 3.1) * 0.0016 * rpm;
    },
  };
}

export interface PrimePumpRig {
  group: THREE.Group;
  /** 0 = handle up, 1 = handle fully pushed down */
  setStroke(v: number): void;
  setAir(air: number, t: number): void;
  handleWorld: THREE.Vector3;
}

/** Hand priming pump with its own little glass column: bubbles out, water up. */
export function buildPrimePump(lib: MaterialLibrary): PrimePumpRig {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    latheProfile(
      [
        [0.0, -0.3],
        [0.13, -0.3],
        [0.14, -0.05],
        [0.1, 0.02],
        [0.1, 0.3],
        [0.0, 0.3],
      ],
      20,
    ),
    lib.brass,
  );
  body.castShadow = true;
  group.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.06, 18), lib.castIron);
  foot.position.y = -0.32;
  foot.castShadow = true;
  group.add(foot);

  const pivot = new THREE.Group();
  pivot.position.y = 0.3;
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.52, 10), lib.stainlessRough);
  lever.rotation.z = Math.PI / 2;
  lever.position.x = 0.24;
  lever.castShadow = true;
  pivot.add(lever);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), lib.rubber);
  grip.rotation.z = Math.PI / 2;
  grip.position.x = 0.48;
  grip.castShadow = true;
  pivot.add(grip);
  group.add(pivot);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.28, 8), lib.stainless);
  rod.position.y = 0.16;
  group.add(rod);

  // priming column
  const colH = 0.42;
  const colR = 0.055;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(colR, colR, colH, 20, 1, true), lib.glass);
  col.position.set(-0.2, 0.0, 0);
  col.renderOrder = 4;
  group.add(col);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(colR * 1.35, colR * 1.35, 0.045, 16), lib.brass);
    cap.position.set(-0.2, (s * colH) / 2, 0);
    group.add(cap);
  }
  const colWater = new THREE.Mesh(new THREE.CylinderGeometry(colR * 0.9, colR * 0.9, 1, 18), lib.waterClear);
  colWater.position.set(-0.2, 0, 0);
  colWater.renderOrder = 3;
  group.add(colWater);

  const bGeo = new THREE.SphereGeometry(1, 7, 5);
  const bMat = new THREE.MeshStandardMaterial({
    color: 0xeaf8ff,
    roughness: 0.05,
    metalness: 0.3,
    transparent: true,
    opacity: 0.5,
    envMapIntensity: 2.4,
  });
  const N = 12;
  const bubbles = new THREE.InstancedMesh(bGeo, bMat, N);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.renderOrder = 5;
  group.add(bubbles);
  const seeds = Array.from({ length: N }, (_, i) => ({
    ph: i / N + Math.random() * 0.1,
    x: -0.2 + (Math.random() - 0.5) * colR * 1.1,
    z: (Math.random() - 0.5) * colR * 1.1,
    r: colR * (0.14 + Math.random() * 0.22),
    sp: 0.6 + Math.random() * 0.7,
  }));
  const mm = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const pp = new THREE.Vector3();
  const ss = new THREE.Vector3();

  return {
    group,
    handleWorld: new THREE.Vector3(),
    setStroke(v) {
      pivot.rotation.z = -v * 0.5;
      rod.position.y = 0.16 - v * 0.1;
    },
    setAir(air, t) {
      const level = 1 - air;
      const h = Math.max(0.001, level * colH);
      colWater.scale.y = h;
      colWater.position.y = -colH / 2 + h / 2;
      colWater.visible = level > 0.01;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const visible = i < Math.round(air * N);
        const u = (t * s.sp + s.ph) % 1;
        pp.set(s.x, -colH / 2 + u * colH, s.z);
        ss.setScalar(visible ? s.r : 0.0001);
        bubbles.setMatrixAt(i, mm.compose(pp, qq, ss));
      }
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
}

export interface StartLeverRig {
  group: THREE.Group;
  setCover(v: number): void;
  setLever(v: number): void;
  lampPower: THREE.MeshStandardMaterial;
  lampRun: THREE.MeshStandardMaterial;
  leverWorld: THREE.Vector3;
}

/** Pedestal starter: hinged guard, then a lever that has to be pushed down. */
export function buildStartStand(lib: MaterialLibrary): StartLeverRig {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 14), lib.stainlessRough);
  post.position.y = 0.575;
  post.castShadow = true;
  group.add(post);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.05, 18), lib.castIronDark);
  foot.castShadow = true;
  foot.receiveShadow = true;
  group.add(foot);
  group.add(boltRing(4, 0.18, 0.022, 0.045, lib.stainlessRough));

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.26), lib.paintedCast(0x6d7276, 1, 0.32));
  box.position.y = 1.36;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  const boxBevel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.28), lib.paintedCast(0x4c5155, 1, 0.36));
  boxBevel.position.y = 1.12;
  group.add(boxBevel);

  const hinge = new THREE.Group();
  hinge.position.set(0, 1.56, 0.13);
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.016),
    new THREE.MeshPhysicalMaterial({
      color: 0xd6803a,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.52,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
      ior: 1.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cover.position.set(0, -0.17, 0.03);
  cover.castShadow = true;
  hinge.add(cover);
  const coverFrame = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 4), lib.stainlessRough);
  coverFrame.position.set(0, -0.17, 0.03);
  coverFrame.rotation.z = Math.PI / 4;
  hinge.add(coverFrame);
  group.add(hinge);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0, 1.42, 0.135);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3, 10), lib.stainless);
  arm.position.y = 0.13;
  arm.castShadow = true;
  leverPivot.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), lib.paintedCast(0xa32a1e, 0.85, 0.15));
  knob.position.y = 0.29;
  knob.castShadow = true;
  leverPivot.add(knob);
  group.add(leverPivot);

  const l1 = indicatorLamp(0.032, lib.stainlessRough);
  l1.group.position.set(-0.12, 1.22, 0.128);
  l1.group.rotation.x = Math.PI / 2;
  group.add(l1.group);
  const l2 = indicatorLamp(0.032, lib.stainlessRough);
  l2.group.position.set(0.12, 1.22, 0.128);
  l2.group.rotation.x = Math.PI / 2;
  group.add(l2.group);

  return {
    group,
    leverWorld: new THREE.Vector3(),
    setCover(v) {
      hinge.rotation.x = -v * 1.5;
    },
    setLever(v) {
      leverPivot.rotation.x = v * 0.85;
    },
    lampPower: l1.lens,
    lampRun: l2.lens,
  };
}
