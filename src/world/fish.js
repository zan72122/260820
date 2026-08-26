import * as THREE from '../../vendor/three.module.js';
import { SUN_DIR, PALETTE, depthAt, seabedY } from './env.js';
import { clamp, lerp, smoothstep } from '../util/math.js';

const MAX_FISH = 56;

/** Laterally compressed body plus a fork tail. Low poly, but unmistakably a fish. */
function fishGeometry() {
  const rings = 11, seg = 8;
  const pos = [], nor = [], uvs = [], idx = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);                 // 0 tail, 1 snout
    const z = lerp(-0.50, 0.52, t);
    const r = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85) * 0.20 + 0.012;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r * 0.42;
      const y = Math.sin(a) * r * (a > Math.PI ? 0.86 : 1.0);   // slightly flatter belly
      pos.push(x, y, z);
      nor.push(Math.cos(a) * 0.42, Math.sin(a), 0.15 * (t - 0.5));
      uvs.push(j / seg, t);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Tail fin
  const base = pos.length / 3;
  pos.push(0, 0, -0.48, 0, 0.20, -0.76, 0, -0.19, -0.75, 0, 0.02, -0.60);
  for (let i = 0; i < 4; i++) { nor.push(1, 0, 0); uvs.push(0.5, 0); }
  idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  // Dorsal
  const d0 = pos.length / 3;
  pos.push(0, 0.10, 0.12, 0, 0.24, -0.05, 0, 0.09, -0.20);
  for (let i = 0; i < 3; i++) { nor.push(1, 0, 0); uvs.push(0.5, 0.5); }
  idx.push(d0, d0 + 1, d0 + 2);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

export function createFish(quality) {
  const geo = fishGeometry();
  // aData: x = swim phase, y = swim rate, z = flash amount, w = alpha
  const data = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FISH * 4), 4);
  geo.setAttribute('aData', data);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: PALETTE.sunColor },
      uShallow: { value: PALETTE.waterShallow },
      uDeep: { value: PALETTE.waterDeep }
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute vec4 aData;
      uniform float uTime;
      varying vec3 vN; varying vec3 vW; varying float vBelly; varying vec4 vD;
      void main(){
        vD = aData;
        vec3 p = position;
        // Body wave: amplitude grows toward the tail, as in a real caudal beat.
        float amp = smoothstep(0.55, -0.52, p.z) * 0.115;
        float bend = sin(uTime * aData.y + aData.x + p.z * 3.4) * amp;
        p.x += bend;
        vBelly = clamp(-p.y * 5.0, 0.0, 1.0);
        vec4 wp = instanceMatrix * vec4(p, 1.0);
        vW = (modelMatrix * wp).xyz;
        vN = normalize(mat3(instanceMatrix) * (normal + vec3(bend * 3.0, 0.0, 0.0)));
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vN; varying vec3 vW; varying float vBelly; varying vec4 vD;
      uniform vec3 uSunDir, uSunColor, uShallow, uDeep;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        // Dark back, pale belly: reads as a shadow from above, as a flash from the side.
        vec3 back = vec3(0.055, 0.085, 0.105);
        vec3 belly = vec3(0.62, 0.66, 0.63);
        vec3 base = mix(back, belly, vBelly * 0.9);

        float lam = max(dot(N, uSunDir), 0.0);
        vec3 H = normalize(uSunDir + V);
        float flank = pow(max(dot(N, H), 0.0), 42.0);
        vec3 col = base * (0.30 + lam * 0.75);
        col += uSunColor * flank * (0.55 + vD.z * 3.2);

        float depth = max(0.0, -vW.y);
        vec3 water = mix(uShallow, uDeep, clamp(depth / 3.0, 0.0, 1.0));
        float ext = 1.0 - exp(-depth * 0.80);
        col = mix(col, water * 0.62, clamp(ext, 0.0, 0.9));

        if (vD.w < 0.02) discard;
        gl_FragColor = vec4(col, vD.w);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_FISH);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.count = MAX_FISH;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_FISH; i++) zero.toArray(mesh.instanceMatrix.array, i * 16);
  return { mesh, material: mat, data };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();

/**
 * Three readable silhouettes:
 *  school   — a tight shimmer of small fish that turns as one body
 *  solitary — one big slow shadow crossing the deeper blue
 *  darters  — a handful of quick fish that scatter and regroup
 */
