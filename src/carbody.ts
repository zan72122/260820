import * as THREE from 'three'
import { MaterialKit, carBodySideTexture } from './materials'
import { L } from './layout'

// New-build lead car body (no bogies). Local origin: center of the underframe
// bottom face. +X along the car (cab at -X), +Z toward the viewer side.

export interface CarBody {
  group: THREE.Group
  liftBrackets: THREE.Object3D[]        // 4 sling attachment points (world targets)
  setLightsOn(on: boolean): void
  setStripe(stripe1: string, stripe2: string): void
}

export function buildCarBody(mats: MaterialKit, stripe1: string, stripe2: string): CarBody {
  const g = new THREE.Group()
  const len = L.carLength, wid = L.carWidth, hgt = L.carBodyHeight

  const sideTexP = carBodySideTexture({ stripe1, stripe2, lengthM: len, mirror: false })
  const sideTexN = carBodySideTexture({ stripe1, stripe2, lengthM: len, mirror: true })
  const sideMatP = new THREE.MeshStandardMaterial({ map: sideTexP, roughness: 0.42, metalness: 0.12 })
  const sideMatN = new THREE.MeshStandardMaterial({ map: sideTexN, roughness: 0.42, metalness: 0.12 })
  const paint = new THREE.MeshStandardMaterial({ color: 0xe7e6e2, roughness: 0.42, metalness: 0.12 })
  const stripePaint = new THREE.MeshStandardMaterial({ color: new THREE.Color(stripe1), roughness: 0.45, metalness: 0.12 })
  const roofPaint = new THREE.MeshStandardMaterial({ color: 0xcfd0cc, roughness: 0.6, metalness: 0.1 })
  const underGray = new THREE.MeshStandardMaterial({ color: 0x565a5e, roughness: 0.8, metalness: 0.3 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x141e26, roughness: 0.1, metalness: 0.3,
    emissive: 0xfff2cf, emissiveIntensity: 0.0
  })

  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m }
  const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    return add(m)
  }

  // --- main shell: box with textured sides + rounded roof cap ---
  const shellH = hgt - 0.25 - 0.55           // shell top at 2.60, roof arc completes to hgt
  const shell = box(len, shellH, wid,
    [paint, paint, roofPaint, underGray, sideMatP, sideMatN],
    0, 0.25 + shellH / 2, 0)
  // rounded roof: half-cylinder along the car, flattened vertically
  const roofR = wid / 2
  const roofGeo = new THREE.CylinderGeometry(roofR, roofR, len - 0.04, 28, 1, false, 0, Math.PI)
  const roof = new THREE.Mesh(roofGeo, roofPaint)
  roof.rotation.z = Math.PI / 2              // axis along X; the half faces up
  roof.scale.x = 0.37                        // local x (radial) is world Y after the rotation
  roof.position.set(0, 0.25 + shellH, 0)
  add(roof)

  // roof equipment: AC units + ventilators + conduit
  for (const x of [-3.4, 1.4]) box(2.5, 0.34, 1.7, roofPaint, x, hgt + 0.03, 0)
  box(0.9, 0.2, 0.9, underGray, 4.6, hgt - 0.02, 0)
  box(8.5, 0.09, 0.24, underGray, 0, hgt - 0.14, 0.9)

  // --- window band (dark glass, slightly proud boxes read as flush units) ---
  const winY = 0.25 + 1.85, winH = 0.85
  const doorXs = [-4.6, 0, 4.6]
  const winSpans: [number, number][] = [[-6.7, -5.5], [-3.6, -0.9], [0.9, 3.6], [5.5, 6.7]]
  const glassMeshes: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    for (const [a, b] of winSpans) {
      const m = box((b - a), winH, 0.03, glass, (a + b) / 2, winY, s * (wid / 2 + 0.006))
      m.castShadow = false
      glassMeshes.push(m)
    }
    // door leaves: paint + stripe band continuing across, small windows
    for (const dx of doorXs) {
      const door = box(1.3, 1.95, 0.025, paint, dx, 0.25 + 1.23, s * (wid / 2 + 0.004))
      door.castShadow = false
      const dstripe = box(1.3, 0.3, 0.026, stripePaint, dx, 1.37, s * (wid / 2 + 0.0055))
      dstripe.castShadow = false
      const seam = box(0.02, 1.95, 0.03, underGray, dx, 0.25 + 1.23, s * (wid / 2 + 0.012))
      seam.castShadow = false
      const dwin = box(0.9, 0.72, 0.03, glass, dx, winY - 0.06, s * (wid / 2 + 0.014))
      dwin.castShadow = false
      glassMeshes.push(dwin)
    }
  }

  // --- cab end (-X): rounded front, windshield, lights ---
  const cab = new THREE.Group()
  // vertical half-cylinder, flattened along X, open side against the shell end
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(wid / 2, wid / 2, shellH, 24, 1, false, Math.PI, Math.PI), paint)
  nose.scale.x = 0.42
  nose.position.set(-len / 2, 0.25 + shellH / 2, 0)
  nose.castShadow = true
  cab.add(nose)
  // curved windshield band hugging the nose
  const ws = new THREE.Mesh(
    new THREE.CylinderGeometry(wid / 2 + 0.015, wid / 2 + 0.015, 1.0, 18, 1, true, Math.PI * 1.3, Math.PI * 0.4), glass)
  ws.scale.x = 0.42
  ws.position.set(-len / 2, 0.25 + 2.0, 0)
  cab.add(ws)
  glassMeshes.push(ws as THREE.Mesh)
  // headlights
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8d2, roughness: 0.25, emissive: 0xfff6d8, emissiveIntensity: 0
  })
  const heads: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), headMat)
    hl.rotation.z = Math.PI / 2
    hl.position.set(-len / 2 - 0.5, 0.25 + 0.95, s * 0.85)
    cab.add(hl)
    heads.push(hl)
  }
  // cab stripe wrap
  const cs = new THREE.Mesh(new THREE.CylinderGeometry(wid / 2 + 0.012, wid / 2 + 0.012, 0.42, 24, 1, true, Math.PI, Math.PI), stripePaint)
  cs.scale.x = 0.425
  cs.position.set(-len / 2, 0.25 + 1.38, 0)
  cab.add(cs)
  g.add(cab)
  // plain end (+X): flat with gangway door
  box(0.06, shellH - 0.3, wid - 0.5, paint, len / 2 + 0.03, 0.25 + shellH / 2, 0)
  box(0.02, 1.9, 0.8, underGray, len / 2 + 0.07, 0.25 + 1.2, 0)

  // --- underframe & skirts ---
  const frame = box(len, 0.25, wid - 0.28, underGray, 0, 0.125, 0)
  frame.castShadow = true
  // underfloor equipment between the bogie openings
  box(2.6, 0.45, 2.0, underGray, -1.2, -0.22, 0)
  box(1.6, 0.38, 1.8, mats.hookSteel, 1.6, -0.19, 0)
  // side skirts with openings where the bogies will enter
  const skirtSpans: [number, number][] = [[-len / 2, -6.15], [-3.05, 3.05], [6.15, len / 2]]
  const skirtPaint = new THREE.MeshStandardMaterial({ color: 0xd9d8d3, roughness: 0.5, metalness: 0.12 })
  for (const s of [-1, 1]) {
    for (const [a, b] of skirtSpans) {
      const sk = box(b - a, L.skirtDrop, 0.05, skirtPaint, (a + b) / 2, -L.skirtDrop / 2, s * (wid / 2 - 0.03))
      sk.castShadow = true
    }
  }

  // --- docking interface under the body: spring seats + center-pin receivers ---
  for (const bx of L.bogieCenters) {
    for (const s of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 20), mats.machinedSteel)
      seat.position.set(bx, -0.03, s * 0.92)
      add(seat)
    }
    // receiver funnel that catches the bogie center pin
    const rec = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, 0.16, 16, 1, true), mats.machinedSteel)
    rec.position.set(bx, -0.08, 0)
    add(rec)
    // white sighting mark on the skirt edge over each bogie
    const markMat = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 })
    for (const s of [-1, 1]) {
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.02), markMat)
      mk.position.set(bx, -0.1, s * (wid / 2 + 0.01))
      g.add(mk)
    }
  }

  // --- lifting brackets: steel plates in the sill holes below the outer doors ---
  const liftBrackets: THREE.Object3D[] = []
  for (const bx of L.liftPointX) {
    for (const s of [-1, 1]) {
      const br = new THREE.Group()
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.08), mats.hookSteel)
      plate.castShadow = true
      br.add(plate)
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 8, 16), mats.machinedSteel)
      eye.position.y = 0.16
      br.add(eye)
      br.position.set(bx, 0.32, s * (wid / 2 + 0.06))
      g.add(br)
      const anchor = new THREE.Object3D()
      anchor.position.set(bx, 0.48, s * (wid / 2 + 0.06))
      g.add(anchor)
      liftBrackets.push(anchor)
    }
  }

  return {
    group: g,
    liftBrackets,
    setLightsOn(on: boolean) {
      glass.emissiveIntensity = on ? 0.85 : 0
      headMat.emissiveIntensity = on ? 4.0 : 0
    },
    setStripe(s1: string, s2: string) {
      sideMatP.map?.dispose()
      sideMatN.map?.dispose()
      sideMatP.map = carBodySideTexture({ stripe1: s1, stripe2: s2, lengthM: len, mirror: false })
      sideMatN.map = carBodySideTexture({ stripe1: s1, stripe2: s2, lengthM: len, mirror: true })
      sideMatP.needsUpdate = sideMatN.needsUpdate = true
      stripePaint.color.set(s1)
    }
  }
}
