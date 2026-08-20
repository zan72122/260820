import * as THREE from 'three';
import { NOISE3, EMBER_RAMP } from '../gfx/glsl.js';
import { radialGlowTexture } from '../gfx/textures.js';

// The fireball is the only object in the game that gets a real materials budget.
// It is a bead of molten slag two or three millimetres across: it boils, it has
// a cooler crust that drifts over a white-hot interior, it hangs as a teardrop
// because it is liquid, and it lags behind the paper cord that carries it.

const VERT = /* glsl */ `
${NOISE3}
uniform float uTime;
uniform float uWobble;
uniform float uBoil;
uniform vec3 uStretch;

varying vec3 vNormalW;
varying vec3 vPosL;
varying vec3 vViewDir;

void main(){
  vec3 n = normalize(normal);
  vec3 p = position;

  // Boiling surface. Two octaves at different speeds so it never looks like a
  // single scrolling texture.
  float b1 = fbm3(n * 5.5 + vec3(0.0, uTime * 0.9, 0.0), 2);
  float b2 = vnoise(n * 13.0 - vec3(uTime * 1.7, 0.0, uTime * 0.6));
  float disp = (b1 - 0.5) * 0.55 + (b2 - 0.5) * 0.28;
  p += n * disp * uWobble * uBoil;

  // Liquid hanging in gravity: fuller below, drawn to a point above where the
  // cord holds it.
  float y = clamp(p.y, -1.0, 1.0);
  p.y += 0.10 * (1.0 - y * y) * (y > 0.0 ? -0.55 : 0.30);
  p.x *= 1.0 + 0.05 * (1.0 - y);
  p.z *= 1.0 + 0.05 * (1.0 - y);

  // Motion smear when the hand moves.
  p += uStretch * dot(p, normalize(uStretch + vec3(1e-5))) * 0.6;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * n);
  vPosL = p;
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${NOISE3}
${EMBER_RAMP}

uniform float uTime;
uniform float uTemp;
uniform float uEmissive;
uniform float uCrust;

varying vec3 vNormalW;
varying vec3 vPosL;
varying vec3 vViewDir;

void main(){
  vec3 n = normalize(vNormalW);
  float fres = 1.0 - clamp(dot(n, normalize(vViewDir)), 0.0, 1.0);

  // Slag crust: cooler, darker islands sliding over the melt.
  float crust = fbm3(vPosL * 6.2 + vec3(0.0, -uTime * 0.55, uTime * 0.22), 3);
  float crustMask = smoothstep(0.46, 0.68, crust) * uCrust;

  // Fine boil right at the surface.
  float boil = vnoise(vPosL * 22.0 + vec3(uTime * 2.3, uTime * 1.1, -uTime * 1.9));

  // Hotter in the middle, where you are looking through more glowing liquid.
  float core = pow(1.0 - fres, 2.2);

  float temp = uTemp;
  temp *= 0.66 + 0.44 * core;
  temp += (boil - 0.5) * 0.13;
  temp -= crustMask * 0.42;
  temp = clamp(temp, 0.0, 1.0);

  vec3 col = emberRamp(temp);

  // Rim: the edge of a molten bead is thin and glows through.
  float rim = pow(fres, 2.6) * 0.9;

  float energy = uEmissive * (0.32 + 0.9 * core + rim) * (1.0 - crustMask * 0.55);
  gl_FragColor = vec4(col * energy, 1.0);
}
`;

