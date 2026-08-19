import * as THREE from 'three';
import { materials } from './materials.js';
import * as T from './textures.js';

/* ------------------------------------------------------------------
   Particle systems.  Everything is pre-allocated: no garbage during play,
   which keeps the frame rate flat on a phone.
------------------------------------------------------------------- */

const GRAV = 17.0;

/** Tumbling snow chunks (the snow arcing out of the chute, dump debris). */
export class ChunkSystem {
  constructor(scene, max = 320, radius = 0.16) {
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    this.mesh = new THREE.InstancedMesh(geo, materials().snowChunk, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.max = max;
    this.p = [];
    for (let i = 0; i < max; i++) {
      this.p.push({
        alive: false,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        rot: new THREE.Euler(), spin: new THREE.Vector3(),
        life: 0, maxLife: 1, size: 1, target: null, assist: 0, homing: 0,
        grounded: false, kind: 0,
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this.onBedHit = null;
    this.onGround = null;
    this.groundAt = null;      // optional (x,z) -> ground height
  }

  spawn(pos, vel, opts = {}) {
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (q.alive) continue;
      q.alive = true;
      q.pos.copy(pos);
      q.vel.copy(vel);
      q.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      q.life = 0;
      q.maxLife = opts.life ?? 3.0;
      q.size = opts.size ?? (0.7 + Math.random() * 0.8);
      q.target = opts.target ?? null;
      q.homing = opts.homing ?? 0;
      q.grounded = false;
      q.kind = opts.kind ?? 0;
      return q;
    }
    return null;
  }

  update(dt, truck, tmp) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (!q.alive) continue;
      q.life += dt;

      if (!q.grounded) {
        // gentle homing keeps the throw landing in a moving bed
        if (q.homing > 0 && q.target) {
          const t = q.target;
          const dx = t.x - q.pos.x, dy = t.y - q.pos.y, dz = t.z - q.pos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > 0.4) {
            const tf = Math.max(0.16, dist / Math.max(4, q.vel.length()));
            const wantX = dx / tf, wantZ = dz / tf;
            const wantY = dy / tf + 0.5 * GRAV * tf;
            const k = Math.min(1, dt * 6.0 * q.homing);
            q.vel.x += (wantX - q.vel.x) * k;
            q.vel.y += (wantY - q.vel.y) * k;
            q.vel.z += (wantZ - q.vel.z) * k;
          }
        }
        q.vel.y -= GRAV * dt;
        q.pos.addScaledVector(q.vel, dt);
        q.rot.x += q.spin.x * dt; q.rot.y += q.spin.y * dt; q.rot.z += q.spin.z * dt;

        // into the bed?
        if (q.kind === 0 && truck && q.vel.y < 2 && truck.isInBed(q.pos, tmp)) {
          if (this.onBedHit) this.onBedHit(q.pos);
          q.alive = false;
          continue;
        }
        // hit the ground (or the flank of the dump mountain)
        const gy = this.groundAt ? this.groundAt(q.pos.x, q.pos.z) : 0.12;
        if (q.pos.y <= gy) {
          q.pos.y = gy;
          if (this.onGround) this.onGround(q.pos, q.kind);
          if (q.kind === 1) {
            // dump-site debris settles into the pile
            q.grounded = true;
            q.vel.set(0, 0, 0);
            q.maxLife = q.life + 6.0;
          } else {
            q.alive = false;
            continue;
          }
        }
      }

      if (q.life > q.maxLife) { q.alive = false; continue; }

      const fade = q.grounded ? Math.max(0, 1 - (q.life - (q.maxLife - 6.0)) / 6.0) : 1;
      this._q.setFromEuler(q.rot);
      this._s.setScalar(q.size * (0.5 + 0.5 * fade));
      this._m.compose(q.pos, this._q, this._s);
      this.mesh.setMatrixAt(n, this._m);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clearKind(kind) {
    for (const q of this.p) if (q.kind === kind) q.alive = false;
  }
}

/** Soft sprite puffs: snow dust, exhaust smoke, impact splashes. */
export class PuffSystem {
  constructor(scene, max, opts = {}) {
    const { color = '255,255,255', size = 1.4, opacity = 0.8, rise = 0.6, drag = 1.6, blending = THREE.NormalBlending } = opts;
    const tex = T.toTexture(T.softSprite(color, opts.hardness ?? 0.25), 1);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3);
    const sz = new Float32Array(max);
    const al = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        uOpacity: { value: opacity },
        fogColor: { value: new THREE.Color(0xc3d2e0) },
        fogNear: { value: 70 }, fogFar: { value: 380 },
      },
      transparent: true, depthWrite: false, blending,
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying float vAlpha; varying float vFog;
        void main(){
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vFog = -mv.z;
          gl_PointSize = aSize * (330.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform float uOpacity;
        uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying float vAlpha; varying float vFog;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          float a = t.a * vAlpha * uOpacity;
          if(a < 0.01) discard;
          float f = smoothstep(fogNear, fogFar, vFog);
          vec3 c = mix(t.rgb, fogColor, f);
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.max = max; this.geo = geo; this.rise = rise; this.drag = drag;
    this.baseSize = size;
    this.p = [];
    for (let i = 0; i < max; i++) {
      this.p.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, s0: 1, s1: 2, a0: 1 });
    }
  }

