import * as THREE from '../../vendor/three.module.js';
import { PALETTE, seabedY } from '../world/env.js';
import { clamp } from '../util/math.js';

const MAX_PARTICLES = 900;

/**
 * Spray, drips and mist. One buffer, one draw call, CPU-stepped so a droplet
 * can report back when it hits the water and leave a ripple behind.
 */
export class Spray {
  constructor(dropTex, heights, onRipple) {
    this.heights = heights;
    this.onRipple = onRipple;
    this.n = MAX_PARTICLES;
    const pos = new Float32Array(this.n * 3);
    const data = new Float32Array(this.n * 4);   // life, maxLife, size, kind
    this.vel = new Float32Array(this.n * 3);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.pos = pos; this.data = data; this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      uniforms: {
        uMap: { value: dropTex },
        uScale: { value: 400 },
        uFoam: { value: PALETTE.foam },
        uSun: { value: PALETTE.sunColor }
      },
      vertexShader: /* glsl */`
        attribute vec4 aData;
        uniform float uScale;
        varying float vAlpha; varying float vKind;
        void main(){
          // aData.x is remaining life and counts *down*, so u = 1 at birth and
          // 0 at death. Alpha and growth both follow age, not remaining life.
          float u = aData.x / max(aData.y, 0.0001);
          float age = 1.0 - u;
          vAlpha = clamp(aData.x > 0.0 ? smoothstep(0.0, 0.18, u) : 0.0, 0.0, 1.0);
          vKind = aData.w;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float grow = aData.w > 1.5 ? (0.6 + age * 2.2) : (1.0 - age * 0.25);
          gl_PointSize = aData.z * grow * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uMap; uniform vec3 uFoam, uSun;
        varying float vAlpha; varying float vKind;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          vec2 pc = gl_PointCoord - 0.5;
          float r = length(pc) * 2.0;

          if (vKind > 0.5 && vKind < 1.5) {
            // A falling bead against a bright sea is not white — it is a small
            // dark lens with one hard glint. White drops simply disappear.
            float body = smoothstep(1.0, 0.72, r);
            if (body < 0.02) discard;
            float glint = pow(max(0.0, 1.0 - length(pc - vec2(-0.13, -0.15)) * 4.4), 2.5);
            vec3 col = mix(vec3(0.16, 0.24, 0.28), uFoam, glint * 0.95);
            gl_FragColor = vec4(col, body * vAlpha * 0.92);
          } else {
            float a = t.a * vAlpha;
            if (a < 0.01) discard;
            vec3 col = uFoam * (vKind > 1.5 ? 0.92 : 1.0) + uSun * 0.22 * vAlpha;
            gl_FragColor = vec4(col, a * (vKind > 1.5 ? 0.24 : 0.88));
          }
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
  }

  _emit(x, y, z, vx, vy, vz, life, size, kind) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.data[i * 4] = life; this.data[i * 4 + 1] = life;
    this.data[i * 4 + 2] = size; this.data[i * 4 + 3] = kind;
  }

  /** The crown thrown up when a whole circle of lead hits the water at once. */
  crown(center, radius, strength = 1, rng) {
    // The skirt: a continuous sheet of water thrown up along the lead line.
    const ring = Math.round(34 * strength);
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + rng.range(-0.06, 0.06);
      const r = radius * rng.range(0.84, 1.02);
      const sp = rng.range(1.1, 2.5) * strength;
      this._emit(
        center.x + Math.cos(a) * r, center.y + 0.02, center.z + Math.sin(a) * r,
        Math.cos(a) * sp * 0.55, rng.range(1.5, 3.2) * strength, Math.sin(a) * sp * 0.55,
        rng.range(0.50, 0.90), rng.range(0.16, 0.34), 0
      );
      // Torn spray off the top of the sheet.
      if (i % 2 === 0) {
        this._emit(
          center.x + Math.cos(a) * r, center.y + 0.06, center.z + Math.sin(a) * r,
          Math.cos(a) * sp * 0.9, rng.range(2.2, 4.0) * strength, Math.sin(a) * sp * 0.9,
          rng.range(0.6, 1.1), rng.range(0.05, 0.11), 0
        );
      }
    }
    for (let i = 0; i < Math.round(15 * strength); i++) {
      const a = rng.range(0, 6.28), r = radius * Math.sqrt(rng.next()) * 0.6;
      this._emit(
        center.x + Math.cos(a) * r, center.y + 0.02, center.z + Math.sin(a) * r,
        rng.range(-0.5, 0.5), rng.range(1.8, 3.6) * strength, rng.range(-0.5, 0.5),
        rng.range(0.5, 0.95), rng.range(0.14, 0.30), 0
      );
    }
    for (let i = 0; i < Math.round(14 * strength); i++) {
      const a = rng.range(0, 6.28), r = radius * rng.range(0.7, 1.25);
      this._emit(
        center.x + Math.cos(a) * r, center.y + 0.05, center.z + Math.sin(a) * r,
        Math.cos(a) * 0.35, rng.range(0.25, 0.75), Math.sin(a) * 0.35,
        rng.range(1.1, 2.0), rng.range(0.26, 0.55), 2
      );
    }
  }

  /** One bead of water leaving the hauled net. */
  drip(x, y, z) {
    // Stylised: a real 4 mm drop is a sub-pixel at this camera distance, so a
    // bead is drawn nearer to 10 cm and given a little sideways drift.
    this._emit(
      x, y - 0.02, z,
      (Math.random() - 0.5) * 0.16, -0.25, (Math.random() - 0.5) * 0.16,
      1.7, 0.085 + Math.random() * 0.062, 1
    );
  }

  splashlet(x, y, z, rng, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28);
      this._emit(x, y, z, Math.cos(a) * rng.range(0.2, 0.7), rng.range(0.5, 1.4),
        Math.sin(a) * rng.range(0.2, 0.7), rng.range(0.3, 0.6), rng.range(0.05, 0.10), 0);
    }
  }

  update(dt) {
    const H = this.heights;
    for (let i = 0; i < this.n; i++) {
      const l = this.data[i * 4];
      if (l <= 0) continue;
      const nl = l - dt;
      this.data[i * 4] = nl > 0 ? nl : 0;
      if (nl <= 0) continue;
      const k = this.data[i * 4 + 3];
      const i3 = i * 3;
      if (k < 1.5) {
        this.vel[i3 + 1] -= 9.0 * dt;
        this.vel[i3] *= 1 - dt * 0.9;
        this.vel[i3 + 2] *= 1 - dt * 0.9;
      } else {
        this.vel[i3 + 1] += 0.22 * dt;                    // mist lifts and drifts
        this.vel[i3] *= 1 - dt * 1.4;
        this.vel[i3 + 2] *= 1 - dt * 1.4;
      }
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;

      if (k < 1.5 && this.vel[i3 + 1] < 0) {
        const surf = H.heightAt(this.pos[i3], this.pos[i3 + 2]);
        if (this.pos[i3 + 1] <= surf) {
          this.data[i * 4] = 0;
          if (this.onRipple && Math.random() < 0.4) {
            this.onRipple(this.pos[i3], this.pos[i3 + 2], k > 0.5 ? 0.10 : 0.07);
          }
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aData.needsUpdate = true;
  }
}

const MAX_RINGS = 4;

/** Expanding lace of foam left where the lead line struck. */
export class FoamRings {
  constructor(heights) {
    this.heights = heights;
    this.slots = [];
    const geo = new THREE.PlaneGeometry(1, 1, 24, 24);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uAge: { value: -1 }, uFoam: { value: PALETTE.foam }, uR: { value: 1 } },
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv; uniform float uAge; uniform vec3 uFoam;
          float h(vec2 p){ return fract(sin(p.x*91.3+p.y*47.7)*21753.11); }
          float n2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
          void main(){
            if (uAge < 0.0) discard;
            vec2 c = vUv * 2.0 - 1.0;
            float r = length(c);
            float ang = atan(c.y, c.x);
            float front = clamp(0.34 + uAge * 0.55, 0.0, 1.0);
            float w = 0.10 + uAge * 0.16;
            float band = exp(-pow((r - front) / w, 2.0));
            // Ragged edge: foam is never a clean circle.
            float ragged = 0.62 + 0.55 * n2(vec2(ang * 3.4, uAge * 1.2));
            float a = band * ragged * exp(-uAge * 1.35) * smoothstep(1.0, 0.9, r);
            if (a < 0.01) discard;
            gl_FragColor = vec4(uFoam, a * 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.renderOrder = 7;
      m.visible = false;
      this.slots.push({ mesh: m, mat, age: -1 });
    }
    this.group = new THREE.Group();
    for (const s of this.slots) this.group.add(s.mesh);
  }

  spawn(x, z, radius) {
    let slot = this.slots.find((s) => s.age < 0) || this.slots.reduce((a, b) => (a.age > b.age ? a : b));
    slot.age = 0;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, this.heights.heightAt(x, z) + 0.012, z);
    slot.mesh.scale.setScalar(radius * 2.5);
  }

  update(dt) {
    for (const s of this.slots) {
      if (s.age < 0) continue;
      s.age += dt;
      s.mat.uniforms.uAge.value = s.age;
      if (s.age > 2.6) { s.age = -1; s.mat.uniforms.uAge.value = -1; s.mesh.visible = false; }
    }
  }
}

/** The net's shadow running over the sand — the clearest link between air and water. */
export class NetShadow {
  constructor() {
    const geo = new THREE.CircleGeometry(1, 40);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
      uniforms: { uSoft: { value: 0.5 }, uStrength: { value: 0.5 }, uMesh: { value: 26 }, uCrisp: { value: 0.5 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uSoft; uniform float uStrength; uniform float uMesh; uniform float uCrisp;
        void main(){
          vec2 c = vUv * 2.0 - 1.0;
          float r = length(c);
          float m = smoothstep(1.0, 1.0 - uSoft, r) * uStrength;
          // The mesh itself shows in the shadow while the net is close to the bed.
          vec2 q = c * uMesh;
          float d = min(abs(fract((q.x + q.y) * 0.5) - 0.5), abs(fract((q.x - q.y) * 0.5) - 0.5));
          float grid = smoothstep(0.16, 0.30, d);
          m *= mix(1.0, mix(1.20, 0.55, grid), 0.5 * uCrisp);
          gl_FragColor = vec4(vec3(1.0 - m * 0.30), 1.0);
        }
      `
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  update(x, z, radius, height, visible, surfaceY) {
    this.mesh.visible = visible;
    if (!visible) return;
    const bed = surfaceY !== undefined ? surfaceY : seabedY(x, z) + 0.02;
    this.mesh.position.set(x, bed, z);
    const spread = 1 + clamp(height, 0, 4) * 0.22;
    this.mesh.scale.setScalar(Math.max(0.05, radius * spread));
    this.material.uniforms.uSoft.value = clamp(0.30 + height * 0.24, 0.24, 0.95);
    this.material.uniforms.uStrength.value = clamp(0.46 - height * 0.08, 0.08, 0.46);
    this.material.uniforms.uMesh.value = Math.max(6, radius * 15);
    this.material.uniforms.uCrisp.value = clamp(1 - height / 1.1, 0, 1);
  }
}
