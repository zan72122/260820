import * as THREE from 'three'
import { MaterialKit } from './materials'
import { L } from './layout'

// Straddle-type monorail bogie. Local origin: center of beam top under the bogie.
// +X along the beam, +Z across. Running wheels ride the beam top, guide wheels
// press the upper side faces, stabilizer wheels the lower side faces.

export interface Bogie {
  group: THREE.Group
  airSprings: THREE.Mesh[]     // scaled in Y as the car weight transfers
  centerPin: THREE.Mesh
  setCompression(t: number): void  // 0 = free, 1 = fully seated
  setWheelRoll(dist: number): void
}

export function buildBogie(mats: MaterialKit): Bogie {
  const g = new THREE.Group()
  const bw = L.beamWidth

  const frameMat = mats.paintedSteelBlue
  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    return add(m)
  }

  // --- running wheels (2 axles) ---
  const wheels: THREE.Mesh[] = []
  const rwR = L.runningWheelDia / 2
  for (const x of [-0.75, 0.75]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(rwR, rwR, 0.36, 24), mats.darkRubber)
    w.rotation.x = Math.PI / 2
    w.position.set(x, rwR, 0)
    add(w)
    wheels.push(w)
    // hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 16), mats.machinedSteel)
    hub.rotation.x = Math.PI / 2
    hub.position.set(x, rwR, 0)
    add(hub)
  }

  // --- guide wheels (4, vertical axis, upper beam sides) & stabilizers (2, lower) ---
  const gwR = L.guideWheelDia / 2
  const sideWheels: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    for (const x of [-0.78, 0.78]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(gwR, gwR, 0.19, 20), mats.darkRubber)
      w.position.set(x, -0.24, s * (bw / 2 + gwR - 0.012))
      add(w)
      sideWheels.push(w)
      // lighter hub cap so the tire reads as a wheel
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(gwR * 0.45, gwR * 0.45, 0.2, 12), mats.machinedSteel)
      cap.position.copy(w.position)
      add(cap)
    }
    const stR = L.stabWheelDia / 2
    const st = new THREE.Mesh(new THREE.CylinderGeometry(stR, stR, 0.17, 20), mats.darkRubber)
    st.position.set(0, -1.02, s * (bw / 2 + stR - 0.012))
    add(st)
    sideWheels.push(st)
    const stCap = new THREE.Mesh(new THREE.CylinderGeometry(stR * 0.45, stR * 0.45, 0.18, 12), mats.machinedSteel)
    stCap.position.copy(st.position)
    add(stCap)
    // mounting bracket from the side plate to the stabilizer wheel spindle
    const stBr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.35), frameMat)
    stBr.position.set(0, -0.9, s * (bw / 2 + stR * 0.8))
    add(stBr)
  }

  // --- frame: top side beams above the wheels + crossmembers + side plates ---
  for (const s of [-1, 1]) {
    box(2.35, 0.3, 0.28, frameMat, 0, 0.62, s * 0.72)         // top longitudinal
    box(0.14, 1.85, 0.85, frameMat, 0, -0.42, s * 0.86)       // side plate down to stabilizers
    // guide wheel brackets
    for (const x of [-0.78, 0.78]) box(0.5, 0.22, 0.3, frameMat, x, -0.30, s * 0.75)
  }
  box(0.4, 0.26, 1.7, frameMat, -1.05, 0.62, 0)               // end crossmember
  box(0.4, 0.26, 1.7, frameMat, 1.05, 0.62, 0)
  // brake units + traction motor hint
  box(0.5, 0.34, 0.4, mats.hookSteel, -0.35, 0.28, 0.55)
  box(0.5, 0.34, 0.4, mats.hookSteel, 0.35, 0.28, -0.55)
  box(0.8, 0.4, 0.5, mats.hookSteel, 0, 0.3, 0)

  // --- bolster + air springs + center pin (the docking interface) ---
  const bolster = box(1.5, 0.1, 2.2, frameMat, 0, 0.72, 0)
  bolster.castShadow = true
  const springs: THREE.Mesh[] = []
  const springCaps: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 1, 22), mats.airSpringRubber)
    spring.position.set(0, 0.77, s * 1.0)
    spring.scale.y = L.bolsterTopAboveBeam - 0.77   // free height 0.18
    spring.position.y = 0.77 + spring.scale.y / 2
    add(spring)
    springs.push(spring)
    // machined seat plate on top of each air spring
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 22), mats.machinedSteel)
    cap.position.set(0, L.bolsterTopAboveBeam + 0.02, s * 1.0)
    add(cap)
    springCaps.push(cap)
    // rubber bellows ring detail
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 8, 22), mats.airSpringRubber)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0.86, s * 1.0)
    add(ring)
  }
  // machined center pin, guides the body receiver during docking
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 16), mats.machinedSteel)
  pin.position.set(0, 0.98, 0)
  add(pin)

  // painted alignment marks: yellow tabs at bolster edges (workers sight these)
  const markMat = new THREE.MeshStandardMaterial({ color: 0xe3c229, roughness: 0.7 })
  for (const s of [-1, 1]) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.1), markMat)
    tab.position.set(0, 0.78, s * 1.08)
    g.add(tab)
  }

  const springFreeH = L.bolsterTopAboveBeam - 0.77
  return {
    group: g,
    airSprings: springs,
    centerPin: pin,
    setCompression(t: number) {
      const h = springFreeH - L.springTravel * t
      for (const s of springs) {
        s.scale.y = h
        s.position.y = 0.77 + h / 2
      }
      for (const c of springCaps) c.position.y = 0.77 + h + 0.017
    },
    setWheelRoll(dist: number) {
      for (const w of wheels) w.rotation.z = -dist / rwR
    }
  }
}
