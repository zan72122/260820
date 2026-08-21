import * as THREE from 'three';
import {
  MapSet,
  castIronMaps,
  concreteMaps,
  epoxyFloorMaps,
  galvanisedMaps,
  paintedPipeMaps,
  pavingMaps,
  rubberMaps,
  stainlessMaps,
  waterNormalMap,
} from './textures';

function repeatSet(src: MapSet, ru: number, rv: number): MapSet {
  const c = <T extends THREE.Texture>(t: T): T => {
    const n = t.clone() as T;
    n.needsUpdate = true;
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.repeat.set(ru, rv);
    return n;
  };
  return { map: c(src.map), roughnessMap: c(src.roughnessMap), normalMap: c(src.normalMap) };
}

export interface WetUniforms {
  uFill: { value: number };
  uTime: { value: number };
  uWetTint: { value: THREE.Color };
  uFlow: { value: number };
}

export type WetMaterial = THREE.MeshStandardMaterial & { wet: WetUniforms };

/**
 * Painted pipe that reads as "carrying water" below the advancing front: cooler,
 * damper, with a condensation ring riding the leading edge and a travelling
 * ripple behind it that shows which way the water is going. Far cheaper — and
 * far clearer at a glance — than making a long run translucent.
 * Progress uses the tube's own length coordinate (uv.x), so it works on any bend.
 */
export function makeWetPipeMaterial(base: THREE.MeshStandardMaterial): WetMaterial {
  const m = base.clone() as WetMaterial;
  m.wet = {
    uFill: { value: 0 },
    uTime: { value: 0 },
    uWetTint: { value: new THREE.Color(0.55, 0.76, 0.9) },
    uFlow: { value: 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, m.wet);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vPipeT;\nvarying vec3 vPipeWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vPipeT = uv.x;',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vPipeWorld = (modelMatrix * vec4(transformed,1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vPipeT;
         varying vec3 vPipeWorld;
         uniform float uFill; uniform float uTime; uniform float uFlow; uniform vec3 uWetTint;
         float wetted, frontBand, ripple, sweat;`,
      )
      // computed in <map_fragment> because that chunk runs before both of the
      // chunks below in the standard fragment shader
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         wetted = 1.0 - smoothstep(uFill - 0.028, uFill + 0.008, vPipeT);
         frontBand = exp(-pow((vPipeT - uFill) * 30.0, 2.0)) * step(0.004, uFill) * step(uFill, 0.997);
         ripple = wetted * uFlow * (sin(vPipeT * 78.0 - uTime * 7.0) * 0.5 + 0.5);
         sweat = wetted * (0.5 + 0.5 * sin(vPipeWorld.y * 31.0 + uTime * 1.1));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(roughnessFactor + wetted * 0.1 - frontBand * 0.4 - ripple * 0.06, 0.04, 1.0);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82 + uWetTint * 0.1, wetted * 0.7);
         diffuseColor.rgb += uWetTint * frontBand * 0.16;
         diffuseColor.rgb *= 1.0 - sweat * 0.035 - ripple * 0.02;`,
      );
  };
  m.customProgramCacheKey = () => 'wetpipe';
  return m;
}

export class MaterialLibrary {
  readonly waterNormal: THREE.CanvasTexture;
  private readonly ironMaps: MapSet;
  private readonly paintMaps: MapSet;
  private readonly steelPaintMaps: MapSet;
  private readonly steelMaps: MapSet;
  private readonly rubberSet: MapSet;
  private readonly concreteSet: MapSet;
  private readonly floorSet: MapSet;
  private readonly galvSet: MapSet;
  private readonly pipeBlue: MapSet;
  private readonly pipeGrey: MapSet;
  private readonly pipeGreen: MapSet;
  private readonly pipeSlide: MapSet;
  private readonly pavingSet: MapSet;

  readonly castIron: THREE.MeshStandardMaterial;
  readonly castIronDark: THREE.MeshStandardMaterial;
  readonly stainless: THREE.MeshStandardMaterial;
  readonly stainlessRough: THREE.MeshStandardMaterial;
  readonly rubber: THREE.MeshStandardMaterial;
  readonly concrete: THREE.MeshStandardMaterial;
  readonly floor: THREE.MeshStandardMaterial;
  readonly galvanised: THREE.MeshStandardMaterial;
  readonly bluePipe: THREE.MeshStandardMaterial;
  readonly greyPipe: THREE.MeshStandardMaterial;
  readonly greenPipe: THREE.MeshStandardMaterial;
  /** Bright moulded flume blue — a slide is not a service pipe. */
  readonly slidePipe: THREE.MeshStandardMaterial;
  readonly paving: THREE.MeshStandardMaterial;
  readonly flumeShell: THREE.MeshStandardMaterial;
  readonly brass: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  /** Large panes and flume walls: reads translucent without a transmission pass. */
  readonly glassLite: THREE.MeshPhysicalMaterial;
  readonly waterClear: THREE.MeshPhysicalMaterial;
  /** Deep standing water — volume, not a lens; no transmission cost. */
  readonly waterDeep: THREE.MeshStandardMaterial;
  readonly waterBody: THREE.MeshStandardMaterial;
  readonly waterFilm: THREE.MeshStandardMaterial;
  readonly lampOff: THREE.MeshStandardMaterial;

