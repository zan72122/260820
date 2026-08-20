import * as THREE from 'three'
import { applyMurk } from './murk'

const UP = new THREE.Vector3(0, 1, 0)

function limb(rTop: number, rBot: number, mat: THREE.Material) {
  const g = new THREE.CylinderGeometry(rTop, rBot, 1, 8, 1)
  g.translate(0, 0.5, 0)
  const m = new THREE.Mesh(g, mat)
  m.castShadow = true
  return m
}

function orient(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  m.position.copy(from)
  const d = new THREE.Vector3().subVectors(to, from)
  const len = Math.max(0.02, d.length())
  m.quaternion.setFromUnitVectors(UP, d.normalize())
  m.scale.set(1, len, 1)
}

function buildGlove(mat: THREE.Material) {
  const g = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mat)
  palm.scale.set(1.0, 0.62, 1.25)
  palm.castShadow = true
  g.add(palm)
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0145, 0.055, 3, 6), mat)
    f.castShadow = true
    f.position.set(-0.033 + i * 0.022, -0.012, 0.068)
    f.rotation.x = 1.25 - i * 0.03
    g.add(f)
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0165, 0.045, 3, 6), mat)
  thumb.position.set(0.044, 0.006, 0.022)
  thumb.rotation.set(0.9, 0, -0.8)
  thumb.castShadow = true
  g.add(thumb)
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.10, 10), mat)
  cuff.rotation.x = Math.PI / 2
  cuff.position.z = -0.075
  cuff.castShadow = true
  g.add(cuff)
  return g
}

export class Worker {
  group = new THREE.Group()
  hoseHand: THREE.Group
  supportHand: THREE.Group
  private head: THREE.Mesh
  private torso: THREE.Mesh
  private hip: THREE.Mesh
  private legs: THREE.Mesh[] = []
  private armR: THREE.Mesh[] = []
  private armL: THREE.Mesh[] = []
  private bedY: number
  private facing = 0
  /** world position of the feet */
  stance = new THREE.Vector3()