const GLOW_VERT = /* glsl */ `
uniform float uScale;
varying vec2 vUv;
void main(){
  vUv = uv;
  // Camera-facing billboard built in view space, so it never shears.
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
}
`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main(){
  float a = texture2D(uMap, vUv).a;
  gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
}
`;

export class Fireball {
  constructor(lightRig, detail = 3) {
    this.lightRig = lightRig;
    const seg = detail >= 3 ? 40 : detail === 2 ? 28 : 18;
    const geo = new THREE.SphereGeometry(1, seg, Math.max(10, Math.floor(seg * 0.62)));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uTemp: { value: 0.5 },
        uEmissive: { value: 4.0 },
        uWobble: { value: 0.3 },
        uBoil: { value: 1.0 },
        uCrust: { value: 0.85 },
        uStretch: { value: new THREE.Vector3() },
      },
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;

    const glowTex = radialGlowTexture(128, 2.9);
    const coreTex = radialGlowTexture(96, 1.5);
    const quad = new THREE.PlaneGeometry(1, 1);

    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: {
        uMap: { value: glowTex },
        uColor: { value: new THREE.Color(1.0, 0.42, 0.13) },
        uIntensity: { value: 1.0 },
        uScale: { value: 0.02 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: {
        uMap: { value: coreTex },
        uColor: { value: new THREE.Color(1.0, 0.72, 0.34) },
        uIntensity: { value: 1.0 },
        uScale: { value: 0.008 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    this.halo = new THREE.Mesh(quad, this.haloMat);
    this.core = new THREE.Mesh(quad, this.coreMat);
    this.halo.renderOrder = 8;
    this.core.renderOrder = 11;
    this.halo.frustumCulled = false;
    this.core.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.add(this.halo, this.mesh, this.core);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this._smoothVel = new THREE.Vector3();
    this.radius = 0.001;
    this.temp = 0.4;
    this.detached = false;
    this.landed = false;
    this.fallTime = 0;
    this.visibleFactor = 1;
    this._tmp = new THREE.Vector3();
  }

  reset(pos) {
    this.position.copy(pos);
    this._prev.copy(pos);
    this.velocity.set(0, 0, 0);
    this._smoothVel.set(0, 0, 0);
    this.detached = false;
    this.landed = false;
    this.fallTime = 0;
    this.visibleFactor = 1;
  }

  detach(extraVel) {
    if (this.detached) return;
    this.detached = true;
    this.fallTime = 0;
    this.velocity.copy(this._smoothVel).multiplyScalar(0.55);
    if (extraVel) this.velocity.add(extraVel);
    this.velocity.y -= 0.035;
  }

  // anchor: where the cord tip currently is. The bead lags behind it, which is
  // what makes the hand -> cord -> bead -> spark chain feel like one object.
  update(dt, anchor, params, shakeWobble) {
    this._prev.copy(this.position);

    if (!this.detached) {
      const lag = 1 - Math.exp(-dt * 26.0);
      this._tmp.copy(anchor).sub(this.position).multiplyScalar(lag);
      this.position.add(this._tmp);
    } else {
      this.fallTime += dt;
      this.velocity.y -= 9.81 * dt;
      this.velocity.multiplyScalar(Math.exp(-1.4 * dt));
      this.position.addScaledVector(this.velocity, dt);
    }

    if (dt > 1e-5) {
      this._tmp.copy(this.position).sub(this._prev).divideScalar(dt);
      this.velocity.copy(this._tmp);
      this._smoothVel.lerp(this._tmp, 1 - Math.exp(-dt * 9.0));
    }

    this.radius = params.emberRadius;
    this.temp = params.emberTemp;

    let temp = params.emberTemp;
    let emissive = 3.0 + temp * 16.0;
    let radius = params.emberRadius;

    if (this.detached) {
      // Falling: it cools fast and the light goes with it.
      const f = Math.min(1, this.fallTime / 1.5);
      temp = params.emberTemp * (1 - f * 0.85);
      emissive = (3.0 + temp * 16.0) * (1 - f * 0.7);
      radius = params.emberRadius * (1 - f * 0.25);
      this.visibleFactor = 1 - f * 0.85;
    }

    this.group.position.copy(this.position);
    this.mesh.scale.setScalar(radius);

    const u = this.material.uniforms;
    u.uTemp.value = temp;
    u.uEmissive.value = emissive;
    u.uWobble.value = params.emberWobble * (1 + shakeWobble * 2.2);
    u.uCrust.value = 0.55 + (1 - temp) * 0.5;
    // Smear the bead along its own motion, capped so violent shaking deforms it
    // rather than tearing it apart.
    const sv = this._smoothVel;
    const smear = Math.min(0.42, sv.length() * 0.55);
    u.uStretch.value.copy(sv).normalize().multiplyScalar(smear);

    const powerScale = this.detached ? this.visibleFactor : 1;
    // The halo has to say "this is hot" without hiding the bead inside it.
    this.haloMat.uniforms.uScale.value = radius * (3.9 + temp * 2.4);
    this.haloMat.uniforms.uIntensity.value = (0.30 + temp * 0.80) * powerScale;
    this.haloMat.uniforms.uColor.value.setRGB(1.0, 0.30 + temp * 0.24, 0.07 + temp * 0.11);
    this.coreMat.uniforms.uScale.value = radius * 1.75;
    this.coreMat.uniforms.uIntensity.value = (0.8 + temp * 1.7) * powerScale;
    this.coreMat.uniforms.uColor.value.setRGB(1.0, 0.55 + temp * 0.34, 0.20 + temp * 0.44);

    this.lightRig.setEmber(this.position, params.emberPower * powerScale, temp);
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.halo.geometry.dispose();
    this.haloMat.dispose();
    this.coreMat.dispose();
  }
}
