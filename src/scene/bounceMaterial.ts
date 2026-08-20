/**
 * Injects the analytic sheet-bounce term into stock Three materials. Using
 * onBeforeCompile rather than a hand-written material keeps real PBR, shadows
 * and tone mapping, and adds only the physics the game actually needs.
 */
import * as THREE from 'three'
import { GLSL_BOUNCE } from '../sim/lightMath'
import { BOUNCE_UNIFORM_DECL, attachBounceUniforms, type LightRig } from './lightRig'

export interface BounceHooks {
  /** Extra declarations placed in the fragment shader. */
  fragmentCommon?: string
  /** Extra declarations placed in the vertex shader. */
  vertexCommon?: string
  /** Runs right after `#include <map_fragment>`. */
  afterMap?: string
  /** Runs right after `#include <lights_fragment_end>`. */
  afterLights?: string
  /** Runs right after `#include <opaque_fragment>` (gl_FragColor is live). */
  afterOpaque?: string
  /** Runs right after `#include <begin_vertex>`. */
  afterBeginVertex?: string
  uniforms?: Record<string, THREE.IUniform>
}

export function withBounce<T extends THREE.Material>(material: T, rig: LightRig, hooks: BounceHooks = {}): T {
  material.onBeforeCompile = (shader) => {
    attachBounceUniforms(shader.uniforms, rig)
    if (hooks.uniforms) for (const k of Object.keys(hooks.uniforms)) shader.uniforms[k] = hooks.uniforms[k]

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${BOUNCE_UNIFORM_DECL}\n${hooks.vertexCommon ?? ''}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nvMomoWNrm = normalize(mat3(modelMatrix) * objectNormal);',
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${hooks.afterBeginVertex ?? ''}\nvMomoWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${BOUNCE_UNIFORM_DECL}\n${GLSL_BOUNCE}\n${hooks.fragmentCommon ?? ''}`,
    )
    if (hooks.afterMap) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n${hooks.afterMap}`,
      )
    }
    if (hooks.afterLights) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>\n${hooks.afterLights}`,
      )
    }
    if (hooks.afterOpaque) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>\n${hooks.afterOpaque}`,
      )
    }
  }
  material.customProgramCacheKey = () => `momo-bounce-${material.uuid}`
  return material
}

/** The standard "how much sheet light reaches this fragment" expression. */
export const BOUNCE_AT_FRAGMENT = /* glsl */ `
float momoBounceHere() {
  return momoBounce(
    vMomoWPos, normalize(vMomoWNrm),
    uQ0, uQ1, uQ2, uQ3,
    uSheetNormal, uSunDir,
    uSheetAlbedo, uSunStrength, uSheetDeployed
  );
}
`