  constructor(bedY: number, murkColor: THREE.Color) {
    this.bedY = bedY
    const waders = new THREE.MeshStandardMaterial({ color: 0x3b4438, roughness: 0.42, metalness: 0.02 })
    const jacket = new THREE.MeshStandardMaterial({ color: 0x474d50, roughness: 0.9 })
    const skin = new THREE.MeshStandardMaterial({ color: 0xa9825f, roughness: 0.7 })
    const glove = new THREE.MeshStandardMaterial({ color: 0x2b4a38, roughness: 0.38, metalness: 0.02 })
    const cap = new THREE.MeshStandardMaterial({ color: 0x39434c, roughness: 0.9 })
    applyMurk(waders, murkColor, 0.12)
    applyMurk(glove, murkColor, 0.3)

    for (let i = 0; i < 2; i++) {
      const upper = limb(0.075, 0.062, waders)
      const lower = limb(0.062, 0.052, waders)
      this.legs.push(upper, lower)
      this.group.add(upper, lower)
    }
    this.hip = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.12, 4, 10), waders)
    this.hip.castShadow = true
    this.group.add(this.hip)

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.158, 0.30, 4, 12), jacket)
    this.torso.scale.set(1.12, 1, 0.74)
    this.torso.castShadow = true
    // chest-high waders over the jacket, the way lotus harvesters actually dress
    const bib = new THREE.Mesh(new THREE.CapsuleGeometry(0.163, 0.16, 4, 12), waders)
    bib.scale.set(1.12, 1, 0.76)
    bib.position.y = -0.1
    bib.castShadow = true
    this.torso.add(bib)
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.26, 4, 8), jacket)
    shoulders.rotation.z = Math.PI / 2
    shoulders.position.y = 0.2
    shoulders.castShadow = true
    this.torso.add(shoulders)
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.09, 10), jacket)
    collar.position.y = 0.27
    this.torso.add(collar)
    this.group.add(this.torso)

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.094, 16, 12), skin)
    this.head.castShadow = true
    const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.101, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), cap)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 12, 1, false, -0.9, 1.9), cap)
    brim.position.set(0, 0.028, 0.055)
    this.head.add(capMesh, brim)
    this.group.add(this.head)

    for (const arr of [this.armR, this.armL]) {
      const upper = limb(0.062, 0.05, jacket)
      const fore = limb(0.05, 0.042, jacket)
      arr.push(upper, fore)
      this.group.add(upper, fore)
    }

    this.hoseHand = buildGlove(glove)
    this.supportHand = buildGlove(glove)
    this.supportHand.visible = false
    this.group.add(this.hoseHand, this.supportHand)
  }

  /** Keep the worker a believable arm's length from where the water is going. */
  moveToward(target: THREE.Vector3, dt: number, preferDir?: THREE.Vector3) {
    const desiredDist = 0.98
    const away = new THREE.Vector3().subVectors(this.stance, target).setY(0)
    if (away.lengthSq() < 1e-5) away.set(0, 0, 1)
    away.normalize()
    // drift toward the side the camera expects the worker to stand on
    if (preferDir) away.lerp(preferDir, 0.9).normalize()
    const want = target.clone().addScaledVector(away, desiredDist)
    want.y = this.bedY
    const k = 1 - Math.exp(-dt * 2.2)
    this.stance.lerp(want, k)
    const f = Math.atan2(target.x - this.stance.x, target.z - this.stance.z)
    let d = f - this.facing
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    this.facing += d * (1 - Math.exp(-dt * 3))
  }

  get shoulderR() {
    const s = new THREE.Vector3(0.19, 0.86, 0)
    s.applyAxisAngle(UP, this.facing)
    return s.add(this.stance).setY(this.bedY + 1.34)
  }
  get shoulderL() {
    const s = new THREE.Vector3(-0.19, 0.86, 0)
    s.applyAxisAngle(UP, this.facing)
    return s.add(this.stance).setY(this.bedY + 1.34)
  }

  private solveArm(shoulder: THREE.Vector3, hand: THREE.Vector3, bones: THREE.Mesh[], sign: number) {
    const upperLen = 0.31
    const foreLen = 0.30
    const d = new THREE.Vector3().subVectors(hand, shoulder)
    const dist = Math.min(upperLen + foreLen - 0.005, Math.max(0.06, d.length()))
    d.normalize()
    const a = (upperLen * upperLen - foreLen * foreLen + dist * dist) / (2 * dist)
    const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a))
    const mid = shoulder.clone().addScaledVector(d, a)
    // elbows swing out and down
    let axis = new THREE.Vector3().crossVectors(d, UP)
    if (axis.lengthSq() < 1e-5) axis = new THREE.Vector3(1, 0, 0)
    axis.normalize()
    const bend = new THREE.Vector3().crossVectors(axis, d).normalize().multiplyScalar(-1)
    bend.addScaledVector(axis, 0.55 * sign).normalize()
    const elbow = mid.addScaledVector(bend, h)
    orient(bones[0], shoulder, elbow)
    orient(bones[1], elbow, hand)
  }

  update(
    dt: number,
    o: { handPos: THREE.Vector3; aim: THREE.Vector3; support: THREE.Vector3 | null; gaze: THREE.Vector3 | null },
  ) {
    void dt
    const feet = this.stance
    const hipY = this.bedY + 0.86
    // legs, slightly bent, planted apart
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1
      const foot = new THREE.Vector3(0.16 * side, 0, 0.03 * side).applyAxisAngle(UP, this.facing).add(feet)
      const knee = new THREE.Vector3(0.14 * side, 0.44, 0.09).applyAxisAngle(UP, this.facing).add(feet)
      const hip = new THREE.Vector3(0.11 * side, 0.86, 0).applyAxisAngle(UP, this.facing).add(feet)
      orient(this.legs[i * 2], hip, knee)
      orient(this.legs[i * 2 + 1], knee, foot)
    }
    this.hip.position.set(feet.x, hipY, feet.z)
    this.hip.rotation.y = this.facing
    this.torso.position.set(feet.x, this.bedY + 1.12, feet.z)
    this.torso.rotation.set(0.14, this.facing, 0)
    const headPos = new THREE.Vector3(0, this.bedY + 1.5, 0).add(feet)
    headPos.x += Math.sin(this.facing) * 0.06
    headPos.z += Math.cos(this.facing) * 0.06
    this.head.position.copy(headPos)
    const look = o.gaze ?? o.aim
    this.head.lookAt(look.x, look.y - 0.05, look.z)

    this.solveArm(this.shoulderR, o.handPos, this.armR, 1)
    this.hoseHand.position.copy(o.handPos)
    this.hoseHand.lookAt(o.aim)

    if (o.support) {
      this.supportHand.visible = true
      this.supportHand.position.copy(o.support)
      this.supportHand.lookAt(o.aim.x, o.support.y, o.aim.z)
      this.supportHand.rotateX(-0.9)
      this.solveArm(this.shoulderL, o.support, this.armL, -1)
      for (const b of this.armL) b.visible = true
    } else {
      this.supportHand.visible = false
      // idle left arm hangs at the side
      const rest = this.shoulderL.clone()
      rest.y = this.bedY + 0.78
      rest.x += Math.sin(this.facing + Math.PI / 2) * 0.08
      rest.z += Math.cos(this.facing + Math.PI / 2) * 0.08
      this.solveArm(this.shoulderL, rest, this.armL, -1)
      for (const b of this.armL) b.visible = true
    }
  }
}