export class FishSystem {
  constructor(fish, heights, rng) {
    this.fish = fish;
    this.heights = heights;
    this.rng = rng;
    this.shoals = [];
    this.free = [];
    for (let i = MAX_FISH - 1; i >= 0; i--) this.free.push(i);
    this.jumper = null;
    this.time = 0;
  }

  get patterns() { return ['school', 'solitary', 'darters']; }

  spawn(kind, opts = {}) {
    const rng = this.rng;
    const count = kind === 'school' ? 20 : kind === 'solitary' ? 1 : 5;
    if (this.free.length < count) return null;
    const slots = [];
    for (let i = 0; i < count; i++) slots.push(this.free.pop());

    const deep = kind === 'solitary';
    const dist = opts.dist ?? (deep ? rng.range(11, 19) : rng.range(2.6, 8.0));
    const side = opts.side ?? rng.range(-9, 9);
    const shoal = {
      kind, slots,
      pos: new THREE.Vector3(side, 0, -dist),
      vel: new THREE.Vector3(rng.sign() * (kind === 'solitary' ? 0.55 : 0.75), 0, rng.range(-0.12, 0.12)),
      wander: rng.range(0, 6.28),
      scale: kind === 'school' ? rng.range(0.115, 0.155)
        : kind === 'solitary' ? rng.range(0.62, 0.88)
          : rng.range(0.26, 0.34),
      spread: kind === 'school' ? 0.62 : kind === 'solitary' ? 0 : 1.7,
      swimDepth: kind === 'solitary' ? rng.range(0.9, 1.7) : rng.range(0.18, 0.55),
      members: slots.map(() => ({
        off: new THREE.Vector3(rng.gauss(), rng.gauss() * 0.35, rng.gauss()),
        phase: rng.range(0, 6.28),
        rate: kind === 'school' ? rng.range(11, 15) : kind === 'solitary' ? rng.range(3.2, 4.4) : rng.range(7, 10),
        dart: 0,
        p: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        alpha: 0
      })),
      life: 0,
      fade: 0,
      flash: 0,
      panic: 0,
      dead: false
    };
    this.shoals.push(shoal);
    return shoal;
  }

  /** A fish breaks the surface: the strongest "there is life out there" cue we have. */
  jump(x, z, onSplash) {
    if (this.jumper || this.free.length < 1) return;
    const slot = this.free.pop();
    this.jumper = {
      slot, x, z, t: 0, dur: 1.05,
      dir: this.rng.range(0, 6.28),
      scale: this.rng.range(0.13, 0.19),
      onSplash, splashed: false
    };
    if (onSplash) onSplash(x, z, 0.35);
  }

  /** Startle everything near a point (the net hitting the water). */
  disturb(x, z, radius, strength = 1) {
    for (const s of this.shoals) {
      const d = Math.hypot(s.pos.x - x, s.pos.z - z);
      if (d < radius * 2.4) {
        s.panic = Math.max(s.panic, strength * (1 - d / (radius * 2.4)));
        const dx = s.pos.x - x, dz = s.pos.z - z;
        const l = Math.max(0.001, Math.hypot(dx, dz));
        s.vel.x += (dx / l) * 2.2 * s.panic;
        s.vel.z += (dz / l) * 2.2 * s.panic;
      }
    }
  }

  /** Fish inside the closing rim. We only ever keep one, and only for a moment. */
  catchIn(x, z, radius) {
    let best = null;
    for (const s of this.shoals) {
      for (let i = 0; i < s.members.length; i++) {
        const m = s.members[i];
        if (m.alpha < 0.3) continue;
        const d = Math.hypot(m.p.x - x, m.p.z - z);
        if (d < radius) {
          const score = radius - d;
          if (!best || score > best.score) best = { shoal: s, index: i, score, kind: s.kind, scale: s.scale };
        }
      }
    }
    if (!best) return null;
    const m = best.shoal.members[best.index];
    m.alpha = 0;
    m.caught = true;
    return { kind: best.kind, scale: best.scale, phase: m.phase, rate: m.rate };
  }

  /** Keep one fish in the observation tub, briefly, so it can be looked at. */
  putInTank(center, kind, scale) {
    if (this.free.length < 1) return false;
    this.tank = {
      slot: this.free.pop(),
      center: center.clone(),
      kind,
      scale: Math.min(scale, 0.155),
      a: 0,
      t: 0,
      pos: center.clone(),
      release: null
    };
    return true;
  }

