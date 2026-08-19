import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Mats } from './materials'
import { atlasUV } from './textures'
import { mulberry32 } from '../core/rng'
import { SHADOWS } from '../core/flags'

/** Squeeze a geometry's 0..1 UVs into one cell of the shared props atlas. */
function atlasify(geo: THREE.BufferGeometry, cell: number) {
  const { u, v, size } = atlasUV(cell)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  if (!uv) return geo
  for (let i = 0; i < uv.count; i++) {
    const su = THREE.MathUtils.clamp(uv.getX(i), 0, 1)
    const sv = THREE.MathUtils.clamp(uv.getY(i), 0, 1)
    uv.setXY(i, u + su * size, v + sv * size)
  }
  uv.needsUpdate = true
  return geo
}

function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) {
  if (ry) geo.rotateY(ry)
  geo.translate(x, y, z)
  return geo
}

/**
 * The patisserie behind the cake. Everything here is background: merged into a
 * couple of draw calls, sharing one texture atlas, kept darker and less saturated
 * than the cake, and pushed into fog so foreground / midground / background stay
 * clearly separated.
 */
export function buildKitchen(mats: Mats): THREE.Group {
  const root = new THREE.Group()
  const rng = mulberry32(2024)

  /* --- walls ------------------------------------------------------- */
  const back = new THREE.Mesh(new THREE.PlaneGeometry(320, 170), mats.wall)
  back.position.set(0, 40, -74)
  back.receiveShadow = false
  root.add(back)

  const side = new THREE.Mesh(new THREE.PlaneGeometry(200, 170), mats.wall)
  side.rotation.y = Math.PI / 2
  side.position.set(-96, 40, -10)
  root.add(side)

  /* --- shelving ---------------------------------------------------- */
  const shelfParts: THREE.BufferGeometry[] = []
  const shelfY = [13.5, 27.5, 41.5]
  for (const y of shelfY) {
    shelfParts.push(place(new THREE.BoxGeometry(96, 1.7, 15), -22, y, -64))
    shelfParts.push(place(new THREE.BoxGeometry(96, 0.9, 1.2), -22, y + 1.3, -57.2))
  }
  shelfParts.push(place(new THREE.BoxGeometry(2.2, 44, 15), -70, 27, -64))
  shelfParts.push(place(new THREE.BoxGeometry(2.2, 44, 15), 26, 27, -64))
  const shelves = new THREE.Mesh(mergeGeometries(shelfParts, false)!, mats.wood)
  shelves.receiveShadow = false
  root.add(shelves)

  /* --- jars and tins on the shelves (single merged atlas mesh) ------ */
  const jarParts: THREE.BufferGeometry[] = []
  for (const y of shelfY) {
    let x = -66
    while (x < 22) {
      const kind = Math.floor(rng() * 4)
      const w = 4.5 + rng() * 3.5
      const h = 5 + rng() * 7
      let g: THREE.BufferGeometry
      if (kind === 0) g = new THREE.CylinderGeometry(w * 0.5, w * 0.5, h, 14, 1)
      else if (kind === 1) g = new THREE.BoxGeometry(w, h, w * 0.8)
      else if (kind === 2) g = new THREE.CylinderGeometry(w * 0.42, w * 0.5, h, 12, 1)
      else g = new THREE.CylinderGeometry(w * 0.5, w * 0.5, h, 16, 1)
      atlasify(g, Math.floor(rng() * 16))
      jarParts.push(place(g, x + w * 0.5, y + 0.85 + h / 2, -64 + (rng() - 0.5) * 4))
      if (kind === 3) {
        const lid = new THREE.CylinderGeometry(w * 0.53, w * 0.53, 1.1, 16, 1)
        atlasify(lid, 9)
        jarParts.push(place(lid, x + w * 0.5, y + 0.85 + h + 0.4, -64))
      }
      x += w + 1.6 + rng() * 3
    }
  }
  const jars = new THREE.Mesh(mergeGeometries(jarParts, false)!, mats.props)
  jars.castShadow = false
  root.add(jars)

  /* --- wall oven ---------------------------------------------------- */
  const oven = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(46, 62, 30), mats.darkSteel)
  body.position.set(60, 22, -58)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 26),
    new THREE.MeshStandardMaterial({
      color: 0x2a1a10,
      emissive: 0xff9a3c,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.35,
    }),
  )
  glass.position.set(60, 26, -42.9)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 36, 12), mats.steel)
  bar.rotation.z = Math.PI / 2
  bar.position.set(60, 9.5, -42.2)
  const dial1 = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.4, 14), mats.steel)
  dial1.rotation.x = Math.PI / 2
  dial1.position.set(48, 47, -42.6)
  const dial2 = dial1.clone()
  dial2.position.x = 72
  oven.add(body, glass, bar, dial1, dial2)
  root.add(oven)

  // warm spill from the oven window, a cheap but convincing depth cue
  const ovenGlow = new THREE.PointLight(0xff9436, 26, 90, 2)
  ovenGlow.position.set(60, 24, -38)
  root.add(ovenGlow)

  /* --- cooling rack with spare sponges ------------------------------ */
  const rackParts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 13; i++)
    rackParts.push(place(new THREE.BoxGeometry(0.28, 0.28, 22), -46 + i * 1.9, -1.1, -34))
  for (let i = 0; i < 3; i++)
    rackParts.push(place(new THREE.BoxGeometry(24, 0.3, 0.3), -34, -1.1, -44 + i * 10))
  for (const [dx, dz] of [
    [-22, -44],
    [-46, -44],
    [-22, -24],
    [-46, -24],
  ])
    rackParts.push(place(new THREE.CylinderGeometry(0.3, 0.3, 2, 8), dx, -2.1, dz))
  const rack = new THREE.Mesh(mergeGeometries(rackParts, false)!, mats.steel)
  root.add(rack)

  for (let i = 0; i < 2; i++) {
    const sponge = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 6.4, 2.2, 28),
      mats.crustPlain,
    )
    sponge.position.set(-42 + i * 15, 0.1, -34 + i * 3)
    sponge.castShadow = SHADOWS
    root.add(sponge)
  }

  /* --- hanging utensils --------------------------------------------- */
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 10), mats.steel)
  rail.rotation.z = Math.PI / 2
  rail.position.set(-22, 52, -62)
  root.add(rail)
  const hangParts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const x = -46 + i * 9
    hangParts.push(place(new THREE.TorusGeometry(1.2, 0.18, 4, 12), x, 50.6, -62))
    if (i % 2 === 0) {
      const w = new THREE.SphereGeometry(2.6, 12, 8)
      w.scale(1, 0.55, 0.5)
      hangParts.push(place(w, x, 45.5, -62))
      hangParts.push(place(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), x, 47.5, -62))
    } else {
      hangParts.push(place(new THREE.BoxGeometry(4.4, 6, 0.5), x, 45.5, -62))
      hangParts.push(place(new THREE.CylinderGeometry(0.32, 0.32, 7, 8), x, 47.6, -62))
    }
  }
  const hangs = new THREE.Mesh(mergeGeometries(hangParts, false)!, mats.steel)
  root.add(hangs)

  /* --- a few decorating supplies within the middle ground ------------ */
  const supplyParts: THREE.BufferGeometry[] = []
  const spots: Array<[number, number, number]> = [
    [26, -1.6, -30],
    [31, -1.6, -36],
    [-58, -1.6, -22],
    [-52, -1.6, -30],
    [40, -1.6, -24],
  ]
  spots.forEach(([x, y, z], i) => {
    const h = 5 + rng() * 4
    const g = new THREE.CylinderGeometry(2.1, 2.1, h, 14, 1)
    atlasify(g, [12, 13, 5, 6, 0][i % 5])
    supplyParts.push(place(g, x, y + h / 2 + 1.5, z))
  })
  const supplies = new THREE.Mesh(mergeGeometries(supplyParts, false)!, mats.props)
  root.add(supplies)

  // background reads slightly darker and less saturated than the hero
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m && 'color' in m && o !== back && o !== side) m.needsUpdate = true
  })

  return root
}
