import type { Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import type { OpticsUniforms } from './optics';

/**
 * Must be applied to a material that already went through injectOptics:
 * the shared uniform declarations come from there.
 *
 * The film on the slide bed. Not a fluid sim: a set of travelling waves in
 * flume-local metres, whose gradient bends the surface normal, plus foam
 * streaks. Direction comes from per-vertex flow vectors baked by the bed
 * builder, so the film always runs the way the flume runs.
 */
export function injectWater(material: Material, uniforms: OpticsUniforms, foamGain: number): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec3 aAlong;
         attribute vec3 aAcross;
         varying vec3 vFlowAlong;
         varying vec3 vFlowAcross;
         varying vec2 vFilm;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vFlowAlong = normalize(mat3(modelMatrix) * aAlong);
         vFlowAcross = normalize(mat3(modelMatrix) * aAcross);
         vFilm = uv;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vFlowAlong;
         varying vec3 vFlowAcross;
         varying vec2 vFilm;

         // travelling film waves, arguments in metres along/across the flume
         float filmH(vec2 q, float t, float f){
           float a = sin(q.x * 7.3 - t * 3.1) * 0.55;
           float b = sin(q.x * 15.7 + q.y * 4.1 - t * 5.2) * 0.28;
           float c = sin(q.x * 31.0 - q.y * 9.3 - t * 8.4) * 0.12;
           float d = sin(q.y * 22.0 + t * 1.3) * 0.09;
           return (a + b + c + d) * (0.25 + 0.75 * f);
         }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           float ft = uLTRipple * 2.0;
           float amp = 0.0016 + uLTFlow * 0.0075;
           float e = 0.012;
           float h0 = filmH(vFilm, ft, uLTFlow);
           float hu = filmH(vFilm + vec2(e, 0.0), ft, uLTFlow);
           float hv = filmH(vFilm + vec2(0.0, e), ft, uLTFlow);
           float du = (hu - h0) / e * amp;
           float dv = (hv - h0) / e * amp;
           normal = normalize(normal - vFlowAlong * du - vFlowAcross * dv);
         }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
         {
           // aerated streaks where the film is fastest
           vec2 fu = vec2(vFilm.x * 0.42 - uLTRipple * 0.36, vFilm.y * 1.1);
           float foam = texture2D(uLTFoam, fu).r;
           foam += texture2D(uLTFoam, fu * 1.9 + vec2(0.31, 0.17)).r * 0.6;
           foam = max(0.0, foam - 0.52) * smoothstep(0.35, 1.0, uLTFlow) * ${foamGain.toFixed(3)};
           float edge = smoothstep(0.05, 0.5, abs(vFilm.y) * 0.9);
           foam *= 0.45 + edge * 0.9;
           reflectedLight.indirectDiffuse += vec3(0.9, 0.95, 1.0) * foam * 0.5;
           diffuseColor.a = clamp(diffuseColor.a + foam * 0.6, 0.0, 1.0);
         }`,
      );
  };
  material.customProgramCacheKey = () => `lt-water-${foamGain}`;
  material.needsUpdate = true;
}
