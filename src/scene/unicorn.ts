import * as THREE from 'three';
import { ensureOutward } from './meshUtil';

/**
 * A small resting unicorn — proportions taken from a pony skull:
 * long nasal slope dropping toward the muzzle, deep cheek (masseter),
 * laterally-set dark eyes under a brow ridge, mobile ears.
 * Built as a lofted cross-section mesh so the head reads as
 * bone-and-muscle structure, not an inflated toy.
 *
 * She lies calmly beside the padded rest; the lower jaw settles into the
 * leather cushion (whose geometry dents to meet it).
 */

interface Section {
  x: number; // along head axis, muzzle = +
  w: number; // half width
  h: number; // half height
  cy: number; // vertical center offset
  squash: number; // superellipse exponent (2 = ellipse, higher = boxier)
  jawFullness: number; // extra fullness on the lower half
}

// dorsal line: high rounded cranium, straight nasal slope descending,
// muzzle low and narrow. cy falls toward the muzzle.
const HEAD_SECTIONS: Section[] = [
  { x: -0.315, w: 0.001, h: 0.001, cy: 0.01, squash: 2.0, jawFullness: 0.2 }, // capped poll
  { x: -0.30, w: 0.062, h: 0.085, cy: 0.012, squash: 2.0, jawFullness: 0.3 },
  { x: -0.26, w: 0.094, h: 0.118, cy: 0.004, squash: 2.15, jawFullness: 0.7 }, // cranium
  { x: -0.19, w: 0.105, h: 0.128, cy: -0.004, squash: 2.3, jawFullness: 1.0 }, // cheek / masseter
  { x: -0.10, w: 0.104, h: 0.120, cy: -0.012, squash: 2.25, jawFullness: 0.95 }, // orbit line
  { x: -0.02, w: 0.080, h: 0.098, cy: -0.020, squash: 2.15, jawFullness: 0.75 },
  { x: 0.06, w: 0.063, h: 0.078, cy: -0.028, squash: 2.05, jawFullness: 0.55 }, // nasal slope
  { x: 0.13, w: 0.052, h: 0.064, cy: -0.034, squash: 2.0, jawFullness: 0.45 },
  { x: 0.19, w: 0.046, h: 0.055, cy: -0.040, squash: 1.95, jawFullness: 0.42 }, // nostril flare
  { x: 0.235, w: 0.041, h: 0.047, cy: -0.048, squash: 1.9, jawFullness: 0.45 },
  { x: 0.262, w: 0.035, h: 0.041, cy: -0.056, squash: 1.9, jawFullness: 0.5 }, // lip
  { x: 0.276, w: 0.001, h: 0.001, cy: -0.06, squash: 1.9, jawFullness: 0.5 }, // capped tip
];

function sectionRadius(sec: Section, ang: number): { y: number; z: number } {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const n = sec.squash;
  const cs = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  const ss = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
  let h = sec.h;
  if (c < 0) h *= 1 + 0.2 * sec.jawFullness * -c;
  return { y: sec.cy + h * cs, z: sec.w * ss };
}

function lerpSection(a: Section, b: Section, t: number): Section {
  return {
    x: a.x + (b.x - a.x) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    squash: a.squash + (b.squash - a.squash) * t,
    jawFullness: a.jawFullness + (b.jawFullness - a.jawFullness) * t,
  };
}

