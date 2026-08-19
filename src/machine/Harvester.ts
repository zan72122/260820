import * as THREE from 'three';
import { bareSteel, paintedSteel, rubberBelt, tyreTread } from '../world/textures';
import { CHAMBER_POS, HEADER_HALF_W, HEADER_Z } from '../game/constants';
import { Chamber } from './Chamber';

/* ------------------------------------------------------------------ *
 * The self-propelled whole-crop harvester.
 *
 * Local frame: +Z forward, +X right, +Y up.  Everything is real
 * geometry — sheet panels, a reel with tines, an auger, a rubber feed
 * elevator, the roll room, and a tailgate that hinges over the top.
 * The left flank carries a bolted inspection window; through it the
 * growing roll is visible from outside, which is the whole point.
 * ------------------------------------------------------------------ */

const BODY = {
  x: 1.22,
  yMin: 0.62,
  /** where the flat side sheets stop and the arched roof springs from */
  yMax: 2.52,
  zBack: -2.98,
  zFront: 0.75,
};
/** the arched roof is a half-ellipse springing off the top of the sheets */
const ARCH_SQUASH = 0.46;
/** where the fixed hood ends and the hinged tailgate begins */
const GATE_SPLIT = -1.05;
const GATE_PIVOT = new THREE.Vector3(0, BODY.yMax + 0.16, GATE_SPLIT);

export class Harvester {
  readonly group = new THREE.Group();
  readonly chamber = new Chamber();

  /** world-space point crop flies into */
  readonly throatMouth = new THREE.Vector3();

  private reel = new THREE.Group();
  private auger!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private gatePivot = new THREE.Group();
  private beltTex: THREE.Texture;
  private throatTex: THREE.Texture;
  private beacon!: THREE.Mesh;
  private beaconMat!: THREE.MeshStandardMaterial;
  private leftPanelMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshStandardMaterial;
  private feedClumps: THREE.Mesh[] = [];
  private rams: { rod: THREE.Mesh; body: THREE.Mesh; anchor: THREE.Vector3; tip: THREE.Object3D }[] = [];
  /** trim on the tailgate that must fade with the skin during a cutaway */
  private fadeMats: THREE.MeshStandardMaterial[] = [];

  private throatFrom = new THREE.Vector3(0, 0.74, 2.12);
  private throatTo = new THREE.Vector3(0, 1.62, 0.05);

  private paint: THREE.MeshStandardMaterial;
  private accent: THREE.MeshStandardMaterial;
  private steel: THREE.MeshStandardMaterial;
  private dark: THREE.MeshStandardMaterial;
  private rubber: THREE.MeshStandardMaterial;
  private shellMat: THREE.MeshStandardMaterial;

  gateAngle = 0;

