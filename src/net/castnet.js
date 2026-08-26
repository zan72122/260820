import * as THREE from '../../vendor/three.module.js';
import { SUN_DIR, PALETTE, depthAt, seabedY } from '../world/env.js';
import { clamp, lerp, smoothstep, easeOutCubic } from '../util/math.js';
import { valueNoise2 } from '../util/rng.js';

const _n0 = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _qRoll = new THREE.Quaternion();

/**
 * The cast net.
 *
 * This is not a cloth solver. It is a *choreographed* shape — folded bundle,
 * opening flower, flat disc, sinking cone, closing purse — with a verlet layer
 * on top so the twine lags, swings and settles like something with weight.
 * The choreography guarantees the bloom always reads; the verlet layer
 * guarantees it never looks like an animation curve.
 */
export class CastNet {
  constructor({ netTex, quality, rng, heights, onSplash, onDrip, onSpray }) {
    this.rings = quality.netRings;
    this.segs = quality.netSegs;
    this.rng = rng;
    this.heights = heights;
    this.onSplash = onSplash;
    this.onDrip = onDrip;
    this.onSpray = onSpray;

    this.radius = 1.55;          // fully open radius, metres
    this.openness = 0;
    this.coneK = 0;
    this.spin = 0;
    this.spinRate = 0;
    this.wetness = 0;
    this.center = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.tiltQuat = new THREE.Quaternion();
    this.gather = 1;             // 1 = bundled in the hand, 0 = fully spread

    // Per-cast character.
    this.petalCount = 5;
    this.petalAmp = 0.05;
    this.petalPhase = 0;
    this.wobble = 0.0;
    this.seedOffset = 0;

    this.phase = 'folded';
    this.phaseT = 0;

    this._buildGeometry(netTex);
    this._buildWeights();
    this._buildBrails();

    this.rimWorld = new THREE.Vector3();
    this.lowestRimY = 0;
    this.openRadiusNow = 0;
  }

  // -------------------------------------------------------------- geometry

