import * as THREE from '../../vendor/three.module.js';
import { SUN_DIR, PALETTE } from '../world/env.js';
import { lerp, clamp } from '../util/math.js';
import { valueNoise2 } from '../util/rng.js';

/**
 * The hand line. It is the single thread of cause and effect in this game:
 * finger → hand → rope → net. It is rebuilt every frame and is never allowed
 * to be culled, so the link stays unbroken on screen.
 */
export class Rope {
  constructor({ ropeTex, fuzzTex, samples = 26, radial = 6 }) {
    this.N = samples;
    this.M = radial;
    this.length = 5.0;

    const build = (rad) => {
      const n = (this.N + 1) * (this.M + 1);
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const idx = [];
      for (let i = 0; i <= this.N; i++) {
        for (let j = 0; j <= this.M; j++) {
          const k = i * (this.M + 1) + j;
          uv[k * 2] = j / this.M;
          uv[k * 2 + 1] = i / this.N * 6.0;
        }
      }
      for (let i = 0; i < this.N; i++) {
        for (let j = 0; j < this.M; j++) {
          const a = i * (this.M + 1) + j, b = a + 1;
          const c = (i + 1) * (this.M + 1) + j, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
      void rad;
      return g;
    };

    this.geo = build();
    this.fuzzGeo = build();

    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: ropeTex }, uWet: { value: 0 },
        uSunDir: { value: SUN_DIR }, uSunColor: { value: PALETTE.sunColor },
        uSky: { value: PALETTE.skyHorizon }
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vUv = uv; vN = normalize(normal); vW = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        uniform sampler2D uMap; uniform float uWet;
        uniform vec3 uSunDir, uSunColor, uSky;
        void main(){
          vec3 t = texture2D(uMap, vUv).rgb;
          vec3 base = t * mix(vec3(0.72, 0.64, 0.47), vec3(0.26, 0.21, 0.16), uWet);
          vec3 V = normalize(cameraPosition - vW);
          vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
          float lam = max(dot(N, uSunDir), 0.0);
          vec3 col = base * (0.34 + lam * 0.80) + base * uSky * 0.26;
          vec3 H = normalize(uSunDir + V);
          col += uSunColor * pow(max(dot(N, H), 0.0), mix(10.0, 50.0, uWet)) * mix(0.04, 0.30, uWet);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });

    this.fuzzMaterial = new THREE.MeshBasicMaterial({
      map: fuzzTex, transparent: true, opacity: 0.20,
      depthWrite: false, side: THREE.DoubleSide, color: 0xe8dcc0
    });

    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.fuzz = new THREE.Mesh(this.fuzzGeo, this.fuzzMaterial);
    this.mesh.frustumCulled = false;
    this.fuzz.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.fuzz.renderOrder = 4;

    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._bn = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._pts = [];
    for (let i = 0; i <= this.N; i++) this._pts.push(new THREE.Vector3());
  }

  /**
   * @param hand   world position of the caster's hand
   * @param net    world position of the net's centre
   * @param slack  0 = bar taut, 1 = lying loose
   */
  update(hand, net, slack, wetness, time, floorFn) {
    const N = this.N, M = this.M;
    const pts = this._pts;
    const dist = hand.distanceTo(net);
    const sag = clamp(slack, 0, 1) * clamp(dist * 0.22, 0.05, 0.75) + 0.02;

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = pts[i];
      p.lerpVectors(hand, net, t);
      p.y -= Math.sin(Math.PI * t) * sag;
      // A rope is never a clean curve: give it a slow live wander.
      const w = Math.sin(Math.PI * t);
      p.x += (valueNoise2(t * 6.0 + time * 0.35, 3.1) - 0.5) * 0.045 * w;
      p.z += (valueNoise2(t * 6.0 + 11.0, time * 0.32) - 0.5) * 0.045 * w;
      p.y += (valueNoise2(t * 5.0 + 21.0, time * 0.28) - 0.5) * 0.030 * w;
      if (floorFn) { const f = floorFn(p.x, p.z); if (p.y < f) p.y = f; }
    }

    this._sweep(this.geo, pts, (t) => lerp(0.0105, 0.0072, t), 1.0);
    this._sweep(this.fuzzGeo, pts, (t) => lerp(0.0105, 0.0072, t) * 2.7, 1.0);
    this.material.uniforms.uWet.value = wetness;
    this.fuzzMaterial.opacity = lerp(0.16, 0.07, wetness);
  }

  _sweep(geo, pts, radiusFn) {
    const N = this.N, M = this.M;
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const up = this._up, t = this._t, n = this._n, bn = this._bn;
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      t.subVectors(b, a).normalize();
      if (Math.abs(t.y) > 0.94) n.set(1, 0, 0); else n.copy(up);
      bn.crossVectors(t, n).normalize();
      n.crossVectors(bn, t).normalize();
      const r = radiusFn(i / N);
      const c = pts[i];
      for (let j = 0; j <= M; j++) {
        const ang = (j / M) * Math.PI * 2;
        const cx = Math.cos(ang), sy = Math.sin(ang);
        const nx = n.x * cx + bn.x * sy;
        const ny = n.y * cx + bn.y * sy;
        const nz = n.z * cx + bn.z * sy;
        const k = (i * (M + 1) + j) * 3;
        pos[k] = c.x + nx * r; pos[k + 1] = c.y + ny * r; pos[k + 2] = c.z + nz * r;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }
}
