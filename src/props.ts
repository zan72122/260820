import * as THREE from 'three'
import { MaterialKit } from './materials'
import { L } from './layout'

// Low-bed delivery trailer (the body arrives on this) and the depot vehicle
// mover that tows the finished car toward the inspection hall.

export interface Trailer {
  group: THREE.Group
  deck: THREE.Group
  setUnloaded(t: number): void   // suspension extends slightly as weight comes off
}

export function buildTrailer(mats: MaterialKit): Trailer {
  const g = new THREE.Group()
  const deck = new THREE.Group()
  g.add(deck)
  const add = (m: THREE.Mesh, p: THREE.Object3D = deck) => { m.castShadow = true; m.receiveShadow = true; p.add(m); return m }

  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.28, 3.1), mats.trailerRed)
  deckMesh.position.y = L.trailerDeckY - 0.14
  add(deckMesh)
  // gooseneck at +X (tractor already detached — parked delivery)
  const neck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.6), mats.trailerRed)
  neck.position.set(8.6, L.trailerDeckY + 0.2, 0)
  add(neck)
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 1.2), mats.hookSteel)
  legs.position.set(9.4, 0.42, 0)
  add(legs)

  // axle bogies (wheels attach to chassis, not the sprung deck)
  for (const ax of [-6.4, -4.9, 4.6, 6.1]) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16), mats.darkRubber)
      w.rotation.x = Math.PI / 2
      w.position.set(ax, 0.5, s * 1.25)
      add(w, g)
    }
  }

  // timber cribbing aligned under the bolster / jacking points: one crosswise
  // sleeper spanning the deck, two shorter bearers stacked on top
  for (const bx of [-4.6, -1.5, 1.5, 4.6]) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(0.42, L.blockH / 2, 2.5), mats.woodBlock)
    sleeper.position.set(bx, L.trailerDeckY + L.blockH / 4, 0)
    add(sleeper)
    for (const s of [-1, 1]) {
      const bearer = new THREE.Mesh(new THREE.BoxGeometry(1.0, L.blockH / 2, 0.38), mats.woodBlock)
      bearer.position.set(bx, L.trailerDeckY + L.blockH * 0.75, s * 0.85)
      add(bearer)
    }
  }

  return {
    group: g, deck,
    setUnloaded(t: number) {
      // springs extend when the body's weight comes off the trailer
      deck.position.y = t * 0.09
    }
  }
}

export interface Mover {
  group: THREE.Group
  setRoll(dist: number): void
}

// Depot vehicle mover: a compact battery unit that rides the beam and couples
// to the car end to tow it to the inspection bays.
export function buildMover(mats: MaterialKit): Mover {
  const g = new THREE.Group()
  const add = (m: THREE.Mesh) => { m.castShadow = true; g.add(m); return m }
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9781d, roughness: 0.55, metalness: 0.25 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 2.4), bodyMat)
  hull.position.y = 1.15
  add(hull)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2.0), bodyMat)
  cab.position.set(-1.0, 2.3, 0)
  add(cab)
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x1a2831, roughness: 0.2, metalness: 0.3 }))
  win.position.set(-1.0, 2.42, 0)
  g.add(win)
  // hazard band + coupler bar toward the car
  const hz = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.3, 2.42), mats.hazard)
  hz.position.y = 0.62
  g.add(hz)
  const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.3), mats.hookSteel)
  coupler.position.set(1.95, 1.35, 0)
  add(coupler)

  // straddle wheels on the beam
  const wheels: THREE.Mesh[] = []
  for (const x of [-0.9, 0.9]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), mats.darkRubber)
    w.rotation.x = Math.PI / 2
    w.position.set(x, 0.42, 0)
    add(w)
    wheels.push(w)
  }
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.1), bodyMat)
    plate.position.set(0, 0.55, s * (L.beamWidth / 2 + 0.09))
    add(plate)
    const gw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 12), mats.darkRubber)
    gw.position.set(0, 0.3, s * (L.beamWidth / 2 + 0.2))
    add(gw)
  }

  return {
    group: g,
    setRoll(dist: number) {
      for (const w of wheels) w.rotation.z = -dist / 0.42
    }
  }
}