  _buildGeometry(netTex) {
    const R = this.rings, S = this.segs;
    const n = (R + 1) * S;
    this.count = n;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const idx = [];

    const tile = 0.95;   // metres per texture repeat: a coarse ~9 cm mesh, so the
                         // knots stay legible on a phone instead of aliasing to grey
    for (let i = 0; i <= R; i++) {
      const rr = (i / R) * this.radius;
      for (let j = 0; j < S; j++) {
        const a = (j / S) * Math.PI * 2;
        const k = i * S + j;
        uv[k * 2] = (Math.cos(a) * rr) / tile;
        uv[k * 2 + 1] = (Math.sin(a) * rr) / tile;
        nor[k * 3 + 1] = 1;
      }
    }
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < S; j++) {
        const j2 = (j + 1) % S;
        const a = i * S + j, b = i * S + j2, c = (i + 1) * S + j, d = (i + 1) * S + j2;
        idx.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: netTex },
        uWet: { value: 0 },
        uSunDir: { value: SUN_DIR },
        uSunColor: { value: PALETTE.sunColor },
        uSky: { value: PALETTE.skyHorizon },
        uShallow: { value: PALETTE.waterShallow },
        uDeep: { value: PALETTE.waterDeep }
      },
      vertexShader: /* glsl */`
        precision highp float;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){
          vUv = uv; vN = normalize(normal); vW = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        uniform sampler2D uMap;
        uniform float uWet;
        uniform vec3 uSunDir, uSunColor, uSky, uShallow, uDeep;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          // Alpha is coverage, not a cut-off. Minified mips average the holes in,
          // which is exactly how a real net dissolves into a gauze at distance.
          float a = clamp(t.a * mix(1.05, 1.35, uWet), 0.0, 1.0);
          if (a < 0.012) discard;

          vec3 dryCol = vec3(0.80, 0.72, 0.55);
          vec3 wetCol = vec3(0.115, 0.088, 0.062);
          vec3 base = t.rgb * mix(dryCol, wetCol, uWet);

          vec3 V = normalize(cameraPosition - vW);
          vec3 N = normalize(vN);
          if (dot(N, V) < 0.0) N = -N;                 // twine has no inside
          float lam = max(dot(N, uSunDir), 0.0);
          vec3 col = base * (0.30 + lam * 0.85);
          col += base * uSky * 0.28;

          // Light coming through the mesh from behind — the reason a wet net glows.
          float through = pow(max(dot(-V, uSunDir), 0.0), 2.2);
          col += base * uSunColor * through * mix(0.13, 0.26, uWet);

          vec3 H = normalize(uSunDir + V);
          float shin = pow(max(dot(N, H), 0.0), mix(16.0, 96.0, uWet));
          col += uSunColor * shin * mix(0.035, 0.42, uWet);

          // Wet twine must never out-shine the sky behind it.
          col = min(col, vec3(0.92));

          // Below the surface the water eats contrast, long before the water
          // plane in front of it gets a say.
          float sub = max(0.0, -vW.y);
          if (sub > 0.0) {
            vec3 tint = mix(uShallow, uDeep, clamp(sub / 2.6, 0.0, 1.0)) * 0.85;
            col = mix(col, tint, clamp(1.0 - exp(-sub * 0.62), 0.0, 0.80));
          }

          gl_FragColor = vec4(col, a * mix(0.94, 1.0, uWet));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });

    // The horn: a whipped collar at the centre where the hand line is made fast.
    // Without it the rope appears to end in the middle of nothing.
    const hornGeo = new THREE.CylinderGeometry(0.024, 0.040, 0.065, 9, 1);
    this.horn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({
      color: 0xc0a878, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.12
    }));
    this.horn.frustumCulled = false;
    this.horn.renderOrder = 4;

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.geo = geo;
    this.pos = pos;
    this.nor = nor;

    // Verlet state
    this.p = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.target = new Float32Array(n * 3);
    this.jit = new Float32Array(n * 3);
    for (let i = 0; i <= R; i++) {
      for (let j = 0; j < S; j++) {
        const k = i * S + j;
        this.jit[k * 3] = valueNoise2(i * 1.7, j * 0.9) - 0.5;
        this.jit[k * 3 + 1] = valueNoise2(i * 2.3 + 40, j * 1.3) - 0.5;
        this.jit[k * 3 + 2] = valueNoise2(i * 0.8, j * 2.1 + 70) - 0.5;
      }
    }
  }

  _buildWeights() {
    const step = Math.max(1, Math.round(this.segs / 28));
    this.weightSlots = [];
    this.weightVar = [];
    for (let j = 0; j < this.segs; j += step) {
      this.weightSlots.push(this.rings * this.segs + j);
      // Hand-crimped lead: each one a slightly different lump, hung its own way.
      this.weightVar.push({
        s: 0.78 + valueNoise2(j * 1.7, 3.1) * 0.55,
        f: 0.80 + valueNoise2(j * 0.9, 7.7) * 0.45,
        roll: valueNoise2(j * 2.3, 1.9) * Math.PI * 2
      });
    }
    const geo = new THREE.SphereGeometry(0.0155, 6, 4);
    geo.scale(1, 1.5, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8b8983, roughness: 0.5, metalness: 0.5, envMapIntensity: 1.0
    });
    this.weights = new THREE.InstancedMesh(geo, mat, this.weightSlots.length);
    this.weights.frustumCulled = false;
    this.weights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weights.renderOrder = 4;
    this._wm = new THREE.Matrix4();
    this._wq = new THREE.Quaternion();
    this._ws = new THREE.Vector3(1, 1, 1);
    this._wt = new THREE.Vector3();
  }

  /** Hauling lines from the hand-line junction down to the lead line. */
  _buildBrails() {
    this.brailCount = 8;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(this.brailCount * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.brailMat = new THREE.LineBasicMaterial({
      color: 0xd8c9a4, transparent: true, opacity: 0.0, depthWrite: false
    });
    this.brails = new THREE.LineSegments(geo, this.brailMat);
    this.brails.frustumCulled = false;
    this.brails.renderOrder = 4;
    this._brailArr = arr;
  }

  // ----------------------------------------------------------------- state

  /** Bundle the net back into the caster's hand. */
  foldAt(handPos) {
    this.phase = 'folded';
    this.phaseT = 0;
    this.openness = 0;
    this.coneK = 0;
    this.gather = 1;
    this.spin = 0;
    this.spinRate = 0;
    this.center.copy(handPos);
    this.quat.identity();
    this.tiltQuat.identity();
    this._writeTargets();
    for (let i = 0; i < this.count * 3; i++) { this.p[i] = this.target[i]; this.prev[i] = this.target[i]; }
    this._commit();
  }

  /** A poke at the bundle: it shifts and resettles, like anything with mass. */
  nudge(strength = 1) {
    const n = this.count;
    for (let k = 0; k < n; k++) {
      const k3 = k * 3;
      this.prev[k3] -= this.jit[k3] * 0.03 * strength;
      this.prev[k3 + 1] -= (0.020 + Math.abs(this.jit[k3 + 1]) * 0.03) * strength;
      this.prev[k3 + 2] -= this.jit[k3 + 2] * 0.03 * strength;
    }
  }

  /**
   * One swipe becomes one cast. Nothing here can fail: every input produces a
   * bloom, and the differences land as character rather than as error.
   */
  launch(params, handPos) {
    const { distance, azimuth, sharpness, smoothness, wobble } = params;
    this.phase = 'lift';
    this.phaseT = 0;
    this.handPos = handPos.clone();
    this.center.copy(handPos);

    const tx = Math.sin(azimuth) * distance;
    const tz = -Math.cos(azimuth) * distance;
    this.landing = new THREE.Vector3(tx, 0, tz);
    this.launchFrom = handPos.clone();

    this.flightTime = clamp(0.62 + distance * 0.052, 0.72, 1.35);
    this.apex = lerp(1.15, 2.5, clamp(distance / 15, 0, 1)) * lerp(1.15, 0.85, sharpness);

    // Character of this particular flower.
    const r = this.rng;
    this.petalCount = 4 + Math.floor(r.next() * 4);
    this.petalAmp = lerp(0.012, 0.115, clamp(wobble, 0, 1)) + (1 - smoothness) * 0.04;
    this.petalPhase = r.range(0, Math.PI * 2);
    this.wobbleAmp = lerp(0.01, 0.10, clamp(wobble, 0, 1));
    this.seedOffset = r.range(0, 100);
    this.openRadius = this.radius * lerp(0.86, 1.06, sharpness) * lerp(1.0, 0.93, wobble);
    this.spinRate = lerp(3.4, 7.4, sharpness) * (r.next() < 0.5 ? 1 : -1);
    this.spinDir = Math.sign(this.spinRate);

    // Landing attitude: a swipe that wandered puts the net down at an angle.
    const tiltAxis = new THREE.Vector3(Math.cos(azimuth + r.range(-1, 1)), 0, Math.sin(azimuth + r.range(-1, 1))).normalize();
    const tiltAngle = lerp(0.02, 0.26, wobble) + (1 - smoothness) * 0.10;
    this.tiltQuat.setFromAxisAngle(tiltAxis, tiltAngle);
    this.landTilt = tiltAngle;

    // The net leaves the hand on edge and turns flat only as it arrives.
    // Through the middle of the flight its face is turned back at the thrower,
    // which is the whole reason the opening reads as a circle and not a line.
    const cast = new THREE.Vector3(Math.sin(azimuth), 0, -Math.cos(azimuth));
    this.faceStart = cast.clone().multiplyScalar(-0.74).add(new THREE.Vector3(0, 0.67, 0)).normalize();
    this.faceEnd = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tiltQuat);

    this.castStats = {
      distance, azimuth, sharpness, smoothness, wobble,
      petals: this.petalCount, petalAmp: this.petalAmp, tilt: tiltAngle,
      radius: this.openRadius
    };
    return this.castStats;
  }

  get isAirborne() { return this.phase === 'lift' || this.phase === 'fly'; }
  get isSubmerged() { return this.phase === 'sink' || this.phase === 'settled'; }

  // ---------------------------------------------------------------- update

  update(dt, t, ctx) {
    this.phaseT += dt;
    const H = this.heights;

    switch (this.phase) {
      case 'folded': {
        // Breathing: wind lifting the edge of a dry net, weight of a wet one.
        this.gather = 1;
        this.openness = 0;
        this.closeK = 0;
        this.center.copy(ctx.restPos);
        break;
      }
      case 'lift': {
        // The hand rises before anything else moves. Cause, then effect.
        const u = clamp(this.phaseT / 0.20, 0, 1);
        this.center.copy(this.launchFrom).addScaledVector(ctx.liftDir, easeOutCubic(u) * 0.42);
        this.center.y += easeOutCubic(u) * 0.30;
        this.gather = 1 - u * 0.18;
        this.spin += this.spinRate * 0.35 * dt;
        if (u >= 1) { this.phase = 'fly'; this.phaseT = 0; this.flightFrom = this.center.clone(); }
        break;
      }
      case 'fly': {
        const T = this.flightTime;
        const u = clamp(this.phaseT / T, 0, 1);
        const uh = 1 - Math.pow(1 - u, 1.55);            // air drag on the horizontal
        this.center.x = lerp(this.flightFrom.x, this.landing.x, uh);
        this.center.z = lerp(this.flightFrom.z, this.landing.z, uh);
        const surfaceY = H.heightAt(this.center.x, this.center.z);
        this.center.y = lerp(this.flightFrom.y, surfaceY, uh) + Math.sin(u * Math.PI) * this.apex;

        // The bloom: fast open with a touch of overshoot, then it breathes back.
        const o = smoothstep(0.05, 0.62, u);
        this.openness = o * (1 + 0.10 * Math.sin(clamp((u - 0.35) / 0.5, 0, 1) * Math.PI));
        // Deepest just after it opens, flattening out as it slows into the water.
        this.billow = 0.42 * smoothstep(0.10, 0.45, u) * (1 - smoothstep(0.58, 1.0, u));
        this.gather = 1 - smoothstep(0.02, 0.45, u);
        this.billow = this.billow || 0;
        this.spin += this.spinRate * (1 - u * 0.45) * dt;
        this._faceTowards(smoothstep(0.34, 1.0, u));

        if (u >= 1) this._touchdown(ctx);
        break;
      }
      case 'splash': {
        this.billow = Math.max(0, (this.billow || 0) - dt * 2.2);
        this._faceTowards(1);
        this.openness = 1;
        this.gather = 0;
        this.spin += this.spinRate * 0.10 * dt;
        // Ride just proud of the surface so the ring is not lost inside the water plane.
        this.center.y = H.heightAt(this.center.x, this.center.z) + 0.035;
        this.wetness = Math.min(1, this.wetness + dt * 3.4);
        if (this.phaseT > 0.42) { this.phase = 'sink'; this.phaseT = 0; }
        break;
      }
      case 'sink': {
        // Lead line leads. In the shallow it can only fall so far, so the net
        // stays a wide circle; over the blue it draws itself into a cone.
        const depth = depthAt(this.center.x, this.center.z);
        this.maxCone = Math.asin(clamp((depth - 0.10) / this.openRadius, 0.0, 0.78));
        const u = clamp(this.phaseT / 1.65, 0, 1);
        this.coneK = easeOutCubic(u);
        this.center.y = H.heightAt(this.center.x, this.center.z) + 0.03 - u * 0.11;
        this.openness = 1;
        this.wetness = Math.min(1, this.wetness + dt * 1.9);
        if (u >= 1) { this.phase = 'settled'; this.phaseT = 0; }
        break;
      }
      case 'settled': {
        this.center.y = H.heightAt(this.center.x, this.center.z) - 0.08;
        this.coneK = 1;
        this.wetness = Math.min(1, this.wetness + dt * 0.6);
        break;
      }
      case 'haul': {
        const T = 1.55;
        const u = clamp(this.phaseT / T, 0, 1);
        const e = easeOutCubic(u);
        this.haulU = u;
        // Purse first, then lift: the rim closes before the bag leaves the water.
        this.closeK = smoothstep(0.06, 0.62, u);
        // The bag rounds out as the cone is drawn shut.
        this.coneK = lerp(this.coneK, 0.45, Math.min(1, dt * 2.2));
        // Lift it clear of the water at the pier edge, so it pours into the sea
        // rather than onto the boards.
        _tmpA.copy(ctx.handPos).addScaledVector(ctx.liftDir, 2.4);
        _tmpA.y += 0.98;
        this.center.lerpVectors(this.haulFrom, _tmpA, e * e * 0.94 + e * 0.06);
        this.center.y = lerp(this.haulFrom.y, _tmpA.y, smoothstep(0.15, 1.0, u));
        this.openness = 1 - smoothstep(0.55, 1.0, u) * 0.25;
        this._maybeDrip(dt, u);
        if (u >= 1) { this.phase = 'landed'; this.phaseT = 0; this.landFrom = this.center.clone(); }
        break;
      }
      case 'landed': {
        // Lowered onto the planks, where it slumps back into a heap.
        const u = clamp(this.phaseT / 1.15, 0, 1);
        this.center.lerpVectors(this.landFrom, ctx.restPos, easeOutCubic(u));
        this.gather = Math.min(1, this.gather + dt * 1.5);
        this.closeK = 1 - u;
        this.coneK = lerp(this.coneK, 0, Math.min(1, dt * 2.5));
        this._maybeDrip(dt, 1);
        if (u >= 1) { this.phase = 'folded'; this.phaseT = 0; }
        break;
      }
    }

    if (this.phase === 'folded' || this.phase === 'landed') {
      this.wetness = Math.max(0, this.wetness - dt * 0.045);
    }
    this.material.uniforms.uWet.value = this.wetness;
    this.brailMat.opacity = (this.phase === 'haul' || this.phase === 'landed')
      ? 0.55 * clamp(this.closeK ?? 0, 0, 1) : (this.phase === 'settled' || this.phase === 'sink' ? 0.22 : 0);

    this._writeTargets(t);
    this._integrate(dt, t);
    this._commit();
    this._updateWeights();
    this._updateBrails();
  }

  /** Aim the net's own plane: t = 0 facing the caster, t = 1 lying on the water. */
  _faceTowards(t) {
    if (!this.faceStart) return;
    _n0.copy(this.faceStart).lerp(this.faceEnd, clamp(t, 0, 1)).normalize();
    this.quat.setFromUnitVectors(_upAxis, _n0);
  }

  _touchdown(ctx) {
    this.phase = 'splash';
    this.phaseT = 0;
    this.openness = 1;
    this.gather = 0;
    this.coneK = 0;
    this.center.y = this.heights.heightAt(this.center.x, this.center.z) + 0.035;
    this.wetness = Math.max(this.wetness, 0.62);   // it is wet the instant it lands
    const r = this.openRadius;
    if (this.onSplash) this.onSplash(this.center.x, this.center.z, 1.0);
    if (this.onSpray) this.onSpray(this.center.clone(), r, this.castStats);
    if (ctx.onTouchdown) ctx.onTouchdown(this.center.clone(), r, this.castStats);
  }

  beginHaul() {
    if (this.phase !== 'sink' && this.phase !== 'settled' && this.phase !== 'splash') return false;
    this.phase = 'haul';
    this.phaseT = 0;
    this.haulFrom = this.center.clone();
    this.closeK = 0;
    return true;
  }

  _maybeDrip(dt, u) {
    if (!this.onDrip || this.wetness < 0.15) return;
    this.dripAcc = (this.dripAcc || 0) + dt * (26 + 60 * (1 - u)) * this.wetness;
    while (this.dripAcc > 1) {
      this.dripAcc -= 1;
      const k = this.weightSlots[(Math.random() * this.weightSlots.length) | 0];
      const x = this.p[k * 3], y = this.p[k * 3 + 1], z = this.p[k * 3 + 2];
      if (y > this.heights.heightAt(x, z) + 0.03) this.onDrip(x, y, z);
    }
  }

  // ---------------------------------------------------------------- shapes

  _writeTargets(t = 0) {
    const R = this.rings, S = this.segs;
    const T = this.target;
    const openR = this.openRadius || this.radius;
    const cone = (this.maxCone ?? 0.7) * (this.coneK || 0);
    const closeK = clamp(this.closeK ?? 0, 0, 1);
    const gather = clamp(this.gather, 0, 1);
    const open = clamp(this.openness, 0, 1.15);

    const cq = this.quat;
    const cx = this.center.x, cy = this.center.y, cz = this.center.z;

    const cosC = Math.cos(cone), sinC = Math.sin(cone);
    // Hauling pulls the lead line under the bag.
    const purseR = lerp(1.0, 0.38, closeK);
    const purseY = lerp(0.0, -0.26, closeK);

    for (let i = 0; i <= R; i++) {
      const fr = i / R;
      for (let j = 0; j < S; j++) {
        const k = i * S + j;
        const a = (j / S) * Math.PI * 2 + this.spin;

        // --- spread shape (flying / floating / sinking / pursing)
        let petal = 1
          + this.petalAmp * fr * Math.sin(this.petalCount * a + this.petalPhase)
          + (this.wobbleAmp || 0) * fr * (valueNoise2(j * 0.31 + this.seedOffset, i * 0.17) - 0.5) * 2;
        const slant = openR * fr * petal * purseR;
        let ox = Math.cos(a) * slant * cosC;
        let oz = Math.sin(a) * slant * cosC;
        let oy = -slant * sinC + purseY * fr * openR;

        // Fine drape: the twine between the lead weights swags a little.
        const swag = Math.sin(j * (S / this.weightSlots.length) * 0.5) * 0.012 * fr;
        oy += swag;

        // Billow: through the air the lead line trails the centre, so the net
        // is a shallow dish. This is what stops the bloom reading as a decal.
        oy += (this.billow || 0) * fr * fr * openR;

        // --- half-folded heap lying on the planks
        // Loose concentric folds, squashed toward the water, piled at the centre.
        // Deliberately not harmonic: three even lobes would read as a flower.
        const fold = 0.26 * Math.sin(a * 2.0 + this.seedOffset)
          + 0.17 * Math.sin(a * 3.7 + 2.1)
          + 0.11 * Math.sin(a * 6.3 - 0.7)
          + 0.34 * (valueNoise2(a * 1.9 + this.seedOffset, 4.2) - 0.5)
          + 0.16 * this.jit[k * 3 + 1];
        // A soaked net slumps: wider footprint, lower pile, softer folds.
        const heavy = this.wetness;
        const rr2 = openR * (0.055 + (0.225 + heavy * 0.070) * fr) * (1 + fold * fr * (1 - heavy * 0.30));
        const bx = Math.cos(a) * rr2 + this.jit[k * 3] * 0.045;
        const bz = Math.sin(a) * rr2 * 0.78 + this.jit[k * 3 + 2] * 0.045;
        // Wind lifting the edge: a slow travelling ruffle, killed by wetness.
        const ruffle = Math.sin(t * 0.85 + a * 3.0) * Math.sin(t * 0.37 + a * 1.0);
        const by = (0.27 - heavy * 0.13) * (1 - fr) * (1 - fr) - 0.015
          + Math.abs(this.jit[k * 3 + 1]) * (0.13 - heavy * 0.06) * fr
          + Math.max(0, Math.sin(a * 3.0 + this.seedOffset)) * 0.075 * fr * (1 - fr) * (1 - heavy * 0.5)
          + ruffle * 0.06 * fr * fr * (1 - heavy * 0.85);

        const g = gather * (1 - open * 0.85);
        ox = lerp(ox, bx, g); oy = lerp(oy, by, g); oz = lerp(oz, bz, g);

        // Rotate into the net's own plane, then place it in the world.
        const qx = cq.x, qy = cq.y, qz = cq.z, qw = cq.w;
        const tx = 2 * (qy * oz - qz * oy);
        const ty = 2 * (qz * ox - qx * oz);
        const tz = 2 * (qx * oy - qy * ox);
        T[k * 3] = cx + ox + qw * tx + (qy * tz - qz * ty);
        T[k * 3 + 1] = cy + oy + qw * ty + (qz * tx - qx * tz);
        T[k * 3 + 2] = cz + oz + qw * tz + (qx * ty - qy * tx);
      }
    }
  }

  _integrate(dt, t) {
    const n = this.count;
    const p = this.p, prev = this.prev, T = this.target;
    const H = this.heights;
    const S = this.segs, R = this.rings;

    // How hard the twine is held to its choreographed place.
    const attract = {
      folded: 0.34, lift: 0.40, fly: 0.36, splash: 0.42,
      sink: 0.20, settled: 0.17, haul: 0.30, landed: 0.36
    }[this.phase] ?? 0.3;
    const drag = this.phase === 'sink' || this.phase === 'settled' ? 0.80 : 0.90;
    const grav = this.isAirborne ? -3.4 : -1.1;
    const heavy = 1 + this.wetness * 0.9;      // a soaked net answers slower

    for (let i = 0; i <= R; i++) {
      const rim = i === R;
      const kAtt = attract * (rim ? 0.78 : 1.0) / heavy;
      for (let j = 0; j < S; j++) {
        const k = i * S + j, k3 = k * 3;
        let vx = (p[k3] - prev[k3]) * drag;
        let vy = (p[k3 + 1] - prev[k3 + 1]) * drag;
        let vz = (p[k3 + 2] - prev[k3 + 2]) * drag;

        vy += grav * dt * dt * (rim ? 2.1 : 1.0) * 6.0;

        let nx = p[k3] + vx, ny = p[k3 + 1] + vy, nz = p[k3 + 2] + vz;
        nx += (T[k3] - nx) * kAtt;
        ny += (T[k3 + 1] - ny) * kAtt;
        nz += (T[k3 + 2] - nz) * kAtt;

        // Water: heavy damping below the surface, and the bed stops the leads.
        const surf = H.heightAt(nx, nz);
        if (ny < surf) {
          const sub = clamp((surf - ny) * 3.0, 0, 1);
          const wd = lerp(1, 0.55, sub);
          nx = p[k3] + (nx - p[k3]) * wd;
          nz = p[k3 + 2] + (nz - p[k3 + 2]) * wd;
          ny = p[k3 + 1] + (ny - p[k3 + 1]) * lerp(1, 0.62, sub);
          const bed = seabedY(nx, nz) + 0.02;
          if (ny < bed) ny = bed;
        }

        prev[k3] = p[k3]; prev[k3 + 1] = p[k3 + 1]; prev[k3 + 2] = p[k3 + 2];
        p[k3] = nx; p[k3 + 1] = ny; p[k3 + 2] = nz;
      }
    }

    // Two relaxation passes keep the twine from stretching into a smear.
    const iters = this.phase === 'fly' ? 1 : 2;
    for (let it = 0; it < iters; it++) {
      this._relaxHoop();
      this._relaxRadial();
    }
    void t; void n;
  }

  _relaxHoop() {
    const S = this.segs, R = this.rings, p = this.p, T = this.target;
    for (let i = 1; i <= R; i++) {
      for (let j = 0; j < S; j++) {
        const j2 = (j + 1) % S;
        const a = (i * S + j) * 3, b = (i * S + j2) * 3;
        const rest = Math.hypot(T[a] - T[b], T[a + 1] - T[b + 1], T[a + 2] - T[b + 2]);
        this._satisfy(a, b, rest, 0.5);
      }
    }
  }

  _relaxRadial() {
    const S = this.segs, R = this.rings, p = this.p, T = this.target;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < S; j++) {
        const a = (i * S + j) * 3, b = ((i + 1) * S + j) * 3;
        const rest = Math.hypot(T[a] - T[b], T[a + 1] - T[b + 1], T[a + 2] - T[b + 2]);
        this._satisfy(a, b, rest, 0.5);
      }
    }
    void p;
  }

  _satisfy(a, b, rest, k) {
    const p = this.p;
    const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return;
    const diff = ((d - rest) / d) * 0.5 * k;
    const mx = dx * diff, my = dy * diff, mz = dz * diff;
    p[a] += mx; p[a + 1] += my; p[a + 2] += mz;
    p[b] -= mx; p[b + 1] -= my; p[b + 2] -= mz;
  }

  _commit() {
    const S = this.segs, R = this.rings, p = this.p, pos = this.pos, nor = this.nor;
    pos.set(p);

    // Normals straight from the polar neighbourhood: cheaper and smoother than
    // rebuilding from triangles every frame.
    for (let i = 0; i <= R; i++) {
      const ip = Math.max(0, i - 1), inx = Math.min(R, i + 1);
      for (let j = 0; j < S; j++) {
        const jp = (j + S - 1) % S, jn = (j + 1) % S;
        const a = (inx * S + j) * 3, b = (ip * S + j) * 3;
        const c = (i * S + jn) * 3, d = (i * S + jp) * 3;
        const ux = p[a] - p[b], uy = p[a + 1] - p[b + 1], uz = p[a + 2] - p[b + 2];
        const wx = p[c] - p[d], wy = p[c + 1] - p[d + 1], wz = p[c + 2] - p[d + 2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const l = Math.hypot(nx, ny, nz) || 1;
        const k3 = (i * S + j) * 3;
        nor[k3] = nx / l; nor[k3 + 1] = ny / l; nor[k3 + 2] = nz / l;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;

    // Sit the horn on the net's centre, aligned with the net's own plane. It
    // shrinks into the folds as the net is gathered, rather than perching on top.
    const g = clamp(this.gather, 0, 1);
    this.horn.position.set(p[0], p[1] - g * 0.035, p[2]);
    this.horn.quaternion.copy(this.quat);
    this.horn.scale.setScalar(1 - g * 0.55);

    // Handy summaries for the camera and the gameplay.
    let lowest = Infinity, rmax = 0;
    for (let j = 0; j < S; j++) {
      const k3 = (R * S + j) * 3;
      lowest = Math.min(lowest, p[k3 + 1]);
      rmax = Math.max(rmax, Math.hypot(p[k3] - this.center.x, p[k3 + 2] - this.center.z));
    }
    this.lowestRimY = lowest;
    this.openRadiusNow = rmax;
  }

  _updateWeights() {
    const p = this.p, S = this.segs;
    for (let w = 0; w < this.weightSlots.length; w++) {
      const k = this.weightSlots[w], k3 = k * 3;
      const jn = ((k % S) + 1) % S;
      const nb = (this.rings * S + jn) * 3;
      const dx = p[nb] - p[k3], dy = p[nb + 1] - p[k3 + 1], dz = p[nb + 2] - p[k3 + 2];
      const v = this.weightVar[w];
      this._wq.setFromUnitVectors(_upAxis, _n0.set(dx, dy, dz).normalize());
      _tmpA.set(0, 0, 1).applyQuaternion(this._wq);
      this._wq.multiply(_qRoll.setFromAxisAngle(_upAxis, v.roll));
      this._ws.set(v.s, v.s * v.f, v.s);
      this._wm.compose(_tmpB.set(p[k3], p[k3 + 1], p[k3 + 2]), this._wq, this._ws);
      this._wm.toArray(this.weights.instanceMatrix.array, w * 16);
    }
    this.weights.instanceMatrix.needsUpdate = true;
  }

  /** A few points on the lead line, for the camera to keep inside the frame. */
  rimPoints(out) {
    const S = this.segs, R = this.rings, p = this.p;
    for (let i = 0; i < out.length; i++) {
      const j = Math.round((i / out.length) * S) % S;
      const k3 = (R * S + j) * 3;
      out[i].set(p[k3], p[k3 + 1], p[k3 + 2]);
    }
    return out;
  }

  _updateBrails() {
    const arr = this._brailArr, p = this.p, S = this.segs, R = this.rings;
    const step = Math.floor(S / this.brailCount);
    for (let b = 0; b < this.brailCount; b++) {
      const k3 = (R * S + ((b * step) % S)) * 3;
      arr[b * 6 + 0] = this.center.x;
      arr[b * 6 + 1] = this.center.y + 0.02;
      arr[b * 6 + 2] = this.center.z;
      arr[b * 6 + 3] = p[k3];
      arr[b * 6 + 4] = p[k3 + 1];
      arr[b * 6 + 5] = p[k3 + 2];
    }
    this.brails.geometry.attributes.position.needsUpdate = true;
  }
}
