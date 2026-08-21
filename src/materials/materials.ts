import { DoubleSide, MeshStandardMaterial, Vector2 } from 'three'
import type { TextureRegistry } from './TextureRegistry'
import type { FamilyName } from './texgen/families'

export interface MaterialOpts {
  /** Albedo tint multiplier (subtle per-instance variation). */
  tint?: string
  /** Texture repeat — set on the shared maps' clone. */
  repeat?: [number, number]
  roughness?: number
  metalness?: number
  normalScale?: number
  doubleSide?: boolean
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
        const clone = tex.clone()
        clone.repeat.set(rx, ry)
        clone.needsUpdate = true
        mat[key] = clone
      }
    }
  }
  return mat
}