  /** Send it home: a small arc out of the tub and back into the shallow. */
  releaseTank(target, onSplash) {
    if (!this.tank || this.tank.release) return false;
    this.tank.release = { from: this.tank.pos.clone(), to: target.clone(), t: 0, dur: 1.15, onSplash, done: false };
    return true;
  }

  get hasTankFish() { return !!this.tank; }

  _updateTank(dt, t, arr, data) {
    const k = this.tank;
    if (!k) return;
    k.t += dt;
    let yaw;
    if (!k.release) {
      // Slow circles just under the surface of the tub.
      k.a += dt * 1.15;
      const r = 0.135;
      k.pos.set(k.center.x + Math.cos(k.a) * r, k.center.y - 0.045 + Math.sin(t * 1.6) * 0.012,
        k.center.z + Math.sin(k.a) * r);
      yaw = Math.atan2(-Math.sin(k.a), Math.cos(k.a)) + Math.PI * 0.5;
    } else {
      const rel = k.release;
      rel.t += dt;
      const u = clamp(rel.t / rel.dur, 0, 1);
      k.pos.lerpVectors(rel.from, rel.to, u);
      k.pos.y += Math.sin(u * Math.PI) * 0.55;
      yaw = Math.atan2(rel.to.x - rel.from.x, rel.to.z - rel.from.z);
      if (!rel.done && u > 0.93) {
        rel.done = true;
        if (rel.onSplash) rel.onSplash(rel.to.x, rel.to.z, 0.45);
      }
      if (u >= 1) {
        this.free.push(k.slot);
        this.tank = null;
        return;
      }
    }
    _q.setFromAxisAngle(_up, yaw);
    _s.setScalar(k.scale);
    _m.compose(k.pos, _q, _s);
    _m.toArray(arr, k.slot * 16);
    data[k.slot * 4 + 0] = 0.7;
    data[k.slot * 4 + 1] = 13.0;
    data[k.slot * 4 + 2] = 0.9;
    data[k.slot * 4 + 3] = 1;
  }

  populate(target = 4) {
    while (this.shoals.length < target) {
      const kind = this.shoals.length === 0 ? 'school'
        : this.rng.next() < 0.34 ? 'solitary'
          : this.rng.next() < 0.55 ? 'darters' : 'school';
      if (!this.spawn(kind)) break;
    }
  }

