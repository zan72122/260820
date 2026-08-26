import * as THREE from '../../vendor/three.module.js';
import { fbm2 } from '../util/rng.js';

// One shared description of the place. Every shader reads from here so the
// light direction stays legible across sky, water, sand, net and spray.
// Ahead and to the left, and low. The height is load-bearing: a low sun is
// what lays the glitter path down the water toward the viewer, and that path
// is the clearest statement in the scene about where the light comes from.
// Raising it, or swinging it out to the side, takes the path off screen.
export const SUN_DIR = new THREE.Vector3(-0.400, 0.407, -0.821).normalize();

export const PALETTE = {
  sunColor:      new THREE.Color(0xffe0b4),
  skyZenith:     new THREE.Color(0x1b5182),
  skyHorizon:    new THREE.Color(0x9db2b6),
  haze:          new THREE.Color(0x93a6a8),
  waterShallow:  new THREE.Color(0x2a7a72),
  waterDeep:     new THREE.Color(0x06203a),
  sand:          new THREE.Color(0xb9a479),
  foam:          new THREE.Color(0xdfeae8)
};

export const WATER_LEVEL = 0.0;
export const PIER_TOP = 0.44;

// Distance from the pier edge, in metres, out into the water.
export function shoreDistance(x, z) {
  return Math.max(0, -z);
}

/**
 * Sea bed depth below the waterline. Two readable places: a calm sandy shallow
 * within ~7 m, and a deeper blue beyond ~11 m.
 *
 * Behind the pier the value goes *negative*: the sand keeps rising and comes
 * out of the water. Without that the whole half-plane behind the shore was a
 * flat five-centimetre puddle, which the foam term painted as a white slab.
 */
export function depthAt(x, z) {
  const d = -z;                       // metres seaward of the pier line
  if (d < 0) return Math.max(-0.95, 0.05 + d * 0.075);
  const s0 = smooth(0.0, 3.0, d);
  const s1 = smooth(2.5, 15.0, d);
  const s2 = smooth(12.0, 30.0, d);
  const bar = (fbm2(x * 0.11 + 3.1, z * 0.11 - 7.4, 3) - 0.5) * 0.5;
  return 0.05 + 0.75 * s0 + 1.9 * s1 + 1.9 * s2 + bar * s1;
}

export function seabedY(x, z) { return WATER_LEVEL - depthAt(x, z); }

/** 0 = calm shallow, 1 = the deeper blue. Used for fish choice and net behaviour. */
export function zoneOf(x, z) {
  return smooth(7.0, 14.0, shoreDistance(x, z));
}

function smooth(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// GLSL twin of depthAt/zoneOf, shared by the water and sea-bed shaders.
export const GLSL_ENV = /* glsl */`
  float envSmooth(float e0, float e1, float x){
    float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }
  float envHash(vec2 p){ return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123); }
  float envNoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(envHash(i), envHash(i + vec2(1.0, 0.0)), u.x),
               mix(envHash(i + vec2(0.0, 1.0)), envHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float envFbm(vec2 p){
    float f = 0.0, a = 0.5, n = 0.0;
    for (int i = 0; i < 3; i++){ f += a * envNoise(p); n += a; p *= 2.02; a *= 0.5; }
    return f / n;
  }
  float envDepth(vec2 xz){
    float d = -xz.y;
    if (d < 0.0) return max(-0.95, 0.05 + d * 0.075);
    float s0 = envSmooth(0.0, 3.0, d);
    float s1 = envSmooth(2.5, 15.0, d);
    float s2 = envSmooth(12.0, 30.0, d);
    float bar = (envFbm(vec2(xz.x * 0.11 + 3.1, xz.y * 0.11 - 7.4)) - 0.5) * 0.5;
    return 0.05 + 0.75 * s0 + 1.9 * s1 + 1.9 * s2 + bar * s1;
  }
`;
