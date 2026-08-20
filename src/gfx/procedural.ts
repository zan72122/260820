import { MeshPhysicalMaterial, type IUniform, type MeshPhysicalMaterialParameters } from 'three';
import { NOISE, BUMP } from './shaders/lib';
import { afterChunk, beforeChunk, replaceChunk, tagProgram, type Shader } from './shaders/patch';

export interface ProceduralSpec {
  /** Unique cache key — three otherwise reuses one program for both materials. */
  key: string;
  uniforms: Record<string, IUniform>;
  /** Declarations shared by both stages (varyings). */
  shared?: string;
  /** Vertex-only declarations, e.g. custom `attribute`s. */
  vertexHead?: string;
  /** Extra vertex code, runs after `begin_vertex`. */
  vertex?: string;
  /** Helper functions available to `surface`. */
  head?: string;
  /**
   * Must assign: gAlbedo (linear), gRough, gMetal, gHeight, gBumpScale, gEmiss.
   * `vObjPos` (object space) and `vWPos` (world space) are in scope.
   */
  surface: string;
  params?: MeshPhysicalMaterialParameters;
}

/**
 * Builds a MeshPhysicalMaterial whose surface is evaluated procedurally in the
 * fragment shader. Keeps three's full PBR + IBL + shadow pipeline (so materials
 * still react correctly to the workshop lighting) while letting each hero
 * material define its own answer to light.
 */
export function proceduralMaterial(spec: ProceduralSpec): MeshPhysicalMaterial {
  const mat = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0,
    ...spec.params,
  });

  const shared = /* glsl */ `
    varying vec3 vObjPos;
    varying vec3 vWPos;
    varying vec3 vVNormal;
    ${spec.shared ?? ''}
  `;

  mat.onBeforeCompile = (shader: Shader) => {
    for (const [name, u] of Object.entries(spec.uniforms)) shader.uniforms[name] = u;

    shader.vertexShader = beforeChunk(shader.vertexShader, 'common',
      `${shared}\n${spec.vertexHead ?? ''}`);
    // View-space normal for fresnel terms: available before three declares
    // `normal`, and correct for flat-shaded and instanced meshes alike.
    shader.vertexShader = afterChunk(shader.vertexShader, 'defaultnormal_vertex',
      'vVNormal = normalize(transformedNormal);');
    shader.vertexShader = afterChunk(shader.vertexShader, 'begin_vertex', /* glsl */ `
      vObjPos = transformed;
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      ${spec.vertex ?? ''}
    `);

    const uniformDecls = Object.keys(spec.uniforms)
      .map((n) => uniformDecl(n, spec.uniforms[n]))
      .join('\n');

    shader.fragmentShader = beforeChunk(shader.fragmentShader, 'common', /* glsl */ `
      ${shared}
      ${uniformDecls}
      ${NOISE}
      ${BUMP}
      ${spec.head ?? ''}
      vec3  gAlbedo = vec3(0.5);
      float gRough = 0.6;
      float gMetal = 0.0;
      float gHeight = 0.0;
      float gBumpScale = 0.0;
      vec3  gEmiss = vec3(0.0);
      float gAlpha = 1.0;
    `);

    shader.fragmentShader = replaceChunk(shader.fragmentShader, 'map_fragment', /* glsl */ `
      {
        ${spec.surface}
      }
      diffuseColor.rgb *= gAlbedo;
      diffuseColor.a *= gAlpha;
    `);

    shader.fragmentShader = replaceChunk(shader.fragmentShader, 'roughnessmap_fragment',
      'float roughnessFactor = clamp(gRough, 0.015, 1.0);');
    shader.fragmentShader = replaceChunk(shader.fragmentShader, 'metalnessmap_fragment',
      'float metalnessFactor = clamp(gMetal, 0.0, 1.0);');
    shader.fragmentShader = replaceChunk(shader.fragmentShader, 'normal_fragment_maps',
      'normal = bumpPerturb(normal, -vViewPosition, gHeight, gBumpScale);');
    shader.fragmentShader = afterChunk(shader.fragmentShader, 'emissivemap_fragment',
      'totalEmissiveRadiance += gEmiss;');
  };

  tagProgram(mat, spec.key);
  return mat;
}

function uniformDecl(name: string, u: IUniform): string {
  const v = u.value;
  if (typeof v === 'number') return `uniform float ${name};`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('isTexture' in o) return `uniform sampler2D ${name};`;
    if ('isColor' in o) return `uniform vec3 ${name};`;
    if ('w' in o) return `uniform vec4 ${name};`;
    if ('z' in o) return `uniform vec3 ${name};`;
    if ('y' in o) return `uniform vec2 ${name};`;
  }
  throw new Error(`unsupported uniform type for ${name}`);
}
