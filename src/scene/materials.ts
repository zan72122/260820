import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three'
import { makeBrassMaps, makeConcreteTexture } from '../util/textures'

/**
 * One shared material library. The brass is deliberately *not* one uniform gold:
 * the sheltered train inside the glass is bright and low-roughness, the exposed
 * outer frame is oxidised and dusty, and the fittings that take the rain are
 * darker still.
 */
export class Materials {
  readonly brassInner: MeshStandardMaterial
  readonly brassOuter: MeshStandardMaterial
  readonly brassFitting: MeshStandardMaterial
  readonly steelDark: MeshStandardMaterial
  readonly steelGalv: MeshStandardMaterial
  readonly steelPaint: MeshStandardMaterial
  readonly chain: MeshStandardMaterial
  readonly rubber: MeshStandardMaterial
  readonly wood: MeshStandardMaterial
  readonly concrete: MeshStandardMaterial
  readonly glass: MeshPhysicalMaterial
  readonly enamel: MeshStandardMaterial
  readonly blued: MeshStandardMaterial

  constructor() {
    const maps = makeBrassMaps(256)
    const concrete = makeConcreteTexture(256)

    this.brassInner = new MeshStandardMaterial({
      color: new Color('#c9a463'),
      metalness: 0.95,
      roughness: 0.22,
      roughnessMap: maps.rough,
      envMapIntensity: 0.8,
    })
    // The rain-facing frame: oxide pulls it green-grey and rough.
    this.brassOuter = new MeshStandardMaterial({
      color: new Color('#8d7c4f'),
      map: maps.tint,
      metalness: 0.82,
      roughness: 0.55,
      roughnessMap: maps.rough,
      aoMap: maps.ao,
      envMapIntensity: 0.5,
    })
    this.brassFitting = new MeshStandardMaterial({
      color: new Color('#6f6141'),
      metalness: 0.8,
      roughness: 0.68,
      roughnessMap: maps.rough,
    })

    this.steelDark = new MeshStandardMaterial({
      color: new Color('#3a4046'),
      metalness: 0.85,
      roughness: 0.46,
    })
    this.steelGalv = new MeshStandardMaterial({
      color: new Color('#8e959b'),
      metalness: 0.9,
      roughness: 0.38,
    })
    // Municipal park green — the colour every real swing frame in a public park is painted.
    this.steelPaint = new MeshStandardMaterial({
      color: new Color('#4a6b5c'),
      metalness: 0.35,
      roughness: 0.58,
    })
    this.chain = new MeshStandardMaterial({
      color: new Color('#9aa1a6'),
      metalness: 0.95,
      roughness: 0.34,
    })
    this.rubber = new MeshStandardMaterial({
      color: new Color('#22252a'),
      metalness: 0.0,
      roughness: 0.85,
    })
    this.wood = new MeshStandardMaterial({
      color: new Color('#6a4d33'),
      metalness: 0.0,
      roughness: 0.72,
    })
    this.concrete = new MeshStandardMaterial({
      color: new Color('#8b8880'),
      map: concrete,
      metalness: 0.0,
      roughness: 0.92,
    })
    // Toughened glass: cheap on mobile (no transmission), but still reads as glass
    // thanks to clearcoat + a low base opacity.
    this.glass = new MeshPhysicalMaterial({
      color: new Color('#b6cbd9'),
      metalness: 0.0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
      side: 2,
    })
    // A public clock has a pale enamel face and dark hands, so it stays readable
    // in silhouette against a bright sky — and can be lit from within after dark.
    this.enamel = new MeshStandardMaterial({
      color: new Color('#e6dfc9'),
      metalness: 0.02,
      roughness: 0.5,
      emissive: new Color('#ffe6bb'),
      emissiveIntensity: 0,
    })
    this.blued = new MeshStandardMaterial({
      color: new Color('#1b1f28'),
      metalness: 0.7,
      roughness: 0.32,
    })
  }
}

let shared: Materials | null = null
export const materials = (): Materials => (shared ??= new Materials())