  constructor() {
    this.waterNormal = waterNormalMap(256);
    this.ironMaps = castIronMaps(256);
    this.paintMaps = castIronMaps(256, [0.78, 0.78, 0.78]);
    this.steelPaintMaps = castIronMaps(256, [0.82, 0.82, 0.82], 0.16);
    this.steelMaps = stainlessMaps(256);
    this.rubberSet = rubberMaps(128);
    this.concreteSet = concreteMaps(384);
    this.floorSet = epoxyFloorMaps(384);
    this.galvSet = galvanisedMaps(192);
    this.pipeBlue = paintedPipeMaps([0.128, 0.203, 0.288], 256, 0.5);
    this.pipeGrey = paintedPipeMaps([0.24, 0.245, 0.235], 256, 0.3);
    this.pipeGreen = paintedPipeMaps([0.126, 0.184, 0.156], 256, 0.4);
    this.pipeSlide = paintedPipeMaps([0.115, 0.318, 0.6], 256, 0.15);
    this.pavingSet = pavingMaps(384);

    this.castIron = new THREE.MeshStandardMaterial({
      ...repeatSet(this.ironMaps, 2, 2),
      color: 0xe4e7ea,
      metalness: 0.3,
      roughness: 1,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });
    this.castIronDark = new THREE.MeshStandardMaterial({
      ...repeatSet(this.ironMaps, 3, 3),
      color: 0x9aa1a8,
      metalness: 0.5,
      roughness: 1,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });
    this.stainless = new THREE.MeshStandardMaterial({
      ...repeatSet(this.steelMaps, 1, 3),
      color: 0xd9dee3,
      metalness: 0.96,
      roughness: 1,
      normalScale: new THREE.Vector2(0.32, 0.32),
    });
    this.stainlessRough = new THREE.MeshStandardMaterial({
      ...repeatSet(this.steelMaps, 2, 2),
      color: 0xa8aeb4,
      metalness: 0.88,
      roughness: 1,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.rubber = new THREE.MeshStandardMaterial({
      ...repeatSet(this.rubberSet, 3, 1),
      color: 0xf0f0f0,
      metalness: 0.0,
      roughness: 1,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    this.concrete = new THREE.MeshStandardMaterial({
      ...repeatSet(this.concreteSet, 3, 3),
      color: 0xf2f0ec,
      metalness: 0.0,
      roughness: 1,
      normalScale: new THREE.Vector2(1.0, 1.0),
    });
    this.floor = new THREE.MeshStandardMaterial({
      ...repeatSet(this.floorSet, 5, 5),
      color: 0xffffff,
      metalness: 0.06,
      roughness: 1,
      normalScale: new THREE.Vector2(0.4, 0.4),
      envMapIntensity: 1.15,
    });
    this.galvanised = new THREE.MeshStandardMaterial({
      ...repeatSet(this.galvSet, 3, 1),
      color: 0xc8ccd0,
      metalness: 0.72,
      roughness: 1,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    this.bluePipe = new THREE.MeshStandardMaterial({
      ...repeatSet(this.pipeBlue, 1, 6),
      color: 0xffffff,
      metalness: 0.22,
      roughness: 1,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    this.greyPipe = new THREE.MeshStandardMaterial({
      ...repeatSet(this.pipeGrey, 1, 5),
      color: 0xffffff,
      metalness: 0.25,
      roughness: 1,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.greenPipe = new THREE.MeshStandardMaterial({
      ...repeatSet(this.pipeGreen, 1, 5),
      color: 0xffffff,
      metalness: 0.2,
      roughness: 1,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.slidePipe = new THREE.MeshStandardMaterial({
      ...repeatSet(this.pipeSlide, 1, 14),
      color: 0xffffff,
      metalness: 0.06,
      roughness: 1,
      normalScale: new THREE.Vector2(0.25, 0.25),
      envMapIntensity: 1.25,
    });
    this.paving = new THREE.MeshStandardMaterial({
      ...repeatSet(this.pavingSet, 1, 1),
      color: 0xffffff,
      metalness: 0.0,
      roughness: 1,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.flumeShell = new THREE.MeshStandardMaterial({
      ...repeatSet(this.steelPaintMaps, 3, 8),
      color: 0xe8f1f4,
      metalness: 0.05,
      roughness: 0.34,
      normalScale: new THREE.Vector2(0.16, 0.16),
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
    });

    this.brass = new THREE.MeshStandardMaterial({
      ...repeatSet(this.steelPaintMaps, 3, 3),
      color: 0xa8823f,
      metalness: 0.85,
      roughness: 0.34,
      normalScale: new THREE.Vector2(0.18, 0.18),
    });

    this.glass = new THREE.MeshPhysicalMaterial({
      color: 0xdfeef4,
      metalness: 0,
      roughness: 0.045,
      transmission: 0.96,
      thickness: 0.05,
      ior: 1.52,
      transparent: true,
      opacity: 1,
      envMapIntensity: 1.5,
      clearcoat: 0.6,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });

    this.waterClear = new THREE.MeshPhysicalMaterial({
      color: 0x63bfe8,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.5,
      thickness: 0.26,
      ior: 1.333,
      attenuationColor: new THREE.Color(0x2b86bb),
      attenuationDistance: 0.28,
      transparent: true,
      envMapIntensity: 1.3,
      normalMap: this.waterNormal,
      normalScale: new THREE.Vector2(0.12, 0.12),
    });

    this.glassLite = new THREE.MeshPhysicalMaterial({
      color: 0xcfe4ee,
      metalness: 0,
      roughness: 0.09,
      transparent: true,
      opacity: 0.34,
      ior: 1.5,
      clearcoat: 0.8,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.waterDeep = new THREE.MeshStandardMaterial({
      color: 0x1d5876,
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 1.1,
    });

    this.waterBody = new THREE.MeshStandardMaterial({
      color: 0x2f7fa8,
      metalness: 0.25,
      roughness: 0.14,
      normalMap: this.waterNormal.clone(),
      normalScale: new THREE.Vector2(0.5, 0.5),
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.94,
    });
    this.waterBody.normalMap!.wrapS = this.waterBody.normalMap!.wrapT = THREE.RepeatWrapping;
    this.waterBody.normalMap!.repeat.set(1, 4);
    this.waterBody.normalMap!.needsUpdate = true;

    this.waterFilm = new THREE.MeshStandardMaterial({
      color: 0x7fc4e4,
      metalness: 0.32,
      roughness: 0.08,
      transparent: true,
      opacity: 0.72,
      normalMap: this.waterNormal.clone(),
      normalScale: new THREE.Vector2(0.34, 0.34),
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterFilm.normalMap!.wrapS = this.waterFilm.normalMap!.wrapT = THREE.RepeatWrapping;
    this.waterFilm.normalMap!.repeat.set(2, 10);
    this.waterFilm.normalMap!.needsUpdate = true;

    this.lampOff = new THREE.MeshStandardMaterial({
      color: 0x2a2f33,
      metalness: 0.3,
      roughness: 0.5,
      emissive: 0x000000,
    });
  }

  /**
   * Re-tile a material for a specific part. Texture density has to match real
   * size or long runs smear into bands; every long cylinder or tube gets this.
   */
  retile<T extends THREE.MeshStandardMaterial>(mat: T, ru: number, rv: number): T {
    const out = mat.clone() as T;
    for (const key of ['map', 'roughnessMap', 'normalMap'] as const) {
      const src = mat[key];
      if (!src) continue;
      const t = src.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(ru, rv);
      t.needsUpdate = true;
      out[key] = t;
    }
    return out;
  }

  /**
   * Enamelled cast iron in an arbitrary plant colour — the neutral bake keeps the
   * cast skin, wear and oil film while `color` supplies the hue.
   */
  paintedCast(hex: number, rough = 1, metal = 0.32): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      ...repeatSet(this.paintMaps, 2, 2),
      color: hex,
      metalness: metal,
      roughness: rough,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
  }

  /** Smooth painted fabrication — structural steel, cladding, moulded shells. */
  paintedSteel(hex: number, rough = 0.62, metal = 0.22): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      ...repeatSet(this.steelPaintMaps, 2, 2),
      color: hex,
      metalness: metal,
      roughness: rough,
      normalScale: new THREE.Vector2(0.3, 0.3),
    });
  }

  /** Pipe material variants that carry the moving-front wetness shader. */
  wetPipe(kind: 'blue' | 'grey' | 'green' | 'slide'): WetMaterial {
    const src =
      kind === 'blue'
        ? this.bluePipe
        : kind === 'grey'
          ? this.greyPipe
          : kind === 'green'
            ? this.greenPipe
            : this.slidePipe;
    return makeWetPipeMaterial(src);
  }

  setEnvironment(env: THREE.Texture) {
    const all: THREE.Material[] = [
      this.castIron,
      this.castIronDark,
      this.stainless,
      this.stainlessRough,
      this.rubber,
      this.concrete,
      this.floor,
      this.galvanised,
      this.bluePipe,
      this.greyPipe,
      this.greenPipe,
      this.slidePipe,
      this.paving,
      this.flumeShell,
      this.brass,
      this.glass,
      this.glassLite,
      this.waterClear,
      this.waterDeep,
      this.waterBody,
      this.waterFilm,
    ];
    for (const m of all) {
      (m as THREE.MeshStandardMaterial).envMap = env;
      m.needsUpdate = true;
    }
  }
}
