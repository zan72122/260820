import * as THREE from 'three';
import { smokeTexture } from '../gfx/textures.js';
import { SCENE_LIGHT } from '../gfx/glsl.js';

// Thin smoke off the bead. Deliberately not a volumetric solve: a handful of
// soft sprites that catch a little of the ember light is all the brief asks for,
// and all a 3mm source would actually produce.

const VERT = /* glsl */ `
attribute vec4 aP;   // xyz world position, w size
attribute vec3 aX;   // x = normalised age, y = seed, z = rotation

varying vec2 vUv;
varying float vAge;
varying float vSeed;
varying vec3 vPosW;

void main(){
  vUv = uv;
  vAge = aX.x;
  vSeed = aX.y;
  vPosW = aP.xyz;

  float c = cos(aX.z);
  float s = sin(aX.z);
  vec2 q = (uv - 0.5) * aP.w;
  vec2 r = vec2(q.x * c - q.y * s, q.x * s + q.y * c);

  vec4 mv = modelViewMatrix * vec4(aP.xyz, 1.0);
  mv.xy += r;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${SCENE_LIGHT}
uniform sampler2D uMap;
uniform float uOpacity;

varying vec2 vUv;
varying float vAge;
varying float vSeed;
varying vec3 vPosW;

void main(){
  float a = texture2D(uMap, vUv).a;
  if (a <= 0.003) discard;

  // In and out: smoke should never appear or vanish, only thin.
  float env = smoothstep(0.0, 0.14, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));

  // Smoke this thin can catch the ember light but must never carry it: the
  // clamp is what stops a wisp two millimetres from the bead going white.
  float d = length(uEmberPos - vPosW);
  float lit = min(0.20, emberFalloff(d) * 0.035);

  vec3 cool = vec3(0.10, 0.115, 0.155);
  vec3 col = cool + uEmberColor * lit;

  gl_FragColor = vec4(col, a * env * uOpacity);
}
`;

export class Smoke {
  constructor(lightRig, capacity = 24) {
    this.capacity = capacity;
    this.count = capacity;
    const n = capacity;

    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.size0 = new Float32Array(n);
    this.rot = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.alive = new Uint8Array(n);

    this.aP = new Float32Array(n * 4);
    this.aX = new Float32Array(n * 3);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.attrP = new THREE.InstancedBufferAttribute(this.aP, 4).setUsage(THREE.DynamicDrawUsage);
    this.attrX = new THREE.InstancedBufferAttribute(this.aX, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', this.attrP);
    geo.setAttribute('aX', this.attrX);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: lightRig.bind({
        uMap: { value: smokeTexture(128, 5) },
        uOpacity: { value: 0.26 },
      }),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.geometry = geo;
    this._acc = 0;
  }

  applyQuality(settings) {
    this.count = Math.min(this.capacity, settings.smoke);
  }

  reset() {
    this.alive.fill(0);
    this._acc = 0;
    this.geometry.instanceCount = 0;
  }

  _spawn(origin, rand, drift) {
    for (let i = 0; i < this.count; i++) {
      if (this.alive[i]) continue;
      this.alive[i] = 1;
      this.px[i] = origin.x + (rand() - 0.5) * 0.004;
      this.py[i] = origin.y + 0.002 + rand() * 0.003;
      this.pz[i] = origin.z + (rand() - 0.5) * 0.004;
      this.vx[i] = (rand() - 0.5) * 0.012 + drift.x * 0.4;
      this.vy[i] = 0.026 + rand() * 0.024;
      this.vz[i] = (rand() - 0.5) * 0.012 + drift.z * 0.4;
      this.age[i] = 0;
      this.life[i] = 1.6 + rand() * 2.0;
      this.size0[i] = 0.0028 + rand() * 0.0032;
      this.rot[i] = rand() * Math.PI * 2;
      this.spin[i] = (rand() - 0.5) * 0.5;
      this.seed[i] = rand();
      return;
    }
  }

  update(dt, origin, rate, drift, rand) {
    this._acc += rate * dt;
    while (this._acc >= 1) {
      this._acc -= 1;
      this._spawn(origin, rand, drift);
    }

    let n = 0;
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      const a = (this.age[i] += dt);
      if (a >= this.life[i]) {
        this.alive[i] = 0;
        continue;
      }
      // Convection up, then it loses its rise and just drifts.
      this.vy[i] += (0.012 - this.vy[i] * 0.35) * dt;
      this.vx[i] += (drift.x * 0.18 - this.vx[i] * 0.5) * dt;
      this.vz[i] += (drift.z * 0.18 - this.vz[i] * 0.5) * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;

      const t = a / this.life[i];
      const o4 = n * 4;
      const o3 = n * 3;
      this.aP[o4] = this.px[i];
      this.aP[o4 + 1] = this.py[i];
      this.aP[o4 + 2] = this.pz[i];
      this.aP[o4 + 3] = this.size0[i] * (1 + t * 3.1);
      this.aX[o3] = t;
      this.aX[o3 + 1] = this.seed[i];
      this.aX[o3 + 2] = this.rot[i];
      n++;
    }
    this.geometry.instanceCount = n;
    if (n > 0) {
      this.attrP.needsUpdate = true;
      this.attrX.needsUpdate = true;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.uniforms.uMap.value.dispose();
    this.material.dispose();
  }
}
