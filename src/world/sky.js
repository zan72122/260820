import * as THREE from '../../vendor/three.module.js';
import { SUN_DIR, PALETTE } from './env.js';

// A dome, not a cubemap: gradient, low sun, sea haze and a few soft banks of cloud.
// The same function is reused by the water as its reflection source.
export const GLSL_SKY = /* glsl */`
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;

  float skyHash(vec2 p){ return fract(sin(p.x * 91.3 + p.y * 47.7) * 21753.11); }
  float skyNoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
               mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float skyFbm(vec2 p){
    float f = 0.0, a = 0.5, n = 0.0;
    for (int i = 0; i < 5; i++){ f += a * skyNoise(p); n += a; p = p * 2.03 + 17.0; a *= 0.5; }
    return f / n;
  }

  vec3 skyColor(vec3 dir, float time){
    dir = normalize(dir);
    float h = clamp(dir.y, -1.0, 1.0);
    float t = pow(clamp(h, 0.0, 1.0), 0.40);
    vec3 col = mix(uHorizon, uZenith, t);

    // Haze thickens right at the waterline so the offing reads as distance.
    float band = exp(-abs(h) * 14.0);
    col = mix(col, uHorizon * 0.99, band * 0.62);

    float sd = max(dot(dir, uSunDir), 0.0);
    col += uSunColor * pow(sd, 16.0) * 0.42;                 // broad glow
    col += uSunColor * pow(sd, 900.0) * 3.2;                // the disc itself
    col += uSunColor * pow(sd, 3.0) * 0.10 * band;          // haze picking up the sun

    // Flat, slow cloud banks. Kept faint: the sea is the subject.
    if (h > -0.02) {
      vec2 cp = dir.xz / max(h + 0.16, 0.05);
      float c = skyFbm(cp * 0.85 + vec2(time * 0.004, time * 0.0022));
      float cover = smoothstep(0.52, 0.80, c) * smoothstep(0.02, 0.22, h);
      vec3 cloudLit = mix(vec3(0.62, 0.65, 0.68), uSunColor * 1.02, pow(sd, 3.0) * 0.6 + 0.18);
      col = mix(col, cloudLit, cover * 0.46);
    }
    return col;
  }
`;

export function createSky({ forEnv = false } = {}) {
  const geo = new THREE.SphereGeometry(600, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uZenith: { value: PALETTE.skyZenith },
      uHorizon: { value: PALETTE.skyHorizon },
      uSunColor: { value: PALETTE.sunColor },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime;
      ${GLSL_SKY}
      void main(){
        vec3 c = skyColor(normalize(vDir), uTime);
        gl_FragColor = vec4(c, 1.0);
        ${forEnv ? '' : '#include <tonemapping_fragment>\n        #include <colorspace_fragment>'}
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  mesh.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return mesh;
}