function loft(sections: Section[], radial: number, lengthwise: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = sections.length;
  for (let j = 0; j <= lengthwise; j++) {
    const t = j / lengthwise;
    const f = t * (n - 1);
    const i0 = Math.min(n - 2, Math.floor(f));
    const ft = f - i0;
    const sm = ft * ft * (3 - 2 * ft);
    const sec = lerpSection(sections[i0], sections[i0 + 1], sm);
    for (let i = 0; i <= radial; i++) {
      const ang = (i / radial) * Math.PI * 2;
      const r = sectionRadius(sec, ang);
      pos.push(sec.x, r.y, r.z);
      uv.push(i / radial, t);
    }
  }
  const stride = radial + 1;
  for (let j = 0; j < lengthwise; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * stride + i;
      const b = a + stride;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  ensureOutward(g);
  return g;
}

/** Procedural short-coat texture: directional faint strokes, no uniformity. */
function coatTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#ede4d3');
  grad.addColorStop(0.5, '#e9dfcd');
  grad.addColorStop(1, '#e2d6c2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 40 + Math.random() * 130;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tint = Math.random() > 0.5 ? '252,246,234' : '206,192,170';
    g2.addColorStop(0, `rgba(${tint},${0.05 + Math.random() * 0.06})`);
    g2.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = 8 + Math.random() * 18;
    const drift = (Math.random() - 0.5) * 5;
    const light = Math.random() > 0.5;
    ctx.strokeStyle = light
      ? `rgba(253,249,240,${0.03 + Math.random() * 0.05})`
      : `rgba(158,144,124,${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + drift, y + len * 0.5, x + drift * 1.6, y + len);
    ctx.stroke();
  }
  // muzzle end (v≈1) shades to soft grey-rose skin
  const mz = ctx.createLinearGradient(0, S * 0.8, 0, S);
  mz.addColorStop(0, 'rgba(168,148,140,0)');
  mz.addColorStop(1, 'rgba(148,128,120,0.5)');
  ctx.fillStyle = mz;
  ctx.fillRect(0, S * 0.8, S, S * 0.2);

  const map = new THREE.CanvasTexture(cv);
  map.anisotropy = 4;
  map.colorSpace = THREE.SRGBColorSpace;

  const bcv = document.createElement('canvas');
  bcv.width = bcv.height = 512;
  const bctx = bcv.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);
  bctx.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 5 + Math.random() * 12;
    const l = Math.random() > 0.5;
    bctx.strokeStyle = l ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
    bctx.lineWidth = 0.7 + Math.random();
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + (Math.random() - 0.5) * 3, y + len);
    bctx.stroke();
  }
  const bump = new THREE.CanvasTexture(bcv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

export class Unicorn {
  readonly group = new THREE.Group();
  readonly headGroup = new THREE.Group();
  readonly hornAnchor = new THREE.Group();
  private earL!: THREE.Group;
  private earR!: THREE.Group;
  private eyeL!: THREE.Group;
  private eyeR!: THREE.Group;
  private maneCards: { m: THREE.Mesh; phase: number; base: number }[] = [];
  private blinkT = 3.2;
  private lookTarget = new THREE.Vector3();
  private lookWeight = 0;
  coatMat!: THREE.MeshPhysicalMaterial;
  plainCoatMat!: THREE.MeshPhysicalMaterial;

  constructor() {
    const { map, bump } = coatTexture();
    this.coatMat = new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.5,
      roughness: 0.8,
      sheen: 0.45,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xfff4e2),
      envMapIntensity: 0.25,
    });
    // untextured coat for small parts whose UVs would smear the head map
    this.plainCoatMat = new THREE.MeshPhysicalMaterial({
      color: 0xe7ddc9,
      bumpMap: bump,
      bumpScale: 0.35,
      roughness: 0.82,
      sheen: 0.4,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xfff4e2),
      envMapIntensity: 0.22,
    });

    this.buildHead();
    this.buildNeckAndBody();
    this.group.add(this.headGroup);
  }

  private buildHead() {
    const headGeo = loft(HEAD_SECTIONS, 44, 72);
    const head = new THREE.Mesh(headGeo, this.coatMat);
    head.castShadow = true;
    head.name = 'unicorn-head';
    this.headGroup.add(head);

    // --- eyes: dark almonds sunk into the orbit, hooded by a shaded lid
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xb9a98c, roughness: 0.88 });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x3c3128, roughness: 0.9 });
    const mkEye = (side: number) => {
      const holder = new THREE.Group();
      const eye = new THREE.Group();
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.0155, 24, 18),
        new THREE.MeshPhysicalMaterial({
          color: 0x1c1310,
          roughness: 0.07,
          envMapIntensity: 1.6,
        })
      );
      ball.scale.set(0.7, 0.9, 1); // almond: shallow front-back, tall oval
      const cornea = new THREE.Mesh(
        new THREE.SphereGeometry(0.0075, 14, 12),
        new THREE.MeshPhysicalMaterial({ color: 0x090604, roughness: 0.04, envMapIntensity: 2.2 })
      );
      cornea.position.set(0, -0.001, 0.0105);
      eye.add(ball, cornea);
      // lash line: a dark rim seating the eye in the socket
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.0148, 0.0026, 8, 22), lashMat);
      lash.scale.set(0.95, 0.9, 1);
      lash.position.z = 0.004;
      // hooded upper lid in shaded coat tone
      const brow = new THREE.Mesh(
        new THREE.TorusGeometry(0.0165, 0.0058, 10, 20, Math.PI * 1.1),
        lidMat
      );
      brow.rotation.z = Math.PI * 0.02;
      brow.position.z = 0.004;
      const lower = new THREE.Mesh(
        new THREE.TorusGeometry(0.0155, 0.0045, 10, 18, Math.PI * 0.75),
        lidMat
      );
      lower.rotation.z = Math.PI * 1.08;
      lower.position.z = 0.004;
      holder.add(eye, lash, brow, lower);
      // just above the widest cheek line, looking outward; sunk into the orbit
      holder.position.set(-0.1, 0.028, 0.076 * side);
      holder.rotation.y = side > 0 ? 0.85 : Math.PI - 0.85;
      holder.rotation.x = -0.12;
      eye.position.z = -0.009;
      this.headGroup.add(holder);
      return eye;
    };
    this.eyeL = mkEye(1);
    this.eyeR = mkEye(-1);

    // --- ears: curved shells on pivots
    const earMat = this.plainCoatMat;
    const earShape = (): THREE.Mesh => {
      // rounded leaf-shell: a squashed sphere hollowed by an inner cup
      const geo = new THREE.SphereGeometry(0.03, 16, 14);
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = THREE.MathUtils.clamp((y + 0.03) / 0.06, 0, 1);
        // stretch tall, taper to a soft tip, flatten front-back
        p.setY(i, y * 1.7 + k * k * 0.012);
        p.setX(i, p.getX(i) * (1 - 0.45 * k * k));
        p.setZ(i, p.getZ(i) * (0.52 - 0.22 * k));
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, earMat);
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xa9887c, roughness: 0.92 })
      );
      inner.position.set(0.012, 0.002, 0);
      inner.scale.set(0.35, 1.25, 0.5);
      m.add(inner);
      return m;
    };
    const mkEar = (side: number) => {
      const pivot = new THREE.Group();
      const ear = earShape();
      ear.position.y = 0.038;
      pivot.add(ear);
      pivot.position.set(-0.26, 0.098, 0.05 * side);
      // upright, tips leaning slightly out and back
      pivot.rotation.set(0.22 * side, 0.15 * side, -0.18);
      this.headGroup.add(pivot);
      return pivot;
    };
    this.earL = mkEar(1);
    this.earR = mkEar(-1);

    // --- nostrils: soft comma pockets on the muzzle flare
    const mkNostril = (side: number) => {
      const g = new THREE.Mesh(
        new THREE.TorusGeometry(0.0095, 0.0042, 10, 18, Math.PI * 1.3),
        new THREE.MeshStandardMaterial({ color: 0x584740 , roughness: 0.88 })
      );
      g.position.set(0.225, -0.021, 0.0335 * side);
      // hug the muzzle surface, opening angled back-down
      g.rotation.set(0.35 * side, -0.55 * side, -0.5);
      g.scale.set(1, 0.8, 0.5);
      this.headGroup.add(g);
    };
    mkNostril(1);
    mkNostril(-1);

    // --- mouth: one subtle crease per side along the lower lip line
    const mkMouth = (side: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(
          new THREE.Vector3(
            0.17 + t * 0.085,
            -0.075 - t * 0.012,
            (0.032 - t * 0.014) * side
          )
        );
      }
      const mouth = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.002, 6),
        new THREE.MeshStandardMaterial({ color: 0x907d6c, roughness: 0.92 })
      );
      mouth.position.z = 0.004 * side; // ride just proud of the lip surface
      mouth.position.y = 0.001;
      this.headGroup.add(mouth);
    };
    mkMouth(1);
    mkMouth(-1);

    // --- mane: sculpted locks (flattened curved tubes), draped down the
    // +z side of the crest the way a resting pony's mane falls. Controlled
    // motion only — no hair physics.
    const maneMat = new THREE.MeshStandardMaterial({ color: 0xf1e9d8, roughness: 0.68 });
    const maneMat2 = new THREE.MeshStandardMaterial({ color: 0xe3d8c0, roughness: 0.75 });
    const mkLock = (
      from: THREE.Vector3,
      mid: THREE.Vector3,
      to: THREE.Vector3,
      r: number,
      mat: THREE.Material
    ) => {
      const curve = new THREE.CatmullRomCurve3([from, mid, to]);
      const geo = new THREE.TubeGeometry(curve, 10, r, 7);
      // taper the tube toward the tip and flatten it sideways
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const t = Math.floor(i / 8) / 10; // segment fraction (radialSegments+1 = 8)
        const pt = curve.getPoint(Math.min(1, t));
        const k = 0.35 + 0.65 * (1 - t * t); // taper to tip
        p.setX(i, pt.x + (p.getX(i) - pt.x) * k);
        p.setY(i, pt.y + (p.getY(i) - pt.y) * k);
        p.setZ(i, pt.z + (p.getZ(i) - pt.z) * k * 0.6);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      this.headGroup.add(m);
      this.maneCards.push({ m, phase: Math.random() * Math.PI * 2, base: 0 });
      return m;
    };
    // forelock: soft locks falling from behind the horn toward the +z brow
    mkLock(
      new THREE.Vector3(-0.2, 0.112, 0.012),
      new THREE.Vector3(-0.16, 0.105, 0.05),
      new THREE.Vector3(-0.12, 0.07, 0.072),
      0.013,
      maneMat
    );
    mkLock(
      new THREE.Vector3(-0.215, 0.108, -0.018),
      new THREE.Vector3(-0.19, 0.098, -0.05),
      new THREE.Vector3(-0.16, 0.058, -0.072),
      0.011,
      maneMat2
    );
    // crest mane: locks hugging the crest, draping down the +z side of the neck
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const sx = -0.275 - t * 0.16;
      const sy = 0.085 - t * 0.15;
      mkLock(
        new THREE.Vector3(sx, sy, 0.0),
        new THREE.Vector3(sx - 0.012, sy - 0.06, 0.055 + Math.sin(i * 2.1) * 0.006),
        new THREE.Vector3(sx - 0.018 + Math.sin(i) * 0.01, sy - 0.135, 0.075),
        0.013 + (i % 2) * 0.003,
        i % 2 ? maneMat2 : maneMat
      );
    }

    // --- horn anchor on the forehead, forward-up
    this.hornAnchor.position.set(-0.155, 0.094, 0);
    this.hornAnchor.rotation.z = -Math.PI / 2 + 0.31;
    this.headGroup.add(this.hornAnchor);
  }

  private buildNeckAndBody() {
    // neck: capped loft from poll toward the shoulders, curving down-back
    const neckSecs: Section[] = [
      { x: 0.04, w: 0.001, h: 0.001, cy: 0, squash: 2.1, jawFullness: 0.4 },
      { x: 0, w: 0.07, h: 0.095, cy: 0, squash: 2.1, jawFullness: 0.4 },
      { x: -0.12, w: 0.092, h: 0.14, cy: -0.02, squash: 2.2, jawFullness: 0.5 },
      { x: -0.26, w: 0.115, h: 0.185, cy: -0.06, squash: 2.3, jawFullness: 0.6 },
      { x: -0.40, w: 0.145, h: 0.23, cy: -0.13, squash: 2.35, jawFullness: 0.6 },
      { x: -0.54, w: 0.175, h: 0.27, cy: -0.21, squash: 2.4, jawFullness: 0.6 },
      { x: -0.66, w: 0.19, h: 0.30, cy: -0.28, squash: 2.4, jawFullness: 0.6 },
    ];
    const neck = new THREE.Mesh(loft(neckSecs, 30, 28), this.coatMat);
    neck.castShadow = true;
    neck.position.set(-0.26, -0.02, 0);
    neck.rotation.z = 0.55;
    this.headGroup.add(neck);

    // body: resting form on the floor — barrel, haunch, folded legs, tail
    const body = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), this.plainCoatMat);
    barrel.scale.set(1.5, 0.85, 1.0);
    barrel.position.set(0, 0.27, 0);
    barrel.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 16), this.plainCoatMat);
    chest.scale.set(1.1, 0.95, 0.9);
    chest.position.set(0.42, 0.24, 0.02);
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 16), this.plainCoatMat);
    haunch.scale.set(1.15, 0.85, 1);
    haunch.position.set(-0.44, 0.24, 0.02);
    // folded foreleg tucked in front, hoof visible
    const foreleg = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.28, 6, 12), this.plainCoatMat);
    foreleg.rotation.set(0, 0, Math.PI / 2 - 0.08);
    foreleg.position.set(0.44, 0.1, 0.2);
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x7d6d58, roughness: 0.45 });
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.055, 12), hoofMat);
    hoof.rotation.z = Math.PI / 2 - 0.08;
    hoof.position.set(0.62, 0.09, 0.2);
    const tail = (() => {
      const pts = [
        new THREE.Vector3(-0.66, 0.34, -0.02),
        new THREE.Vector3(-0.78, 0.2, 0.05),
        new THREE.Vector3(-0.76, 0.06, 0.12),
        new THREE.Vector3(-0.66, 0.015, 0.18),
      ];
      return new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.05, 10),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.72 })
      );
    })();
    tail.castShadow = true;
    body.add(barrel, chest, haunch, foreleg, hoof, tail);
    body.position.set(-1.06, 0.0, -0.24);
    body.rotation.y = 0.22;
    this.group.add(body);
  }

  /** Point ears / gaze toward a world position (the hint system). weight 0..1 */
  lookAt(target: THREE.Vector3, weight: number) {
    this.lookTarget.copy(target);
    this.lookWeight = weight;
  }

  update(dt: number, time: number) {
    // blink: quick soft squash of both eyes
    this.blinkT -= dt;
    if (this.blinkT <= 0) this.blinkT = 2.6 + Math.random() * 3.5;
    const bl = this.blinkT < 0.13 ? 1 - Math.abs(this.blinkT / 0.065 - 1) : 0;
    const sy = 1 - bl * 0.8;
    this.eyeL.scale.y = sy;
    this.eyeR.scale.y = sy;

    // ears: idle swivel + hint pointing
    const idleL = Math.sin(time * 0.6) * 0.08 + Math.sin(time * 2.3 + 1) * 0.03;
    const idleR = Math.sin(time * 0.5 + 2) * 0.08;
    if (this.lookWeight > 0.01) {
      const local = this.headGroup.worldToLocal(this.lookTarget.clone());
      const yaw = Math.atan2(-local.z, local.x);
      this.earL.rotation.y = THREE.MathUtils.lerp(-0.2, yaw * 0.45, this.lookWeight) + idleL * 0.3;
      this.earR.rotation.y = THREE.MathUtils.lerp(0.2, yaw * 0.45, this.lookWeight) + idleR * 0.3;
      const gy = THREE.MathUtils.clamp(yaw, -0.5, 0.5) * this.lookWeight;
      this.eyeL.rotation.y = gy;
      this.eyeR.rotation.y = -gy;
      this.lookWeight = Math.max(0, this.lookWeight - dt * 0.2);
    } else {
      this.earL.rotation.y = -0.2 + idleL;
      this.earR.rotation.y = 0.2 + idleR;
      this.eyeL.rotation.y *= 0.95;
      this.eyeR.rotation.y *= 0.95;
    }

    // mane: gentle controlled sway, no heavy physics
    for (const c of this.maneCards) {
      c.m.rotation.z = c.base + Math.sin(time * 1.1 + c.phase) * 0.03;
    }
  }
}
