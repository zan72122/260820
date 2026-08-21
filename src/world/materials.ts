/** 現場のヒーローマテリアル定義。全面に同じ roughness を使わない。 */
import * as THREE from 'three'
import { concreteMaps, galvanizedMaps, groundMaps, moldedMaps, powderCoatMaps, webbingMap } from './textures'

export interface Palette {
  galvanized: THREE.MeshStandardMaterial
  /** 接合面・裏側：めっき面より曇らせる */
  galvanizedDull: THREE.MeshStandardMaterial
  boltSteel: THREE.MeshStandardMaterial
  deck: THREE.MeshStandardMaterial
  frame: THREE.MeshStandardMaterial
  chute: THREE.MeshStandardMaterial
  chuteBack: THREE.MeshStandardMaterial
  rail: THREE.MeshStandardMaterial
  concrete: THREE.MeshStandardMaterial
  ground: THREE.MeshStandardMaterial
  gravel: THREE.MeshStandardMaterial
  sling: THREE.MeshStandardMaterial
  tagLine: THREE.MeshStandardMaterial
  fence: THREE.MeshStandardMaterial
  fencePost: THREE.MeshStandardMaterial
  cone: THREE.MeshStandardMaterial
  coneBase: THREE.MeshStandardMaterial
  hiVis: THREE.MeshStandardMaterial
  helmet: THREE.MeshStandardMaterial
  workwear: THREE.MeshStandardMaterial
  skin: THREE.MeshStandardMaterial
  craneBody: THREE.MeshStandardMaterial
  craneBoom: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  hose: THREE.MeshStandardMaterial
  foliage: THREE.MeshStandardMaterial
  bark: THREE.MeshStandardMaterial
  house: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  safetySurface: THREE.MeshStandardMaterial
  timber: THREE.MeshStandardMaterial
  childShirt: THREE.MeshStandardMaterial
  childPants: THREE.MeshStandardMaterial
  ball: THREE.MeshStandardMaterial
}

export function createPalette(aniso: number): Palette {
  const galv = galvanizedMaps(aniso)
  const conc = concreteMaps(aniso)
  const grnd = groundMaps(Math.max(aniso, 8))
  const deckCoat = powderCoatMaps(0x3f6b8c, aniso)
  const frameCoat = powderCoatMaps(0x505b66, aniso)
  const railCoat = powderCoatMaps(0xb8542f, aniso)
  const molded = moldedMaps(0x8fa844, aniso)

  const galvanized = new THREE.MeshStandardMaterial({
    map: galv.map,
    roughnessMap: galv.roughnessMap,
    // 経年した溶融亜鉛めっきは酸化被膜で拡散反射が強い。完全な鏡面にはしない。
    metalness: 0.3,
    roughness: 0.6,
    color: 0xd3d8d9,
    envMapIntensity: 1.1,
  })

  return {
    galvanized,
    galvanizedDull: new THREE.MeshStandardMaterial({
      map: galv.map,
      roughnessMap: galv.roughnessMap,
      metalness: 0.2,
      roughness: 0.8,
      color: 0xc9cdcc,
      envMapIntensity: 0.7,
    }),
    boltSteel: new THREE.MeshStandardMaterial({ color: 0xcfd3d4, metalness: 0.55, roughness: 0.34 }),
    deck: new THREE.MeshStandardMaterial({
      map: deckCoat.map,
      roughnessMap: deckCoat.roughnessMap,
      metalness: 0.25,
      roughness: 0.62,
    }),
    frame: new THREE.MeshStandardMaterial({
      map: frameCoat.map,
      roughnessMap: frameCoat.roughnessMap,
      metalness: 0.3,
      roughness: 0.66,
    }),
    chute: new THREE.MeshStandardMaterial({
      map: molded.map,
      roughnessMap: molded.roughnessMap,
      metalness: 0.02,
      roughness: 0.72,
      side: THREE.DoubleSide,
    }),
    chuteBack: new THREE.MeshStandardMaterial({ color: 0x6f8434, metalness: 0.02, roughness: 0.78 }),
    rail: new THREE.MeshStandardMaterial({
      map: railCoat.map,
      roughnessMap: railCoat.roughnessMap,
      metalness: 0.28,
      roughness: 0.58,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: conc.map,
      roughnessMap: conc.roughnessMap,
      metalness: 0.0,
      roughness: 0.88,
    }),
    ground: new THREE.MeshStandardMaterial({
      map: grnd.map,
      roughnessMap: grnd.roughnessMap,
      metalness: 0.0,
      roughness: 0.95,
    }),
    gravel: new THREE.MeshStandardMaterial({ color: 0x8d8a80, metalness: 0, roughness: 0.92 }),
    sling: new THREE.MeshStandardMaterial({
      map: webbingMap(0x2f8f46, aniso),
      metalness: 0.0,
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),
    tagLine: new THREE.MeshStandardMaterial({ color: 0xd9c48a, metalness: 0, roughness: 0.9 }),
    fence: new THREE.MeshStandardMaterial({ color: 0xdadfe1, metalness: 0.15, roughness: 0.72, side: THREE.DoubleSide }),
    fencePost: new THREE.MeshStandardMaterial({ color: 0x9fa5a7, metalness: 0.6, roughness: 0.62 }),
    cone: new THREE.MeshStandardMaterial({ color: 0xd94f1e, metalness: 0.0, roughness: 0.66 }),
    coneBase: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.0, roughness: 0.85 }),
    hiVis: new THREE.MeshStandardMaterial({ color: 0xd7e04a, metalness: 0.0, roughness: 0.72 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0xe8e8e6, metalness: 0.05, roughness: 0.38 }),
    workwear: new THREE.MeshStandardMaterial({ color: 0x3f4a5c, metalness: 0.0, roughness: 0.86 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd6a887, metalness: 0.0, roughness: 0.72 }),
    craneBody: new THREE.MeshStandardMaterial({ color: 0xd8a326, metalness: 0.35, roughness: 0.55 }),
    craneBoom: new THREE.MeshStandardMaterial({ color: 0xe2e4e2, metalness: 0.4, roughness: 0.48 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, metalness: 0.0, roughness: 0.93 }),
    hose: new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.1, roughness: 0.7 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x4b6b39, metalness: 0.0, roughness: 0.92 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5c4b3c, metalness: 0.0, roughness: 0.95 }),
    house: new THREE.MeshStandardMaterial({ color: 0xcfc7b8, metalness: 0.0, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6b6360, metalness: 0.0, roughness: 0.85 }),
    safetySurface: new THREE.MeshStandardMaterial({ color: 0x8a5c42, metalness: 0.0, roughness: 0.97 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x8a6f4b, metalness: 0.0, roughness: 0.93 }),
    childShirt: new THREE.MeshStandardMaterial({ color: 0xe0644a, metalness: 0.0, roughness: 0.8 }),
    childPants: new THREE.MeshStandardMaterial({ color: 0x36527a, metalness: 0.0, roughness: 0.85 }),
    ball: new THREE.MeshStandardMaterial({ color: 0x2f6fd0, metalness: 0.0, roughness: 0.42 }),
  }
}
