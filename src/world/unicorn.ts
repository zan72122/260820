import * as THREE from 'three';
import { clamp, damp, lerp } from '../util/rng';

// A small real horse (≈1.2 m withers), not a toy pony:
// - weight over four planted hooves, barrel slung between shoulders/hips
// - to reach the water it spreads its forelegs, drops chest and neck,
//   and shifts its mass forward — the neck never bends alone
// - horn: layered milky keratin, opaque at root, faintly translucent at
//   the tip; light moves ONLY inside the spiral groove while winding.

export const HORN_LEN = 0.36;
export const HORN_TURNS = 5.0;

const COAT = 0xcfc8bb;
const COAT_LOW = 0xa39a8c; // rain-wet lower legs
const MUZZLE = 0x8f847c;
const MANE = 0xb8ad9c;
const HOOF = 0x4e4943;

function cyl(
  rTop: number,
  rBot: number,
  len: number,
  mat: THREE.Material,
  radial = 10
): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radial, 1);
  g.translate(0, -len / 2, 0); // hang from the pivot
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function ball(r: number, mat: THREE.Material, wSeg = 10, hSeg = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat);
  m.castShadow = true;
  return m;
}

interface Leg {
  pivot: THREE.Group;
  lower: THREE.Group;
  hoofPivot: THREE.Group;
  side: number; // -1 left, +1 right
  front: boolean;
}

export class Unicorn {
  group = new THREE.Group();
  torso = new THREE.Group();
  private legs: Leg[] = [];
  private neckPivot = new THREE.Group();
  private headPivot = new THREE.Group();
  private hornGroup = new THREE.Group();
  private hornTipObj = new THREE.Object3D();
  private earL = new THREE.Group();
  private earR = new THREE.Group();
  private tailSegs: THREE.Group[] = [];
  hornMat: THREE.ShaderMaterial;

  private kneel = 0;
  private kneelTarget = 0;
  private lean = 0;
  private aimTarget: THREE.Vector3 | null = null;
  private earTarget: THREE.Vector3 | null = null;
  private glanceTarget: THREE.Vector3 | null = null;
  private breathe = 0;
  private earFlickT = 3;
  private barrel: THREE.Mesh;

  // rest pose
  private restNeckX = 1.02;
  private restHeadX = -1.22;

