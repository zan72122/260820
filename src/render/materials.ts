import { Color, DoubleSide, FrontSide, Material, MeshPhysicalMaterial, Texture } from 'three';
import * as tex from './textures';

const srgb = (hex: string): Color => new Color(hex).convertSRGBToLinear();

/** Reuse one baked image with a different tiling, instead of baking twice. */
function retile(t: Texture, x: number, y: number): Texture {
  const c = t.clone();
  c.repeat.set(x, y);
  c.needsUpdate = true;
  return c;
}

/**
 * Every surface in the park is a physically-based material with its own
 * roughness story — none of them are told apart by base colour alone.
 * Textures are baked on first use so nothing the child has not unlocked yet
 * costs memory or start-up time.
 */
export class MaterialLibrary {
  private cache = new Map<string, unknown>();
  private disposables: (Material | Texture)[] = [];

  private memo<T>(key: string, make: () => T): T {
    let v = this.cache.get(key) as T | undefined;
    if (v === undefined) {
      v = make();
      this.cache.set(key, v);
    }
    return v;
  }

  private track<T extends Material>(m: T): T {
    this.disposables.push(m);
    return m;
  }

  /** One brushed-steel bake shared by every metal part in the park. */
  private steelMaps(): tex.SlideMetalMaps {
    return this.memo('steelMaps', () => tex.bakeSlideMetal());
  }

