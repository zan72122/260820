import type * as THREE from 'three';

/**
 * Large-scale variation for soil surfaces.
 *
 * A tiling soil texture over a whole field reads as a woven grid from
 * standing height. The obvious fix — baking low-frequency tint into vertex
 * colours — cannot work here, because the worked strip is a shape with holes
 * cut in it and therefore has almost no interior vertices, so its tint would
 * differ from the densely tessellated crater collar that laps over it and the
 * join would show as a pale disc.
 *
 * Doing it in the shader, from world position, makes every soil surface agree
 * regardless of how it happens to be tessellated: field, worked strip, split
 * plates and crater all sample the same function in the same space.
 */
export function applyMacroVariation(material: THREE.Material, strength = 1): void {
  const lo = 1 - 0.22 * strength;
  const hi = 1 + 0.16 * strength;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n\tvMacroPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vMacroPos;
float macroHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float macroNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = macroHash(i), b = macroHash(i + vec2(1.0, 0.0));
  float c = macroHash(i + vec2(0.0, 1.0)), d = macroHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 mp = vMacroPos.xz;
  float m = macroNoise(mp * 0.13) * 0.52 + macroNoise(mp * 0.55) * 0.31 + macroNoise(mp * 2.3) * 0.17;
  diffuseColor.rgb *= mix(${lo.toFixed(3)}, ${hi.toFixed(3)}, m);
}`,
      );
  };
  // Materials sharing a program must not share this one.
  material.customProgramCacheKey = () => `macro${strength.toFixed(2)}`;
  material.needsUpdate = true;
}
