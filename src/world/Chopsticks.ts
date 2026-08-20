import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'

const UP = new Vector3(0, 1, 0)

/**
 * A pair of lacquered chopsticks held just off-screen. The player never sees
 * a hand: the sticks reach in from the lower corner of the frame, so their own
 * finger never covers the thing they are trying to catch.
 */
export class Chopsticks {
  readonly group = new Group()
  private sticks: Object3D[] = []
  private lacquer: MeshPhysicalMaterial
  private wood: MeshPhysicalMaterial
  private glintT = -10
  private glintDur = 0.55

  /** Mid-point between the two tips, in world space. */
  readonly tip = new Vector3()
  /** Unit vector pointing from the held end towards the tips. */
  readonly forward = new Vector3(0, 0, -1)
  /** 0 = wide open, 1 = pinched shut. */
  closedness = 0

  constructor() {
    this.lacquer = new MeshPhysicalMaterial({
      color: new Color(0x3a1c16),
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.4,
      emissive: new Color(0xfff0d8),
      emissiveIntensity: 0,
    })
    this.wood = new MeshPhysicalMaterial({
      color: new Color(0xcdb489),
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.1,
      emissive: new Color(0xfff0d8),
      emissiveIntensity: 0,
    })

    const rBack = 0.0056
    const rTip = 0.0017
    const split = 0.86
    const rSplit = rBack + (rTip - rBack) * split
    const bodyGeo = new CylinderGeometry(rSplit, rBack, split, 8, 1, false)
    bodyGeo.translate(0, split / 2, 0)
    const tipGeo = new CylinderGeometry(rTip, rSplit, 1 - split, 8, 1, false)
    tipGeo.translate(0, split + (1 - split) / 2, 0)

    for (let i = 0; i < 2; i++) {
      const s = new Group()
      const body = new Mesh(bodyGeo, this.lacquer)
      const tip = new Mesh(tipGeo, this.wood)
      body.castShadow = true
      tip.castShadow = true
      s.add(body, tip)
      this.sticks.push(s)
      this.group.add(s)
    }
    this.group.visible = false
  }

  /** A single, silent catch of the light. */
  flash(time: number): void {
    this.glintT = time
  }

  /**
   * Place the pair. `tip` is where the chopsticks meet, `hand` is the
   * off-screen point they reach in from.
   */
  place(tip: Vector3, hand: Vector3): void {
    this.tip.copy(tip)
    const dir = new Vector3().subVectors(tip, hand)
    const len = Math.max(0.20, Math.min(0.46, dir.length() * 1.06))
    dir.normalize()
    this.forward.copy(dir)

    // A perpendicular that stays roughly horizontal so the sticks open
    // sideways on screen rather than towards the camera.
    const perp = new Vector3().crossVectors(dir, UP)
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0)
    perp.normalize()

    const gap = 0.0018 + (1 - this.closedness) * 0.0125
    const backSpread = 0.0042

    const q = new Quaternion()
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1
      const tipP = new Vector3().copy(tip).addScaledVector(perp, sign * gap)
      const backP = new Vector3().copy(tip).addScaledVector(dir, -len).addScaledVector(perp, sign * backSpread)
      const axis = new Vector3().subVectors(tipP, backP)
      const l = axis.length()
      axis.normalize()
      q.setFromUnitVectors(UP, axis)
      const s = this.sticks[i]
      s.position.copy(backP)
      s.quaternion.copy(q)
      s.scale.set(1, l, 1)
    }
  }

  update(time: number): void {
    const age = time - this.glintT
    let e = 0
    if (age >= 0 && age < this.glintDur) {
      const t = age / this.glintDur
      e = Math.sin(t * Math.PI) ** 2 * 0.85
    }
    this.lacquer.emissiveIntensity = e
    this.wood.emissiveIntensity = e * 0.5
  }
}
