import * as THREE from 'three'
import { MaterialKit } from './materials'

// Adult depot workers: helmet, hi-vis vest, work trousers. Simple articulated
// figures — one foreground rigging supervisor holds the radio remote (the
// player's input is this person's operation), one signaller raises an arm
// during motion, others observe from behind the safety line.

export interface Worker {
  group: THREE.Group
  rightArm: THREE.Group
  leftArm: THREE.Group
  setPose(t: number): void
}

export function buildWorker(mats: MaterialKit, opts: { vest?: boolean } = {}): Worker {
  const g = new THREE.Group()
  const add = (m: THREE.Mesh, parent: THREE.Object3D = g) => { m.castShadow = true; parent.add(m); return m }

  // legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.78, 10), mats.workwear)
    leg.position.set(0, 0.39, s * 0.1)
    add(leg)
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.13), mats.darkRubber)
    shoe.position.set(0.04, 0.045, s * 0.1)
    add(shoe)
  }
  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.185, 0.52, 12), opts.vest === false ? mats.workwear : mats.vest)
  torso.position.y = 1.04
  add(torso)
  // reflective stripes on vest
  if (opts.vest !== false) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.06, 12), mats.galvanized)
    stripe.position.y = 1.02
    add(stripe)
  }
  // head + helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mats.skin)
  head.position.y = 1.46
  add(head)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.helmetWhite)
  helmet.position.y = 1.49
  add(helmet)
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.02, 12), mats.helmetWhite)
  brim.position.y = 1.47
  add(brim)

  // arms (pivot at shoulders)
  const mkArm = (s: number) => {
    const arm = new THREE.Group()
    arm.position.set(0, 1.26, s * 0.2)
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.55, 8), mats.workwear)
    upper.position.y = -0.26
    add(upper, arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mats.skin)
    hand.position.y = -0.55
    add(hand, arm)
    g.add(arm)
    return arm
  }
  const leftArm = mkArm(-1)
  const rightArm = mkArm(1)

  return {
    group: g, rightArm, leftArm,
    setPose() { /* posed externally */ }
  }
}

// Industrial radio remote control box (generic, no specific make): a plain
// yellow box with two joystick levers, an E-stop, and a neck strap.
export function buildRemote(mats: MaterialKit): { group: THREE.Group, stickV: THREE.Mesh, stickH: THREE.Mesh } {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), mats.craneYellow)
  body.castShadow = true
  g.add(body)
  const mkStick = (x: number) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.11, 8), mats.hookSteel)
    st.position.set(x, 0.08, 0)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), mats.darkRubber)
    knob.position.y = 0.055
    st.add(knob)
    g.add(st)
    return st
  }
  const stickV = mkStick(-0.08)
  const stickH = mkStick(0.08)
  const estop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 10),
    new THREE.MeshStandardMaterial({ color: 0xb42313, roughness: 0.5 }))
  estop.position.set(0, 0.065, 0.07)
  g.add(estop)
  return { group: g, stickV, stickH }
}