  spawn(pos, vel, opts = {}) {
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (q.alive) continue;
      q.alive = true;
      q.pos.copy(pos);
      q.vel.copy(vel);
      q.life = 0;
      q.maxLife = opts.life ?? 1.0;
      q.s0 = (opts.size ?? this.baseSize) * (0.7 + Math.random() * 0.6);
      q.s1 = q.s0 * (opts.grow ?? 2.4);
      q.a0 = opts.alpha ?? 1.0;
      return q;
    }
    return null;
  }

  update(dt) {
    const pos = this.geo.attributes.position.array;
    const sz = this.geo.attributes.aSize.array;
    const al = this.geo.attributes.aAlpha.array;
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (!q.alive) continue;
      q.life += dt;
      const t = q.life / q.maxLife;
      if (t >= 1) { q.alive = false; continue; }
      q.vel.y += this.rise * dt;
      q.vel.multiplyScalar(1 - Math.min(0.9, this.drag * dt));
      q.pos.addScaledVector(q.vel, dt);
      pos[n * 3] = q.pos.x; pos[n * 3 + 1] = q.pos.y; pos[n * 3 + 2] = q.pos.z;
      sz[n] = q.s0 + (q.s1 - q.s0) * t;
      al[n] = q.a0 * Math.sin(Math.min(1, t * 1.9) * Math.PI * 0.5) * (1 - t * t);
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

/** Ambient falling snow that follows the camera. */
export class Snowfall {
  constructor(scene, count = 700) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const al = new Float32Array(count);
    this.vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 26;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
      sz[i] = 0.5 + Math.random() * 1.1;
      al[i] = 0.35 + Math.random() * 0.5;
      this.vel.push({ y: -0.9 - Math.random() * 1.5, x: (Math.random() - 0.5) * 0.7, ph: Math.random() * 6.3 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
    const tex = T.toTexture(T.softSprite('255,255,255', 0.4), 1);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      transparent: true, depthWrite: false,
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying float vAlpha;
        void main(){
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * (150.0 / max(1.0,-mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying float vAlpha;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          if(t.a*vAlpha < 0.02) discard;
          gl_FragColor = vec4(t.rgb, t.a*vAlpha);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this.count = count;
    this._t = 0;
  }

  update(dt, center) {
    this._t += dt;
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      const v = this.vel[i];
      p[i * 3 + 1] += v.y * dt;
      p[i * 3] += (v.x + Math.sin(this._t * 0.7 + v.ph) * 0.35) * dt;
      if (p[i * 3 + 1] < center.y - 4) {
        p[i * 3 + 1] = center.y + 22;
        p[i * 3] = center.x + (Math.random() - 0.5) * 90;
        p[i * 3 + 2] = center.z + (Math.random() - 0.5) * 90;
      }
      // keep the field wrapped around the camera
      const dx = p[i * 3] - center.x, dz = p[i * 3 + 2] - center.z;
      if (dx > 45) p[i * 3] -= 90; else if (dx < -45) p[i * 3] += 90;
      if (dz > 45) p[i * 3 + 2] -= 90; else if (dz < -45) p[i * 3 + 2] += 90;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
