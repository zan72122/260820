/* Wakasagi (pond smelt) — procedural body with a swimming bend done in the
   vertex shader, plus dead-simple, always-forgiving behaviour. */
import * as THREE from 'three';
import { fishSkinTexture } from './textures.js';
import { WATER_Y, LAKE_DEPTH, HOLE_R } from './world.js';

const FISH_LEN = 0.125;

/* girth profile from tail (t=0) to nose (t=1) */
function profile(t) {
  const s = Math.pow(Math.sin(Math.PI * Math.pow(t, 1.5)), 0.7);
  return Math.max(0.13, s);
}

function buildBody(len = FISH_LEN, rings = 22, sides = 12) {
  const hy = len * 0.098, hx = len * 0.046;
  const pos = [], uv = [], idx = [], nor = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = (t - 0.5) * len;
    const p = profile(t);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      // start the ring at the top so v maps cleanly from back to belly
      const cx = Math.sin(a), cy = Math.cos(a);
      pos.push(cx * hx * p, cy * hy * p, z);
      nor.push(cx, cy, 0);
      uv.push(t, (1 - cy) * 0.5);
    }
  }
  const stride = sides + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function finGeometry(pts) {
  const g = new THREE.BufferGeometry();
  const pos = [];
  for (let i = 1; i < pts.length - 1; i++) {
    pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/* Merge a handful of small parts into one mesh — seven fish times a dozen
   little meshes is a lot of draw calls for a phone to push. */
function mergeGeos(list) {
  const pos = [], nor = [];
  for (const { geo, matrix } of list) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
const _m4 = () => new THREE.Matrix4();

let sharedSkin = null;

export function createFish() {
  if (!sharedSkin) sharedSkin = fishSkinTexture(128);
  const grp = new THREE.Group();
  const L = FISH_LEN;

  const mat = new THREE.MeshStandardMaterial({
    map: sharedSkin, roughness: 0.24, metalness: 0.52, color: 0xffffff,
    emissive: 0x6f97b4, emissiveIntensity: 0.16,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0xcfe0ea, roughness: 0.35, metalness: 0.25, transparent: true,
    opacity: 0.72, side: THREE.DoubleSide, emissive: 0x53748c, emissiveIntensity: 0.2,
  });

  const uniforms = {
    uTime: { value: 0 }, uPhase: { value: Math.random() * 6.28 },
    uAmp: { value: 1 }, uRate: { value: 6.0 }, uLen: { value: L },
    uFlash: { value: 0 },
  };
  const bend = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      uniform float uTime, uPhase, uAmp, uRate, uLen;
      ` + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float bt = clamp((-transformed.z / uLen) + 0.5, 0.0, 1.4);
        float w  = pow(bt, 1.7);
        float wave = sin(uTime * uRate + uPhase + bt * 3.4);
        transformed.x += wave * w * uLen * 0.19 * uAmp;
        // a little yaw so the head leads the beat
        transformed.x += sin(uTime * uRate + uPhase) * uLen * 0.02 * uAmp * (1.0 - w);
      `);
    shader.fragmentShader = `
      uniform float uFlash;
      ` + shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.4);
        totalEmissiveRadiance += vec3(0.55, 0.72, 0.85) * rim * (0.45 + uFlash * 2.6);
      `);
  };
  mat.onBeforeCompile = bend;
  mat.customProgramCacheKey = () => 'fishbody';
  finMat.onBeforeCompile = bend;
  finMat.customProgramCacheKey = () => 'fishfin';

  const body = new THREE.Mesh(buildBody(L), mat);
  grp.add(body);

  // --- every fin in one mesh ---------------------------------------
  const tz = -L * 0.5;
  const finParts = [
    { geo: finGeometry([                              // forked caudal
      [0, 0, tz + 0.004],
      [0, L * 0.115, tz - L * 0.20],
      [0, L * 0.035, tz - L * 0.10],
      [0, -L * 0.035, tz - L * 0.10],
      [0, -L * 0.115, tz - L * 0.20],
    ]) },
    { geo: finGeometry([                              // dorsal
      [0, L * 0.085, L * 0.06], [0, L * 0.175, L * 0.0], [0, L * 0.08, -L * 0.06],
    ]) },
    { geo: finGeometry([                              // anal
      [0, -L * 0.075, -L * 0.10], [0, -L * 0.16, -L * 0.16], [0, -L * 0.06, -L * 0.20],
    ]) },
    { geo: finGeometry([                              // adipose (a smelt trait)
      [0, L * 0.06, -L * 0.20], [0, L * 0.105, -L * 0.245], [0, L * 0.05, -L * 0.27],
    ]) },
  ];
  for (const sgn of [-1, 1]) {
    finParts.push({ geo: finGeometry([
      [sgn * L * 0.03, -L * 0.02, L * 0.20],
      [sgn * L * 0.09, -L * 0.07, L * 0.10],
      [sgn * L * 0.03, -L * 0.03, L * 0.11],
    ]) });
  }
  grp.add(new THREE.Mesh(mergeGeos(finParts), finMat));

  // --- eyes and mouth in one mesh ----------------------------------
  const eyeG = new THREE.SphereGeometry(L * 0.036, 10, 8);
  const dark = [];
  for (const sgn of [-1, 1]) {
    dark.push({ geo: eyeG, matrix: _m4().makeTranslation(sgn * L * 0.036, L * 0.028, L * 0.395) });
  }
  dark.push({
    geo: new THREE.BoxGeometry(L * 0.05, L * 0.006, L * 0.03),
    matrix: _m4().makeTranslation(0, -L * 0.012, L * 0.468),
  });
  grp.add(new THREE.Mesh(mergeGeos(dark),
    new THREE.MeshStandardMaterial({ color: 0x161d23, roughness: 0.14, metalness: 0.35 })));

  // --- catchlights --------------------------------------------------
  const hiG = new THREE.SphereGeometry(L * 0.013, 6, 6);
  const hi = [];
  for (const sgn of [-1, 1]) {
    hi.push({ geo: hiG, matrix: _m4().makeTranslation(sgn * L * 0.052, L * 0.042, L * 0.418) });
  }
  grp.add(new THREE.Mesh(mergeGeos(hi), new THREE.MeshBasicMaterial({ color: 0xffffff })));

  grp.traverse(o => { o.frustumCulled = false; });
  grp.userData = { uniforms, L };
  return grp;
}

/* =====================================================================
   Behaviour.  Deliberately eager: a wakasagi in this lake really wants
   to be caught, because a four-year-old should never wait or fail.
   ===================================================================== */
const V = new THREE.Vector3();
const Q = new THREE.Quaternion();
const M = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export class Fish {
  constructor(scene, i) {
    this.obj = createFish();
    this.u = this.obj.userData.uniforms;
    scene.add(this.obj);
    this.i = i;
    this.state = 'wander';
    this.vel = new THREE.Vector3();
    this.speed = 0.16 + Math.random() * 0.14;
    this.target = new THREE.Vector3();
    this.timer = Math.random() * 2;
    this.interest = 0;
    this.roll = 0;
    this.hidden = false;
    this.reset();
  }
  reset() {
    const a = Math.random() * Math.PI * 2;
    const r = 0.45 + Math.random() * 1.35;
    this.obj.position.set(
      Math.cos(a) * r,
      WATER_Y - 0.45 - Math.random() * 1.35,
      Math.sin(a) * r);
    this.pickTarget();
    this.obj.lookAt(this.target);
    this.state = 'wander';
    this.interest = 0;
  }
  pickTarget(near = null) {
    if (near) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.12 + Math.random() * 0.3;
      this.target.set(near.x + Math.cos(a) * r, near.y + (Math.random() - 0.5) * 0.4, near.z + Math.sin(a) * r);
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 1.5;
      this.target.set(Math.cos(a) * r,
        THREE.MathUtils.clamp(WATER_Y - 0.4 - Math.random() * 1.6, LAKE_DEPTH + 0.4, WATER_Y - 0.35),
        Math.sin(a) * r);
    }
    this.timer = 1.4 + Math.random() * 2.4;
  }
  setVisible(v) { this.obj.visible = v; }

  /** lure: Vector3 or null.  jig: 0..1 how much the child is wiggling. */
  update(dt, time, lure, jig) {
    const o = this.obj;
    this.u.uTime.value = time;

    if (this.state === 'hooked') { this.u.uRate.value = 15; this.u.uAmp.value = 1.5; return; }

    this.timer -= dt;
    if (lure && this.state !== 'bite') {
      const d = o.position.distanceTo(lure);
      // curiosity grows with wiggling and with being close by
      this.interest += dt * (0.14 + jig * 1.35) * THREE.MathUtils.clamp(2.6 - d * 0.55, 0.25, 2.6);
      this.interest = Math.min(this.interest, 4);
      if (this.interest > 0.7 + this.i * 0.16) this.state = 'curious';
    } else if (!lure) {
      this.interest = Math.max(0, this.interest - dt * 0.6);
      if (this.state === 'curious') this.state = 'wander';
    }

    if (this.state === 'curious' && lure) {
      if (this.timer <= 0) this.pickTarget(lure);
      // circle in, always ending up close to the rig
      const d = o.position.distanceTo(lure);
      if (d > 0.55) this.target.lerp(lure, 0.045);
      this.speed = THREE.MathUtils.lerp(this.speed, 0.3 + jig * 0.2, dt * 1.4);
    } else if (this.state === 'bite' && lure) {
      this.target.copy(lure);
      this.speed = THREE.MathUtils.lerp(this.speed, 0.5, dt * 3);
    } else {
      if (this.timer <= 0) this.pickTarget();
      this.speed = THREE.MathUtils.lerp(this.speed, 0.15 + (this.i % 3) * 0.03, dt);
    }

    // steer
    V.subVectors(this.target, o.position);
    const dist = V.length();
    if (dist < 0.09) this.timer = 0;
    V.normalize().multiplyScalar(this.speed);
    this.vel.lerp(V, 1 - Math.pow(0.0016, dt));
    o.position.addScaledVector(this.vel, dt);

    // never let one swim up into the ice or down through the bed
    const ceiling = (Math.hypot(o.position.x, o.position.z) < HOLE_R * 0.7)
      ? WATER_Y - 0.06 : WATER_Y - 0.34;
    if (o.position.y > ceiling) { o.position.y = ceiling; this.vel.y *= -0.35; }
    if (o.position.y < LAKE_DEPTH + 0.25) { o.position.y = LAKE_DEPTH + 0.25; this.vel.y *= -0.35; }

    // face the way it is going, with a little banking
    if (this.vel.lengthSq() > 1e-6) {
      V.copy(o.position).add(this.vel);
      M.lookAt(o.position, V, UP);
      Q.setFromRotationMatrix(M);
      o.quaternion.slerp(Q, 1 - Math.pow(0.004, dt));
    }
    const turn = this.vel.x * 0.6;
    this.roll = THREE.MathUtils.lerp(this.roll, THREE.MathUtils.clamp(-turn, -0.5, 0.5), dt * 3);
    o.rotateZ(this.roll * dt * 2.2);

    const sp = this.vel.length();
    this.u.uRate.value = 4.2 + sp * 16;
    this.u.uAmp.value = 0.55 + sp * 1.5;
    this.u.uFlash.value *= Math.max(0, 1 - dt * 3.4);
  }
  flash() { this.u.uFlash.value = 1; }
}
