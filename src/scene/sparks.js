import * as THREE from 'three';
import { EMBER_RAMP } from '../gfx/glsl.js';

// One draw call for every spark on screen.
//
// The important behaviour is not the emitter, it is the *branching*: a
// senko-hanabi spark flies a little way, bursts into three, and each of those
// bursts again. That recursion is what makes the matsuba stage look like pine
// needles instead of a fountain. So the simulation is a small CPU particle
// pool with a branch event, and the GPU only ever sees a flat instance buffer.

const CAPACITY = 2000;

const VERT = /* glsl */ `
attribute vec4 aP;  // xyz = position, w = width
attribute vec4 aV;  // xyz = velocity, w = normalised age
attribute vec2 aX;  // x = seed, y = heat

uniform float uStreak;   // metres of trail per unit width
// Metres of trail per m/s. Tuned to roughly 80ms of travel, because that is
// how long the eye integrates: a sparkler looks like needles, not dots.
uniform float uStretch;

varying vec2 vUv;
varying float vAge;
varying float vSeed;
varying float vHeat;

void main(){
  vUv = uv;
  vAge = aV.w;
  vSeed = aX.x;
  vHeat = aX.y;

  vec4 mv = modelViewMatrix * vec4(aP.xyz, 1.0);
  vec3 mvVel = (modelViewMatrix * vec4(aV.xyz, 0.0)).xyz;

  vec2 d = mvVel.xy;
  float sp = length(d);
  vec2 axis = sp > 1e-6 ? d / sp : vec2(0.0, 1.0);
  vec2 side = vec2(-axis.y, axis.x);

  float width = aP.w;
  float streak = width * uStreak + sp * uStretch;

  // The quad hangs *behind* the particle: the head is the particle itself and
  // the tail is where it has just been, which is what a moving ember looks like.
  vec2 offset = axis * ((uv.y - 1.0) * streak) + side * ((uv.x - 0.5) * width * 2.0);
  mv.xy += offset;

  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${EMBER_RAMP}

uniform float uTime;
uniform float uIntensity;

varying vec2 vUv;
varying float vAge;
varying float vSeed;
varying float vHeat;

void main(){
  float along = vUv.y;                 // 0 tail .. 1 head
  float across = vUv.x * 2.0 - 1.0;

  float radial = 1.0 - across * across;
  if (radial <= 0.0) discard;
  radial = pow(radial, 1.6);

  // The tail thins and dies; the head keeps a hot point.
  float taper = smoothstep(0.0, 0.42, along);
  float head = pow(along, 6.0);

  // Sparks flicker as they tumble, which is why a photograph of one is a
  // dotted line rather than a solid streak.
  float bead = 0.58 + 0.42 * sin(along * (44.0 + vSeed * 30.0) + vSeed * 61.0 - uTime * 47.0);

  float lifeFade = pow(max(0.0, 1.0 - vAge), 0.75);
  float birth = smoothstep(0.0, 0.055, vAge);
  float flash = exp(-vAge * 13.0) * 0.7;

  // The streak is the particle's own recent past, so the tail is older and
  // cooler than the head. Only the head ever gets close to white.
  float temp = vHeat * pow(max(0.0, 1.0 - vAge), 0.6) * mix(0.30, 0.78, along);
  vec3 col = emberRamp(clamp(temp, 0.0, 1.0));

  float a = radial * taper * bead * lifeFade * birth;
  float energy = (a * (1.0 + flash) + head * radial * lifeFade * 0.45) * uIntensity;

  gl_FragColor = vec4(col * energy, 1.0);
}
`;

function quadGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  // x in [0,1] across, y in [0,1] along (1 = head).
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class Sparks {
  constructor() {
    this.capacity = CAPACITY;
    const n = CAPACITY;

    // Simulation state (struct of arrays).
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.size = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.heat = new Float32Array(n);
    this.branchAt = new Float32Array(n);
    this.depth = new Uint8Array(n);
    this.alive = new Uint8Array(n);

    this.free = new Int32Array(n);
    for (let i = 0; i < n; i++) this.free[i] = n - 1 - i;
    this.freeCount = n;
    this.liveCount = 0;
    this.maxLive = 1500;

    // Render buffers.
    this.aP = new Float32Array(n * 4);
    this.aV = new Float32Array(n * 4);
    this.aX = new Float32Array(n * 2);

    const geo = quadGeometry();
    this.attrP = new THREE.InstancedBufferAttribute(this.aP, 4).setUsage(THREE.DynamicDrawUsage);
    this.attrV = new THREE.InstancedBufferAttribute(this.aV, 4).setUsage(THREE.DynamicDrawUsage);
    this.attrX = new THREE.InstancedBufferAttribute(this.aX, 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', this.attrP);
    geo.setAttribute('aV', this.attrV);
    geo.setAttribute('aX', this.attrX);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uStreak: { value: 3.0 },
        uStretch: { value: 0.078 },
        uIntensity: { value: 3.1 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      // The quad is rebuilt in view space from the velocity, so its winding
      // flips with the direction of travel. Half the sparks would be culled.
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.geometry = geo;

    this._emitAcc = 0;
    this.onBirth = null;
    this._birthsThisFrame = 0;
  }

  applyQuality(settings) {
    this.maxLive = settings.maxSparks;
  }

  reset() {
    this.alive.fill(0);
    this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.liveCount = 0;
    this._emitAcc = 0;
    this.geometry.instanceCount = 0;
  }

  _alloc() {
    if (this.freeCount === 0 || this.liveCount >= this.maxLive) return -1;
    const i = this.free[--this.freeCount];
    this.alive[i] = 1;
    this.liveCount++;
    return i;
  }

  _release(i) {
    this.alive[i] = 0;
    this.free[this.freeCount++] = i;
    this.liveCount--;
  }

  // Emit a single spark from the fireball surface.
  spawn(origin, radius, p, carryVel, rand) {
    const i = this._alloc();
    if (i < 0) return -1;

    // Random point/direction on the sphere, then bent toward the phase bias.
    let dx = rand() * 2 - 1;
    let dy = rand() * 2 - 1;
    let dz = rand() * 2 - 1;
    let len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;

    const bias = p.upBias;
    if (bias !== 0) {
      const b = Math.min(1, Math.abs(bias));
      const target = bias > 0 ? Math.abs(dy) : -Math.abs(dy);
      dy = dy * (1 - b) + target * b;
      len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
    }
    // Keep sparks mostly in the plane facing the camera so they read on a phone,
    // without flattening them into a decal.
    dz *= 0.62;

    const speed = p.speed * (1 - p.speedVar * 0.5 + rand() * p.speedVar);
    this.px[i] = origin.x + dx * radius * 0.92;
    this.py[i] = origin.y + dy * radius * 0.92;
    this.pz[i] = origin.z + dz * radius * 0.92;
    this.vx[i] = dx * speed + carryVel.x;
    this.vy[i] = dy * speed + carryVel.y;
    this.vz[i] = dz * speed + carryVel.z;
    this.age[i] = 0;
    this.life[i] = p.life * (0.72 + rand() * 0.56);
    this.size[i] = p.size * (0.75 + rand() * 0.6);
    this.seed[i] = rand();
    this.heat[i] = 0.92 + rand() * 0.08;
    this.depth[i] = 0;
    this.branchAt[i] = p.branchDelay * (0.65 + rand() * 0.7);
    this._birthsThisFrame++;
    return i;
  }

  _split(parent, p, rand) {
    const n = p.branchCount | 0;
    if (n <= 0) return;
    const vx = this.vx[parent];
    const vy = this.vy[parent];
    const vz = this.vz[parent];
    const sp = Math.hypot(vx, vy, vz);
    if (sp < 1e-5) return;
    const ux = vx / sp;
    const uy = vy / sp;
    const uz = vz / sp;
    // Build a basis around the parent's direction.
    const ax = Math.abs(ux) < 0.8 ? 1 : 0;
    const ay = Math.abs(ux) < 0.8 ? 0 : 1;
    const az = 0;
    let bx = uy * az - uz * ay;
    let by = uz * ax - ux * az;
    let bz = ux * ay - uy * ax;
    const bl = Math.hypot(bx, by, bz) || 1;
    bx /= bl;
    by /= bl;
    bz /= bl;
    const cx = uy * bz - uz * by;
    const cy = uz * bx - ux * bz;
    const cz = ux * by - uy * bx;

    const baseAngle = rand() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const c = this._alloc();
      if (c < 0) return;
      const ang = baseAngle + (k / n) * Math.PI * 2 + (rand() - 0.5) * 0.8;
      const spread = p.branchSpread * (0.5 + rand() * 0.9);
      const sx = Math.cos(ang) * Math.sin(spread);
      const sy = Math.sin(ang) * Math.sin(spread);
      const cosS = Math.cos(spread);
      const dx = ux * cosS + bx * sx + cx * sy;
      const dy = uy * cosS + by * sx + cy * sy;
      const dz = uz * cosS + bz * sx + cz * sy;
      const childSpeed = sp * p.branchKeep * (0.8 + rand() * 0.5);
      this.px[c] = this.px[parent];
      this.py[c] = this.py[parent];
      this.pz[c] = this.pz[parent];
      this.vx[c] = dx * childSpeed;
      this.vy[c] = dy * childSpeed;
      this.vz[c] = dz * childSpeed;
      this.age[c] = 0;
      this.life[c] = this.life[parent] * (0.55 + rand() * 0.35);
      this.size[c] = this.size[parent] * (0.72 + rand() * 0.2);
      this.seed[c] = rand();
      this.heat[c] = this.heat[parent] * 0.93;
      this.depth[c] = this.depth[parent] + 1;
      this.branchAt[c] = p.branchDelay * (0.6 + rand() * 0.8);
    }
    this._release(parent);
  }

  // dt: seconds. p: sampled timeline params. wind: extra acceleration (m/s^2).
  update(dt, p, origin, emberRadius, carryVel, wind, rateScale, rand) {
    this._birthsThisFrame = 0;
    const gx = wind.x;
    const gy = -p.gravity + wind.y;
    const gz = wind.z;
    const dragK = Math.exp(-p.drag * dt);
    const maxDepth = p.maxDepth | 0;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;
      const a = (this.age[i] += dt);
      if (a >= this.life[i]) {
        this._release(i);
        continue;
      }
      let vx = this.vx[i];
      let vy = this.vy[i];
      let vz = this.vz[i];
      vx = (vx + gx * dt) * dragK;
      vy = (vy + gy * dt) * dragK;
      vz = (vz + gz * dt) * dragK;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.vz[i] = vz;
      this.px[i] += vx * dt;
      this.py[i] += vy * dt;
      this.pz[i] += vz * dt;

      if (this.depth[i] < maxDepth && a >= this.branchAt[i]) {
        this._split(i, p, rand);
      }
    }

    // Emission. A fractional accumulator, so a rate of half a spark per second
    // still produces the single startling first one rather than nothing at all.
    //
    // Quality scaling deliberately does not touch the first couple of sparks per
    // second. Shedding load must never delay the beat where one spark leaves the
    // bead for the first time -- that beat is the game.
    const FREE = 2.0;
    const rate = p.rate <= FREE ? p.rate : FREE + (p.rate - FREE) * rateScale;
    this._emitAcc += rate * dt;
    let budget = Math.min(48, Math.floor(this._emitAcc));
    this._emitAcc -= budget;
    while (budget-- > 0) {
      if (this.spawn(origin, emberRadius, p, carryVel, rand) < 0) break;
    }

    if (this._birthsThisFrame > 0 && this.onBirth) {
      this.onBirth(this._birthsThisFrame, dt);
    }
    this._writeBuffers();
  }

  burst(origin, radius, p, carryVel, rand, count, speedMul = 1.6) {
    for (let k = 0; k < count; k++) {
      const i = this.spawn(origin, radius, p, carryVel, rand);
      if (i < 0) break;
      this.vx[i] *= speedMul;
      this.vy[i] *= speedMul;
      this.vz[i] *= speedMul;
    }
  }

  _writeBuffers() {
    const P = this.aP;
    const V = this.aV;
    const X = this.aX;
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;
      const o4 = n * 4;
      const o2 = n * 2;
      P[o4] = this.px[i];
      P[o4 + 1] = this.py[i];
      P[o4 + 2] = this.pz[i];
      P[o4 + 3] = this.size[i];
      V[o4] = this.vx[i];
      V[o4 + 1] = this.vy[i];
      V[o4 + 2] = this.vz[i];
      V[o4 + 3] = this.age[i] / this.life[i];
      X[o2] = this.seed[i];
      X[o2 + 1] = this.heat[i];
      n++;
    }
    this.geometry.instanceCount = n;
    if (n > 0) {
      this.attrP.addUpdateRange(0, n * 4);
      this.attrV.addUpdateRange(0, n * 4);
      this.attrX.addUpdateRange(0, n * 2);
      this.attrP.needsUpdate = true;
      this.attrV.needsUpdate = true;
      this.attrX.needsUpdate = true;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
