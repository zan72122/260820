import * as THREE from 'three';
import { bakeSurface, surfaceMaterial, type Recipe, type StandardOptions, type SurfaceMaps } from './texgen';

/**
 * Lazy, cached surface baking.
 *
 * Only the two materials the discovery sequence needs are baked before the
 * first frame; everything else is baked the moment it is first requested (a
 * few milliseconds each), which keeps time-to-first-drop short on a phone.
 */
export class MaterialLibrary {
  private maps = new Map<string, SurfaceMaps>();
  private materials = new Map<string, THREE.Material>();
  private scale: number;
  private anisotropy: number;

  constructor(textureScale = 1, anisotropy = 4) {
    this.scale = textureScale;
    this.anisotropy = anisotropy;
  }

  private bake(recipe: Recipe): SurfaceMaps {
    let m = this.maps.get(recipe.id);
    if (!m) {
      const base = recipe.size ?? 256;
      const size = Math.max(64, Math.round((base * this.scale) / 64) * 64);
      m = bakeSurface({ ...recipe, size }, size);
      this.maps.set(recipe.id, m);
    }
    return m;
  }

  /** Prime a recipe's maps without building a material (used during boot). */
  prime(recipe: Recipe) {
    this.bake(recipe);
  }

  /**
   * Fetch a material. Materials that differ only in tiling or tint share one
   * set of baked maps, so a variant key is required per distinct option set.
   */
  get(recipe: Recipe, options: StandardOptions = {}, variant = 'default'): THREE.Material {
    const key = `${recipe.id}#${variant}`;
    let mat = this.materials.get(key);
    if (mat) return mat;
    const maps = this.bake(recipe);
    if (options.repeat && options.repeat !== 1) {
      // A distinct repeat needs its own texture views so tiling does not leak
      // between users of the same recipe.
      const clone: SurfaceMaps = {
        map: maps.map.clone(),
        orm: maps.orm.clone(),
        normalMap: maps.normalMap.clone(),
        dispose() {
          this.map.dispose();
          this.orm.dispose();
          this.normalMap.dispose();
        },
      };
      clone.map.colorSpace = THREE.SRGBColorSpace;
      clone.map.needsUpdate = true;
      clone.orm.needsUpdate = true;
      clone.normalMap.needsUpdate = true;
      mat = surfaceMaterial(clone, { anisotropy: this.anisotropy, ...options });
      this.maps.set(`${key}:tiled`, clone);
    } else {
      mat = surfaceMaterial(maps, { anisotropy: this.anisotropy, ...options });
    }
    mat.name = key;
    this.materials.set(key, mat);
    return mat;
  }

  dispose() {
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.maps.values()) m.dispose();
    this.materials.clear();
    this.maps.clear();
  }
}