  /** Brushed stainless bed. The slide shader is patched in world/slide.ts. */
  slideSteel(): MeshPhysicalMaterial {
    return this.memo('slideSteel', () => {
      const maps = this.steelMaps();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        aoMap: maps.aoMap,
        anisotropyMap: maps.anisotropyMap,
        color: srgb('#f2f4f5'),
        metalness: 1,
        roughness: 1,
        aoMapIntensity: 0.6,
        anisotropy: 0.55,
        anisotropyRotation: 0,
        // Kept just above zero so the water-film code path is compiled in.
        clearcoat: 0.02,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.15,
        side: FrontSide,
      });
      m.normalScale.set(0.55, 0.55);
      return this.track(m);
    });
  }

  /** Plain stainless for the rails and the gate flap. */
  bareSteel(rough = 0.3): MeshPhysicalMaterial {
    return this.memo(`bareSteel${rough}`, () => {
      // Clones share the same image but carry their own tiling.
      const maps = this.steelMaps();
      const m = new MeshPhysicalMaterial({
        map: retile(maps.map, 3, 1),
        roughnessMap: retile(maps.roughnessMap, 3, 1),
        normalMap: retile(maps.normalMap, 3, 1),
        color: srgb('#e8ebec'),
        metalness: 1,
        roughness: rough,
        anisotropyMap: maps.anisotropyMap,
        anisotropy: 0.4,
        envMapIntensity: 1.1,
      });
      m.normalScale.set(0.4, 0.4);
      return this.track(m);
    });
  }

  /** Powder-coated steelwork: a paint film, not a shiny metal. */
  paint(hex: string, key = hex): MeshPhysicalMaterial {
    return this.memo(`paint${key}`, () => {
      // One neutral bake, tinted per colour.
      const maps = this.memo('paintMaps', () => tex.bakePaint());
      const m = new MeshPhysicalMaterial({
        color: srgb(hex),
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalnessMap: maps.metalnessMap,
        metalness: 1,
        roughness: 1,
        clearcoat: 0.55,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.9,
      });
      m.normalScale.set(0.35, 0.35);
      return this.track(m);
    });
  }

  wood(): MeshPhysicalMaterial {
    return this.memo('wood', () => {
      const maps = tex.bakeWood();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        sheen: 0.15,
        sheenRoughness: 0.9,
        sheenColor: srgb('#8a6a44'),
        envMapIntensity: 0.75,
      });
      m.normalScale.set(0.8, 0.8);
      return this.track(m);
    });
  }

  woodEnd(): MeshPhysicalMaterial {
    return this.memo('woodEnd', () => {
      const maps = tex.bakeWoodEnd();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.7,
      });
      m.normalScale.set(0.7, 0.7);
      return this.track(m);
    });
  }

  rubberFloor(): MeshPhysicalMaterial {
    return this.memo('rubberFloor', () => {
      const maps = tex.bakeRubberFloor();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        clearcoat: 0.12,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.55,
      });
      m.normalScale.set(0.9, 0.9);
      return this.track(m);
    });
  }

  soil(): MeshPhysicalMaterial {
    return this.memo('soil', () => {
      const maps = tex.bakeSoil();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.6,
      });
      m.normalScale.set(0.32, 0.32);
      return this.track(m);
    });
  }

  felt(): MeshPhysicalMaterial {
    return this.memo('felt', () => {
      const maps = tex.bakeFelt();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        sheen: 0.85,
        sheenRoughness: 0.85,
        sheenColor: srgb('#e6c99a'),
        envMapIntensity: 0.5,
      });
      m.normalScale.set(1.1, 1.1);
      return this.track(m);
    });
  }

  sponge(): MeshPhysicalMaterial {
    return this.memo('sponge', () => {
      const maps = tex.bakeSponge();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        sheen: 0.3,
        sheenRoughness: 0.7,
        envMapIntensity: 0.6,
      });
      m.normalScale.set(1.4, 1.4);
      return this.track(m);
    });
  }

  rubber(hex = '#c94b3c'): MeshPhysicalMaterial {
    return this.memo(`rubber${hex}`, () => {
      const maps = tex.bakeRubber();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        color: srgb(hex),
        metalness: 0,
        roughness: 1,
        clearcoat: 0.18,
        clearcoatRoughness: 0.55,
        envMapIntensity: 0.7,
      });
      m.normalScale.set(0.5, 0.5);
      return this.track(m);
    });
  }

  /** Dark tyre rubber: same family, different wear story. */
  tyre(): MeshPhysicalMaterial {
    return this.memo('tyre', () => {
      const maps = tex.bakeRubber();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        color: srgb('#2b2b2e'),
        metalness: 0,
        roughness: 1,
        clearcoat: 0.1,
        clearcoatRoughness: 0.7,
        envMapIntensity: 0.5,
      });
      m.normalScale.set(0.7, 0.7);
      return this.track(m);
    });
  }

  polishedMetal(hex = '#dfe3e6'): MeshPhysicalMaterial {
    return this.memo(`polished${hex}`, () => {
      const maps = this.steelMaps();
      const m = new MeshPhysicalMaterial({
        color: srgb(hex),
        map: retile(maps.map, 1, 4),
        roughnessMap: retile(maps.roughnessMap, 1, 4),
        normalMap: retile(maps.normalMap, 1, 4),
        metalness: 1,
        roughness: 0.19,
        envMapIntensity: 1.7,
      });
      m.normalScale.set(0.22, 0.22);
      return this.track(m);
    });
  }

  ice(withTransmission: boolean): MeshPhysicalMaterial {
    return this.memo(`ice${withTransmission}`, () => {
      const maps = tex.bakeIce();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        color: srgb('#dff1f7'),
        metalness: 0,
        roughness: 1,
        transmission: withTransmission ? 0.92 : 0,
        thickness: 0.05,
        ior: 1.31,
        attenuationDistance: 0.35,
        attenuationColor: srgb('#bfe6f2'),
        transparent: !withTransmission,
        opacity: withTransmission ? 1 : 0.72,
        clearcoat: 0.9,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.25,
      });
      m.normalScale.set(0.35, 0.35);
      return this.track(m);
    });
  }

  leaf(): MeshPhysicalMaterial {
    return this.memo('leaf', () => {
      const maps = tex.bakeLeaf();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        side: DoubleSide,
        transmission: 0,
        sheen: 0.4,
        sheenRoughness: 0.6,
        sheenColor: srgb('#c9a45c'),
        envMapIntensity: 0.7,
      });
      m.normalScale.set(1.0, 1.0);
      return this.track(m);
    });
  }

  grass(): MeshPhysicalMaterial {
    return this.memo('grass', () => {
      const maps = tex.bakeGrass();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        sheen: 0.3,
        sheenRoughness: 0.9,
        sheenColor: srgb('#8fbf5a'),
        envMapIntensity: 0.55,
      });
      m.normalScale.set(0.9, 0.9);
      return this.track(m);
    });
  }

  sand(): MeshPhysicalMaterial {
    return this.memo('sand', () => {
      const maps = tex.bakeSand();
      const m = new MeshPhysicalMaterial({
        map: maps.map,
        roughnessMap: maps.roughnessMap,
        normalMap: maps.normalMap,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.6,
      });
      m.normalScale.set(1.2, 1.2);
      return this.track(m);
    });
  }

  /** Plain matte helper for small props that do not need their own bake. */
  matte(hex: string, rough = 0.75, metal = 0): MeshPhysicalMaterial {
    return this.memo(`matte${hex}${rough}${metal}`, () =>
      this.track(
        new MeshPhysicalMaterial({
          color: srgb(hex),
          roughness: rough,
          metalness: metal,
          envMapIntensity: 0.8,
        }),
      ),
    );
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.cache.clear();
  }
}
