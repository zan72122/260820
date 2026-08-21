import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { approach, clamp01, lerp } from '../core/math'

export type Pose = 'stand' | 'walk' | 'sit' | 'slide'

/**
 * A four-year-old, built from primitives. Everything is a joint group so the
 * same rig can stand at the foot of the stairs, climb, sit at the top and ride
 * the bed without any imported animation.
 */
export class Child {
  readonly root = new THREE.Group()

  private readonly hips = new THREE.Group()
  private readonly torso = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly thighs: THREE.Group[] = []
  private readonly shins: THREE.Group[] = []
  private readonly upperArms: THREE.Group[] = []
  private readonly foreArms: THREE.Group[] = []

  private pose: Pose = 'stand'
  private phase = 0
  private blend = 0
  private armSpread = 0
  private tuck = 0

  constructor() {
    const m = buildMaterials()
    this.root.name = 'child'
    this.root.add(this.hips)
    this.hips.position.y = 0.5
    this.hips.add(this.torso)

    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.06, 4, 10), m.trousers)
    pelvis.rotation.z = Math.PI / 2
    pelvis.scale.set(1, 1, 0.8)
    pelvis.castShadow = true
    this.hips.add(pelvis)

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.14, 4, 10), m.jacket)
    chest.position.y = 0.14
    chest.scale.set(1, 1, 0.82)
    chest.castShadow = true
    this.torso.add(chest)

    // A zipped front placket so the jacket is not one flat colour.
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.01), m.trousers)
    placket.position.set(0, 0.14, 0.083)
    this.torso.add(placket)

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.045, 10), m.trousers)
    collar.position.y = 0.245
    this.torso.add(collar)

    this.head.position.y = 0.275
    this.torso.add(this.head)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.093, 16, 12), m.skinTone)
    skull.scale.set(1, 1.06, 0.96)
    skull.position.y = 0.075
    skull.castShadow = true
    this.head.add(skull)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 12, 0, Math.PI * 2, 0, 1.35), m.hair)
    hair.position.y = 0.078
    hair.scale.set(1, 1.05, 1)
    this.head.add(hair)
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.03), m.hair)
    fringe.position.set(0, 0.108, 0.079)
    this.head.add(fringe)

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group()
      shoulder.position.set(side * 0.115, 0.215, 0)
      this.torso.add(shoulder)
      this.upperArms.push(shoulder)

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.11, 4, 8), m.jacket)
      upper.position.y = -0.075
      upper.castShadow = true
      shoulder.add(upper)

      const elbow = new THREE.Group()
      elbow.position.y = -0.15
      shoulder.add(elbow)
      this.foreArms.push(elbow)

      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.031, 0.1, 4, 8), m.jacket)
      fore.position.y = -0.07
      fore.castShadow = true
      elbow.add(fore)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), m.skinTone)
      hand.position.y = -0.135
      elbow.add(hand)

      const hip = new THREE.Group()
      hip.position.set(side * 0.058, -0.045, 0)
      this.hips.add(hip)
      this.thighs.push(hip)

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.13, 4, 8), m.trousers)
      thigh.position.y = -0.09
      thigh.castShadow = true
      hip.add(thigh)

      const knee = new THREE.Group()
      knee.position.y = -0.185
      hip.add(knee)
      this.shins.push(knee)

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.041, 0.12, 4, 8), m.trousers)
      shin.position.y = -0.085
      shin.castShadow = true
      knee.add(shin)

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.13), m.shoe)
      foot.position.set(0, -0.165, 0.025)
      foot.castShadow = true
      knee.add(foot)
    }
  }

  /** Ground clearance of the hips when standing. */
  static readonly HIP_HEIGHT = 0.5

  setPose(pose: Pose): void {
    if (this.pose !== pose) {
      this.pose = pose
      this.blend = 0
    }
  }

  /** Optional lean while sliding: arms wide, or tucked small. Never fails a run. */
  setPosture(spread: number, tuck: number): void {
    this.armSpread = clamp01(spread)
    this.tuck = clamp01(tuck)
  }

  update(dt: number, speed: number): void {
    this.blend = Math.min(1, this.blend + dt * 5)
    this.phase += dt * (2.6 + speed * 1.6)

    const set = (g: THREE.Group, x: number, y = 0, z = 0): void => {
      g.rotation.x = approach(g.rotation.x, x, 0.06, dt)
      g.rotation.y = approach(g.rotation.y, y, 0.06, dt)
      g.rotation.z = approach(g.rotation.z, z, 0.06, dt)
    }

    switch (this.pose) {
      case 'walk': {
        const s = Math.sin(this.phase)
        const c = Math.cos(this.phase)
        set(this.thighs[0], s * 0.62)
        set(this.thighs[1], -s * 0.62)
        set(this.shins[0], -Math.max(0, -s) * 0.85 - 0.1)
        set(this.shins[1], -Math.max(0, s) * 0.85 - 0.1)
        set(this.upperArms[0], -s * 0.5, 0, 0.12)
        set(this.upperArms[1], s * 0.5, 0, -0.12)
        set(this.foreArms[0], -0.42)
        set(this.foreArms[1], -0.42)
        set(this.torso, 0.06 + c * 0.02)
        set(this.head, -0.12)
        this.hips.position.y = Child.HIP_HEIGHT + Math.abs(Math.sin(this.phase)) * 0.022
        break
      }
      case 'sit': {
        set(this.thighs[0], -1.42, 0, 0.1)
        set(this.thighs[1], -1.42, 0, -0.1)
        set(this.shins[0], -0.35)
        set(this.shins[1], -0.35)
        set(this.upperArms[0], -0.5, 0, 0.5)
        set(this.upperArms[1], -0.5, 0, -0.5)
        set(this.foreArms[0], -0.5)
        set(this.foreArms[1], -0.5)
        set(this.torso, 0.16)
        set(this.head, -0.08)
        this.hips.position.y = Child.HIP_HEIGHT
        break
      }
      case 'slide': {
        const spread = this.armSpread
        const tuck = this.tuck
        set(this.thighs[0], lerp(-1.5, -1.85, tuck), 0, 0.1)
        set(this.thighs[1], lerp(-1.5, -1.85, tuck), 0, -0.1)
        set(this.shins[0], lerp(-0.16, -0.7, tuck))
        set(this.shins[1], lerp(-0.16, -0.7, tuck))
        set(this.upperArms[0], lerp(0.35, -0.2, spread), 0, lerp(0.28, 1.3, spread))
        set(this.upperArms[1], lerp(0.35, -0.2, spread), 0, lerp(-0.28, -1.3, spread))
        set(this.foreArms[0], lerp(-0.7, -0.15, spread))
        set(this.foreArms[1], lerp(-0.7, -0.15, spread))
        set(this.torso, lerp(0.2, 0.55, tuck))
        set(this.head, lerp(-0.12, 0.1, tuck))
        this.hips.position.y = Child.HIP_HEIGHT
        break
      }
      default: {
        set(this.thighs[0], 0, 0, 0.04)
        set(this.thighs[1], 0, 0, -0.04)
        set(this.shins[0], -0.05)
        set(this.shins[1], -0.05)
        set(this.upperArms[0], 0.05, 0, 0.14)
        set(this.upperArms[1], 0.05, 0, -0.14)
        set(this.foreArms[0], -0.2)
        set(this.foreArms[1], -0.2)
        set(this.torso, 0)
        set(this.head, 0)
        this.hips.position.y = Child.HIP_HEIGHT + Math.sin(this.phase * 0.4) * 0.006
        break
      }
    }
  }

  setVisible(v: boolean): void {
    this.root.visible = v
  }
}
