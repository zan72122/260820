import type { Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import type { PatternKind } from '../state/OpticsState';
import { OPTICS_GLSL, OPTICS_UNIFORM_DECL, type OpticsUniforms } from './optics';

const KIND_INDEX: Record<PatternKind, number> = { rings: 0, stripes: 1, holes: 2 };

/**
 * The plate itself, seen from outside. Light does not pass through resin
 * like glass: it scatters, so the moulded pattern glows softly from within
 * and the thin sections go noticeably more transparent.
 */
export function injectPlateGlow(
  material: Material,
  uniforms: OpticsUniforms,
  kind: PatternKind,
): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uPlateKind = { value: KIND_INDEX[kind] };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLTW;\nvarying vec3 vLTN;\nvarying vec2 vPlate;`)
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>\n  vLTN = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vLTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vPlate = vec2(position.x, position.z);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${OPTICS_UNIFORM_DECL}
uniform float uPlateKind;
varying vec2 vPlate;
${OPTICS_GLSL}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float pi;
          vec3 pc = ltPattern(vPlate, 0.014, uPlateKind, pi);
          float back = smoothstep(-0.05, 0.65, dot(normalize(vLTN), uLTSun));
          float rim = pow(1.0 - abs(dot(normalize(vLTN), normalize(vViewPosition))), 2.0);
          float sun = smoothstep(0.0, 0.5, dot(uLTSun, uLTNormal)) * (1.0 - 0.6 * uLTCloud);
          // forward scatter through the laminate
          vec3 scat = pc * uLTSunColor * (pi * (0.42 + 0.62 * back) + 0.06) * sun;
          reflectedLight.indirectDiffuse += scat * diffuseColor.rgb * 1.5 + scat * 0.16;
          reflectedLight.indirectSpecular += scat * rim * 0.35;
          // thin, patterned sections let more through
          diffuseColor.a = clamp(diffuseColor.a * mix(1.05, 0.55, pi), 0.18, 1.0);
        }`,
      );
  };
  material.customProgramCacheKey = () => `lt-plate-${kind}`;
  material.needsUpdate = true;
}
