import * as THREE from 'three'
import { MURK_GLSL } from './shaders'

export type MurkUniforms = {
  uMurkColor: THREE.IUniform<THREE.Color>
  uWaterY: THREE.IUniform<number>
  uClean: THREE.IUniform<number>
}

/**
 * Makes any standard material obey the turbid water: the deeper a surface sits
 * below the water line, the more it dissolves into silt colour. Nothing in this
 * field is visible "through" the water at range.
 */
export function applyMurk(material: THREE.Material, murkColor: THREE.Color, clean = 0): MurkUniforms {
  const u: MurkUniforms = {
    uMurkColor: { value: murkColor.clone() },
    uWaterY: { value: 0 },
    uClean: { value: clean },
  }
  const prev = material.onBeforeCompile?.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer)
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMurkWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvMurkWorld = (modelMatrix * vec4(transformed,1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MURK_GLSL}\nuniform float uClean;\nvarying vec3 vMurkWorld;`)
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight = mix(outgoingLight, uMurkColor, murkAmount(vMurkWorld, uClean, 0.0));\n#include <opaque_fragment>',
      )
  }
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `murk|${prevKey ? prevKey() : ''}`
  return u
}
