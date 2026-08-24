import * as THREE from 'three'
import { MaterialKit } from './materials'
import { L } from './layout'

// Mobile telescopic crane with outriggers. The superstructure yaws and the boom
// luffs so the boom head stays plumb above the commanded hook position
// (kinematic control — the "two-crane sync" is handled by the sim layer).

export interface Crane {
  group: THREE.Group
  hookBlock: THREE.Group
  boomTipWorld: THREE.Vector3
  setHook(hookWorld: THREE.Vector3, tension: number): void
  setBeacon(t: number, moving: boolean): void
}

export function buildCrane(mats: MaterialKit, baseX: number, baseZ: number): Crane {
  const g = new THREE.Group()
  g.position.set(baseX, 0, baseZ)

  const add = (parent: THREE.Object3D, m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    return add(parent, m)
  }

  // --- carrier (truck chassis), parked parallel to the beam ---
  const carrier = new THREE.Group()
  carrier.rotation.y = Math.PI / 2   // long axis along X
  g.add(carrier)
  box(carrier, 2.6, 0.85, 9.6, mats.craneWhite, 0, 1.25, 0)
  box(carrier, 2.45, 0.55, 9.0, mats.hookSteel, 0, 0.72, 0)
  // driver cab at one end
  box(carrier, 2.5, 1.5, 1.8, mats.craneWhite, 0, 2.3, 3.9)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2831, roughness: 0.15, metalness: 0.3 })
  box(carrier, 2.3, 0.7, 0.1, winMat, 0, 2.6, 4.78)
  // wheels: 4 axles
  for (const az of [-3.6, -2.2, 1.6, 3.0]) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 18), mats.darkRubber)
      w.rotation.z = Math.PI / 2
      w.position.set(s * 1.15, 0.62, az)
      add(carrier, w)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 12), mats.craneYellow)
      hub.rotation.z = Math.PI / 2
      hub.position.copy(w.position)
      add(carrier, hub)
    }
  }
  // outriggers: beams fully extended, jacks down, floats on timber mats
  for (const az of [-3.2, 3.2]) {
    for (const s of [-1, 1]) {
      box(carrier, 0.42, 0.38, 2.5, mats.craneYellow, s * 1.9, 1.05, az)
      box(carrier, 0.3, 1.1, 0.3, mats.machinedSteel, s * 2.95, 0.6, az)
      const pad = box(carrier, 1.0, 0.16, 1.0, mats.hookSteel, s * 2.95, 0.22, az)
      pad.receiveShadow = true
      const mat = box(carrier, 1.3, 0.14, 1.3, mats.woodBlock, s * 2.95, 0.07, az)
      mat.receiveShadow = true
    }
  }

  // --- superstructure: yaws about Y at group origin ---
  const sup = new THREE.Group()
  sup.position.y = 1.75
  g.add(sup)
  box(sup, 1.7, 1.0, 2.2, mats.craneYellow, 0, 0.5, -0.6)           // machinery deck
  box(sup, 2.4, 1.5, 1.2, mats.hookSteel, 0, 0.6, -2.1)             // counterweight stack
  box(sup, 2.4, 0.5, 1.2, mats.hookSteel, 0, 1.55, -2.1)
  const cwHazard = box(sup, 2.42, 0.3, 1.22, mats.hazard, 0, 0.1, -2.1)
  cwHazard.castShadow = false
  // operator cab
  box(sup, 0.9, 1.1, 1.5, mats.craneYellow, 1.15, 0.55, 0.4)
  box(sup, 0.8, 0.62, 0.1, winMat, 1.15, 0.72, 1.16)
  // warning beacon
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xcc3b1e, emissive: 0xff5522, emissiveIntensity: 0 })
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 10), beaconMat)
  beacon.position.set(0, 1.15, -1.6)
  sup.add(beacon)

  // --- boom: pivot behind the yaw axis, luffs about X ---
  const boomPivot = new THREE.Group()
  boomPivot.position.set(0, L.boomPivotY - 1.75 + 1.0, -1.0)
  sup.add(boomPivot)
  const sections = 4
  const boom = new THREE.Group()
  boomPivot.add(boom)
  for (let i = 0; i < sections; i++) {
    const w0 = 0.95 - i * 0.15
    const segLen = L.boomLen / sections + 0.4
    const seg = box(boom, w0, w0 * 0.92, segLen, mats.craneYellow, 0, 0, (i + 0.5) * (L.boomLen / sections) - 0.2)
    seg.castShadow = true
  }
  // boom head: sheave housing
  const head = new THREE.Group()
  head.position.z = L.boomLen
  boom.add(head)
  box(head, 0.42, 0.5, 0.5, mats.craneYellow, 0, -0.1, 0)
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), mats.hookSteel)
  sheave.rotation.z = Math.PI / 2
  head.position.z = L.boomLen
  add(head, sheave)
  // luffing cylinder (two nested tubes from carrier deck to mid-boom)
  const cylOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12), mats.craneYellow)
  const cylInner = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), mats.machinedSteel)
  cylOuter.castShadow = true
  sup.add(cylOuter, cylInner)

  // --- hook block (world-space, driven by sim): heavy multi-sheave block ---
  const hookBlock = new THREE.Group()
  box(hookBlock, 0.62, 0.9, 0.38, mats.hookSteel, 0, -0.45, 0)
  const cheek = box(hookBlock, 0.68, 0.42, 0.4, mats.craneYellow, 0, -0.18, 0)
  cheek.castShadow = false
  for (const sx of [-0.16, 0.16]) {
    const blockSheave = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.11, 14), mats.craneYellow)
    blockSheave.rotation.z = Math.PI / 2
    blockSheave.position.set(sx, -0.18, 0)
    add(hookBlock, blockSheave)
  }
  // hook: shank + curved hook via torus arc
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), mats.hookSteel)
  shank.position.y = -0.68
  add(hookBlock, shank)
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 10, 18, Math.PI * 1.5), mats.hookSteel)
  hook.rotation.y = Math.PI / 2
  hook.rotation.x = Math.PI
  hook.position.y = -0.9
  add(hookBlock, hook)

  // hoist rope falls: boom head -> hook block (four falls, updated per frame)
  const fallGeo = new THREE.CylinderGeometry(0.034, 0.034, 1, 6)
  const falls: THREE.Mesh[] = []
  const FALL_OFFSETS = [-0.2, -0.07, 0.07, 0.2]
  for (let i = 0; i < FALL_OFFSETS.length; i++) {
    const f = new THREE.Mesh(fallGeo, mats.wireRope)
    f.castShadow = false
    falls.push(f)
  }

  const world = new THREE.Group()
  world.add(g, hookBlock, ...falls)

  const boomTipWorld = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  function setHook(hookWorld: THREE.Vector3, tension: number) {
    const dx = hookWorld.x - baseX
    const dz = hookWorld.z - baseZ
    const azim = Math.atan2(dx, dz)
    sup.rotation.y = azim
    const r = Math.hypot(dx, dz) + 1.0   // pivot sits 1 m behind the yaw axis
    const rc = Math.min(r, L.boomLen * 0.94)
    const luff = Math.acos(rc / L.boomLen)
    // elastic dip under load: the boom visibly takes the weight
    boom.rotation.x = -(luff - tension * 0.02)
    const pivotWorldY = L.boomPivotY + 1.0
    boomTipWorld.set(
      baseX + Math.sin(azim) * (rc - 1.0),
      pivotWorldY + Math.sin(luff) * L.boomLen - tension * 0.3,
      baseZ + Math.cos(azim) * (rc - 1.0)
    )
    // luffing cylinder follows (visual only; computed in sup-local space)
    const cylBase = tmp.set(0, 0.2, 0.9)
    const boomMid = new THREE.Vector3(
      0,
      (L.boomPivotY - 1.75 + 1.0) + Math.sin(luff) * 6.5,
      -1.0 + Math.cos(luff) * 6.5
    )
    const dir = boomMid.clone().sub(cylBase)
    const lenC = dir.length()
    const dirN = dir.clone().normalize()
    cylOuter.position.copy(cylBase).addScaledVector(dir, 0.25)
    cylOuter.scale.y = lenC * 0.5
    cylOuter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN)
    cylInner.position.copy(cylBase).addScaledVector(dir, 0.65)
    cylInner.scale.y = lenC * 0.6
    cylInner.quaternion.copy(cylOuter.quaternion)

    hookBlock.position.copy(hookWorld)
    // rope falls
    for (let i = 0; i < FALL_OFFSETS.length; i++) {
      const off = FALL_OFFSETS[i]
      const a = boomTipWorld.clone(); a.x += off * Math.cos(azim); a.z -= off * Math.sin(azim)
      const b = hookWorld.clone(); b.x += off * 0.6 * Math.cos(azim); b.z -= off * 0.6 * Math.sin(azim)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const d = a.clone().sub(b)
      falls[i].position.copy(mid)
      falls[i].scale.y = d.length()
      falls[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    }
  }

  let beaconPhase = 0
  function setBeacon(dt: number, moving: boolean) {
    if (moving) {
      beaconPhase += dt * 6
      beaconMat.emissiveIntensity = (Math.sin(beaconPhase) > 0 ? 1.6 : 0.15)
    } else {
      beaconMat.emissiveIntensity = Math.max(0, beaconMat.emissiveIntensity - dt * 4)
    }
  }

  return { group: world, hookBlock, boomTipWorld, setHook, setBeacon }
}
