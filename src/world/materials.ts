import * as THREE from 'three'
import {
  makeAsphalt,
  makeConcrete,
  makeDirtDetail,
  makeGrassDetail,
  makePaintedSteel,
  makeTarp,
  makeWindowLights,
  type SurfaceMaps,
} from './textures'

/** 全体で共有するマテリアル。テクスチャ生成は起動時に一度だけ。 */
export class MaterialLib {
  readonly grassMaps: SurfaceMaps
  readonly dirtMaps: SurfaceMaps
  readonly concrete: THREE.MeshStandardMaterial
  readonly asphalt: THREE.MeshStandardMaterial
  readonly steel: THREE.MeshStandardMaterial
  readonly steelDark: THREE.MeshStandardMaterial
  readonly paintWhite: THREE.MeshStandardMaterial
  readonly paintRed: THREE.MeshStandardMaterial
  readonly paintYellow: THREE.MeshStandardMaterial
  readonly wood: THREE.MeshStandardMaterial
  readonly tarp: THREE.MeshStandardMaterial
  readonly plasticOrange: THREE.MeshStandardMaterial
  readonly cloth: THREE.MeshStandardMaterial
  readonly sandbag: THREE.MeshStandardMaterial
  readonly windowTex: THREE.Texture
  readonly buildingDay: THREE.MeshStandardMaterial

  constructor(quality: number) {
    const size = quality > 0.6 ? 512 : 256
    const aniso = quality > 0.6 ? 8 : 4
    const small = quality > 0.6 ? 256 : 128

    this.grassMaps = makeGrassDetail(size, aniso)
    this.dirtMaps = makeDirtDetail(size, aniso)

    const con = makeConcrete(size, aniso)
    this.concrete = std(con, { roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) })

    const asp = makeAsphalt(size, aniso)
    this.asphalt = std(asp, { roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.4, 0.4) })

    const st = makePaintedSteel([104, 112, 116], size, aniso)
    this.steel = std(st, { roughness: 1, metalness: 0.35 })

    const std2 = makePaintedSteel([58, 62, 66], small, aniso)
    this.steelDark = std(std2, { roughness: 1, metalness: 0.4 })

    const wh = makePaintedSteel([196, 196, 190], small, aniso)
    this.paintWhite = std(wh, { roughness: 0.85, metalness: 0.05 })

    const rd = makePaintedSteel([152, 46, 38], small, aniso)
    this.paintRed = std(rd, { roughness: 0.8, metalness: 0.05 })

    const yl = makePaintedSteel([186, 146, 46], small, aniso)
    this.paintYellow = std(yl, { roughness: 0.85, metalness: 0.05 })

    const wd = makePaintedSteel([118, 92, 62], small, aniso)
    this.wood = std(wd, { roughness: 1, metalness: 0 })

    const tp = makeTarp(small, aniso)
    this.tarp = std(tp, { roughness: 1, metalness: 0, side: THREE.DoubleSide })

    this.plasticOrange = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c4551f'),
      roughness: 0.72,
      metalness: 0,
    })

    this.cloth = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d9d5c8'),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })

    this.sandbag = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8b7f66'),
      roughness: 1,
      metalness: 0,
    })

    this.windowTex = makeWindowLights(256)
    this.buildingDay = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5d5f63'),
      roughness: 0.95,
      metalness: 0,
    })
  }
}

function std(maps: SurfaceMaps, extra: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    ...extra,
  })
}
