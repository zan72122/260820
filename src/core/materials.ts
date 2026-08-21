import * as THREE from 'three'
import { buildTextures, type TextureSet } from './textures'

export interface MaterialSet {
  tex: TextureSet
  resin: THREE.MeshStandardMaterial
  galvanised: THREE.MeshStandardMaterial
  paintedSteel: THREE.MeshStandardMaterial
  darkSteel: THREE.MeshStandardMaterial
  housing: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  conduit: THREE.MeshStandardMaterial
  concrete: THREE.MeshStandardMaterial
  ground: THREE.MeshStandardMaterial
  grass: THREE.MeshStandardMaterial
  bark: THREE.MeshStandardMaterial
  foliage: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  glassDark: THREE.MeshStandardMaterial
  needle: THREE.MeshStandardMaterial
  dial: THREE.MeshStandardMaterial
  skinTone: THREE.MeshStandardMaterial
  jacket: THREE.MeshStandardMaterial
  trousers: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  shoe: THREE.MeshStandardMaterial
  silhouette: THREE.MeshBasicMaterial
}

let cached: MaterialSet | null = null

export function buildMaterials(): MaterialSet {
  if (cached) return cached
  const tex = buildTextures()

  const resin = new THREE.MeshStandardMaterial({
    map: tex.rollerMap,
    roughnessMap: tex.rollerRough,
    normalMap: tex.rollerNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
  })

  const galvanised = new THREE.MeshStandardMaterial({
    map: tex.galvMap,
    roughnessMap: tex.galvRough,
    roughness: 1,
    metalness: 0.82,
    color: 0xffffff,
  })

  const paintedSteel = new THREE.MeshStandardMaterial({
    map: tex.paintMap,
    roughnessMap: tex.paintRough,
    roughness: 1,
    metalness: 0.12,
    color: 0xffffff,
  })

  // Same enamel process, different colour batch: the handrail run.
  const darkSteel = new THREE.MeshStandardMaterial({
    map: tex.paintMap,
    roughnessMap: tex.paintRough,
    roughness: 1,
    metalness: 0.2,
    color: 0x6e7a84,
  })

  // Weatherproof polyester-coated aluminium: the generator and the distribution box.
  const housing = new THREE.MeshStandardMaterial({
    map: tex.paintMap,
    roughnessMap: tex.paintRough,
    roughness: 1,
    metalness: 0.45,
    color: 0x8d9aa2,
  })

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.92,
    metalness: 0,
  })

  const conduit = new THREE.MeshStandardMaterial({
    map: tex.galvMap,
    roughnessMap: tex.galvRough,
    roughness: 1,
    metalness: 0.75,
    color: 0xc8ccd0,
  })

  const concrete = new THREE.MeshStandardMaterial({
    map: tex.concreteMap,
    roughnessMap: tex.concreteRough,
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
  })

  const ground = new THREE.MeshStandardMaterial({
    map: tex.groundMap,
    roughnessMap: tex.groundRough,
    normalMap: tex.groundNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
  })

  const grass = new THREE.MeshStandardMaterial({
    color: 0x1c2a1a,
    roughness: 0.96,
    metalness: 0,
  })

  const bark = new THREE.MeshStandardMaterial({
    map: tex.barkMap,
    roughnessMap: tex.barkRough,
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
  })

  const foliage = new THREE.MeshStandardMaterial({
    color: 0x16211a,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })

  const wood = new THREE.MeshStandardMaterial({
    map: tex.woodMap,
    roughness: 0.86,
    metalness: 0,
    color: 0xffffff,
  })

  // Unlit lamp glass seen from outside: dark, slightly reflective, never emissive.
  const glassDark = new THREE.MeshStandardMaterial({
    color: 0x2b2f33,
    roughness: 0.35,
    metalness: 0.1,
  })

  const needle = new THREE.MeshStandardMaterial({
    color: 0xd8552f,
    roughness: 0.55,
    metalness: 0.1,
  })

  const dial = new THREE.MeshStandardMaterial({
    color: 0xdad4c6,
    roughness: 0.72,
    metalness: 0,
  })

  const skinTone = new THREE.MeshStandardMaterial({
    color: 0xc79574,
    roughness: 0.82,
    metalness: 0,
  })

  const jacket = new THREE.MeshStandardMaterial({
    color: 0xc87a35,
    roughness: 0.9,
    metalness: 0,
  })

  const trousers = new THREE.MeshStandardMaterial({
    color: 0x2b3a52,
    roughness: 0.94,
    metalness: 0,
  })

  const hair = new THREE.MeshStandardMaterial({
    color: 0x241a13,
    roughness: 0.95,
    metalness: 0,
  })

  const shoe = new THREE.MeshStandardMaterial({
    color: 0x8a3b32,
    roughness: 0.85,
    metalness: 0,
  })

  // Far treeline and rooftops: pure occluders against the dusk sky, no shading cost.
  const silhouette = new THREE.MeshBasicMaterial({
    color: 0x0b0f16,
    fog: false,
  })

  cached = {
    tex,
    resin,
    galvanised,
    paintedSteel,
    darkSteel,
    housing,
    rubber,
    conduit,
    concrete,
    ground,
    grass,
    bark,
    foliage,
    wood,
    glassDark,
    needle,
    dial,
    skinTone,
    jacket,
    trousers,
    hair,
    shoe,
    silhouette,
  }
  return cached
}
