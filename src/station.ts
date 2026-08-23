import * as THREE from 'three';
import {
  LetterSpec, PartSpec, RodSpec, LIGHT_Z, TABLE_Z, TABLE_TOP_Y,
  SCREEN_BOTTOM, SCREEN_TOP, SCREEN_HALF_W, SCREEN_CY,
  RAIL_Z_A, RAIL_Z_B, WHEEL_TABLE_RATIO,
} from './const';
import { backproject, intersectSegs2D, segCircleParams, rodParamAtScreenL } from './mathProj';
import { MatLib, makeScaleTexture, makeScreenTexture, rand } from './materials';

export interface StationSounds {
  tick(strength: number): void;
  rumble(level: number): void;
  clunk(): void;
  stopHit(): void;
  leverUnlock(): void;
  leverTick(): void;
  success(): void;
}

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function rodMesh(
  a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, roundCaps = true,
): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = roundCaps
    ? new THREE.CapsuleGeometry(r, len, 6, 14)
    : new THREE.CylinderGeometry(r, r, len, 14);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  _q.setFromUnitVectors(_up, dir.normalize());
  m.quaternion.copy(_q);
  m.castShadow = true;
  return m;
}

function box(
  w: number, h: number, d: number, mat: THREE.Material,
  x = 0, y = 0, z = 0, ry = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(
  rt: number, rb: number, h: number, mat: THREE.Material,
  x = 0, y = 0, z = 0, seg = 24,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Station {
  group = new THREE.Group();
  index: number;
  spec: LetterSpec | null = null;

  // interactive state
  tableAngle = 0;
  tableTarget = 0;
  tableVel = 0;
  lightY = 1.5;
  lightTarget = 1.5;
  wheelSpin = 0;
  dragging = false;
  leverDragging = false;
  solvedTable = false;
  solved = false;
  leverUnlocked = false;
  active = false;

  private tableGroup = new THREE.Group();
  private partsGroup = new THREE.Group();
  private wheelGroup = new THREE.Group();
  private shaftMeshes: THREE.Mesh[] = [];
  private wheelAxis = new THREE.Vector3(1, 0, 0);
  private carriage = new THREE.Group();
  private leverArm: THREE.Group | null = null;
  private flag: THREE.Group | null = null;
  private flagUp = false;
  private lampHead = new THREE.Group();
  private lensMat: THREE.MeshPhysicalMaterial;
  spot: THREE.SpotLight;
  private screenMat: THREE.ShaderMaterial | null = null;
  private beam: THREE.Mesh | null = null;
  private dust: THREE.Points | null = null;
  private dustBase: Float32Array | null = null;

  wheelProxy: THREE.Mesh;
  leverProxy: THREE.Mesh | null = null;
  private wheelCenterLocal = new THREE.Vector3();

  /** set per-frame by the game: fades the haze cone out when viewed on-axis */
  beamViewFactor = 1;
  private lastTickAngle = 0;
  private lastLeverTickY = 0;
  private settleTime = 0;
  private flagWiggleT = 0;
  private M: MatLib;
  private S: StationSounds;
  private nominalLightY = 1.5;

  onSolvedTable: (() => void) | null = null;
  onSolved: (() => void) | null = null;

  constructor(index: number, M: MatLib, sounds: StationSounds) {
    this.index = index;
    this.M = M;
    this.S = sounds;
    this.group.position.x = 0; // set by game via STATION_SPACING
    this.lensMat = M.lens.clone();

    this.spot = new THREE.SpotLight(0xfff2dc, 0);
    this.spot.angle = 0.25;
    this.spot.penumbra = 0.32;
    this.buildScreen();
    this.buildTurntable();
    this.buildPedestal();
    this.buildLampCart();
    this.wheelProxy = this.buildWheelProxy();
    this.group.add(this.tableGroup);
    this.tableGroup.add(this.partsGroup);
  }

  // ---------------------------------------------------------------- hardware

  private buildScreen(): void {
    const M = this.M;
    const g = new THREE.Group();
    const w = SCREEN_HALF_W * 2, h = SCREEN_TOP - SCREEN_BOTTOM;
    const { map } = makeScreenTexture();
    // The panel evaluates the projection directly: it samples the lamp's own
    // shadow map with the lamp's own projection matrix. Identical optics to
    // the rest of the scene, but with full control of contrast, so the
    // letter stays deep and readable on a small phone screen.
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uShadowMap: { value: null },
        uShadowMatrix: { value: new THREE.Matrix4() },
        uLightPos: { value: new THREE.Vector3() },
        uLightDir: { value: new THREE.Vector3(0, 0, -1) },
        uCosOuter: { value: Math.cos(this.spot.angle) },
        uCosInner: { value: Math.cos(this.spot.angle * 0.62) },
        uIntensity: { value: 0 },
        uAmbient: { value: 0.045 },
        uTexel: { value: 1 / 2048 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        #include <packing>
        varying vec3 vWorld;
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform sampler2D uShadowMap;
        uniform mat4 uShadowMatrix;
        uniform vec3 uLightPos;
        uniform vec3 uLightDir;
        uniform float uCosOuter, uCosInner, uIntensity, uAmbient, uTexel;
        float sampleShadow(vec2 uv, float z) {
          float d = unpackRGBAToDepth(texture2D(uShadowMap, uv));
          return step(z, d + 0.0016);
        }
        void main() {
          vec3 base = texture2D(uMap, vUv).rgb;
          vec3 toFrag = normalize(vWorld - uLightPos);
          float cosA = dot(toFrag, uLightDir);
          float cone = smoothstep(uCosOuter, uCosInner, cosA);
          float lit = 1.0;
          vec4 sc = uShadowMatrix * vec4(vWorld, 1.0);
          vec3 s = sc.xyz / sc.w;
          if (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0) {
            lit = 0.0;
            for (int i = -1; i <= 1; i++)
              for (int j = -1; j <= 1; j++)
                lit += sampleShadow(s.xy + vec2(float(i), float(j)) * uTexel * 1.4, s.z);
            lit /= 9.0;
            lit = smoothstep(0.08, 0.92, lit);
          }
          float glow = uIntensity * cone * (0.022 + 0.978 * lit);
          vec3 col = base * (uAmbient + vec3(1.0, 0.965, 0.9) * glow);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.screenMat = mat;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    panel.position.set(0, SCREEN_CY, 0.002);
    g.add(panel);
    // physical body of the milky acrylic (visible thickness from the side)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7, metalness: 0 }),
    );
    body.position.set(0, SCREEN_CY, -0.006);
    g.add(body);

    // aluminium frame
    const fw = 0.055, fd = 0.04;
    const top = box(w + fw * 2, fw, fd, M.alu, 0, SCREEN_TOP + fw / 2, -fd / 2 + 0.006);
    const bot = box(w + fw * 2, fw, fd, M.alu, 0, SCREEN_BOTTOM - fw / 2, -fd / 2 + 0.006);
    const l = box(fw, h, fd, M.alu, -w / 2 - fw / 2, SCREEN_CY, -fd / 2 + 0.006);
    const r = box(fw, h, fd, M.alu, w / 2 + fw / 2, SCREEN_CY, -fd / 2 + 0.006);
    g.add(top, bot, l, r);
    // tension clips (uneven counts per side, functional)
    for (let i = 0; i < 5; i++) {
      const cx = -w / 2 + (i + 0.5) * (w / 5) + (rand() - 0.5) * 0.05;
      g.add(box(0.03, 0.02, 0.05, M.steelDark, cx, SCREEN_TOP + 0.01, -0.02));
    }
    for (let i = 0; i < 4; i++) {
      const cy = SCREEN_BOTTOM + (i + 0.5) * (h / 4) + (rand() - 0.5) * 0.04;
      g.add(box(0.02, 0.03, 0.05, M.steelDark, -w / 2 - 0.01, cy, -0.02));
      g.add(box(0.02, 0.03, 0.05, M.steelDark, w / 2 + 0.01, cy, -0.02));
    }
    // rear X-brace
    const b1 = rodMesh(
      new THREE.Vector3(-w / 2, SCREEN_BOTTOM, -0.05),
      new THREE.Vector3(w / 2, SCREEN_TOP, -0.05), 0.012, M.steelPaintedDark, false,
    );
    const b2 = rodMesh(
      new THREE.Vector3(w / 2, SCREEN_BOTTOM, -0.05),
      new THREE.Vector3(-w / 2, SCREEN_TOP, -0.05), 0.012, M.steelPaintedDark, false,
    );
    b1.castShadow = b2.castShadow = false;
    g.add(b1, b2);
    // legs: raked steel tubes to floor plates, anchor bolts — raked BEHIND
    // the screen plane so they never cross the projection light
    for (const sx of [-1, 1]) {
      const foot = new THREE.Vector3(sx * (w / 2 + 0.28), 0, -0.36);
      const leg = rodMesh(
        new THREE.Vector3(sx * (w / 2 - 0.02), SCREEN_CY + 0.35, -0.03),
        foot.clone().setY(0.02), 0.021, M.steelPaintedDark, false,
      );
      const leg2 = rodMesh(
        new THREE.Vector3(sx * (w / 2 - 0.02), SCREEN_BOTTOM + 0.05, -0.03),
        foot.clone().setY(0.02), 0.019, M.steelPaintedDark, false,
      );
      g.add(leg, leg2);
      const plate = box(0.2, 0.016, 0.26, M.steelPaintedDark, foot.x, 0.008, foot.z);
      g.add(plate);
      for (const [bx, bz] of [[-0.07, -0.09], [0.07, -0.09], [-0.07, 0.09], [0.07, 0.09]] as const) {
        g.add(cyl(0.011, 0.011, 0.02, M.steelDark, foot.x + bx, 0.024, foot.z + bz, 6));
      }
    }
    this.group.add(g);
  }

  private buildTurntable(): void {
    this.buildTableBase(0.78); // rebuilt when a spec with a larger radius loads
    this.tableGroup.position.set(0, 0, TABLE_Z);
  }

  private tableBase: THREE.Group | null = null;
  private tableTop: THREE.Group | null = null;
  private strikerStops: THREE.Group | null = null;

  private buildTableBase(R: number): void {
    const M = this.M;
    if (this.tableBase) this.group.remove(this.tableBase);
    if (this.tableTop) this.tableGroup.remove(this.tableTop);
    if (this.strikerStops) this.group.remove(this.strikerStops);

    const base = new THREE.Group();
    // anchored floor flange
    const flange = cyl(R * 0.66, R * 0.72, 0.07, M.steelPainted, 0, 0.035, TABLE_Z);
    base.add(flange);
    // anchor bolts at slightly uneven angles
    const boltAngles = [0.25, 1.35, 2.2, 3.4, 4.35, 5.5];
    for (const a of boltAngles) {
      const bx = Math.cos(a) * R * 0.62, bz = Math.sin(a) * R * 0.62;
      base.add(cyl(0.016, 0.016, 0.035, M.steelDark, bx, 0.078, TABLE_Z + bz, 6));
    }
    // main casting
    base.add(cyl(R * 0.5, R * 0.6, 0.3, M.steelPainted, 0, 0.22, TABLE_Z));
    // bearing ring
    base.add(cyl(R * 0.55, R * 0.55, 0.07, M.steelDark, 0, 0.41, TABLE_Z));
    // worm gearbox toward the operator side
    const gb = box(0.3, 0.24, 0.24, M.steelPaintedDark, 0.24, 0.3, TABLE_Z + R * 0.52, 0.12);
    base.add(gb);
    const gbCover = box(0.24, 0.18, 0.015, M.steelPainted, 0.24, 0.3, TABLE_Z + R * 0.52 + 0.125, 0.12);
    base.add(gbCover);
    for (const [dx, dy] of [[-0.08, -0.055], [0.08, -0.06], [-0.078, 0.058], [0.083, 0.055]] as const) {
      base.add(cyl(0.007, 0.007, 0.012, M.steelDark, 0.24 + dx, 0.3 + dy, TABLE_Z + R * 0.52 + 0.133, 6));
    }
    // fiducial pointer reading the rim scale
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 4), M.brass);
    pointer.rotation.x = Math.PI / 2;
    pointer.position.set(0, TABLE_TOP_Y - 0.028, TABLE_Z + R + 0.045);
    base.add(pointer);
    this.group.add(base);
    this.tableBase = base;

    // rotating top
    const top = new THREE.Group();
    const disc = cyl(R, R, 0.055, M.steelDark, 0, TABLE_TOP_Y - 0.0275 - 0, 0);
    disc.position.y = TABLE_TOP_Y - 0.0275;
    top.add(disc);
    // rim degree scale
    const scaleTex = makeScaleTexture();
    scaleTex.repeat.set(6, 1);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.03, 48, 1, true),
      new THREE.MeshStandardMaterial({ map: scaleTex, roughness: 0.5, metalness: 0.6 }),
    );
    rim.position.y = TABLE_TOP_Y - 0.02;
    top.add(rim);
    // radial T-slot covers
    for (const a of [0.35, 2.45, 4.55]) {
      const slot = box(R * 0.92, 0.003, 0.03, M.castIron, 0, TABLE_TOP_Y + 0.0015, 0, 0);
      slot.rotation.y = a;
      slot.position.set(Math.cos(a) * R * 0.46, TABLE_TOP_Y + 0.0015, -Math.sin(a) * R * 0.46);
      slot.castShadow = false;
      top.add(slot);
    }
    // striker lug on the rim (meets the fixed end stops)
    const striker = box(0.05, 0.06, 0.09, M.castIron, 0, TABLE_TOP_Y - 0.03, R + 0.03);
    top.add(striker);
    this.tableGroup.add(top);
    this.tableTop = top;
  }

  private buildStops(range: [number, number], R: number): void {
    const M = this.M;
    if (this.strikerStops) this.group.remove(this.strikerStops);
    const g = new THREE.Group();
    // the striker lug sits at azimuth -θ (table spins with rotation.y = -θ);
    // fixed stops sit just beyond the reachable arc
    for (const end of [range[0], range[1]]) {
      const a = -end + (end < 0 ? 0.055 : -0.055);
      const x = Math.sin(a) * (R + 0.07);
      const z = Math.cos(a) * (R + 0.07);
      const stop = box(0.06, 0.1, 0.06, M.steelPaintedDark, x, TABLE_TOP_Y - 0.05, TABLE_Z + z, -a);
      g.add(stop);
      const pad = box(0.015, 0.06, 0.045, M.rubber, x - Math.sin(a + Math.PI / 2) * 0.036, TABLE_TOP_Y - 0.045, TABLE_Z + z - Math.cos(a + Math.PI / 2) * 0.036, -a);
      g.add(pad);
    }
    this.group.add(g);
    this.strikerStops = g;
  }

  private buildPedestal(): void {
    const M = this.M;
    const g = new THREE.Group();
    const P = new THREE.Vector3(0.52, 0, 4.18);

    // column + flange
    g.add(cyl(0.085, 0.11, 1.24, M.steelPainted, P.x, 0.62, P.z, 16));
    g.add(cyl(0.15, 0.17, 0.05, M.steelPainted, P.x, 0.025, P.z, 16));
    for (const a of [0.5, 1.9, 3.3, 4.8]) {
      g.add(cyl(0.012, 0.012, 0.03, M.steelDark, P.x + Math.cos(a) * 0.13, 0.06, P.z + Math.sin(a) * 0.13, 6));
    }
    // top reduction box
    const head = box(0.24, 0.2, 0.22, M.steelPaintedDark, P.x, 1.32, P.z, -0.7);
    g.add(head);

    // shaft from pedestal head to the table gearbox, with universal joints
    const A = new THREE.Vector3(P.x - 0.1, 1.27, P.z - 0.12);
    const B = new THREE.Vector3(0.3, 0.36, TABLE_Z + 0.52);
    const shaft = rodMesh(A, B, 0.021, M.steelDark, false);
    g.add(shaft);
    this.shaftMeshes.push(shaft);
    for (const p of [A, B]) {
      const uj = cyl(0.036, 0.036, 0.09, M.castIron, p.x, p.y, p.z, 10);
      uj.quaternion.copy(shaft.quaternion);
      g.add(uj);
      this.shaftMeshes.push(uj);
    }
    // safety cover over the upper shaft run (bolted half-shell, worn paint)
    const covLen = 0.42;
    const dir = B.clone().sub(A).normalize();
    const covCenter = A.clone().addScaledVector(dir, 0.28);
    const cover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, covLen, 12, 1, true, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x5a5f56, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }),
    );
    cover.position.copy(covCenter);
    _q.setFromUnitVectors(_up, dir);
    cover.quaternion.copy(_q);
    cover.castShadow = true;
    g.add(cover);
    for (const t of [-0.16, 0.16]) {
      const bp = A.clone().addScaledVector(dir, 0.28 + t);
      const br = box(0.018, 0.05, 0.06, M.steelPaintedDark, bp.x, bp.y - 0.055, bp.z);
      g.add(br);
    }

    // handwheel: cast iron, worn rim, three spokes, grip knob
    const wheelDir = A.clone().sub(B).normalize(); // axis pointing toward operator
    const W = A.clone().addScaledVector(wheelDir, 0.16);
    this.wheelAxis.copy(wheelDir);
    this.wheelCenterLocal.copy(W);
    const wg = this.wheelGroup;
    wg.position.copy(W);
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wheelDir);
    wg.quaternion.copy(_q);
    const RIM = 0.24;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM, 0.02, 12, 40), M.ironRim);
    rim.castShadow = true;
    wg.add(rim);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.35;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, RIM - 0.01, 8), M.castIron);
      sp.position.set(Math.cos(a) * RIM * 0.48, Math.sin(a) * RIM * 0.48, 0);
      sp.rotation.z = a + Math.PI / 2;
      sp.castShadow = true;
      wg.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.055, 14), M.castIron);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    wg.add(hub);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.065, 6), M.steelDark);
    nut.rotation.x = Math.PI / 2;
    wg.add(nut);
    // grip knob on the rim (spins freely in reality; modeled fixed)
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.07, 10), M.rubber);
    knob.position.set(RIM * 0.82, 0, 0.045);
    knob.rotation.x = Math.PI / 2;
    knob.castShadow = true;
    wg.add(knob);
    g.add(wg);

    this.group.add(g);
    this.pedestalPos = P;
  }

  private pedestalPos = new THREE.Vector3();

  private buildWheelProxy(): THREE.Mesh {
    // generous invisible touch disc around the handwheel
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.3, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    m.position.copy(this.wheelCenterLocal);
    m.quaternion.copy(this.wheelGroup.quaternion);
    m.rotateX(Math.PI / 2);
    m.name = 'wheelProxy';
    this.group.add(m);
    return m;
  }

  private buildLever(): void {
    // signal-box style: a tall fore/aft lever planted beside the turntable,
    // linked to the lamp carriage by a floor tube — visible in both portrait
    // and landscape operating views
    const M = this.M;
    const g = new THREE.Group();
    const base = new THREE.Vector3(0.5, 0, 3.62);
    // floor bracket
    g.add(box(0.2, 0.05, 0.26, M.steelPaintedDark, base.x, 0.025, base.z));
    for (const [bx, bz] of [[-0.07, -0.09], [0.07, -0.09], [-0.07, 0.09], [0.07, 0.09]] as const) {
      g.add(cyl(0.01, 0.01, 0.02, M.steelDark, base.x + bx, 0.055, base.z + bz, 6));
    }
    const cheekL = box(0.016, 0.5, 0.2, M.steelPainted, base.x - 0.045, 0.28, base.z);
    const cheekR = box(0.016, 0.5, 0.2, M.steelPainted, base.x + 0.045, 0.28, base.z);
    g.add(cheekL, cheekR);
    // engraved quadrant sector between the cheeks
    const quad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.02, 14, 1, false, -0.5, 1.0), M.brass,
    );
    quad.rotation.z = Math.PI / 2;
    quad.position.set(base.x, 0.5, base.z);
    g.add(quad);
    // lever arm assembly (pivots fore/aft around the x-axis)
    const pivot = new THREE.Vector3(base.x, 0.5, base.z);
    const arm = new THREE.Group();
    arm.position.copy(pivot);
    const armRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 1.3, 12), M.castIron);
    armRod.position.set(0, 0.65, 0);
    armRod.castShadow = true;
    arm.add(armRod);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.24, 12), M.rubber);
    grip.position.set(0, 1.18, 0);
    arm.add(grip);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), M.castIron);
    ball.position.set(0, 1.32, 0);
    ball.castShadow = true;
    arm.add(ball);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 14), M.castIron);
    boss.rotation.z = Math.PI / 2;
    boss.castShadow = true;
    arm.add(boss);
    // short rear arm driving the push tube
    const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), M.steelDark);
    rear.position.set(0, -0.11, 0.06);
    rear.rotation.x = 0.5;
    arm.add(rear);
    g.add(arm);
    this.leverArm = arm;
    // linkage run to the lamp cart column
    const runTube = rodMesh(
      new THREE.Vector3(base.x + 0.04, 0.05, base.z + 0.24),
      new THREE.Vector3(0.4, 0.05, LIGHT_Z + 0.42), 0.012, M.steelPaintedDark, false,
    );
    g.add(runTube);
    const upTube = rodMesh(
      new THREE.Vector3(0.4, 0.05, LIGHT_Z + 0.42),
      new THREE.Vector3(0.09, 0.6, LIGHT_Z + 0.5), 0.01, M.steelPaintedDark, false,
    );
    g.add(upTube);
    // generous invisible hit box around the upper arm
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 1.1, 0.8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.set(base.x, 1.35, base.z);
    proxy.name = 'leverProxy';
    g.add(proxy);
    this.leverProxy = proxy;
    this.group.add(g);
  }

  private buildLampCart(): void {
    const M = this.M;
    const g = new THREE.Group();
    // cart base riding both rails
    const base = box(0.7, 0.05, RAIL_Z_B - RAIL_Z_A + 0.3, M.steelPainted, 0, 0.075, (RAIL_Z_A + RAIL_Z_B) / 2);
    g.add(base);
    for (const z of [RAIL_Z_A, RAIL_Z_B]) {
      for (const x of [-0.26, 0.26]) {
        const wr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 18), M.castIron);
        wr.rotation.z = Math.PI / 2;
        wr.position.set(x, 0.05, z);
        wr.castShadow = true;
        g.add(wr);
      }
    }
    // rail clamp (the cart is locked at its station)
    g.add(box(0.09, 0.06, 0.1, M.steelDark, 0.38, 0.06, RAIL_Z_A));
    // column with rack
    const columnZ = LIGHT_Z + 0.5;
    const col = box(0.09, 2.1, 0.09, M.steelPainted, 0, 1.15, columnZ);
    g.add(col);
    const rack = box(0.02, 1.9, 0.035, M.steelDark, 0.056, 1.15, columnZ);
    g.add(rack);
    // counterweight on the back
    g.add(box(0.16, 0.3, 0.1, M.castIron, 0, 0.35, columnZ + 0.12));

    // sliding carriage with the lamp head
    const car = this.carriage;
    const colZ = LIGHT_Z + 0.5;
    const clamp = box(0.16, 0.18, 0.16, M.steelPaintedDark, 0, 0, colZ);
    car.add(clamp);
    const crank = cyl(0.03, 0.03, 0.05, M.castIron, 0.1, 0, colZ, 10);
    crank.rotation.z = Math.PI / 2;
    car.add(crank);
    const arm = box(0.05, 0.05, 0.34, M.steelPaintedDark, 0, 0.02, colZ - 0.2);
    car.add(arm);

    // lamp head: housing behind the optical point; the lens front sits
    // EXACTLY at the projection origin (0, lightY, LIGHT_Z) used to
    // back-project the letter parts, so the optics never lie.
    const lh = this.lampHead;
    const yokeL = rodMesh(new THREE.Vector3(-0.09, 0.1, 0.06), new THREE.Vector3(-0.09, -0.02, 0.06), 0.011, M.steelDark, false);
    const yokeR = rodMesh(new THREE.Vector3(0.09, 0.1, 0.06), new THREE.Vector3(0.09, -0.02, 0.06), 0.011, M.steelDark, false);
    lh.add(yokeL, yokeR);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.3, 20), M.lampHousing);
    housing.rotation.x = Math.PI / 2;
    housing.castShadow = true;
    housing.position.z = 0.05;
    lh.add(housing);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.008, 20), M.lampHousing);
      fin.rotation.x = Math.PI / 2;
      fin.position.z = 0.11 + i * 0.024;
      lh.add(fin);
    }
    const focusRing = new THREE.Mesh(new THREE.CylinderGeometry(0.079, 0.079, 0.035, 20), M.steelDark);
    focusRing.rotation.x = Math.PI / 2;
    focusRing.position.z = -0.09;
    lh.add(focusRing);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), this.lensMat);
    lens.position.z = -0.108;
    lens.rotation.y = Math.PI;
    lh.add(lens);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), M.rubber);
    knob.position.set(0.08, 0.04, 0.06);
    knob.rotation.z = Math.PI / 2;
    lh.add(knob);
    // head center behind the lens; aimed at the screen in setLampHeight()
    lh.position.set(0, 0.02, LIGHT_Z + 0.11);
    car.add(lh);
    // service loop of cable at the carriage
    const coil = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 16), M.cable);
      loop.position.set(0.09, -0.05 - i * 0.012, colZ + 0.05);
      loop.rotation.y = Math.PI / 2 + (i % 2 ? 0.15 : -0.1);
      coil.add(loop);
    }
    car.add(coil);
    g.add(car);

    // drooping cable from column base to the floor outlet
    const cablePts = [
      new THREE.Vector3(0.05, 0.5, columnZ + 0.06),
      new THREE.Vector3(0.35, 0.14, columnZ + 0.3),
      new THREE.Vector3(0.9, 0.03, columnZ + 0.62),
      new THREE.Vector3(1.85, 0.03, columnZ + 1.1),
      new THREE.Vector3(1.9, 0.42, columnZ + 1.44),
    ];
    const curve = new THREE.CatmullRomCurve3(cablePts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.009, 6), M.cable);
    cable.castShadow = false;
    g.add(cable);

    // spotlight (the one real shadow light)
    const spot = this.spot;
    spot.decay = 0;
    spot.distance = 0;
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 1.6;
    spot.shadow.camera.far = 8.5;
    spot.shadow.bias = -0.00035;
    spot.shadow.normalBias = 0.012;
    spot.shadow.radius = 4;
    spot.shadow.camera.near = 1.2;
    spot.layers.enable(1);
    spot.position.set(0, 1.5, LIGHT_Z);
    spot.target.position.set(0, SCREEN_CY, 0);
    this.group.add(spot);
    this.group.add(spot.target);

    this.group.add(g);
    this.setLampHeight(1.5);
  }

  private setLampHeight(y: number): void {
    this.carriage.position.y = y - 0.02;
    // the optical point of the projection: exactly the back-projection origin
    this.spot.position.set(0, y, LIGHT_Z);
    this.spot.target.position.set(0, SCREEN_CY, 0);
    // tilt the head so it faces the screen center (carriage has no rotation,
    // so station-local direction == parent-local direction)
    const dir = new THREE.Vector3(0, SCREEN_CY - y, -LIGHT_Z).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    this.lampHead.quaternion.copy(_q);
  }

  private buildBeamAndDust(): void {
    // whisper-thin beam scattering + local dust motes; no room-filling fog
    const L = LIGHT_Z - 0.15;
    const rEnd = Math.tan(this.spot.angle * 0.92) * L;
    const geo = new THREE.ConeGeometry(rEnd, L, 30, 8, true);
    geo.translate(0, -L / 2, 0);
    geo.rotateX(Math.PI / 2); // apex at origin, opening toward local -z (the lens direction)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uIntensity: { value: 0 } },
      vertexShader: /* glsl */`
        varying float vAx; varying vec3 vPos;
        void main() {
          vAx = -position.z / ${(L).toFixed(3)};
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying float vAx; uniform float uIntensity;
        void main() {
          float ax = clamp(vAx, 0.0, 1.0);
          float fade = pow(1.0 - ax, 1.6) * 0.75 + 0.06;
          gl_FragColor = vec4(1.0, 0.95, 0.85, fade * uIntensity);
        }`,
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.renderOrder = 5;
    this.beam = beam;
    this.lampHead.add(beam);
    beam.position.set(0, 0, -0.11);

    // dust motes drifting inside the beam
    const N = 130;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const t = 0.1 + rand() * 0.75;
      const rad = Math.tan(0.19) * (L * t) * Math.sqrt(rand());
      const a = rand() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = Math.sin(a) * rad;
      pos[i * 3 + 2] = -t * L;
    }
    this.dustBase = pos.slice();
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dm = new THREE.PointsMaterial({
      color: 0xfff3dd, size: 0.006, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const dust = new THREE.Points(dg, dm);
    dust.renderOrder = 6;
    this.dust = dust;
    this.lampHead.add(dust);
    dust.position.set(0, 0, -0.13);
  }

  private buildFlag(): void {
    const M = this.M;
    const g = new THREE.Group();
    const P = this.pedestalPos;
    g.position.set(P.x - 0.02, 1.46, P.z - 0.02);
    const pin = cyl(0.012, 0.012, 0.06, M.steelDark, 0, 0, 0, 8);
    g.add(pin);
    const arm = new THREE.Group();
    const rodm = box(0.2, 0.022, 0.008, M.brass, 0.1, 0, 0);
    arm.add(rodm);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 4), M.brass);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(0.22, 0, 0);
    arm.add(tip);
    arm.rotation.z = -Math.PI / 2; // starts hanging down
    g.add(arm);
    this.flag = g;
    (g as unknown as { arm: THREE.Group }).arm = arm;
    this.group.add(g);
  }

  // ------------------------------------------------------------ letter parts

  loadSpec(spec: LetterSpec): void {
    this.spec = spec;
    this.nominalLightY = spec.lightY;
    this.lightY = this.lightTarget = spec.lightY0 ?? spec.lightY;
    this.tableAngle = this.tableTarget = spec.tableAngle0;
    this.lastTickAngle = this.tableAngle;
    this.setLampHeight(this.lightY);
    this.buildTableBase(spec.tableRadius);
    this.buildStops(spec.tableRange, spec.tableRadius);
    if (spec.hasLever) this.buildLever();
    this.buildBeamAndDust();
    this.buildFlag();
    this.buildParts(spec);
    this.tableGroup.rotation.y = -this.tableAngle;
  }

  private buildParts(spec: LetterSpec): void {
    const M = this.M;
    const ly = spec.lightY;
    const parts = this.partsGroup;
    parts.clear();
    const worldPts: { A: THREE.Vector3; B: THREE.Vector3; r: number }[] = [];
    const ringInfo: { C: THREE.Vector3; R: number; tube: number; e2: THREE.Vector3 }[] = [];

    for (const p of spec.parts) {
      if (p.kind === 'rod') {
        const A = backproject(p.a[0], p.a[1], p.za, ly);
        const B = backproject(p.b[0], p.b[1], p.zb, ly);
        const scale = LIGHT_Z / (LIGHT_Z - (p.za + p.zb) / 2);
        const r = p.strokeW / 2 / scale;
        const mesh = rodMesh(this.toTable(A), this.toTable(B), r, M.matteBlack);
        parts.add(mesh);
        // clamp collars near ends (functional mounting)
        for (const t of [0.1, 0.9]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.32, r * 1.32, r * 1.5, 10), M.steelDark);
          c.position.copy(this.toTable(A.clone().lerp(B, t)));
          c.quaternion.copy(mesh.quaternion);
          c.castShadow = true;
          parts.add(c);
        }
        worldPts.push({ A, B, r });
      } else {
        const C = backproject(p.center[0], p.center[1], p.z, ly);
        const scale = LIGHT_Z / (LIGHT_Z - p.z);
        const R = p.radius / scale;
        const tube = p.strokeW / 2 / scale;
        const n = new THREE.Vector3(0, ly, LIGHT_Z).sub(C).normalize();
        const torus = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 14, 48), M.matteBlack);
        torus.position.copy(this.toTable(C));
        _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        torus.quaternion.copy(_q);
        torus.castShadow = true;
        parts.add(torus);
        const e2 = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
        ringInfo.push({ C, R, tube, e2 });
        worldPts.push({ A: C, B: C, r: tube });
      }
    }

    // feet: support columns dropping to bosses on the table
    for (const f of spec.feet) {
      const p = spec.parts[f.part];
      let pt: THREE.Vector3;
      let partR = 0.02;
      if (p.kind === 'rod') {
        const { A, B, r } = worldPts[f.part];
        pt = A.clone().lerp(B, f.u);
        partR = r;
      } else {
        const ri = ringInfo[spec.parts.filter((q2, i) => q2.kind === 'ring' && i < f.part).length] ?? ringInfo[0];
        pt = ri.C.clone().addScaledVector(ri.e2, -ri.R);
        partR = ri.tube;
      }
      const r = f.r ?? 0.0095;
      const top = pt.clone(); top.y -= partR * 0.4;
      const bottom = new THREE.Vector3(pt.x, TABLE_TOP_Y, pt.z);
      const col = rodMesh(this.toTable(top), this.toTable(bottom), r, M.matteBlack, false);
      parts.add(col);
      // clamp knuckle at the part, boss at the table
      const kn = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r * 1.7, partR * 1.15), 12, 10), M.steelDark);
      kn.position.copy(this.toTable(pt));
      kn.castShadow = true;
      parts.add(kn);
      const boss = cyl(r * 3.2, r * 3.8, 0.035, M.steelDark);
      const bl = this.toTable(bottom);
      boss.position.set(bl.x, TABLE_TOP_Y + 0.0175, bl.z);
      parts.add(boss);
    }

    // ray-aligned tie struts at stroke crossings, derived from the letter
    // geometry itself: each strut lies exactly on the light ray through a
    // crossing, so its solved shadow collapses to a point inside the strokes
    if (spec.autoStruts) {
      const addStrut = (sx: number, sy: number, z1: number, z2: number): void => {
        if (Math.abs(z1 - z2) < 0.04) return;
        const P1 = backproject(sx, sy, z1, ly);
        const P2 = backproject(sx, sy, z2, ly);
        parts.add(rodMesh(this.toTable(P1), this.toTable(P2), 0.008, M.matteBlack, false));
        for (const e of [P1, P2]) {
          const kn = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), M.steelDark);
          kn.position.copy(this.toTable(e));
          kn.castShadow = true;
          parts.add(kn);
        }
      };
      const zOnRod = (idx: number, sx: number, sy: number): number => {
        const { A, B } = worldPts[idx];
        const u = rodParamAtScreenL(A, B, sx, sy, ly);
        return A.z + u * (B.z - A.z);
      };
      const rods = spec.parts
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.kind === 'rod') as { p: RodSpec; i: number }[];
      for (let i = 0; i < rods.length; i++) {
        for (let j = i + 1; j < rods.length; j++) {
          const r1 = rods[i].p, r2 = rods[j].p;
          const hit = intersectSegs2D(r1.a, r1.b, r2.a, r2.b);
          if (!hit || hit.ta < -0.02 || hit.ta > 1.02 || hit.tb < -0.02 || hit.tb > 1.02) continue;
          addStrut(hit.s[0], hit.s[1], zOnRod(rods[i].i, hit.s[0], hit.s[1]), zOnRod(rods[j].i, hit.s[0], hit.s[1]));
        }
      }
      spec.parts.forEach((rp, ri) => {
        if (rp.kind !== 'ring') return;
        for (const rod of rods) {
          for (const t of segCircleParams(rod.p.a, rod.p.b, rp.center, rp.radius)) {
            const sx = rod.p.a[0] + t * (rod.p.b[0] - rod.p.a[0]);
            const sy = rod.p.a[1] + t * (rod.p.b[1] - rod.p.a[1]);
            addStrut(sx, sy, worldPts[ri].A.z, zOnRod(rod.i, sx, sy));
          }
        }
      });
    }

    // engineered braces (shadow hides behind a stroke or leaves the screen)
    for (const b of spec.braces) {
      const P1 = backproject(b.a[0], b.a[1], b.za, ly);
      const P2 = backproject(b.b[0], b.b[1], b.zb, ly);
      const brace = rodMesh(this.toTable(P1), this.toTable(P2), b.r, M.matteBlack, false);
      parts.add(brace);
      // boss where the brace lands on the table
      for (const e of [P1, P2]) {
        if (Math.abs(e.y - TABLE_TOP_Y) < 0.04) {
          const boss = cyl(b.r * 3, b.r * 3.6, 0.03, M.steelDark);
          const bl = this.toTable(e);
          boss.position.set(bl.x, TABLE_TOP_Y + 0.015, bl.z);
          parts.add(boss);
        } else {
          const kn = new THREE.Mesh(new THREE.SphereGeometry(b.r * 2.1, 10, 8), M.steelDark);
          kn.position.copy(this.toTable(e));
          kn.castShadow = true;
          parts.add(kn);
        }
      }
    }
  }

  /** world(station-local) -> turntable-local */
  private toTable(p: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.y, p.z - TABLE_Z);
  }

  // ----------------------------------------------------------------- control

  applyWheelDelta(dWheel: number): void {
    if (!this.spec || this.solved) return;
    const spec = this.spec;
    let t = this.tableTarget + dWheel / WHEEL_TABLE_RATIO;
    const [lo, hi] = spec.tableRange;
    if (t < lo) { t = lo; this.S.stopHit(); }
    if (t > hi) { t = hi; this.S.stopHit(); }
    // mechanical detent: gets "heavier" to leave near the solved angle
    if (Math.abs(this.tableTarget) < spec.detent && Math.abs(t) > Math.abs(this.tableTarget)) {
      t = this.tableTarget + (t - this.tableTarget) * 0.55;
    }
    this.tableTarget = t;
  }

  applyLeverDelta(dy: number): void {
    if (!this.spec || this.solved || !this.spec.hasLever) return;
    if (!this.leverUnlocked) {
      this.S.leverTick();
      return;
    }
    const [lo, hi] = this.spec.leverRange!;
    let t = this.lightTarget + dy;
    if (t < lo) { t = lo; this.S.stopHit(); }
    if (t > hi) { t = hi; this.S.stopHit(); }
    const err = Math.abs(this.lightTarget - this.nominalLightY);
    if (err < 0.03 && Math.abs(t - this.nominalLightY) > err) {
      t = this.lightTarget + (t - this.lightTarget) * 0.55;
    }
    this.lightTarget = t;
  }

  wiggleFlag(): void {
    this.flagWiggleT = 0.8;
  }

  /** nudge toward the solution — used by the physical hint system */
  hintNudge(): void {
    if (!this.spec || this.solved) return;
    if (!this.solvedTable) {
      this.tableTarget += -Math.sign(this.tableTarget) * Math.min(0.012, Math.abs(this.tableTarget));
    } else if (this.spec.hasLever && this.leverUnlocked) {
      const d = this.nominalLightY - this.lightTarget;
      this.lightTarget += Math.sign(d) * Math.min(0.008, Math.abs(d));
    }
  }

  setActive(on: boolean): void {
    this.active = on;
    this.spot.intensity = on ? this.spot.intensity : 0;
    this.spot.castShadow = on;
  }

  /** 0..1 — how close the machine is to revealing its letter */
  closeness(): number {
    if (!this.spec) return 0;
    const a = 1 - Math.min(1, Math.abs(this.tableAngle) / Math.max(0.35, Math.abs(this.spec.tableAngle0)));
    if (!this.spec.hasLever) return a;
    const lr = this.spec.leverRange!;
    const l = 1 - Math.min(1, Math.abs(this.lightY - this.nominalLightY) / ((lr[1] - lr[0]) * 0.5));
    return a * 0.55 + l * 0.45;
  }

  update(dt: number, targetIntensity: number): void {
    if (!this.spec) return;
    const spec = this.spec;

    // detent pull when the hand is off or moving slowly
    if (!this.solvedTable || !spec.hasLever) {
      if (Math.abs(this.tableTarget) < spec.detent && !this.solved) {
        const pull = this.dragging ? 2.2 : 9;
        this.tableTarget += (0 - this.tableTarget) * Math.min(1, dt * pull);
      }
    } else {
      // table already locked in its detent (lever stage)
      this.tableTarget += (0 - this.tableTarget) * Math.min(1, dt * 10);
    }
    if (spec.hasLever && this.leverUnlocked && !this.solved) {
      if (Math.abs(this.lightTarget - this.nominalLightY) < 0.03) {
        const pull = this.leverDragging ? 2.2 : 9;
        this.lightTarget += (this.nominalLightY - this.lightTarget) * Math.min(1, dt * pull);
      }
    }

    // critically-damped follow
    const prev = this.tableAngle;
    const k = 14;
    this.tableVel += (this.tableTarget - this.tableAngle) * k * dt;
    this.tableVel *= Math.exp(-dt * 9);
    this.tableAngle += this.tableVel * dt * 6;
    // hard clamp
    const [lo, hi] = spec.tableRange;
    if (this.tableAngle < lo) { this.tableAngle = lo; this.tableVel = 0; }
    if (this.tableAngle > hi) { this.tableAngle = hi; this.tableVel = 0; }

    this.tableGroup.rotation.y = -this.tableAngle;
    const dAng = this.tableAngle - prev;
    this.wheelSpin += dAng * WHEEL_TABLE_RATIO;
    this.wheelGroup.rotation.z = this.wheelSpin * 3.5; // includes reduction stage
    // the transmission shaft spins about its own axis (local Y of the rod mesh)
    for (const s of this.shaftMeshes) s.rotateY(dAng * WHEEL_TABLE_RATIO * 3.5);

    // ratchet ticks proportional to travel
    if (Math.abs(this.tableAngle - this.lastTickAngle) > 0.035) {
      this.S.tick(Math.min(1, Math.abs(this.tableVel) * 2));
      this.lastTickAngle = this.tableAngle;
    }
    this.S.rumble(Math.min(1, Math.abs(dAng) / Math.max(dt, 1e-4) * 0.55));

    // lamp height follow
    const prevL = this.lightY;
    this.lightY += (this.lightTarget - this.lightY) * Math.min(1, dt * 10);
    if (Math.abs(this.lightY - prevL) > 1e-5) this.setLampHeight(this.lightY);
    if (spec.hasLever && Math.abs(this.lightY - this.lastLeverTickY) > 0.025) {
      this.S.leverTick();
      this.lastLeverTickY = this.lightY;
    }
    if (this.leverArm) {
      const [lo2, hi2] = spec.leverRange!;
      const f = (this.lightY - (lo2 + hi2) / 2) / (hi2 - lo2);
      // lamp high = lever pulled back toward the operator
      this.leverArm.rotation.x = f * 0.46;
    }

    // ---- solve detection
    if (!this.solvedTable) {
      if (Math.abs(this.tableAngle) < 0.008 && Math.abs(this.tableVel) < 0.06 && !this.dragging) {
        this.settleTime += dt;
        if (this.settleTime > 0.35) {
          this.solvedTable = true;
          this.settleTime = 0;
          this.S.clunk();
          if (spec.hasLever && !this.leverUnlocked) {
            this.leverUnlocked = true;
            window.setTimeout(() => this.S.leverUnlock(), 420);
            this.onSolvedTable?.();
          } else if (!spec.hasLever) {
            this.finishSolve();
          } else {
            this.onSolvedTable?.();
          }
        }
      } else {
        this.settleTime = 0;
      }
    } else if (spec.hasLever && !this.solved) {
      if (Math.abs(this.lightY - this.nominalLightY) < 0.012 && !this.leverDragging) {
        this.settleTime += dt;
        if (this.settleTime > 0.35) this.finishSolve();
      } else {
        this.settleTime = 0;
      }
    }

    // flag animation (wiggle timer nudges the raised flag as a swipe cue)
    if (this.flag) {
      const arm = (this.flag as unknown as { arm: THREE.Group }).arm;
      let want = this.flagUp ? 0.06 : -Math.PI / 2;
      if (this.flagWiggleT > 0) {
        this.flagWiggleT -= dt;
        want += Math.sin(this.flagWiggleT * 26) * 0.14;
      }
      arm.rotation.z += (want - arm.rotation.z) * Math.min(1, dt * 7);
    }

    // light + beam + dust
    const cur = this.spot.intensity;
    this.spot.intensity = cur + (targetIntensity - cur) * Math.min(1, dt * 3);
    this.lensMat.emissiveIntensity = this.spot.intensity * 0.55;

    // feed the screen shader the lamp's own projection + shadow map
    if (this.screenMat) {
      const u = this.screenMat.uniforms;
      if (!u.uShadowMap.value && this.spot.shadow.map) {
        u.uShadowMap.value = this.spot.shadow.map.texture;
        u.uShadowMatrix.value = this.spot.shadow.matrix;
      }
      this.spot.getWorldPosition(_v1);
      this.spot.target.getWorldPosition(_v2);
      (u.uLightPos.value as THREE.Vector3).copy(_v1);
      (u.uLightDir.value as THREE.Vector3).copy(_v2.sub(_v1).normalize());
      u.uIntensity.value = this.spot.intensity * 0.22;
    }
    if (this.beam) {
      (this.beam.material as THREE.ShaderMaterial).uniforms.uIntensity.value =
        this.spot.intensity * 0.0035 * this.beamViewFactor;
    }
    if (this.dust && this.dustBase) {
      const mat = this.dust.material as THREE.PointsMaterial;
      mat.opacity = this.spot.intensity * 0.02;
      const attr = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const t = performance.now() * 0.00021;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3] = this.dustBase[i * 3] + Math.sin(t * 2.1 + i * 1.7) * 0.02;
        arr[i * 3 + 1] = this.dustBase[i * 3 + 1] + Math.sin(t * 1.3 + i * 2.9) * 0.03;
      }
      attr.needsUpdate = true;
    }
  }

  private finishSolve(): void {
    this.solved = true;
    this.flagUp = true;
    this.S.success();
    this.onSolved?.();
  }

  reset(): void {
    if (!this.spec) return;
    this.solved = false;
    this.solvedTable = false;
    this.leverUnlocked = false;
    this.flagUp = false;
    this.settleTime = 0;
    this.tableAngle = this.tableTarget = this.spec.tableAngle0;
    this.tableVel = 0;
    this.lightY = this.lightTarget = this.spec.lightY0 ?? this.spec.lightY;
    this.setLampHeight(this.lightY);
    this.tableGroup.rotation.y = -this.tableAngle;
  }

  getWheelCenterWorld(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.wheelCenterLocal);
    return this.group.localToWorld(out);
  }

}

export type { PartSpec };
