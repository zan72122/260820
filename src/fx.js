// ---------------------------------------------------------------------------
// Particles: snow thrown up by the sweeping hand, crumbs of soil, and the
// sparkle burst when the carrot finally lets go.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, clamp01 } from './util.js';
import { softDotSprite, sparkleSprite } from './textures.js';

const rng = makeRng(5150);

class PointPool {
  constructor(max, map, blending, gravity) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.spin = new Float32Array(max);
    this.gravity = gravity;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uPixelRatio;
        varying float vA;
        varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 900.0 * uPixelRatio / max(-mv.z, 0.12);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        varying float vA;
        varying vec3 vC;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC * t.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.geo = geo;
  }

  spawn(x, y, z, vx, vy, vz, size, life, color) {
    let i = this.count;
    if (i >= this.max) {
      // recycle the oldest
      i = (this._rr = ((this._rr || 0) + 1) % this.max);
    } else {
      this.count++;
    }
    const p3 = i * 3;
    this.pos[p3] = x; this.pos[p3 + 1] = y; this.pos[p3 + 2] = z;
    this.vel[p3] = vx; this.vel[p3 + 1] = vy; this.vel[p3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.col[p3] = color[0]; this.col[p3 + 1] = color[1]; this.col[p3 + 2] = color[2];
  }

  update(dt) {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const p3 = i * 3;
      this.vel[p3 + 1] += this.gravity * dt;
      this.vel[p3] *= 1 - 1.9 * dt;
      this.vel[p3 + 2] *= 1 - 1.9 * dt;
      this.pos[p3] += this.vel[p3] * dt;
      this.pos[p3 + 1] += this.vel[p3 + 1] * dt;
      this.pos[p3 + 2] += this.vel[p3 + 2] * dt;
      const t = clamp01(this.life[i] / this.maxLife[i]);
      this.alpha[i] = t * t * (3 - 2 * t);
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

/** Chunky soil clods - real little solids, not billboards, so they read close up. */
class ClodPool {
  constructor(max, material) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0075, 0), material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.rotV = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.head = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    for (let i = 0; i < max; i++) {
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
  }
  spawn(x, y, z, vx, vy, vz, scale, life) {
    const i = this.head = (this.head + 1) % this.max;
    const p3 = i * 3;
    this.pos[p3] = x; this.pos[p3 + 1] = y; this.pos[p3 + 2] = z;
    this.vel[p3] = vx; this.vel[p3 + 1] = vy; this.vel[p3 + 2] = vz;
    this.rot[p3] = rng() * 6.28; this.rot[p3 + 1] = rng() * 6.28; this.rot[p3 + 2] = rng() * 6.28;
    this.rotV[p3] = (rng() - 0.5) * 14; this.rotV[p3 + 1] = (rng() - 0.5) * 14; this.rotV[p3 + 2] = (rng() - 0.5) * 14;
    this.life[i] = life;
    this.scale[i] = scale;
  }
  update(dt, groundY) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const p3 = i * 3;
      this.vel[p3 + 1] -= 6.2 * dt;
      this.pos[p3] += this.vel[p3] * dt;
      this.pos[p3 + 1] += this.vel[p3 + 1] * dt;
      this.pos[p3 + 2] += this.vel[p3 + 2] * dt;
      const gy = groundY(this.pos[p3], this.pos[p3 + 2]);
      if (this.pos[p3 + 1] < gy) {
        this.pos[p3 + 1] = gy;
        this.vel[p3 + 1] *= -0.22;
        this.vel[p3] *= 0.5; this.vel[p3 + 2] *= 0.5;
        this.rotV[p3] *= 0.4; this.rotV[p3 + 1] *= 0.4; this.rotV[p3 + 2] *= 0.4;
      }
      this.rot[p3] += this.rotV[p3] * dt;
      this.rot[p3 + 1] += this.rotV[p3 + 1] * dt;
      this.rot[p3 + 2] += this.rotV[p3 + 2] * dt;
      const fade = clamp01(this.life[i] / 0.5);
      this.e.set(this.rot[p3], this.rot[p3 + 1], this.rot[p3 + 2]);
      this.q.setFromEuler(this.e);
      this.v.set(this.pos[p3], this.pos[p3 + 1], this.pos[p3 + 2]);
      const sc = this.scale[i] * fade;
      this.s.set(sc, sc, sc);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      if (this.life[i] <= 0) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
      }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene, soilMap) {
    this.snow = new PointPool(320, softDotSprite(64), THREE.NormalBlending, -3.2);
    this.sparkle = new PointPool(140, sparkleSprite(128), THREE.AdditiveBlending, -0.35);
    scene.add(this.snow.points);
    scene.add(this.sparkle.points);

    const clodMat = new THREE.MeshStandardMaterial({
      map: soilMap, color: 0x8a7358, roughness: 0.96, metalness: 0,
    });
    this.clods = new ClodPool(90, clodMat);
    scene.add(this.clods.mesh);

    // warm flare that blooms behind the carrot the instant it comes free
    const flareMat = new THREE.SpriteMaterial({
      map: softDotSprite(128, [255, 226, 178]),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    });
    this.flare = new THREE.Sprite(flareMat);
    this.flare.scale.setScalar(0.6);
    this.flare.renderOrder = 4;
    this.flare.visible = false;
    scene.add(this.flare);
    this.flareT = 0;
  }

  /** Powder kicked up by a sweep. */
  puffSnow(x, y, z, dirX, dirZ, amount) {
    const n = Math.min(9, 1 + Math.floor(amount * 90));
    for (let i = 0; i < n; i++) {
      const sp = 0.25 + rng() * 0.75;
      this.snow.spawn(
        x + (rng() - 0.5) * 0.09, y + 0.008 + rng() * 0.03, z + (rng() - 0.5) * 0.09,
        dirX * sp + (rng() - 0.5) * 0.4,
        0.32 + rng() * 0.75,
        dirZ * sp + (rng() - 0.5) * 0.4,
        0.010 + rng() * 0.024,
        0.45 + rng() * 0.5,
        [1, 1, 1]
      );
    }
  }

  /** Loose earth flicked aside. */
  puffSoil(x, y, z, amount, spread = 1) {
    const n = Math.min(7, 1 + Math.floor(amount * 40));
    for (let i = 0; i < n; i++) {
      this.clods.spawn(
        x + (rng() - 0.5) * 0.05, y + 0.01, z + (rng() - 0.5) * 0.05,
        (rng() - 0.5) * 0.9 * spread, 0.5 + rng() * 1.3 * spread, (rng() - 0.5) * 0.9 * spread,
        0.5 + rng() * 1.1, 0.9 + rng() * 0.7
      );
    }
    for (let i = 0; i < n; i++) {
      this.snow.spawn(
        x + (rng() - 0.5) * 0.06, y + 0.01, z + (rng() - 0.5) * 0.06,
        (rng() - 0.5) * 0.5, 0.25 + rng() * 0.5, (rng() - 0.5) * 0.5,
        0.008 + rng() * 0.012, 0.35 + rng() * 0.3,
        [0.42, 0.33, 0.24]
      );
    }
  }

  /** Celebration glitter. */
  burstSparkle(x, y, z, n = 26, spread = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, e = rng() * 1.3;
      const sp = (0.5 + rng() * 1.5) * spread;
      this.sparkle.spawn(
        x + (rng() - 0.5) * 0.05, y + (rng() - 0.5) * 0.05, z + (rng() - 0.5) * 0.05,
        Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 1.1, Math.sin(a) * Math.cos(e) * sp,
        0.011 + rng() * 0.021, 0.5 + rng() * 0.5,
        [1, 0.95, 0.86]
      );
    }
  }

  popFlare(pos) {
    this.flare.position.copy(pos);
    this.flare.visible = true;
    this.flareT = 1;
  }

  update(dt, groundY, pixelRatio) {
    this.snow.update(dt);
    this.sparkle.update(dt);
    this.clods.update(dt, groundY);
    this.snow.points.material.uniforms.uPixelRatio.value = pixelRatio;
    this.sparkle.points.material.uniforms.uPixelRatio.value = pixelRatio;
    if (this.flareT > 0) {
      this.flareT = Math.max(0, this.flareT - dt * 1.5);
      const t = this.flareT;
      this.flare.material.opacity = Math.sin(Math.PI * Math.min(1, (1 - t) * 3.2 + t * 0.1)) * 0.55 * t;
      this.flare.scale.setScalar(0.35 + (1 - t) * 0.95);
      if (this.flareT <= 0) this.flare.visible = false;
    }
  }
}
