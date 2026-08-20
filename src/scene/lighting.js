/**
 * One description of the light, shared by the three.js lights and by every
 * hand-written shader, so the paper, the water and the fish all agree about
 * where the stall lamp is.
 *
 * The festival is faked the way film fakes it: one warm key from the stall's
 * bare bulb, a cool ambient from the last of the dusk sky, and three small
 * point lights standing in for a whole street of lanterns. The lanterns
 * themselves are emissive geometry and cast no shadows — a hundred
 * shadow-casting point lights is exactly the mistake a phone cannot afford.
 */

import * as THREE from 'three';

export const LIGHT = {
  keyDir: new THREE.Vector3(0.3, 1.05, 0.22).normalize(),
  keyColor: new THREE.Color(0xffd2a1),
  keyIntensity: 3.6,
  skyColor: new THREE.Color(0x2b3f63),
  groundColor: new THREE.Color(0x2a1a12),
  ambientIntensity: 1.5,
  lanterns: [
    { pos: new THREE.Vector3(-1.0, 0.37, -1.36), color: new THREE.Color(0xff9d4d), power: 1.35 },
    { pos: new THREE.Vector3(1.08, 0.37, -1.36), color: new THREE.Color(0xffb066), power: 1.1 },
    { pos: new THREE.Vector3(0.1, 1.45, 0.4), color: new THREE.Color(0xffc98a), power: 0.8 },
  ],
};

export function createLightUniforms() {
  return {
    uKeyDir: { value: LIGHT.keyDir.clone() },
    uKeyColor: { value: LIGHT.keyColor.clone().multiplyScalar(LIGHT.keyIntensity) },
    uSkyColor: { value: LIGHT.skyColor.clone().multiplyScalar(LIGHT.ambientIntensity) },
    uGroundColor: { value: LIGHT.groundColor.clone().multiplyScalar(LIGHT.ambientIntensity) },
    uLampA: {
      value: new THREE.Vector4(
        LIGHT.lanterns[0].pos.x,
        LIGHT.lanterns[0].pos.y,
        LIGHT.lanterns[0].pos.z,
        LIGHT.lanterns[0].power
      ),
    },
    uLampB: {
      value: new THREE.Vector4(
        LIGHT.lanterns[1].pos.x,
        LIGHT.lanterns[1].pos.y,
        LIGHT.lanterns[1].pos.z,
        LIGHT.lanterns[1].power
      ),
    },
    uLampC: {
      value: new THREE.Vector4(
        LIGHT.lanterns[2].pos.x,
        LIGHT.lanterns[2].pos.y,
        LIGHT.lanterns[2].pos.z,
        LIGHT.lanterns[2].power
      ),
    },
    uLampColor: { value: new THREE.Color(0xff9f52) },
  };
}

/** Matching GLSL. Expects the uniforms above to be present. */
export const LIGHTING_GLSL = /* glsl */ `
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec4 uLampA;
uniform vec4 uLampB;
uniform vec4 uLampC;
uniform vec3 uLampColor;

vec3 hemi(vec3 n) {
  return mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
}

vec3 lampContribution(vec4 lamp, vec3 worldPos, vec3 n) {
  vec3 d = lamp.xyz - worldPos;
  float dist2 = max(dot(d, d), 0.02);
  vec3 l = d * inversesqrt(dist2);
  // Wrapped diffuse: a paper lantern is a big soft source, not a point.
  float ndl = max(dot(n, l) * 0.72 + 0.28, 0.0);
  return uLampColor * lamp.w * ndl / (1.0 + dist2 * 0.42);
}

vec3 allLamps(vec3 worldPos, vec3 n) {
  return lampContribution(uLampA, worldPos, n)
       + lampContribution(uLampB, worldPos, n)
       + lampContribution(uLampC, worldPos, n);
}
`;
