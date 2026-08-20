/**
 * The water surface.
 *
 * Deliberately not a fluid simulation. What sells water on a phone is:
 * expanding ring waves where things touch it, broken lantern highlights on a
 * moving normal, a fresnel-weighted mix between reflection and the tinted
 * bottom, and a bright meniscus at the tub wall. All of that is analytic.
 *
 * The surface is drawn transparent with depth *testing* on and depth writing
 * off, so the depth buffer sorts it against the fish and the poi for free:
 * anything below the surface gets tinted by it, anything lifted above it
 * punches through. That single choice is what makes "the fish broke the
 * surface" readable without a special case.
 */

import * as THREE from 'three';
import { MAX_RIPPLES, RIPPLE_GLSL, FILMIC_GLSL } from './glsl/shared.js';
import { clamp } from '../core/Rng.js';

const RIPPLE_LIFE = 3.1;
const RIPPLE_SPEED = 1.05;
const RIPPLE_K = 34.0;

/** Evenly tessellated disc, slightly denser in the middle where play happens. */
export function makeDiscGeometry(rings, segments) {
  const pos = [];
  const uv = [];
  const idx = [];
  pos.push(0, 0, 0);
  uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) {
    const r = Math.pow(i / rings, 0.88);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, 0, z);
      uv.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
    }
  }
  for (let j = 0; j < segments; j++) {
    idx.push(0, 1 + ((j + 1) % segments), 1 + j);
  }
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      idx.push(a0 + j, b0 + j1, b0 + j);
      idx.push(a0 + j, a0 + j1, b0 + j1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Water {
  /**
   * @param {object} o
   * @param {object} o.settings  tier settings
   * @param {THREE.Texture} o.normalMap
   */
  constructor({ settings, normalMap }) {
    this.settings = settings;
    this.rippleCount = Math.min(settings.rippleCount, MAX_RIPPLES);
    this._cursor = 0;
    this.time = 0;

    const ripples = [];
    for (let i = 0; i < this.rippleCount; i++) ripples.push(new THREE.Vector4(0, 0, -99, 0));

    /** Shared with the tub floor so its caustics track the same waves. */
    this.uniforms = {
      uTime: { value: 0 },
      uSwell: { value: 1 },
      uRipples: { value: ripples },
      uNormalMap: { value: normalMap },
      uLantern0: { value: new THREE.Vector4(-1.5, 1.55, -1.9, 1.0) },
      uLantern1: { value: new THREE.Vector4(1.35, 1.75, -1.6, 0.8) },
      uLantern2: { value: new THREE.Vector4(0.15, 2.15, 0.9, 0.55) },
      uKeyDir: { value: new THREE.Vector3(0.35, 0.86, 0.36).normalize() },
      uDeep: { value: new THREE.Color(0x10201e) },
      uShallow: { value: new THREE.Color(0x1d3a34) },
      uTint: { value: 0.34 },
      uBounds: { value: new THREE.Vector2(1, 1) },
      uDetail: { value: settings.waterSegments > 60 ? 1 : 0.55 },
    };

    const geo = makeDiscGeometry(
      Math.max(12, Math.round(settings.waterSegments * 0.34)),
      Math.max(28, Math.round(settings.waterSegments))
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      defines: { RIPPLE_COUNT: this.rippleCount },
      vertexShader: /* glsl */ `
        ${RIPPLE_GLSL}
        varying vec3 vWorld;
        varying vec3 vNormalW;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float h = waterHeight(wp.xz, uTime);
          wp.y += h;
          vWorld = wp.xyz;
          vNormalW = waterNormalAt(wp.xz, uTime, 0.035);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${RIPPLE_GLSL}
        ${FILMIC_GLSL}
        uniform sampler2D uNormalMap;
        uniform vec4 uLantern0;
        uniform vec4 uLantern1;
        uniform vec4 uLantern2;
        uniform vec3 uKeyDir;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uTint;
        uniform vec2 uBounds;
        uniform float uDetail;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        varying vec2 vUv;

        vec3 nightSky(vec3 d) {
          float up = clamp(d.y, -1.0, 1.0);
          vec3 zenith = vec3(0.030, 0.038, 0.070);
          vec3 horizon = vec3(0.330, 0.165, 0.086);
          vec3 c = mix(horizon, zenith, pow(clamp(up, 0.0, 1.0), 0.52));
          float band = exp(-pow((up - 0.04) * 6.5, 2.0));
          c += vec3(0.50, 0.235, 0.085) * band * 0.62;
          return c;
        }

        // Point-light specular. Lanterns hanging over a rippled surface break
        // into long shivering columns of light — the signature of festival water.
        float lampSpec(vec3 n, vec3 v, vec4 lamp, float power) {
          vec3 l = normalize(lamp.xyz - vWorld);
          vec3 h = normalize(l + v);
          float s = pow(max(dot(n, h), 0.0), power);
          float dist = length(lamp.xyz - vWorld);
          return s * lamp.w / (1.0 + dist * dist * 0.11);
        }

        void main() {
          vec3 n = normalize(vNormalW);

          // two scrolling detail normals for the fine chop
          vec2 p = vWorld.xz;
          vec3 d1 = texture2D(uNormalMap, p * 1.55 + vec2(uTime * 0.020, uTime * 0.013)).xyz * 2.0 - 1.0;
          vec3 d2 = texture2D(uNormalMap, p * 3.10 - vec2(uTime * 0.031, uTime * 0.017)).xyz * 2.0 - 1.0;
          vec3 detail = normalize(vec3(d1.x + d2.x * 0.6, 2.6 / uDetail, d1.y + d2.y * 0.6));
          n = normalize(mix(n, normalize(n + detail * 0.5), 0.55 * uDetail));

          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.4);
          fres = clamp(0.035 + fres * 0.965, 0.0, 1.0);

          vec3 refl = nightSky(reflect(-v, n));
          float spec = 0.0;
          spec += lampSpec(n, v, uLantern0, 220.0);
          spec += lampSpec(n, v, uLantern1, 180.0);
          spec += lampSpec(n, v, uLantern2, 320.0);
          float keySpec = pow(max(dot(n, normalize(uKeyDir + v)), 0.0), 90.0) * 0.5;

          // How far this bit of water is from the rim, in normalised tub units.
          vec2 e = vec2(vWorld.x / uBounds.x, vWorld.z / uBounds.y);
          float edge = clamp(length(e), 0.0, 1.0);
          float meniscus = smoothstep(0.86, 1.0, edge);

          vec3 tint = mix(uShallow, uDeep, smoothstep(0.1, 0.9, 1.0 - edge));
          vec3 col = mix(tint, refl, fres);
          col += vec3(1.0, 0.72, 0.45) * spec * 1.5;
          col += vec3(1.0, 0.85, 0.68) * keySpec;
          col += vec3(0.9, 0.62, 0.36) * meniscus * 0.22;

          float alpha = mix(uTint, 0.94, fres);
          alpha = clamp(alpha + spec * 0.5 + meniscus * 0.24, 0.0, 1.0);

          gl_FragColor = vec4(filmicKnee(col), alpha);
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = true;
  }

  /** Elliptical tub footprint; portrait and landscape use different shapes. */
  setBounds(rx, rz) {
    this.mesh.scale.set(rx, 1, rz);
    this.uniforms.uBounds.value.set(rx, rz);
  }

  /**
   * @param {number} x,z  world position
   * @param {number} strength  metres of initial displacement (0.004 .. 0.03)
   */
  addRipple(x, z, strength) {
    const v = this.uniforms.uRipples.value[this._cursor % this.rippleCount];
    this._cursor++;
    v.set(x, z, this.time, clamp(strength, 0, 0.06));
    return v;
  }

  update(dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
  }

  // ---- CPU mirror of the GLSL height field -------------------------------
  // Used for droplet splashes and for deciding how deep the paper is sitting.

  _swellAt(x, z) {
    const t = this.time;
    const s = this.uniforms.uSwell.value;
    return (
      (Math.sin(x * 3.1 + t * 0.75) * 0.0042 +
        Math.sin(z * 2.55 - t * 0.61) * 0.0038 +
        Math.sin((x + z) * 7.3 + t * 1.6) * 0.0014 +
        Math.sin((x - z * 1.4) * 12.1 - t * 2.1) * 0.0008) *
      s
    );
  }

  heightAt(x, z) {
    let h = this._swellAt(x, z);
    const t = this.time;
    const arr = this.uniforms.uRipples.value;
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (r.w === 0) continue;
      const age = t - r.z;
      if (age < 0 || age > RIPPLE_LIFE) continue;
      const d = Math.hypot(x - r.x, z - r.y);
      const band = d - age * RIPPLE_SPEED;
      if (band > 0) continue;
      h +=
        r.w *
        Math.sin(band * RIPPLE_K) *
        Math.exp(band * 3.1) *
        Math.exp(-age * 1.15) *
        (1 / (1 + d * 3.4));
    }
    return h;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
