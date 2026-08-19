import * as THREE from 'three';
import { materials } from './materials.js';
import { helicoidGeometry, roundedBox, mesh } from './geo.js';

/* ------------------------------------------------------------------
   The star of the show: a rotary snow blower (ロータリ除雪車).
   Local space: forward = +Z, up = +Y.  Roughly 1 unit = 1 metre.
------------------------------------------------------------------- */

export class Plow {
  constructor(scene) {
    const M = materials();
    this.M = M;
    const root = new THREE.Group();
    this.root = root;
    scene.add(root);

    /* ---------------- running gear ---------------- */
    const wheelGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.62, 22);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.66, 14);
    hubGeo.rotateZ(Math.PI / 2);
    const lugGeo = new THREE.BoxGeometry(0.68, 0.1, 0.16);

    this.wheels = [];
    const wheelPos = [[1.18, 0.74, 1.95], [-1.18, 0.74, 1.95], [1.18, 0.74, -1.85], [-1.18, 0.74, -1.85]];
    for (const p of wheelPos) {
      const g = new THREE.Group();
      g.position.set(p[0], p[1], p[2]);
      root.add(g);
      mesh(wheelGeo, M.rubber, g);
      mesh(hubGeo, M.greyPaint, g);
      // chunky snow-tyre lugs
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const l = mesh(lugGeo, M.rubberDirty, g,
          [0, Math.cos(a) * 0.72, Math.sin(a) * 0.72], [a, 0, 0]);
        l.scale.setScalar(1.0);
      }
      this.wheels.push(g);
    }

    // mud flaps
    const flapGeo = new THREE.BoxGeometry(0.62, 0.5, 0.04);
    mesh(flapGeo, M.rubberDirty, root, [1.18, 0.5, -2.42]);
    mesh(flapGeo, M.rubberDirty, root, [-1.18, 0.5, -2.42]);

    /* ---------------- chassis / body ---------------- */
    mesh(roundedBox(2.32, 0.5, 5.6, 0.06), M.darkPaint, root, [0, 0.82, -0.15]);

    // engine deck behind the cab
    const deck = mesh(roundedBox(2.42, 0.95, 3.0, 0.1), M.orangePaint, root, [0, 1.55, -1.45]);
    deck.name = 'deck';
    // radiator grille at the back
    const grille = mesh(new THREE.BoxGeometry(1.9, 0.7, 0.08), M.bareSteel, root, [0, 1.6, -2.98]);
    for (let i = 0; i < 7; i++) {
      mesh(new THREE.BoxGeometry(1.86, 0.05, 0.06), M.darkPaint, root, [0, 1.32 + i * 0.1, -3.03]);
    }
    grille.receiveShadow = true;

    // side steps + handrail
    mesh(new THREE.BoxGeometry(0.5, 0.06, 1.1), M.bareSteel, root, [1.28, 0.62, 0.3]);
    mesh(new THREE.BoxGeometry(0.5, 0.06, 1.1), M.bareSteel, root, [-1.28, 0.62, 0.3]);
    const railGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8);
    mesh(railGeo, M.yellowPaint, root, [1.32, 1.35, 0.85]);
    mesh(railGeo, M.yellowPaint, root, [-1.32, 1.35, 0.85]);

    /* ---------------- cab ---------------- */
    const cab = new THREE.Group();
    cab.position.set(0, 2.05, 0.55);
    root.add(cab);
    // frame posts
    const postGeo = new THREE.BoxGeometry(0.11, 1.32, 0.11);
    const cabW = 0.92, cabD = 0.78;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mesh(postGeo, M.orangePaint, cab, [sx * cabW, 0.66, sz * cabD]);
    }
    // roof + floor
    mesh(roundedBox(2.02, 0.12, 1.76, 0.05), M.orangePaint, cab, [0, 1.38, 0]);
    mesh(roundedBox(2.0, 0.14, 1.72, 0.04), M.darkPaint, cab, [0, 0.03, 0]);
    // glazing
    const glassMat = M.glass;
    mesh(new THREE.PlaneGeometry(1.78, 1.24), glassMat, cab, [0, 0.68, cabD + 0.02]);   // windscreen
    mesh(new THREE.PlaneGeometry(1.78, 1.24), glassMat, cab, [0, 0.68, -cabD - 0.02], [0, Math.PI, 0]);
    mesh(new THREE.PlaneGeometry(1.5, 1.24), glassMat, cab, [cabW + 0.02, 0.68, 0], [0, Math.PI / 2, 0]);
    mesh(new THREE.PlaneGeometry(1.5, 1.24), glassMat, cab, [-cabW - 0.02, 0.68, 0], [0, -Math.PI / 2, 0]);
    // wiper
    const wiper = new THREE.Group();
    wiper.position.set(-0.35, 0.16, cabD + 0.05);
    cab.add(wiper);
    mesh(new THREE.BoxGeometry(0.03, 0.9, 0.02), M.rubber, wiper, [0, 0.45, 0]);
    this.wiper = wiper;
    // seat + steering column (visible through the glass)
    mesh(roundedBox(0.5, 0.5, 0.16, 0.05), M.darkPaint, cab, [0, 0.5, -0.3]);
    mesh(roundedBox(0.5, 0.12, 0.46, 0.05), M.darkPaint, cab, [0, 0.28, -0.06]);
    const wheelRim = new THREE.TorusGeometry(0.17, 0.028, 8, 18);
    mesh(wheelRim, M.rubber, cab, [0, 0.62, 0.42], [Math.PI / 2.6, 0, 0]);
    // mirrors
    for (const sx of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), M.bareSteel, cab,
        [sx * (cabW + 0.24), 1.15, cabD - 0.1], [0, 0, sx * 0.5]);
      mesh(roundedBox(0.12, 0.34, 0.05, 0.03), M.darkPaint, cab,
        [sx * (cabW + 0.46), 0.98, cabD - 0.12]);
    }

    // amber beacon
    const beacon = new THREE.Group();
    beacon.position.set(0.62, 1.5, -0.5);
    cab.add(beacon);
    mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 12), M.lampAmber, beacon, [0, 0.1, 0]);
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), M.darkPaint, beacon, [0, 0, 0]);
    this.beacon = beacon;
    this.beaconLight = new THREE.PointLight(0xffa020, 0, 9, 2);
    this.beaconLight.position.set(0, 0.12, 0);
    beacon.add(this.beaconLight);

    // roof work lights
    const lampGeo = roundedBox(0.24, 0.18, 0.12, 0.04);
    for (const sx of [-0.62, -0.2, 0.2]) {
      mesh(lampGeo, M.darkPaint, cab, [sx, 1.48, 0.78]);
      mesh(new THREE.PlaneGeometry(0.2, 0.14), M.lampWhite, cab, [sx, 1.48, 0.85]);
    }

    /* ---------------- exhaust stack ---------------- */
    const stack = new THREE.Group();
    stack.position.set(-0.95, 2.0, -0.35);
    root.add(stack);
    mesh(new THREE.CylinderGeometry(0.085, 0.1, 1.5, 10), M.bareSteel, stack, [0, 0.75, 0]);
    mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.14, 10), M.chrome, stack, [0, 1.52, 0]);
    this.exhaustPort = new THREE.Object3D();
    this.exhaustPort.position.set(0, 1.62, 0);
    stack.add(this.exhaustPort);

    /* ---------------- lift frame + hydraulics ---------------- */
    const liftPivot = new THREE.Group();
    liftPivot.position.set(0, 0.9, 2.55);
    root.add(liftPivot);
    this.liftPivot = liftPivot;

    // A-frame arms
    for (const sx of [-1, 1]) {
      mesh(roundedBox(0.16, 0.22, 1.0, 0.04), M.orangePaint, liftPivot, [sx * 0.85, 0.02, 0.5]);
    }
    // hydraulic cylinders (barrel + polished rod)
    this.rams = [];
    for (const sx of [-1, 1]) {
      const ram = new THREE.Group();
      ram.position.set(sx * 0.62, 0.55, 2.1);
      root.add(ram);
      mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), M.bluePaint, ram, [0, 0, 0], [Math.PI / 2.4, 0, 0]);
      const rod = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), M.chrome, ram,
        [0, 0.28, 0.38], [Math.PI / 2.4, 0, 0]);
      this.rams.push(rod);
    }

    /* ---------------- auger head ---------------- */
    const head = new THREE.Group();
    head.position.set(0, 0, 3.25);
    root.add(head);
    this.head = head;

    const HW = 3.15;                 // cutting width
    // back plate
    mesh(roundedBox(HW, 1.85, 0.14, 0.05), M.orangePaint, head, [0, 1.02, -0.5]);
    // top hood, angled forward
    mesh(roundedBox(HW, 0.5, 0.14, 0.05), M.orangePaint, head, [0, 1.92, -0.16], [-0.5, 0, 0]);
    // side plates
    for (const sx of [-1, 1]) {
      mesh(roundedBox(0.12, 1.9, 1.15, 0.04), M.orangePaint, head, [sx * (HW / 2 - 0.05), 1.0, 0.0]);
      // hazard-striped end marker
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), M.yellowPaint, head,
        [sx * (HW / 2 + 0.02), 2.35, -0.2]);
      mesh(new THREE.SphereGeometry(0.06, 8, 6), M.lampRed, head, [sx * (HW / 2 + 0.02), 2.92, -0.2]);
      // skid shoe
      mesh(roundedBox(0.14, 0.3, 0.9, 0.05), M.bareSteel, head, [sx * (HW / 2 - 0.02), 0.15, -0.05]);
    }
    // scraper / cutting edge along the bottom
    mesh(new THREE.BoxGeometry(HW - 0.1, 0.16, 0.4), M.bareSteel, head, [0, 0.09, 0.42], [0.22, 0, 0]);
    for (let i = 0; i < 9; i++) {
      mesh(new THREE.ConeGeometry(0.07, 0.22, 5), M.bareSteel, head,
        [-1.35 + i * 0.34, 0.14, 0.62], [Math.PI / 2 + 0.3, 0, 0]);
    }

    // twin counter-rotating auger flights
    const augerGroup = new THREE.Group();
    augerGroup.position.set(0, 1.0, 0.1);
    head.add(augerGroup);
    this.augerGroup = augerGroup;
    const shaftGeo = new THREE.CylinderGeometry(0.15, 0.15, HW - 0.3, 14);
    shaftGeo.rotateZ(Math.PI / 2);
    mesh(shaftGeo, M.bareSteel, augerGroup);
    for (const hand of [1, -1]) {
      const flight = helicoidGeometry(0.16, 0.62, (HW - 0.5) / 2, 1.85, 96, hand);
      const m = new THREE.Mesh(flight, M.bareSteel);
      m.material = M.bareSteel.clone();
      m.material.side = THREE.DoubleSide;
      m.castShadow = true;
      m.position.x = hand * (HW - 0.5) / 4;
      augerGroup.add(m);
      // paddle at the inboard end that feeds the impeller
      const paddle = mesh(new THREE.BoxGeometry(0.12, 1.1, 0.1), M.yellowPaint, augerGroup,
        [hand * 0.16, 0, 0]);
      paddle.userData.spin = true;
    }

    // impeller (blower) drum behind the augers
    const drum = new THREE.Group();
    drum.position.set(0, 1.05, -0.42);
    head.add(drum);
    mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.52, 20, 1, true), M.greyPaint, drum, [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.06, 20), M.darkPaint, drum, [0, 0, -0.26], [Math.PI / 2, 0, 0]);
    const impeller = new THREE.Group();
    drum.add(impeller);
    this.impeller = impeller;
    mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.44, 10), M.bareSteel, impeller, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const blade = mesh(new THREE.BoxGeometry(0.09, 1.4, 0.4), M.bareSteel, impeller, [0, 0, 0], [0, 0, a]);
      blade.position.set(Math.cos(a + Math.PI / 2) * 0.35, Math.sin(a + Math.PI / 2) * 0.35, 0);
    }

    /* ---------------- chute ---------------- */
    const chuteYaw = new THREE.Group();
    chuteYaw.position.set(0, 1.85, -0.42);
    head.add(chuteYaw);
    this.chuteYaw = chuteYaw;

    mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.16, 18), M.darkPaint, chuteYaw, [0, -0.02, 0]);
    mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.9, 18, 1, true), M.yellowPaint, chuteYaw, [0, 0.45, 0]);
    // ribs
    for (let i = 0; i < 3; i++) {
      mesh(new THREE.TorusGeometry(0.45, 0.032, 6, 18), M.darkPaint, chuteYaw, [0, 0.16 + i * 0.3, 0], [Math.PI / 2, 0, 0]);
    }

    // elbow + nozzle: rotates up/down a little for feel
    const elbow = new THREE.Group();
    elbow.position.set(0, 0.9, 0);
    chuteYaw.add(elbow);
    this.elbow = elbow;
    this.chuteElev = 0.62;                        // radians up from horizontal
    elbow.rotation.x = (Math.PI / 2 - this.chuteElev);   // tip the nozzle forward-up
    mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.5, 18, 1, true), M.yellowPaint, elbow, [0, 0.25, 0]);
    const nozzle = mesh(new THREE.CylinderGeometry(0.36, 0.43, 0.8, 18, 1, true), M.yellowPaint, elbow, [0, 0.78, 0]);
    nozzle.material = M.yellowPaint;
    mesh(new THREE.TorusGeometry(0.37, 0.04, 6, 18), M.darkPaint, elbow, [0, 1.16, 0], [Math.PI / 2, 0, 0]);
    // deflector cap
    mesh(roundedBox(0.8, 0.06, 0.44, 0.03), M.orangePaint, elbow, [0, 1.28, -0.16], [-0.5, 0, 0]);
    // chute control ram
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), M.chrome, chuteYaw, [0.42, 0.6, 0.16], [0.4, 0, -0.3]);

    // muzzle marker (where snow leaves the chute)
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 1.2, 0);
    elbow.add(this.muzzle);

    // intake marker (where snow is sucked in)
    this.intake = new THREE.Object3D();
    this.intake.position.set(0, 0.9, 0.55);
    head.add(this.intake);

    /* ---------------- headlight cones ---------------- */
    const headLampGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12);
    headLampGeo.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      mesh(headLampGeo, M.darkPaint, head, [sx * 1.2, 2.2, -0.42]);
      mesh(new THREE.CircleGeometry(0.11, 12), M.lampWhite, head, [sx * 1.2, 2.2, -0.35]);
    }

    /* ---------------- state ---------------- */
    this.speed = 0;
    this.augerSpin = 0;
    this.chuteAngle = -1.3;     // target yaw, negative = toward the truck lane
    this.chuteAngleCur = -1.3;
    this.bounce = 0;
    this.load = 0;
    this._t = 0;
    this._tmpV = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
  }

  get position() { return this.root.position; }

  /** world position where snow leaves the chute */
  muzzleWorld(out) { return this.muzzle.getWorldPosition(out); }

  /** unit vector the chute is pointing along */
  muzzleDir(out) {
    this.muzzle.getWorldQuaternion(this._tmpQ);
    return out.set(0, 1, 0).applyQuaternion(this._tmpQ).normalize();
  }

  intakeWorld(out) { return this.intake.getWorldPosition(out); }
  exhaustWorld(out) { return this.exhaustPort.getWorldPosition(out); }

  update(dt, opts) {
    const { speed = 0, cutting = 0, running = true } = opts;
    this._t += dt;
    this.speed = speed;
    this.load = cutting;

    // wheels roll with ground speed
    const roll = (speed * dt) / 0.74;
    for (const w of this.wheels) w.rotation.x += roll;

    // auger + impeller spin up while working
    const targetSpin = running ? (1.0 + cutting * 1.4) : 0;
    this.augerSpin += (targetSpin - this.augerSpin) * Math.min(1, dt * 3);
    this.augerGroup.rotation.x -= this.augerSpin * dt * 7.0;
    this.impeller.rotation.z += this.augerSpin * dt * 16.0;

    // chute swing, eased so a toddler's flick still looks like machinery
    const d = this.chuteAngle - this.chuteAngleCur;
    this.chuteAngleCur += d * Math.min(1, dt * 5.0);
    this.chuteYaw.rotation.y = this.chuteAngleCur;

    // engine idle shake + heavier shudder while chewing snow
    const shake = (running ? 0.008 : 0) + cutting * 0.03;
    this.root.position.y = Math.sin(this._t * 26) * shake + Math.sin(this._t * 11) * shake * 0.6;
    this.root.rotation.z = Math.sin(this._t * 8.5) * (0.004 + cutting * 0.016);
    this.root.rotation.x = -cutting * 0.022 + Math.sin(this._t * 5.3) * 0.004;

    // beacon
    this.beacon.rotation.y += dt * 6.0;
    const flash = (Math.sin(this._t * 6.0) * 0.5 + 0.5);
    this.beaconLight.intensity = running ? 2.5 + flash * 6 : 0;

    // wiper sweeps now and then
    this.wiper.rotation.z = Math.sin(this._t * 1.6) * 0.5;

    // hydraulic rods extend as the head bites in
    for (const rod of this.rams) rod.position.z = 0.38 + cutting * 0.06;

    // head follows the snow load a touch (weight transfer)
    this.head.rotation.x = -cutting * 0.03;
  }
}