  update(dt, t) {
    this.time = t;
    const H = this.heights;
    const arr = this.fish.mesh.instanceMatrix.array;
    const data = this.fish.data.array;
    const rng = this.rng;

    for (let i = 0; i < MAX_FISH; i++) data[i * 4 + 3] = 0;   // hide everything, then re-show

    for (let si = this.shoals.length - 1; si >= 0; si--) {
      const s = this.shoals[si];
      s.life += dt;
      s.panic = Math.max(0, s.panic - dt * 0.55);
      s.wander += dt * (0.45 + s.panic * 1.2);
      s.fade = Math.min(1, s.fade + dt * 0.7);

      const speed = (s.kind === 'solitary' ? 0.5 : s.kind === 'school' ? 0.85 : 1.05) * (1 + s.panic * 2.6);
      const turn = Math.sin(s.wander) * 0.55 + Math.cos(s.wander * 0.63) * 0.35;
      const heading = Math.atan2(s.vel.z, s.vel.x) + turn * dt;
      s.vel.set(Math.cos(heading), 0, Math.sin(heading)).multiplyScalar(speed);

      // Keep them in water and roughly in front of the pier.
      const ahead = -s.pos.z;
      if (ahead < 1.6) s.vel.z -= 0.9;
      if (s.kind !== 'solitary' && ahead > 13) s.vel.z += 0.7;
      if (Math.abs(s.pos.x) > 13) s.vel.x -= Math.sign(s.pos.x) * 0.9;

      s.pos.addScaledVector(s.vel, dt);

      if (s.life > (s.kind === 'solitary' ? 34 : 26)) s.dead = true;
      const out = s.life > 2 && (Math.abs(s.pos.x) > 16 || -s.pos.z > 30 || -s.pos.z < 0.6);
      if (out) s.dead = true;
      if (s.dead) s.fade -= dt * 1.4;
      if (s.fade <= 0 && s.dead) {
        for (const sl of s.slots) this.free.push(sl);
        this.shoals.splice(si, 1);
        continue;
      }

      // A whole school catching the light at once.
      s.flash = Math.max(0, s.flash - dt * 2.2);
      if (s.kind === 'school' && rng.next() < dt * 0.55) s.flash = 1;

      const surf = H.heightAt(s.pos.x, s.pos.z);
      for (let mi = 0; mi < s.members.length; mi++) {
        const m = s.members[mi];
        const slot = s.slots[mi];
        if (m.caught) continue;

        if (s.kind === 'darters') {
          m.dart -= dt;
          if (m.dart <= 0) { m.dart = rng.range(0.7, 2.1); m.burst = rng.range(0.5, 1.4); }
          m.burst = Math.max(0, (m.burst || 0) - dt * 1.6);
        }
        const jitter = s.kind === 'school' ? 0.05 : 0.22;
        const wob = Math.sin(t * m.rate * 0.22 + m.phase) * jitter;
        const spread = s.spread * (1 + s.panic * 1.6) * (1 + (m.burst || 0) * 0.8);

        const px = s.pos.x + m.off.x * spread + wob;
        const pz = s.pos.z + m.off.z * spread + wob * 0.7;
        const bed = seabedY(px, pz);
        const water = H.heightAt(px, pz);
        let py = water - s.swimDepth - m.off.y * 0.25 + Math.sin(t * 0.7 + m.phase) * 0.04;
        py = clamp(py, bed + 0.09 * s.scale * 6, water - 0.045);

        m.p.set(px, py, pz);
        _fwd.set(s.vel.x, (py - m.p.y) * 0.0 + 0.0, s.vel.z).normalize();
        const yaw = Math.atan2(_fwd.x, _fwd.z);
        m.q.setFromAxisAngle(_up, yaw + Math.PI * 0.5 * 0 + 0);
        _q.setFromAxisAngle(_up, yaw);
        const alpha = s.fade * smoothstep(0.0, 0.6, s.life) * (1 - smoothstep(24, 34, s.life) * 0.9);
        m.alpha = alpha;

        _s.setScalar(s.scale * (s.kind === 'school' ? (0.85 + (mi % 5) * 0.07) : 1));
        _m.compose(m.p, _q, _s);
        _m.toArray(arr, slot * 16);
        data[slot * 4 + 0] = m.phase;
        data[slot * 4 + 1] = m.rate * (1 + (m.burst || 0) * 0.9 + s.panic);
        data[slot * 4 + 2] = s.flash * 0.8 + (m.burst || 0) * 0.4;
        data[slot * 4 + 3] = alpha;
      }
      void surf;
    }

    this._updateTank(dt, t, arr, data);

    // Jumping fish.
    if (this.jumper) {
      const j = this.jumper;
      j.t += dt;
      const u = j.t / j.dur;
      if (u >= 1) {
        this.free.push(j.slot);
        this.jumper = null;
      } else {
        const arc = Math.sin(u * Math.PI);
        const surface = H.heightAt(j.x, j.z);
        const y = surface - 0.10 + arc * 0.42;
        const dx = Math.cos(j.dir), dz = Math.sin(j.dir);
        _p.set(j.x + dx * (u - 0.5) * 0.75, y, j.z + dz * (u - 0.5) * 0.75);
        const pitch = Math.cos(u * Math.PI) * 0.9;
        _q.setFromEuler(new THREE.Euler(pitch, Math.atan2(dx, dz), 0, 'YXZ'));
        _s.setScalar(j.scale);
        _m.compose(_p, _q, _s);
        _m.toArray(arr, j.slot * 16);
        data[j.slot * 4 + 0] = 0;
        data[j.slot * 4 + 1] = 16;
        data[j.slot * 4 + 2] = 1.4;
        data[j.slot * 4 + 3] = 1;
        if (!j.splashed && u > 0.86) {
          j.splashed = true;
          if (j.onSplash) j.onSplash(_p.x, _p.z, 0.5);
        }
      }
    }

    this.fish.mesh.instanceMatrix.needsUpdate = true;
    this.fish.data.needsUpdate = true;
    this.fish.material.uniforms.uTime.value = t;
  }
}

export { MAX_FISH };
