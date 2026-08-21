import { DoubleSide, MeshStandardMaterial, Vector2 } from 'three'
import type { TextureRegistry } from './TextureRegistry'
import type { FamilyName } from './texgen/families'
import { TEX_WORLD_SIZE } from './matkit'

export interface MaterialOpts {
  /** Albedo tint multiplier (subtle per-instance variation). */
  tint?: string
  /** Texture repeat — set on the shared maps' clone. */
  repeat?: [number, number]
  roughness?: number
  metalness?: number
  normalScale?: number
  doubleSide?: boolean
  /** Per-vertex tint baked at merge time (one draw call per assembly). */
  vertexColors?: boolean
}

/**
 * Standard-material factory over the registry. Materials are intentionally
 * NOT shared between callers that pass different repeats — textures are
 * cloned so each surface can scale its UV density to real-world size.
 */
export function makeMat(
  reg: TextureRegistry,
  family: FamilyName,
  opts: MaterialOpts = {},
): MeshStandardMaterial {
  const maps = reg.get(family)
  const mat = new MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    roughness: opts.roughness ?? 1,
    metalness: opts.metalness ?? 0,
  })
  if (maps.metalnessMap) mat.metalnessMap = maps.metalnessMap
  if (opts.vertexColors) mat.vertexColors = true
  if (opts.tint) mat.color.set(opts.tint)
  if (opts.normalScale !== undefined) {
    mat.normalScale = new Vector2(opts.normalScale, opts.normalScale)
  }
  if (opts.doubleSide) mat.side = DoubleSide
  if (opts.repeat) {
    const [rx, ry] = opts.repeat
    for (const key of ['map', 'roughnessMap', 'normalMap', 'metalnessMap'] as const) {
      const tex = mat[key]
      if (tex) {
        const clone = reg.trackClone(tex)
        clone.repeat.set(rx, ry)
        clone.needsUpdate = true
        mat[key] = clone
      }
    }
  }
  return mat
}

/**
 * 地面用: 土をベースに、頂点属性で苔（aMoss）・踏み分け（aWear）・湿り
 * 汚れ（aShade）をブレンドする拡張 StandardMaterial。ゾーンは環境ロジック
 * から作られる（シードで非対称）ので、「左右対称の汚れ」になりようがない。
 */
export function makeGroundMaterial(reg: TextureRegistry): MeshStandardMaterial {
  const soil = reg.get('soilPacked')
  const mossMaps = reg.get('moss')
  const mat = new MeshStandardMaterial({
    map: reg.trackClone(soil.map),
    roughnessMap: reg.trackClone(soil.roughnessMap),
    normalMap: reg.trackClone(soil.normalMap),
    roughness: 1,
    metalness: 0,
  })
  // UVはメートル単位: 全マップを同じ物理サイズで敷く
  for (const key of ['map', 'roughnessMap', 'normalMap'] as const) {
    const tex = mat[key]!
    tex.repeat.setScalar(1 / TEX_WORLD_SIZE.soilPacked)
    tex.needsUpdate = true
  }

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMossMap = { value: mossMaps.map }
    shader.uniforms.uMossScale = {
      value: TEX_WORLD_SIZE.soilPacked / TEX_WORLD_SIZE.moss,
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aMoss;
         attribute float aWear;
         attribute float aShade;
         varying vec3 vGroundZones;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
         vGroundZones = vec3(aMoss, aWear, aShade);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uMossMap;
         uniform float uMossScale;
         varying vec3 vGroundZones;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec4 mossTexel = texture2D(uMossMap, vMapUv * uMossScale);
         diffuseColor.rgb = mix(diffuseColor.rgb, mossTexel.rgb, vGroundZones.x);
         // 踏み固められた動線: わずかに明るく乾いた土
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.06, 1.0), vGroundZones.y);
         // 接地・湿りの暗部
         diffuseColor.rgb *= 1.0 - vGroundZones.z * 0.42;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 1.0, vGroundZones.x);
         roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.85, vGroundZones.y);`,
      )
  }
  return mat
}