  constructor(scene: THREE.Scene, castShadows: boolean) {
    scene.add(this.group);

    // Enamel over steel is a dielectric: high metalness just turns it black.
    const paintTex = paintedSteel(0x6f9250);
    paintTex.repeat.set(2, 2);
    this.paint = new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.44, metalness: 0.12 });
    const accentTex = paintedSteel(0xdb7220);
    accentTex.repeat.set(2, 2);
    this.accent = new THREE.MeshStandardMaterial({ map: accentTex, roughness: 0.45, metalness: 0.12 });
    const steelTex = bareSteel();
    steelTex.repeat.set(2, 2);
    this.steel = new THREE.MeshStandardMaterial({ map: steelTex, roughness: 0.38, metalness: 0.88, color: 0xb4baba });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x35393c, roughness: 0.62, metalness: 0.3 });
    // the roof shells are open tubes, so they must read solid from inside too
    this.shellMat = new THREE.MeshStandardMaterial({
      map: paintTex, roughness: 0.44, metalness: 0.12, side: THREE.DoubleSide,
    });
    // The whole tailgate skin shares one material so the "cutaway" camera can
    // ghost it in one go and show the roll room working inside.
    const skinTex = paintedSteel(0x6f9250).clone();
    skinTex.repeat.set(0.4, 0.4);
    skinTex.needsUpdate = true;
    this.leftPanelMat = new THREE.MeshStandardMaterial({
      map: skinTex, roughness: 0.44, metalness: 0.12, side: THREE.DoubleSide,
      transparent: false, opacity: 1,
    });
    this.beltTex = rubberBelt().clone();
    this.beltTex.repeat.set(1, 3);
    this.beltTex.needsUpdate = true;
    this.rubber = new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.9, metalness: 0.05, color: 0xa8aca8 });
    this.throatTex = rubberBelt().clone();
    this.throatTex.repeat.set(2, 4);
    this.throatTex.needsUpdate = true;

    this.buildChassis();
    this.buildBody();
    this.buildCab();
    this.buildHeader();
    this.buildThroat();
    this.buildTailgate();
    this.buildWheels();
    this.buildDetails();

    // chamber sits inside the body; its rear rollers ride on the gate
    this.chamber.group.position.set(CHAMBER_POS.x, CHAMBER_POS.y, CHAMBER_POS.z);
    this.group.add(this.chamber.group);
    const gateRollerHolder = new THREE.Group();
    gateRollerHolder.position.set(
      CHAMBER_POS.x - GATE_PIVOT.x,
      CHAMBER_POS.y - GATE_PIVOT.y,
      CHAMBER_POS.z - GATE_PIVOT.z
    );
    gateRollerHolder.add(this.chamber.rearRollers);
    this.gatePivot.add(gateRollerHolder);

    if (castShadows) {
      this.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    }
  }

  /* ---------------------------------------------------------------- */

  private box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  /** Half-elliptical roof section of the given length, springing at y=0. */
  private arch(length: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(BODY.x, BODY.x, length, 22, 1, true, -Math.PI / 2, Math.PI);
    geo.rotateX(-Math.PI / 2);   // axis Y -> Z, and the open arc swings up to +Y
    geo.scale(1, ARCH_SQUASH, 1);
    const m = new THREE.Mesh(geo, this.shellMat);
    return m;
  }

  private buildChassis() {
    const g = new THREE.Group();
    // main longitudinal rails
    for (const x of [-0.86, 0.86]) {
      g.add(this.box(0.16, 0.26, 5.0, this.dark, x, 0.5, -0.6));
    }
    g.add(this.box(1.9, 0.2, 0.24, this.dark, 0, 0.5, 1.15));
    g.add(this.box(1.9, 0.2, 0.24, this.dark, 0, 0.5, -1.95));
    // axles
    g.add(this.box(2.5, 0.14, 0.14, this.dark, 0, 0.66, 1.15));
    g.add(this.box(2.4, 0.12, 0.12, this.dark, 0, 0.52, -1.95));
    this.group.add(g);
  }

  /** One flank sheet, optionally with the round inspection window cut out. */
  private sidePanel(zA: number, zB: number, mat: THREE.Material, hole?: { z: number; y: number; r: number }) {
    const shape = new THREE.Shape();
    shape.moveTo(zA, BODY.yMin);
    shape.lineTo(zB, BODY.yMin);
    shape.lineTo(zB, BODY.yMax);
    shape.lineTo(zA, BODY.yMax);
    shape.closePath();
    if (hole) {
      const p = new THREE.Path();
      p.absarc(hole.z, hole.y, hole.r, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  }

  private buildBody() {
    const g = new THREE.Group();
    const t = 0.07;
    const w = BODY.x * 2;
    const cy = (BODY.yMax + BODY.yMin) / 2;

    // Floor only under the fixed part: the roll has to fall clear at the back.
    const floorZa = -1.35;
    const floorLen = BODY.zFront - floorZa;
    g.add(this.box(w, t, floorLen, this.paint, 0, BODY.yMin, floorZa + floorLen / 2));
    // subframe cradling the roll room
    for (const sx of [-1, 1]) {
      g.add(this.box(0.12, 0.42, 0.14, this.dark, sx * 1.02, 0.8, -1.2));
      g.add(this.box(0.12, 0.42, 0.14, this.dark, sx * 1.02, 0.8, -2.4));
    }

    // arched roof over the fixed hood
    const frontLen = BODY.zFront - GATE_SPLIT;
    const shell = this.arch(frontLen);
    shell.position.set(0, BODY.yMax, BODY.zFront - frontLen / 2);
    g.add(shell);

    // fixed flanks
    const right = this.sidePanel(GATE_SPLIT, BODY.zFront, this.paint);
    right.position.x = BODY.x;
    g.add(right);
    const left = this.sidePanel(GATE_SPLIT, BODY.zFront, this.paint);
    left.position.x = -BODY.x + t;
    g.add(left);
    for (const sx of [-1, 1]) {
      g.add(this.box(t * 1.2, 0.26, frontLen * 0.9, this.accent,
        sx * (BODY.x + 0.005), cy - 0.3, BODY.zFront - frontLen / 2));
    }

    // front bulkhead
    g.add(this.box(w, BODY.yMax - BODY.yMin, t, this.paint, 0, cy, BODY.zFront));
    this.group.add(g);
  }

  private buildCab() {
    const g = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.55, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x4d6167, roughness: 0.06, metalness: 0.1,
      transparent: true, opacity: 0.62, side: THREE.DoubleSide,
    });
    const cx = 0.0;
    const cz = 1.34;
    const w = 1.36, d = 1.2, h = 1.3;
    const base = 1.66;
    // posts
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(this.box(0.09, h, 0.09, frame, cx + sx * w / 2, base + h / 2, cz + sz * d / 2));
      }
    }
    // roof + floor
    g.add(this.box(w + 0.12, 0.1, d + 0.12, frame, cx, base + h, cz));
    g.add(this.box(w, 0.08, d, frame, cx, base, cz));
    // glazing
    g.add(this.box(w - 0.04, h - 0.1, 0.03, glass, cx, base + h / 2, cz + d / 2));
    g.add(this.box(w - 0.04, h - 0.1, 0.03, glass, cx, base + h / 2, cz - d / 2));
    g.add(this.box(0.03, h - 0.1, d - 0.04, glass, cx - w / 2, base + h / 2, cz));
    g.add(this.box(0.03, h - 0.1, d - 0.04, glass, cx + w / 2, base + h / 2, cz));
    // platform the cab stands on
    g.add(this.box(w + 0.3, 0.12, d + 0.36, this.paint, cx, base - 0.06, cz));
    // seat + wheel, just enough to read as a cab
    g.add(this.box(0.42, 0.5, 0.12, frame, cx, base + 0.36, cz - 0.28));
    g.add(this.box(0.42, 0.1, 0.42, frame, cx, base + 0.14, cz - 0.05));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 6, 16), this.dark);
    wheel.rotation.x = -0.9;
    wheel.position.set(cx, base + 0.62, cz + 0.3);
    g.add(wheel);
    // mirrors
    for (const sx of [-1, 1]) {
      const arm = this.box(0.05, 0.05, 0.32, frame, cx + sx * (w / 2 + 0.16), base + h - 0.14, cz + 0.34);
      g.add(arm);
      g.add(this.box(0.05, 0.3, 0.2, this.dark, cx + sx * (w / 2 + 0.3), base + h - 0.24, cz + 0.46));
    }
    this.group.add(g);
  }

  private buildHeader() {
    const g = new THREE.Group();
    const hw = HEADER_HALF_W;

    // Support arms from the body down to the header frame
    for (const sx of [-1, 1]) {
      const arm = this.box(0.14, 0.18, 1.5, this.paint, sx * 0.9, 0.86, 1.6);
      arm.rotation.x = -0.16;
      g.add(arm);
    }
    // spine across the full width of the head
    g.add(this.box(hw * 2, 0.16, 0.16, this.steel, 0, 1.02, HEADER_Z - 0.66));
    for (const sx of [-1, 1]) {
      const stay = this.box(0.07, 0.07, 0.95, this.steel, sx * (hw - 0.25), 0.95, HEADER_Z - 0.3);
      stay.rotation.x = 0.42;
      g.add(stay);
    }

    // header backsheet and floor pan
    g.add(this.box(hw * 2, 0.72, 0.09, this.accent, 0, 0.72, HEADER_Z - 0.62));
    const pan = this.box(hw * 2, 0.06, 0.86, this.steel, 0, 0.34, HEADER_Z - 0.2);
    pan.rotation.x = -0.1;
    g.add(pan);

    // cutter bar with knife guards
    const bar = this.box(hw * 2, 0.11, 0.2, this.steel, 0, 0.24, HEADER_Z + 0.3);
    g.add(bar);
    const guard = new THREE.ConeGeometry(0.055, 0.2, 4);
    guard.rotateX(-Math.PI / 2);
    const guards = Math.round(hw * 2 / 0.115);
    for (let i = 0; i < guards; i++) {
      const m = new THREE.Mesh(guard, this.steel);
      m.position.set(-hw + 0.055 + (i / (guards - 1)) * (hw * 2 - 0.11), 0.24, HEADER_Z + 0.44);
      m.rotation.z = Math.PI / 4;
      g.add(m);
    }

    // reel: five bats carrying steel tines
    const reelR = 0.40;
    const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, hw * 2 + 0.1, 8);
    shaftGeo.rotateZ(Math.PI / 2);
    this.reel.add(new THREE.Mesh(shaftGeo, this.steel));
    const batGeo = new THREE.BoxGeometry(hw * 2, 0.07, 0.07);
    const tineGeo = new THREE.CylinderGeometry(0.012, 0.008, 0.24, 4);
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2;
      const bat = new THREE.Mesh(batGeo, this.accent);
      bat.position.set(0, Math.sin(a) * reelR, Math.cos(a) * reelR);
      this.reel.add(bat);
      const tines = Math.round(hw * 2 / 0.2);
      for (let t = 0; t < tines; t++) {
        const tine = new THREE.Mesh(tineGeo, this.steel);
        tine.position.set(
          -hw + 0.12 + (t / (tines - 1)) * (hw * 2 - 0.24),
          Math.sin(a) * (reelR + 0.12),
          Math.cos(a) * (reelR + 0.12)
        );
        tine.rotation.x = -a;
        this.reel.add(tine);
      }
      // end discs
      for (const sx of [-1, 1]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, reelR, 0.04), this.steel);
        spoke.position.set(sx * hw, Math.sin(a) * reelR * 0.5, Math.cos(a) * reelR * 0.5);
        spoke.rotation.x = -a;
        this.reel.add(spoke);
      }
    }
    this.reel.position.set(0, 1.10, HEADER_Z + 0.06);
    g.add(this.reel);

    // cross auger with helical flighting
    const augerCore = new THREE.CylinderGeometry(0.19, 0.19, hw * 2 - 0.1, 12);
    augerCore.rotateZ(Math.PI / 2);
    this.auger = new THREE.Mesh(augerCore, this.steel);
    this.auger.position.set(0, 0.62, HEADER_Z - 0.42);
    const flightGeo = new THREE.BoxGeometry(0.035, 0.19, 0.19);
    for (let i = 0; i < 46; i++) {
      const t = i / 45;
      const side = t < 0.5 ? 1 : -1;
      const a = t * Math.PI * 9 * side;
      const f = new THREE.Mesh(flightGeo, this.dark);
      f.position.set(-hw + 0.08 + t * (hw * 2 - 0.16), Math.sin(a) * 0.155, Math.cos(a) * 0.155);
      f.rotation.x = -a;
      this.auger.add(f);
    }
    // retracting fingers in the middle that pull the crop back
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.3, 4), this.steel);
      f.position.set(-0.28 + i * 0.14, -0.1, -0.16);
      f.rotation.x = -1.2;
      this.auger.add(f);
    }
    g.add(this.auger);

    // rubber apron across the back of the header, to stop crop spilling
    const apron = this.box(hw * 2 - 0.1, 0.36, 0.03, this.rubber, 0, 1.16, HEADER_Z - 0.66);
    apron.rotation.x = 0.22;
    g.add(apron);

    // crop dividers at both ends
    for (const sx of [-1, 1]) {
      const div = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.0, 4), this.accent);
      div.rotation.x = Math.PI / 2;
      div.rotation.y = Math.PI / 4;
      div.position.set(sx * (hw + 0.06), 0.62, HEADER_Z + 0.62);
      g.add(div);
      // end sheet
      g.add(this.box(0.06, 1.0, 1.1, this.accent, sx * (hw + 0.03), 0.7, HEADER_Z - 0.12));
      // skid shoe
      const shoe = this.box(0.1, 0.08, 0.72, this.dark, sx * (hw - 0.1), 0.14, HEADER_Z - 0.1);
      g.add(shoe);
    }

    this.group.add(g);
  }

  /** The rubber feed elevator that carries the crop up into the roll room. */
  private buildThroat() {
    const g = new THREE.Group();
    const from = this.throatFrom;
    const to = this.throatTo;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dy, dz);
    const mid = new THREE.Vector3(0, (from.y + to.y) / 2, (from.z + to.z) / 2);
    const ang = Math.atan2(dy, dz);

    const beltMat = new THREE.MeshStandardMaterial({
      map: this.throatTex, roughness: 0.9, metalness: 0.05, color: 0x9fa39f, side: THREE.DoubleSide,
    });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, len), beltMat);
    belt.position.copy(mid);
    belt.rotation.x = -ang + Math.PI / 2;
    g.add(belt);
    // side cheeks so the crop is visibly channelled
    for (const sx of [-1, 1]) {
      const cheek = this.box(0.06, 0.42, len, this.steel, sx * 0.78, mid.y + 0.16, mid.z);
      cheek.rotation.x = -ang + Math.PI / 2;
      g.add(cheek);
    }
    // drive rollers at each end
    const rollGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.56, 10);
    rollGeo.rotateZ(Math.PI / 2);
    for (const p of [from, to]) {
      const r = new THREE.Mesh(rollGeo, this.dark);
      r.position.set(0, p.y, p.z);
      g.add(r);
    }

    // little slugs of crop riding up the elevator while it is feeding
    const clumpMat = new THREE.MeshStandardMaterial({ color: 0xa79a55, roughness: 0.95 });
    const clumpGeo = new THREE.IcosahedronGeometry(0.19, 0);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(clumpGeo, clumpMat);
      m.scale.set(2.4, 0.55, 0.85);
      m.visible = false;
      this.feedClumps.push(m);
      g.add(m);
    }

    this.group.add(g);
  }

  private buildTailgate() {
    this.gatePivot.position.copy(GATE_PIVOT);
    const g = this.gatePivot;
    const p = GATE_PIVOT;
    const t = 0.07;
    const w = BODY.x * 2;
    const cy = (BODY.yMax + BODY.yMin) / 2;
    const gateLen = GATE_SPLIT - BODY.zBack;

    const rel = (x: number, y: number, z: number) => new THREE.Vector3(x - p.x, y - p.y, z - p.z);
    const place = (o: THREE.Object3D, x: number, y: number, z: number) => {
      o.position.copy(rel(x, y, z));
      g.add(o);
      return o;
    };

    // arched rear shell, continuing the hood's profile
    const shell = this.arch(gateLen);
    shell.material = this.leftPanelMat;
    place(shell, 0, BODY.yMax, GATE_SPLIT - gateLen / 2);

    // arched end wall so nothing shows through from behind
    const capShape = new THREE.Shape();
    capShape.moveTo(-BODY.x, 0);
    capShape.lineTo(BODY.x, 0);
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI;
      capShape.lineTo(Math.cos(a) * BODY.x, Math.sin(a) * BODY.x * ARCH_SQUASH);
    }
    capShape.closePath();
    place(new THREE.Mesh(new THREE.ShapeGeometry(capShape), this.leftPanelMat), 0, BODY.yMax, BODY.zBack);

    // back plate
    place(this.box(w, BODY.yMax - BODY.yMin, t, this.leftPanelMat), 0, cy, BODY.zBack);

    // the flanks of the gate — the left one carries the inspection window,
    // because the roll room lives inside the tailgate, not the hood
    const winR = Math.min(
      0.74,
      BODY.yMax - CHAMBER_POS.y - 0.09,
      CHAMBER_POS.y - BODY.yMin - 0.09,
      Math.min(CHAMBER_POS.z - BODY.zBack, GATE_SPLIT - CHAMBER_POS.z) - 0.09
    );
    const rightCheek = this.sidePanel(BODY.zBack, GATE_SPLIT, this.leftPanelMat);
    place(rightCheek, BODY.x, 0, 0);

    const leftCheek = this.sidePanel(BODY.zBack, GATE_SPLIT, this.leftPanelMat,
      { z: CHAMBER_POS.z, y: CHAMBER_POS.y, r: winR });
    place(leftCheek, -BODY.x + t, 0, 0);

    // window rim, bolts and a faintly tinted pane
    const rim = new THREE.Mesh(new THREE.TorusGeometry(winR + 0.015, 0.05, 8, 28), this.steel);
    rim.rotation.y = Math.PI / 2;
    place(rim, -BODY.x - 0.01, CHAMBER_POS.y, CHAMBER_POS.z);
    const boltGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.05, 6);
    boltGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      place(new THREE.Mesh(boltGeo, this.steel),
        -BODY.x - 0.05,
        CHAMBER_POS.y + Math.sin(a) * (winR + 0.015),
        CHAMBER_POS.z + Math.cos(a) * (winR + 0.015));
    }
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0xcfe0dc, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false,
    });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(winR, 28), this.glassMat);
    glass.rotation.y = -Math.PI / 2;
    glass.renderOrder = 5;
    place(glass, -BODY.x - 0.02, CHAMBER_POS.y, CHAMBER_POS.z);

    // hazard chevrons + tail lamps
    const chev = new THREE.MeshStandardMaterial({ color: 0xd9d3c4, roughness: 0.7 });
    const chevAccent = this.accent.clone();
    this.fadeMats.push(chev, chevAccent);
    for (let i = 0; i < 9; i++) {
      const sq = this.box(0.1, 0.34, 0.03, i % 2 ? chev : chevAccent);
      sq.rotation.z = 0.5;
      place(sq, -0.86 + i * 0.215, 0.98, BODY.zBack - 0.05);
    }
    for (const sx of [-1, 1]) {
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0x8c1b12, emissive: 0x5a0d08, emissiveIntensity: 0.6, roughness: 0.4,
      });
      this.fadeMats.push(lampMat);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), lampMat);
      lamp.rotation.x = Math.PI / 2;
      place(lamp, sx * 0.95, 1.95, BODY.zBack - 0.05);
    }

    this.group.add(g);

    // two hydraulic rams driving it open
    for (const sx of [-1, 1]) {
      const anchor = new THREE.Vector3(sx * (BODY.x + 0.13), 0.76, -0.45);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.62, 8), this.dark);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.7, 8), this.steel);
      const tip = new THREE.Object3D();
      tip.position.copy(rel(sx * (BODY.x + 0.07), 0.72, -2.55));
      this.gatePivot.add(tip);
      this.group.add(body, rod);
      this.rams.push({ body, rod, anchor, tip });
    }
  }

  private buildWheels() {
    const tread = tyreTread();
    tread.repeat.set(6, 1);
    const tyre = new THREE.MeshStandardMaterial({ map: tread, roughness: 0.94, metalness: 0.02, color: 0xb8bcb8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb5b0a4, roughness: 0.55, metalness: 0.6 });

    const make = (x: number, z: number, r: number, w: number) => {
      const g = new THREE.Group();
      const tg = new THREE.CylinderGeometry(r, r, w, 18, 1, false);
      tg.rotateZ(Math.PI / 2);
      const t = new THREE.Mesh(tg, tyre);
      g.add(t);
      const rg = new THREE.CylinderGeometry(r * 0.52, r * 0.52, w + 0.02, 14);
      rg.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rg, rimMat);
      g.add(rim);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, w + 0.06, 6), this.dark);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(0, Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.3);
        g.add(bolt);
      }
      g.position.set(x, r, z);
      this.wheels.push(t);
      this.group.add(g);
      return g;
    };

    make(-1.16, 1.15, 0.66, 0.44);
    make(1.16, 1.15, 0.66, 0.44);
    make(-1.06, -1.95, 0.50, 0.32);
    make(1.06, -1.95, 0.50, 0.32);

    // mudguards over the drive wheels
    for (const sx of [-1, 1]) {
      const gg = new THREE.CylinderGeometry(0.84, 0.84, 0.5, 16, 1, true, -Math.PI / 2, Math.PI);
      gg.rotateX(-Math.PI / 2);
      gg.rotateY(Math.PI / 2);
      const guard = new THREE.Mesh(gg, this.shellMat);
      guard.position.set(sx * 1.16, 0.66, 1.15);
      this.group.add(guard);
    }
  }

  private buildDetails() {
    // exhaust stack with a heat shield
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.15, 10), this.dark);
    stack.position.set(0.9, 3.0, -0.15);
    this.group.add(stack);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 10, 1, true), this.steel);
    shield.position.set(0.9, 2.85, -0.15);
    this.group.add(shield);

    // rotating amber beacon
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0xd88a12, emissive: 0xff9c17, emissiveIntensity: 1.4, roughness: 0.3,
      transparent: true, opacity: 0.85,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10), this.beaconMat);
    this.beacon.position.set(-0.52, 3.11, 1.34);
    this.group.add(this.beacon);
    this.group.add(this.box(0.1, 0.05, 0.1, this.dark, -0.52, 3.02, 1.34));

    // radiator grille on the right flank
    for (let i = 0; i < 9; i++) {
      this.group.add(this.box(0.02, 0.5, 0.05, this.dark, BODY.x + 0.05, 2.1, -0.2 + i * 0.09));
    }

    // access ladder + handrail
    for (let i = 0; i < 3; i++) {
      this.group.add(this.box(0.36, 0.04, 0.06, this.steel, 1.3, 0.85 + i * 0.32, 0.4));
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.3, 6), this.steel);
    rail.position.set(1.42, 1.5, 0.4);
    this.group.add(rail);

    // a couple of hydraulic hoses running along the flank
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1a, roughness: 0.85 });
    for (const off of [0, 0.07]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.9, 1.0 + off, 1.4),
        new THREE.Vector3(1.16, 1.35 + off, 0.7),
        new THREE.Vector3(1.2, 1.5 + off, -0.4),
        new THREE.Vector3(1.12, 1.85 + off, -0.9),
      ]);
      const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 6, false), hoseMat);
      this.group.add(hose);
    }

    // front work lights
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10),
        new THREE.MeshStandardMaterial({ color: 0xdfe4e2, emissive: 0xfff0c0, emissiveIntensity: 0.5, roughness: 0.25 })
      );
      l.rotation.x = Math.PI / 2;
      l.position.set(sx * 0.55, 2.98, 1.93);
      this.group.add(l);
    }
  }

  /* ---------------------------------------------------------------- */

  /**
   * @param dt        seconds
   * @param speed     ground speed m/s (drives wheels + reel)
   * @param feed      0..1 how hard the header is being fed
   * @param gate      0..1 tailgate open fraction
   * @param cutaway   0..1 how see-through the left flank should be
   */
  update(dt: number, speed: number, feed: number, gate: number, cutaway: number, time: number) {
    // reel and auger idle even when stopped, and speed up under load
    const work = 0.45 + Math.min(1, speed / 2) * 0.9 + feed * 0.5;
    this.reel.rotation.x -= dt * work * 3.4;
    this.auger.rotation.x -= dt * work * 5.2;
    for (const w of this.wheels) w.rotation.x += (dt * speed) / 0.6;
    this.throatTex.offset.y = (this.throatTex.offset.y - dt * work * 1.6) % 1;
    this.beltTex.offset.y = (this.beltTex.offset.y - dt * work * 1.1) % 1;

    // crop slugs riding the elevator
    for (let i = 0; i < this.feedClumps.length; i++) {
      const m = this.feedClumps[i];
      if (feed < 0.04) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const t = ((time * 0.85 * (0.7 + work * 0.35) + i / this.feedClumps.length) % 1);
      m.position.set(
        Math.sin(i * 2.3 + time) * 0.16,
        this.throatFrom.y + (this.throatTo.y - this.throatFrom.y) * t + 0.06,
        this.throatFrom.z + (this.throatTo.z - this.throatFrom.z) * t
      );
      const s = 0.9 + Math.sin(t * Math.PI) * 0.35;
      m.scale.set(2.4 * s, 0.55 * s, 0.85 * s);
      m.rotation.z = Math.sin(t * 8 + i) * 0.3;
    }

    // tailgate
    this.gateAngle = gate * 1.02;
    this.gatePivot.rotation.x = this.gateAngle;
    // rams follow the gate
    const tmp = new THREE.Vector3();
    for (const r of this.rams) {
      r.tip.getWorldPosition(tmp);
      this.group.worldToLocal(tmp);
      const mid = tmp.clone().add(r.anchor).multiplyScalar(0.5);
      const dir = tmp.clone().sub(r.anchor);
      const len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      r.body.position.copy(r.anchor).addScaledVector(dir, len * 0.28);
      r.body.quaternion.copy(q);
      r.rod.position.copy(mid).addScaledVector(dir, len * 0.22);
      r.rod.quaternion.copy(q);
      r.rod.scale.y = Math.max(0.4, len / 0.7) * 0.62;
    }

    // beacon
    this.beacon.rotation.y += dt * 7;
    this.beaconMat.emissiveIntensity = 0.5 + Math.abs(Math.sin(time * 6.5)) * 2.4;

    // cutaway: dissolve the left flank when the camera goes to the roll room
    const op = 1 - cutaway * 0.86;
    this.leftPanelMat.opacity = op;
    this.leftPanelMat.transparent = op < 0.999;
    this.leftPanelMat.depthWrite = op > 0.55;
    const trimOp = op * op;
    for (const m of this.fadeMats) {
      if (m.transparent !== (trimOp < 0.999)) {
        m.transparent = trimOp < 0.999;
        m.needsUpdate = true;
      }
      m.opacity = trimOp;
      m.depthWrite = trimOp > 0.5;
    }
    if (this.leftPanelMat.needsUpdate === false && this.leftPanelMat.transparent !== (op < 0.999)) {
      this.leftPanelMat.needsUpdate = true;
    }
    this.glassMat.opacity = 0.13 - cutaway * 0.12;
    this.chamber.setLampIntensity(11 + cutaway * 10);

    // keep the world-space throat mouth current for the flying crop
    this.throatMouth.set(0, this.throatFrom.y + 0.1, this.throatFrom.z - 0.15);
    this.group.localToWorld(this.throatMouth);
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
  }

  get right(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion);
  }

  /** World-space point at the header mouth (used for the crop suction). */
  headerWorld(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0.5, HEADER_Z + 0.1);
    return this.group.localToWorld(out);
  }
}
