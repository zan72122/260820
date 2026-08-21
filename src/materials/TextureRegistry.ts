import {
  CanvasTexture,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { Flags } from '../core/flags'
import { generateFamily, type FamilyName } from './texgen/families'

export interface PbrMaps {
  map: Texture
  roughnessMap: Texture
  normalMap: Texture
  metalnessMap?: Texture
}

/**
 * Hands out PBR texture sets per family. Always synthesizes the procedural
 * set synchronously (deterministic, zero-network boot), then — outside
 * E2E_FAST — tries to upgrade in place to committed CC0 scans under
 * /textures/<family>/ if the repo carries them (scripts/fetch-textures.mjs).
 */
export class TextureRegistry {
  private readonly cache = new Map<FamilyName, PbrMaps>()
  private readonly fallbacks: string[] = []
  private manifest: Promise<Set<string>> | null = null
  /** 配布したUVクローン: アップグレード時に全員へ届けるための台帳 */
  private readonly clones = new Map<Texture, Texture[]>()

  constructor(
    private readonly seed: number,
    private readonly flags: Flags,
  ) {}

  usedFallbackTextures(): string[] {
    return [...this.fallbacks]
  }

  /** repeat違いのクローンを登録付きで作る（CC0差し替えが全クローンに届く） */
  trackClone(tex: Texture): Texture {
    const clone = tex.clone()
    const list = this.clones.get(tex)
    if (list) list.push(clone)
    else this.clones.set(tex, [clone])
    return clone
  }

  get(family: FamilyName): PbrMaps {
    const hit = this.cache.get(family)
    if (hit) return hit

    const size = this.flags.e2eFast ? 128 : 512
    const bytes = generateFamily(family, this.seed, size)
    const toTexture = (
      data: Uint8ClampedArray,
      colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
    ): Texture => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0)
      }
      const tex = new CanvasTexture(canvas)
      tex.wrapS = RepeatWrapping
      tex.wrapT = RepeatWrapping
      tex.colorSpace = colorSpace
      tex.anisotropy = this.flags.e2eFast ? 1 : 4
      return tex
    }

    const maps: PbrMaps = {
      map: toTexture(bytes.albedo, SRGBColorSpace),
      roughnessMap: toTexture(bytes.rough, NoColorSpace),
      normalMap: toTexture(bytes.normal, NoColorSpace),
      ...(bytes.metalness
        ? { metalnessMap: toTexture(bytes.metalness, NoColorSpace) }
        : {}),
    }
    this.cache.set(family, maps)
    this.fallbacks.push(family)
    if (!this.flags.e2eFast) void this.tryUpgrade(family, maps)
    return maps
  }

  /** Swap procedural images for committed CC0 scans when available. */
  private async tryUpgrade(family: FamilyName, maps: PbrMaps): Promise<void> {
    try {
      this.manifest ??= fetch('/textures/manifest.json')
        .then((r) => (r.ok ? r.json() : []))
        .then((list: string[]) => new Set(list))
        .catch(() => new Set<string>())
      const available = await this.manifest
      if (!available.has(family)) return

      const loader = new TextureLoader()
      const swap = async (
        target: Texture,
        file: string,
        colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
      ) => {
        const fresh = await loader.loadAsync(`/textures/${family}/${file}`)
        // 画像はSourceを共有する全クローンに反映されるが、GPUへの再転送は
        // テクスチャごとの version 更新が必要 — 台帳の全員を起こす。
        target.image = fresh.image
        for (const t of [target, ...(this.clones.get(target) ?? [])]) {
          t.colorSpace = colorSpace
          t.needsUpdate = true
        }
      }
      await Promise.all([
        swap(maps.map, 'albedo.webp', SRGBColorSpace),
        swap(maps.roughnessMap, 'rough.webp', NoColorSpace),
        swap(maps.normalMap, 'normal.webp', NoColorSpace),
      ])
      const i = this.fallbacks.indexOf(family)
      if (i >= 0) this.fallbacks.splice(i, 1)
    } catch {
      // Keep the procedural set — never let a network hiccup break the scene.
    }
  }
}
