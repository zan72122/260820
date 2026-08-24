import * as THREE from 'three'
import { MaterialKit } from './materials'
import { L } from './layout'
import { mulberry32 } from './util'

// Static depot environment: floor, track beam on plinths, buildings, safety furniture, sky.

export function buildSky(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4; c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0.0, '#3f70a8')
  g.addColorStop(0.45, '#7ea6c4')
  g.addColorStop(0.72, '#c4d6dd')
  g.addColorStop(1.0, '#dfe5e2')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.mapping = THREE.EquirectangularReflectionMapping
  return t
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

export function buildBeam(mats: MaterialKit, group: THREE.Group, zPos: number, topY: number, withStops: boolean) {
  const bw = L.beamWidth, bh = L.beamHeight, bl = L.beamLength
  const beam = new THREE.Mesh(new THREE.BoxGeometry(bl, bh, bw), [
    mats.concreteBeam, mats.concreteBeam, mats.beamTop, mats.concreteBeam, mats.concreteBeam, mats.concreteBeam
  ])
  beam.position.set(0, topY - bh / 2, zPos)
  beam.castShadow = beam.receiveShadow = true
  group.add(beam)

  // low concrete plinths carrying the beam (load path: beam -> plinth -> floor)
  const plinthH = topY - bh
  for (let x = -bl / 2 + 3; x <= bl / 2 - 2; x += 6) {
    const p = box(0.9, plinthH, 1.5, mats.concreteBeam, x, plinthH / 2, zPos)
    p.castShadow = p.receiveShadow = true
    group.add(p)
    // steel bearing plate between plinth and beam
    const plate = box(0.7, 0.08, 1.0, mats.machinedSteel, x, plinthH + 0.04, zPos)
    group.add(plate)
  }

  if (withStops) {
    // wheel stop at the +X open end of the loading track
    const stop = box(0.35, 0.5, bw + 0.28, mats.hazard, bl / 2 - 0.6, topY + 0.25, zPos)
    stop.castShadow = true
    group.add(stop)
  }
}

function buildBuilding(mats: MaterialKit, group: THREE.Group) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9beb9, roughness: 0.9 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6f7b82, roughness: 0.8 })
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c3339, roughness: 0.7 })

  // Inspection hall: the beam runs into its open gate at -X
  const hx = L.hallX
  const hall = new THREE.Group()
  const w = 26, h = 12, d = 30
  // front wall with opening for the track
  const front = new THREE.Group()
  front.add(box(w, h, 0.8, wallMat, 0, h / 2, 0))
  const opening = box(5.4, 8.4, 1.0, doorMat, 0, 4.2, 0.02)
  front.add(opening)
  // dark interior glimpse
  front.position.set(hx + d / 2, 0, 0)
  front.rotation.y = Math.PI / 2
  hall.add(front)
  const bodyB = box(d, h, w, wallMat, hx - 1, h / 2, 0)
  bodyB.castShadow = bodyB.receiveShadow = true
  hall.add(bodyB)
  const roof = box(d + 2, 0.7, w + 2, roofMat, hx - 1, h + 0.3, 0)
  roof.castShadow = true
  hall.add(roof)
  // roof monitor
  hall.add(box(d - 6, 1.6, 6, roofMat, hx - 1, h + 1.6, 0))
  group.add(hall)

  // distant depot shed on the far side
  const shed = new THREE.Group()
  const s1 = box(40, 9, 16, wallMat, 8, 4.5, -26)
  s1.castShadow = true
  shed.add(s1)
  shed.add(box(42, 0.6, 17, roofMat, 8, 9.3, -26))
  // band of dark windows
  const win = box(38, 2.2, 0.2, doorMat, 8, 6.4, -17.9)
  shed.add(win)
  group.add(shed)
}

function buildSafetyFurniture(mats: MaterialKit, group: THREE.Group, rng: () => number) {
  // painted yellow boundary line around the lift area
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xdfc22a, roughness: 0.9 })
  const mkLine = (wx: number, wz: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wx, wz), lineMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.012, z)
    m.receiveShadow = true
    group.add(m)
  }
  const ext = 13.5
  mkLine(ext * 2, 0.12, 0, 11.6)
  mkLine(0.12, 9.0, -ext, 7.1)
  mkLine(0.12, 9.0, ext, 7.1)

  // portable barrier fences along the boundary (workers stay behind these)
  const fence = (x: number, z: number, ry: number) => {
    const f = new THREE.Group()
    const rail = box(1.8, 0.05, 0.05, mats.galvanized, 0, 1.0, 0)
    const rail2 = box(1.8, 0.05, 0.05, mats.galvanized, 0, 0.55, 0)
    const legL = box(0.05, 1.05, 0.05, mats.galvanized, -0.85, 0.52, 0)
    const legR = box(0.05, 1.05, 0.05, mats.galvanized, 0.85, 0.52, 0)
    const footL = box(0.3, 0.04, 0.5, mats.galvanized, -0.85, 0.02, 0)
    const footR = box(0.3, 0.04, 0.5, mats.galvanized, 0.85, 0.02, 0)
    f.add(rail, rail2, legL, legR, footL, footR)
    rail.castShadow = true
    f.position.set(x, 0, z)
    f.rotation.y = ry
    group.add(f)
  }
  for (let i = -4; i <= 4; i++) fence(i * 2.0 + 0.3, 11.6, 0)

  // traffic cones
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xd8541e, roughness: 0.75 })
  const coneBaseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
  const conePositions: [number, number][] = [
    [-9.5, 10.2], [-6, 10.6], [9.5, 10.2], [6, 10.6], [-11.5, 8.5], [11.5, 8.5]
  ]
  for (const [x, z] of conePositions) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 12), coneMat)
    cone.position.set(x + rng() * 0.3, 0.33, z + rng() * 0.3)
    cone.castShadow = true
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), coneBaseMat)
    base.position.set(cone.position.x, 0.02, cone.position.z)
    group.add(cone, base)
  }
}

export function buildWorld(mats: MaterialKit): THREE.Group {
  const rng = mulberry32(9)
  const g = new THREE.Group()

  // depot floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), mats.concreteFloor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  g.add(floor)

  // main loading track beam + a parallel empty depot track behind for depth
  buildBeam(mats, g, 0, L.beamTopY, true)
  buildBeam(mats, g, -13, L.beamTopY, false)

  buildBuilding(mats, g)
  buildSafetyFurniture(mats, g, rng)

  return g
}
