import * as THREE from 'three'
import { PAN } from '../core/dims'
import { aluminiumRough, aluminiumTint } from '../core/textures'
import { clamp } from '../core/math'

/**
 * Two-piece aluminium chiffon pan, built as one closed lathe cross-section so
 * the wall, the rolled rim, the base and the hollow central tube all carry a
 * readable metal thickness.
 */
const PROFILE: [number, number][] = [
  // hollow inside of the central tube, bottom -> top
  [0.0234, 0.0],
  [0.0204, 0.1035],
  // rolled tube lip
  [0.0209, 0.1048],
  [0.0216, 0.1051],
  [0.0222, 0.1044],
  // outer face of the tube, back down to the base
  [0.0246, 0.003],
  [0.0252, 0.0016],
  [0.0264, 0.0012],
  // floor of the pan
  [0.0755, 0.0012],
  [0.0768, 0.0018],
  [0.0774, 0.0032],
  // inner wall climbing to the rim
  [0.085, 0.0995],
  // rolled rim
  [0.0856, 0.1009],
  [0.0866, 0.1013],
  [0.0874, 0.1005],
  [0.0874, 0.0992],
  // outer wall back down
  [0.0798, 0.0026],
  [0.0794, 0.001],
  [0.0784, 0.0],
  // underside of the base, back to the tube
  [0.0252, 0.0],
  [0.0234, 0.0],
]

export class ChiffonPan {
  /** Where the pan sits in the world (origin = centre of its base). */
  readonly root = new THREE.Group()
  /** Rotation centre for the big turn — the middle of the pan, not its floor. */
  readonly flipPivot = new THREE.Object3D()
  /** Pan geometry + whatever is inside it. */
  readonly body = new THREE.Object3D()
  readonly contents = new THREE.Object3D()
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshStandardMaterial
  private heatValue = 0

  constructor() {
    const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y))
    const geo = new THREE.LatheGeometry(pts, 128)
    geo.computeVertexNormals()

    const rough = aluminiumRough()
    const tint = aluminiumTint()
    this.material = new THREE.MeshStandardMaterial({
      color: 0xc9cac6,
      map: tint,
      roughnessMap: rough,
      bumpMap: rough,
      bumpScale: 0.12,
      metalness: 0.88,
      roughness: 0.46,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x000000),
    })
    this.material.shadowSide = THREE.DoubleSide

    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.name = 'chiffon-pan'

    this.flipPivot.position.set(0, PAN.height / 2, 0)
    this.body.position.set(0, -PAN.height / 2, 0)
    this.body.add(this.mesh, this.contents)
    this.flipPivot.add(this.body)
    this.root.add(this.flipPivot)
  }

  /** 0 = room temperature, 1 = straight out of the oven. */
  set heat(v: number) {
    this.heatValue = clamp(v)
    const h = this.heatValue
    this.material.emissive.setRGB(0.11 * h, 0.035 * h, 0.008 * h)
    this.material.color.setRGB(0.79 - 0.05 * h, 0.792 - 0.07 * h, 0.776 - 0.1 * h)
  }
  get heat() {
    return this.heatValue
  }

  /** World position of a point on the rim, used to place the mitts and knife. */
  rimPoint(angle: number, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(Math.cos(angle) * PAN.rTop, PAN.height, Math.sin(angle) * PAN.rTop)
    this.body.localToWorld(out)
    return out
  }
}
