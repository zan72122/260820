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
const _dir = new Vector3()
const _perp = new Vector3()
const _tipP = new Vector3()
const _backP = new Vector3()
const _axis = new Vector3()
const _q = new Quaternion()

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
  private glintDur = 0.62
  private glintPos = { value: -1 }
  private glintAmt = { value: 0 }

  /** Mid-point between the two tips, in world space. */
  readonly tip = new Vector3()
  /** Unit vector pointing from the held end towards the tips. */
  readonly forward = new Vector3(0, 0, -1)
  /** 0 = wide open, 1 = pinched shut. */
  closedness = 0

  constructor() {
    this.lacquer = new MeshPhysicalMaterial({
      color: new Color(0x5d2b1e),
      roughness: 0.16,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.4,
      emissive: new Color(0xfff0d8),
      emissiveIntensity: 0,
    })
    this.installGlint(this.lacquer)
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
    this.installGlint(this.wood)

    const rBack = 0.0056
    const rTip = 0.0017
    const split = 0.78
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

  /**
   * The only hint the game ever gives: a highlight that slides once down the
   * lacquer, the way a real chopstick catches the sun when it moves.
   */
  private installGlint(mat: MeshPhysicalMaterial): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGlintPos = this.glintPos
      shader.uniforms.uGlintAmt = this.glintAmt
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vAlong;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvAlong = position.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vAlong;\nuniform float uGlintPos;\nuniform float uGlintAmt;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vec3(1.0, 0.95, 0.86) * exp(-pow((vAlong - uGlintPos) / 0.11, 2.0)) * uGlintAmt;',
        )
    }
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
    _dir.subVectors(tip, hand)
    const len = Math.max(0.20, Math.min(0.33, _dir.length() * 1.04))
    _dir.normalize()
    this.forward.copy(_dir)

    // A perpendicular that stays roughly horizontal so the sticks open
    // sideways on screen rather than towards the camera.
    _perp.crossVectors(_dir, UP)
    if (_perp.lengthSq() < 1e-6) _perp.set(1, 0, 0)
    _perp.normalize()

    const gap = 0.0018 + (1 - this.closedness) * 0.0125
    const backSpread = 0.0042

    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1
      _tipP.copy(tip).addScaledVector(_perp, sign * gap)
      _backP.copy(tip).addScaledVector(_dir, -len).addScaledVector(_perp, sign * backSpread)
      _axis.subVectors(_tipP, _backP)
      const l = _axis.length()
      _axis.normalize()
      _q.setFromUnitVectors(UP, _axis)
      const s = this.sticks[i]
      s.position.copy(_backP)
      s.quaternion.copy(_q)
      s.scale.set(1, l, 1)
    }
  }

  update(time: number): void {
    const age = time - this.glintT
    if (age >= 0 && age < this.glintDur) {
      const t = age / this.glintDur
      this.glintPos.value = -0.12 + t * 1.30
      this.glintAmt.value = Math.sin(t * Math.PI) ** 2 * 0.85
    } else {
      this.glintAmt.value = 0
    }
  }
}
