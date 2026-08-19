import * as THREE from 'three'
import {
  creamBump,
  creamMap,
  metalMap,
  propsAtlas,
  spongeCrumbBump,
  spongeCrumbMap,
  spongeCrustMap,
  wallMap,
  woodMap,
} from './textures'

export interface Mats {
  crust: THREE.MeshStandardMaterial
  /** same look, but for primitives that carry no vertex-colour attribute */
  crustPlain: THREE.MeshStandardMaterial
  crumb: THREE.MeshStandardMaterial
  cream: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  steel: THREE.MeshStandardMaterial
  darkSteel: THREE.MeshStandardMaterial
  ceramic: THREE.MeshStandardMaterial
  handle: THREE.MeshStandardMaterial
  wall: THREE.MeshStandardMaterial
  props: THREE.MeshStandardMaterial
  sugarShell: THREE.MeshStandardMaterial
  chocolate: THREE.MeshStandardMaterial
  sugarSoft: THREE.MeshStandardMaterial
  ghost: THREE.MeshBasicMaterial
}

export function buildMaterials(): Mats {
  const crumbTex = spongeCrumbMap()
  const crumbBmp = spongeCrumbBump()

  const crust = new THREE.MeshStandardMaterial({
    map: spongeCrustMap(),
    bumpMap: crumbBmp,
    bumpScale: 0.16,
    roughness: 0.72,
    metalness: 0,
    vertexColors: true,
  })
  crust.map!.repeat.set(1, 1)

  const crumb = new THREE.MeshStandardMaterial({
    map: crumbTex,
    bumpMap: crumbBmp,
    bumpScale: 0.5,
    roughness: 0.96,
    metalness: 0,
    vertexColors: true,
  })

  const cream = new THREE.MeshStandardMaterial({
    map: creamMap(),
    bumpMap: creamBump(),
    bumpScale: 0.34,
    roughness: 0.44,
    metalness: 0,
    vertexColors: true,
    color: 0xfff6ea,
  })

  const wood = new THREE.MeshStandardMaterial({
    map: woodMap(),
    roughness: 0.66,
    metalness: 0,
  })

  const steel = new THREE.MeshStandardMaterial({
    map: metalMap(),
    roughness: 0.26,
    metalness: 0.85,
    color: 0xdde2e7,
    envMapIntensity: 1.1,
  })

  const darkSteel = new THREE.MeshStandardMaterial({
    map: metalMap(),
    roughness: 0.5,
    metalness: 0.72,
    color: 0x8d949c,
    envMapIntensity: 1.2,
  })

  const ceramic = new THREE.MeshStandardMaterial({
    color: 0xf3ece1,
    roughness: 0.28,
    metalness: 0.02,
  })

  const handle = new THREE.MeshStandardMaterial({
    map: woodMap(),
    color: 0x6b4630,
    roughness: 0.5,
    metalness: 0.05,
  })

  const wall = new THREE.MeshStandardMaterial({
    map: wallMap(),
    roughness: 0.94,
    metalness: 0,
  })

  const props = new THREE.MeshStandardMaterial({
    map: propsAtlas(),
    roughness: 0.62,
    metalness: 0.08,
  })
  props.map!.wrapS = props.map!.wrapT = THREE.ClampToEdgeWrapping

  const sugarShell = new THREE.MeshStandardMaterial({
    roughness: 0.14,
    metalness: 0.04,
    vertexColors: false,
    envMapIntensity: 1.6,
  })

  const chocolate = new THREE.MeshStandardMaterial({
    roughness: 0.42,
    metalness: 0.03,
    envMapIntensity: 0.9,
  })

  const sugarSoft = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.02,
    envMapIntensity: 1.15,
  })

  const ghost = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.32,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })

  const crustPlain = crust.clone()
  crustPlain.vertexColors = false

  return {
    crust,
    crustPlain,
    crumb,
    cream,
    wood,
    steel,
    darkSteel,
    ceramic,
    handle,
    wall,
    props,
    sugarShell,
    chocolate,
    sugarSoft,
    ghost,
  }
}
