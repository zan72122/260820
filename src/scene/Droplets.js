/**
 * Water that has left the water: the drops that run off the paper when it
 * comes up, and the spray a tail throws when it slaps the surface.
 *
 * One pooled InstancedMesh, no allocation after start-up. A drop that lands
 * puts a ripple back into the surface and pings the audio — the loop closes,
 * which is most of why it reads as real.
 */

import * as THREE from 'three';
import { LIGHTING_GLSL, createLightUniforms } from './lighting.js';
import { clamp } from '../core/Rng.js';

export class Droplets {
  /**
   * @param {object} o
   * @param {number} o.budget      maximum live drops
   * @param {import('../core/Rng.js').Rng} o.rng
   */
  constructor({ budget, rng, detail = 0 }) {
    this.rng = rng;
    this.max = budget;
    this.count = 0;

    this.pos = new Float32Array(budget * 3);
    this.vel = new Float32Array(budget * 3);
    this.life = new Float32Array(budget);
    this.size = new Float32Array(budget);
    this.hang = new Float32Array(budget);
    this.alive = new Uint8Array(budget);

    // One subdivision is enough to stop a falling drop reading as a die.
    const geo = new THREE.IcosahedronGeometry(1, detail);
    this.uniforms = { ...createLightUniforms(), uTime: { value: 0 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec4 wp = instanceMatrix * vec4(position, 1.0);
          wp = modelMatrix * wp;
          vW = wp.xyz;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${LIGHTING_GLSL}
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);
          vec3 base = vec3(0.34, 0.44, 0.46) * 0.5 + hemi(n) * 0.7;
          vec3 lamps = allLamps(vW, n);
          vec3 h = normalize(uKeyDir + v);
          float spec = pow(max(dot(n, h), 0.0), 90.0);
          // A drop is mostly a lens full of whatever is bright nearby, so it
          // reads as a highlight with a dark rim rather than a grey bead.
          vec3 col = base + lamps * 2.2 + (uKeyColor + uLampColor) * spec * 2.4;
          col += vec3(1.0, 0.82, 0.58) * fres * 1.1;
          gl_FragColor = vec4(col, clamp(0.42 + fres * 0.58, 0.0, 0.97));
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, budget);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
    this.mesh.count = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this.onSplash = null;
  }

  /**
   * @param {number} x,y,z    spawn point
   * @param {number} vx,vy,vz initial velocity
   * @param {number} size     radius in metres
   * @param {number} hang     seconds it clings before letting go
   */
  spawn(x, y, z, vx, vy, vz, size = 0.004, hang = 0) {
    let i = -1;
    for (let k = 0; k < this.max; k++) {
      if (!this.alive[k]) {
        i = k;
        break;
      }
    }
    if (i < 0) return false;
    this.alive[i] = 1;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = 3.0;
    this.size[i] = size;
    this.hang[i] = hang;
    this.count = Math.max(this.count, i + 1);
    return true;
  }

  /**
   * Run-off from the rim of the poi.
   *
   * Biased towards whichever side of the hoop is currently lowest, because
   * that is where water actually leaves a tilted sheet — and because a few
   * drops falling from one edge reads as draining, while the same number
   * sprinkled evenly round the rim reads as nothing at all.
   */
  runOff(poi, n, strength = 1) {
    const rng = this.rng;
    const low = this._lowestRimAngle(poi);
    for (let i = 0; i < n; i++) {
      const a = low + rng.sym(1.1);
      const r = rng.range(0.72, 1.0);
      const p = poi.paperWorldPoint(Math.cos(a) * r, Math.sin(a) * r, this._p.clone());
      this.spawn(
        p.x,
        p.y - 0.004,
        p.z,
        rng.sym(0.06) * strength,
        rng.range(-0.05, 0.12) * strength,
        rng.sym(0.06) * strength,
        // Generous for real water, but a 2mm drop is three pixels on a phone
        // held at arm's length, and these have to be seen to close the loop.
        rng.range(0.006, 0.0125),
        rng.range(0, 0.34)
      );
    }
  }

  /** Which way round the hoop hangs lowest, in the sheet's local angle. */
  _lowestRimAngle(poi) {
    let best = Infinity;
    let bestA = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = poi.paperWorldPoint(Math.cos(a) * 0.95, Math.sin(a) * 0.95, this._p);
      if (p.y < best) {
        best = p.y;
        bestA = a;
      }
    }
    return bestA;
  }

  /** Spray thrown up by a tail or a body hitting the surface. */
  splash(x, y, z, n, strength = 1) {
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(0.12, 0.42) * strength;
      this.spawn(
        x + rng.sym(0.012),
        y + 0.004,
        z + rng.sym(0.012),
        Math.cos(a) * sp,
        rng.range(0.28, 0.72) * strength,
        Math.sin(a) * sp,
        rng.range(0.0045, 0.0092),
        0
      );
    }
  }

  /**
   * @param {number} dt
   * @param {(x:number,z:number)=>number} waterHeightAt
   */
  update(dt, waterHeightAt) {
    let highest = 0;
    let drawn = 0;
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      const i3 = i * 3;
      if (this.hang[i] > 0) {
        this.hang[i] -= dt;
      } else {
        this.vel[i3 + 1] -= 9.81 * dt * 0.72; // a little slow, so drops read
        this.pos[i3] += this.vel[i3] * dt;
        this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
        this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      }
      this.life[i] -= dt;

      const wy = waterHeightAt(this.pos[i3], this.pos[i3 + 2]);
      if (this.pos[i3 + 1] <= wy || this.life[i] <= 0) {
        this.alive[i] = 0;
        if (this.life[i] > 0 && this.onSplash) {
          this.onSplash(this.pos[i3], this.pos[i3 + 2], this.size[i]);
        }
        continue;
      }
      highest = i + 1;

      // Falling drops stretch a little along their travel.
      const speed = Math.abs(this.vel[i3 + 1]);
      const stretch = clamp(1 + speed * 0.5, 1, 2.1);
      const s = this.size[i];
      this._p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      this._s.set(s, s * stretch, s);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(drawn, this._m);
      drawn++;
    }
    this.count = highest;
    this.mesh.count = drawn;
    if (drawn > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