  constructor() {
    const coatMat = new THREE.MeshStandardMaterial({ color: COAT, roughness: 0.88, metalness: 0 });
    const coatLowMat = new THREE.MeshStandardMaterial({ color: COAT_LOW, roughness: 0.6, metalness: 0 });
    const muzzleMat = new THREE.MeshStandardMaterial({ color: MUZZLE, roughness: 0.7 });
    const maneMat = new THREE.MeshStandardMaterial({ color: MANE, roughness: 0.95, side: THREE.DoubleSide });
    const hoofMat = new THREE.MeshStandardMaterial({ color: HOOF, roughness: 0.38, metalness: 0.05 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.15 });

    // ---- torso -----------------------------------------------------------
    const barrelGeo = new THREE.CapsuleGeometry(0.255, 0.6, 6, 14);
    barrelGeo.rotateX(Math.PI / 2); // capsule axis along Z
    this.barrel = new THREE.Mesh(barrelGeo, coatMat);
    this.barrel.position.set(0, 0.9, -0.02);
    this.barrel.scale.set(0.82, 1, 1); // ribcage narrower than tall
    this.barrel.castShadow = true;
    this.torso.add(this.barrel);

    const chest = ball(0.21, coatMat, 12, 10);
    chest.position.set(0, 0.82, 0.34);
    chest.scale.set(0.78, 1.05, 1);
    this.torso.add(chest);

    const rump = ball(0.235, coatMat, 12, 10);
    rump.position.set(0, 0.93, -0.36);
    rump.scale.set(0.85, 1, 1.1);
    this.torso.add(rump);

    // withers ridge
    const withers = ball(0.16, coatMat);
    withers.position.set(0, 1.06, 0.28);
    withers.scale.set(0.6, 0.75, 1.1);
    this.torso.add(withers);

    // shoulder + haunch masses blended into the barrel silhouette
    for (const sd of [-1, 1]) {
      const sh = ball(0.13, coatMat);
      sh.position.set(sd * 0.085, 0.82, 0.33);
      sh.scale.set(0.85, 1.15, 0.95);
      this.torso.add(sh);
      const th = ball(0.155, coatMat);
      th.position.set(sd * 0.085, 0.8, -0.38);
      th.scale.set(0.85, 1.2, 1.0);
      this.torso.add(th);
    }

    // ---- neck + head -----------------------------------------------------
    this.neckPivot.position.set(0, 1.0, 0.38);
    this.neckPivot.rotation.order = 'YXZ';
    this.neckPivot.rotation.x = this.restNeckX;
    this.torso.add(this.neckPivot);

    const neckLen = 0.66;
    const neckGeo = new THREE.CylinderGeometry(0.072, 0.15, neckLen, 12, 3);
    neckGeo.translate(0, neckLen / 2, 0);
    const neck = new THREE.Mesh(neckGeo, coatMat);
    neck.scale.set(0.72, 1, 1.15); // crest deeper than wide
    neck.castShadow = true;
    this.neckPivot.add(neck);

    this.headPivot.position.set(0, neckLen, 0);
    this.headPivot.rotation.order = 'YXZ';
    this.headPivot.rotation.x = this.restHeadX;
    this.neckPivot.add(this.headPivot);
    // poll/throat: rounds off the neck-to-head joint
    const poll = ball(0.088, coatMat, 12, 10);
    poll.position.set(0, neckLen - 0.02, 0.01);
    poll.scale.set(0.75, 1, 1);
    this.neckPivot.add(poll);

    // head built along +Z (muzzle forward)
    const skull = ball(0.105, coatMat, 14, 12);
    skull.position.set(0, 0.012, 0.035);
    skull.scale.set(0.7, 0.95, 1.2);
    this.headPivot.add(skull);
    const cheekL = ball(0.078, coatMat);
    cheekL.position.set(-0.032, -0.03, 0.01);
    cheekL.scale.set(0.85, 1, 1.1);
    this.headPivot.add(cheekL);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.032;
    this.headPivot.add(cheekR);

    const muzzleGeo = new THREE.CylinderGeometry(0.05, 0.078, 0.24, 12, 2);
    muzzleGeo.rotateX(Math.PI / 2);
    muzzleGeo.translate(0, 0, 0.12);
    const muzzle = new THREE.Mesh(muzzleGeo, coatMat);
    muzzle.position.set(0, -0.03, 0.09);
    muzzle.rotation.x = 0.24; // muzzle drops from the skull line
    muzzle.scale.set(0.78, 0.92, 1);
    muzzle.castShadow = true;
    this.headPivot.add(muzzle);
    // rounded nose covers the muzzle end (no flat cap)
    const nose = ball(0.056, coatMat, 12, 8);
    nose.position.set(0, -0.088, 0.315);
    nose.scale.set(0.76, 0.8, 0.85);
    this.headPivot.add(nose);
    const noseTip = ball(0.045, muzzleMat, 10, 8);
    noseTip.position.set(0, -0.095, 0.335);
    noseTip.scale.set(0.72, 0.7, 0.6);
    this.headPivot.add(noseTip);
    for (const sd of [-1, 1]) {
      const nostril = ball(0.009, new THREE.MeshStandardMaterial({ color: 0x4a413a, roughness: 0.5 }), 6, 5);
      nostril.position.set(sd * 0.026, -0.072, 0.345);
      nostril.scale.set(1, 0.7, 0.6);
      this.headPivot.add(nostril);
      const eye = ball(0.016, eyeMat, 10, 8);
      eye.position.set(sd * 0.056, 0.018, 0.05);
      this.headPivot.add(eye);
    }
    const jaw = ball(0.06, coatMat);
    jaw.position.set(0, -0.07, 0.03);
    jaw.scale.set(0.7, 0.7, 1.3);
    this.headPivot.add(jaw);

    // ears (guidance: they orient before anything else does)
    const earGeo = new THREE.ConeGeometry(0.024, 0.085, 7);
    earGeo.translate(0, 0.042, 0);
    for (const [grp, sd] of [
      [this.earL, -1],
      [this.earR, 1],
    ] as const) {
      grp.position.set(sd * 0.058, 0.075, -0.045);
      const ear = new THREE.Mesh(earGeo, coatMat);
      ear.scale.set(1, 1, 0.5);
      ear.castShadow = false;
      grp.add(ear);
      grp.rotation.z = sd * -0.5;
      grp.rotation.x = -0.45;
      this.headPivot.add(grp);
    }

    // ---- horn ------------------------------------------------------------
    this.hornMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      uniforms: {
        uGlowT: { value: 0 },
        uGlowAmt: { value: 0 },
        uLoad: { value: 0 },
        uSunDir: { value: new THREE.Vector3(6.5, 4.2, 3.2).normalize() },
      },
      vertexShader: `
        varying vec3 vPos; varying vec3 vNorm; varying vec3 vWorld;
        void main(){
          vPos = position;
          vNorm = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vPos; varying vec3 vNorm; varying vec3 vWorld;
        uniform float uGlowT, uGlowAmt, uLoad;
        uniform vec3 uSunDir;
        void main(){
          float t = clamp(vPos.y / ${HORN_LEN.toFixed(3)}, 0.0, 1.0);
          float ang = atan(vPos.x, vPos.z);
          float coord = ang / 6.2831853 + t * ${HORN_TURNS.toFixed(1)};
          float gd = abs(fract(coord) - 0.5);
          float groove = smoothstep(0.27, 0.13, gd);

          // layered keratin: subtle lengthwise banding, never plastic
          vec3 base = mix(vec3(0.90, 0.87, 0.81), vec3(0.96, 0.945, 0.91), t);
          base *= 1.0 - 0.05 * sin(t * 70.0 + ang * 2.0);
          base *= 1.0 - groove * 0.22;

          // stored murk pigment fills the groove from the root upward
          float loadMask = groove * (1.0 - smoothstep(uLoad * 0.62 - 0.05, uLoad * 0.62 + 0.03, t)) * step(0.01, uLoad);
          base = mix(base, vec3(0.17, 0.12, 0.18), loadMask * 0.62);

          vec3 n = normalize(vNorm);
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float ndl = clamp(dot(n, uSunDir), 0.0, 1.0);
          vec3 col = base * (0.52 + 0.55 * ndl);
          // faint warm transmission at the thin tip when backlit
          float rim = pow(1.0 - abs(dot(n, viewDir)), 2.6);
          col += vec3(0.28, 0.24, 0.18) * rim * smoothstep(0.45, 1.0, t) * 0.5;
          float spec = pow(clamp(dot(normalize(viewDir + uSunDir), n), 0.0, 1.0), 30.0);
          col += vec3(spec) * 0.12 * (1.0 - groove * 0.6);

          // the ONLY glow: a weak light travelling inside the groove
          float g = groove * exp(-pow((t - uGlowT) * 7.0, 2.0)) * uGlowAmt;
          col += vec3(0.42, 0.38, 0.6) * g * 0.55;

          float alpha = mix(1.0, 0.72, smoothstep(0.55, 1.0, t));
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const hornGeo = new THREE.CylinderGeometry(0.005, 0.026, HORN_LEN, 14, 36);
    hornGeo.translate(0, HORN_LEN / 2, 0);
    const horn = new THREE.Mesh(hornGeo, this.hornMat);
    horn.castShadow = true;
    this.hornGroup.position.set(0, 0.07, 0.04);
    this.hornGroup.rotation.x = 0.95; // continues the forehead line, up-forward
    this.hornGroup.add(horn);
    this.hornTipObj.position.set(0, HORN_LEN, 0);
    this.hornGroup.add(this.hornTipObj);
    this.headPivot.add(this.hornGroup);

    // mane: rain-matted, lying close along the crest — a low ridge of
    // overlapping tufts, not loose cards
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const tuft = ball(0.052 + Math.sin(t * Math.PI) * 0.015, maneMat, 8, 6);
      tuft.castShadow = false;
      tuft.position.set(0.008 * (i % 2 === 0 ? 1 : -1), 0.06 + t * 0.56, -0.052 - Math.sin(t * Math.PI) * 0.022);
      tuft.scale.set(0.42, 1.25, 0.75);
      tuft.rotation.x = -0.15;
      this.neckPivot.add(tuft);
    }
    const forelock = ball(0.045, maneMat, 8, 6);
    forelock.castShadow = false;
    forelock.position.set(0.01, 0.075, 0.045);
    forelock.scale.set(0.6, 0.5, 1.2);
    this.headPivot.add(forelock);

    // ---- tail ------------------------------------------------------------
    let tailParent: THREE.Object3D = this.torso;
    let tailPos = new THREE.Vector3(0, 1.0, -0.6);
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.copy(tailPos);
      const len = 0.3 - i * 0.05;
      const tm = cyl(0.05 - i * 0.013, 0.03 - i * 0.008, len, maneMat, 8);
      seg.add(tm);
      seg.rotation.x = i === 0 ? -0.32 : -0.18;
      tailParent.add(seg);
      this.tailSegs.push(seg);
      tailParent = seg;
      tailPos = new THREE.Vector3(0, -len, 0);
    }

    this.group.add(this.torso);

    // ---- legs (children of root: hooves stay planted while torso leans) --
    const mkLeg = (side: number, front: boolean): Leg => {
      const pivot = new THREE.Group();
      const px = side * (front ? 0.145 : 0.155);
      const pz = front ? 0.35 : -0.4;
      const upperLen = front ? 0.35 : 0.37;
      const lowerLen = front ? 0.3 : 0.29;
      const pasternLen = 0.07;
      const hoofH = 0.065;
      pivot.position.set(px, upperLen + lowerLen + pasternLen + hoofH - 0.015, pz);
      const upper = cyl(front ? 0.058 : 0.072, 0.042, upperLen, coatMat);
      pivot.add(upper);
      const knee = ball(0.052, coatMat, 8, 6);
      knee.position.y = -upperLen;
      pivot.add(knee);
      const lower = new THREE.Group();
      lower.position.y = -upperLen;
      const cannon = cyl(0.036, 0.032, lowerLen, coatLowMat);
      lower.add(cannon);
      const fetlock = ball(0.037, coatLowMat, 8, 6);
      fetlock.position.y = -lowerLen;
      lower.add(fetlock);
      const hoofPivot = new THREE.Group();
      hoofPivot.position.y = -lowerLen;
      const pastern = cyl(0.03, 0.033, pasternLen, coatLowMat, 8);
      pastern.rotation.x = 0.28; // pastern slopes forward
      hoofPivot.add(pastern);
      const hoofGeo = new THREE.CylinderGeometry(0.041, 0.049, hoofH, 10, 1);
      hoofGeo.translate(0, -hoofH / 2, 0);
      const hoof = new THREE.Mesh(hoofGeo, hoofMat);
      hoof.position.set(0, -pasternLen + 0.005, 0.022);
      hoof.castShadow = true;
      hoofPivot.add(hoof);
      lower.add(hoofPivot);
      pivot.add(lower);
      this.group.add(pivot);
      return { pivot, lower, hoofPivot, side, front };
    };
    this.legs.push(mkLeg(-1, true), mkLeg(1, true), mkLeg(-1, false), mkLeg(1, false));
  }

  // Settle each hoof onto the actual terrain under it (called once placed).
  plantHooves(terrainHeight: (x: number, z: number) => number) {
    this.group.updateWorldMatrix(true, true);
    const rootY = this.group.position.y;
    const w = new THREE.Vector3();
    for (const leg of this.legs) {
      leg.pivot.getWorldPosition(w);
      const gy = terrainHeight(w.x, w.z);
      leg.pivot.position.y += gy - rootY;
    }

    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
    });
  }

  setKneel(k: number) {
    this.kneelTarget = clamp(k, 0, 1);
  }
  getKneel() {
    return this.kneel;
  }
  setAim(t: THREE.Vector3 | null) {
    this.aimTarget = t ? t.clone() : null;
  }
  setEarTarget(t: THREE.Vector3 | null) {
    this.earTarget = t ? t.clone() : null;
  }
  setGlance(t: THREE.Vector3 | null) {
    this.glanceTarget = t ? t.clone() : null;
  }

  tipWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.hornTipObj.getWorldPosition(out);
  }
  hornMatrixWorld(): THREE.Matrix4 {
    return this.hornGroup.matrixWorld;
  }
  setHornGlow(t: number, amt: number) {
    this.hornMat.uniforms.uGlowT.value = t;
    this.hornMat.uniforms.uGlowAmt.value = amt;
  }
  setHornLoad(v: number) {
    this.hornMat.uniforms.uLoad.value = clamp(v, 0, 1);
  }
  getHornLoad(): number {
    return this.hornMat.uniforms.uLoad.value;
  }

  // Aim solver: explicit pitch/yaw state per joint (no Euler-decomposition
  // branch issues), nudged toward the target every iteration and clamped.
  private jointAngles = { neckRx: 1.02, neckRy: 0, headRx: -1.22, headRy: 0 };

  private aimJoint(
    joint: THREE.Object3D,
    key: 'neck' | 'head',
    target: THREE.Vector3,
    limX: [number, number],
    limY: [number, number],
    weight: number
  ) {
    const a = this.jointAngles;
    const tipW = this.tipWorld(new THREE.Vector3());
    const parent = joint.parent!;
    parent.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const jp = joint.position;
    const tipP = tipW.applyMatrix4(inv).sub(jp);
    const tgtP = target.clone().applyMatrix4(inv).sub(jp);
    const pitch = (v: THREE.Vector3) => Math.atan2(-v.y, Math.hypot(v.x, v.z));
    let dp = (pitch(tgtP) - pitch(tipP)) * weight;
    let dy = 0;
    if (Math.hypot(tgtP.x, tgtP.z) > 0.05 && Math.hypot(tipP.x, tipP.z) > 0.05) {
      let raw = Math.atan2(tgtP.x, tgtP.z) - Math.atan2(tipP.x, tipP.z);
      while (raw > Math.PI) raw -= Math.PI * 2;
      while (raw < -Math.PI) raw += Math.PI * 2;
      dy = raw * weight;
    }
    if (key === 'neck') {
      a.neckRx = clamp(a.neckRx + dp, limX[0], limX[1]);
      a.neckRy = clamp(a.neckRy + dy, limY[0], limY[1]);
      joint.rotation.set(a.neckRx, a.neckRy, 0, 'YXZ');
    } else {
      a.headRx = clamp(a.headRx + dp, limX[0], limX[1]);
      a.headRy = clamp(a.headRy + dy, limY[0], limY[1]);
      joint.rotation.set(a.headRx, a.headRy, 0, 'YXZ');
    }
  }

  update(dt: number, time: number) {
    // --- kneel / weight-shift blend
    this.kneel = damp(this.kneel, this.kneelTarget, 3.2, dt);
    const k = this.kneel;
    // weight shift: reaching farther rocks the whole body forward — the
    // neck never stretches alone
    let leanTarget = 0;
    if (this.aimTarget) {
      const nb = this.neckPivot.getWorldPosition(new THREE.Vector3());
      const d = nb.distanceTo(this.aimTarget);
      leanTarget = clamp((d - 0.8) * 0.32, 0, 0.22);
    }
    this.lean = damp(this.lean, leanTarget, 4, dt);
    // torso pitches about the chest, drops, and moves forward
    this.torso.rotation.x = 0.14 * k + this.lean * 0.5;
    this.torso.position.set(0, -0.125 * k - this.lean * 0.25, 0.2 * k + this.lean);
    // forelegs spread and soften; hind legs take a touch of angle
    for (const leg of this.legs) {
      if (leg.front) {
        leg.pivot.rotation.z = leg.side * 0.16 * k;
        leg.pivot.rotation.x = 0.14 * k;
        leg.lower.rotation.x = -0.2 * k;
        leg.hoofPivot.rotation.x = 0.07 * k;
      } else {
        leg.pivot.rotation.x = -0.05 * k;
        leg.lower.rotation.x = 0.05 * k;
      }
    }

    // --- breathing & idle micro-motion
    this.breathe += dt;
    const br = Math.sin(this.breathe * 1.5) * 0.008;
    this.barrel.scale.set(0.82 * (1 + br), 1 + br, 1);

    // --- neck/head aim
    const restNX = lerp(this.restNeckX, 1.62, k);
    const restHX = lerp(this.restHeadX, -0.52, k);
    const a = this.jointAngles;
    if (this.aimTarget) {
      for (let i = 0; i < 4; i++) {
        this.aimJoint(this.neckPivot, 'neck', this.aimTarget, [0.25, 2.3], [-1.25, 1.25], 0.5);
        this.aimJoint(this.headPivot, 'head', this.aimTarget, [-1.7, 0.5], [-0.95, 0.95], 0.6);
      }
    } else {
      // ease back to rest, with an optional glance bias
      let gy = 0;
      if (this.glanceTarget) {
        const l = this.group.worldToLocal(this.glanceTarget.clone());
        gy = clamp(Math.atan2(l.x, l.z) * 0.5, -0.5, 0.5);
      }
      a.neckRx = damp(a.neckRx, restNX, 4, dt);
      a.neckRy = damp(a.neckRy, gy * 0.6, 3, dt);
      a.headRx = damp(a.headRx, restHX, 4, dt);
      a.headRy = damp(a.headRy, gy * 0.4, 3, dt);
      this.neckPivot.rotation.set(a.neckRx, a.neckRy, 0, 'YXZ');
      this.headPivot.rotation.set(a.headRx, a.headRy, 0, 'YXZ');
    }

    // --- ears: track the ear target (murk streak), with idle flicks
    let earYaw = 0;
    let earPitch = -0.25;
    if (this.earTarget) {
      const l = this.headPivot.worldToLocal(this.earTarget.clone());
      earYaw = clamp(Math.atan2(l.x, l.z) * 0.4, -0.55, 0.55);
      earPitch = clamp(-0.25 + Math.atan2(-l.y, l.length()) * 0.15, -0.6, 0.1);
    }
    this.earFlickT -= dt;
    const flick = this.earFlickT < 0.18 && this.earFlickT > 0 ? Math.sin((0.18 - this.earFlickT) * 30) * 0.4 : 0;
    if (this.earFlickT <= 0) this.earFlickT = 2.5 + Math.random() * 4;
    this.earL.rotation.y = damp(this.earL.rotation.y, earYaw, 6, dt);
    this.earL.rotation.x = damp(this.earL.rotation.x, earPitch + flick, 6, dt);
    this.earR.rotation.y = damp(this.earR.rotation.y, earYaw, 6, dt);
    this.earR.rotation.x = damp(this.earR.rotation.x, earPitch, 6, dt);

    // --- tail sway
    for (let i = 0; i < this.tailSegs.length; i++) {
      const seg = this.tailSegs[i];
      seg.rotation.z = Math.sin(time * 0.8 + i * 0.9) * 0.06;
    }
  }
}
