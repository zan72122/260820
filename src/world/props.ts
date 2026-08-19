import * as THREE from 'three'
import { DIM } from './dims'
import type { Mats } from './materials'
import { contactShadowMap } from './textures'
import { FAST } from '../core/flags'

const cast = (m: THREE.Mesh) => {
  m.castShadow = !FAST
  m.receiveShadow = !FAST
  return m
}

function contactDecal(radius: number, y: number, opacity = 1) {
  const g = new THREE.PlaneGeometry(radius * 2, radius * 2)
  const mat = new THREE.MeshBasicMaterial({
    map: contactShadowMap(),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    color: 0x000000,
  })
  mat.map!.wrapS = mat.map!.wrapT = THREE.ClampToEdgeWrapping
  const m = new THREE.Mesh(g, mat)
  m.rotation.x = -Math.PI / 2
  m.position.y = y
  m.renderOrder = -1
  return m
}

/**
 * Everything on the bench that is not the cake: the turntable the cake rides on,
 * the candy bowl, the pastry knife and the offset spatula. All of them are real
 * geometry with believable thickness, so the cake reads at the right scale.
 */
export class Props {
  readonly root = new THREE.Group()
  /** rotates with the cake when the child spins the turntable */
  readonly turntable = new THREE.Group()
  readonly bowl = new THREE.Group()
  readonly bowlLip = new THREE.Object3D()
  readonly bowlInner = new THREE.Object3D()
  readonly knife = new THREE.Group()
  readonly knifeEdge = new THREE.Object3D()
  readonly spatula = new THREE.Group()
  readonly spatulaTip = new THREE.Object3D()

  constructor(mats: Mats) {
    this.buildBench(mats)
    this.buildTurntable(mats)
    this.buildBowl(mats)
    this.buildKnife(mats)
    this.buildSpatula(mats)
    this.root.add(this.turntable, this.bowl, this.knife, this.spatula)
  }

  /* -- bench --------------------------------------------------------- */
  private buildBench(mats: Mats) {
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(190, 4.2, 130),
      mats.wood.clone(),
    )
    ;(top.material as THREE.MeshStandardMaterial).map =
      (mats.wood.map as THREE.Texture).clone()
    const m = top.material as THREE.MeshStandardMaterial
    m.map!.repeat.set(9, 6)
    m.map!.needsUpdate = true
    m.color.set(0xbb9871)
    top.position.set(0, DIM.tableTop - 2.1, -12)
    top.receiveShadow = !FAST
    this.root.add(top)
  }

  /* -- turntable + board --------------------------------------------- */
  private buildTurntable(mats: Mats) {
    const plateH = 0.9
    const plate = cast(
      new THREE.Mesh(
        new THREE.CylinderGeometry(DIM.turntableRadius, DIM.turntableRadius * 0.99, plateH, 64),
        mats.steel,
      ),
    )
    plate.position.y = -DIM.boardThickness - plateH / 2

    // concentric guide grooves, the kind a real turntable has
    for (let i = 0; i < 3; i++) {
      const r = 5 + i * 3.2
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.045, 4, 64),
        mats.darkSteel,
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = plate.position.y + plateH / 2 + 0.01
      this.turntable.add(ring)
    }

    const board = cast(
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          DIM.boardRadius,
          DIM.boardRadius * 0.985,
          DIM.boardThickness,
          64,
        ),
        mats.wood,
      ),
    )
    board.position.y = -DIM.boardThickness / 2

    this.turntable.add(plate, board)

    const pedestal = cast(
      new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.2, 0.9, 32), mats.darkSteel),
    )
    pedestal.position.y = -DIM.boardThickness - plateH - 0.45
    const foot = cast(
      new THREE.Mesh(new THREE.CylinderGeometry(7.4, 8.2, 0.55, 40), mats.darkSteel),
    )
    foot.position.y = DIM.tableTop + 0.28
    this.root.add(pedestal, foot, contactDecal(15, DIM.tableTop + 0.05, 0.85))
  }

  /* -- candy bowl ---------------------------------------------------- */
  private buildBowl(mats: Mats) {
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(1.7, 0.02),
      new THREE.Vector2(3.5, 0.3),
      new THREE.Vector2(4.9, 1.35),
      new THREE.Vector2(5.6, 2.9),
      new THREE.Vector2(5.85, 4.05),
      new THREE.Vector2(5.4, 4.2),
      new THREE.Vector2(5.15, 3.7),
      new THREE.Vector2(4.4, 2.0),
      new THREE.Vector2(2.9, 0.75),
      new THREE.Vector2(0.0, 0.52),
    ]
    const geo = new THREE.LatheGeometry(pts, 44)
    geo.computeVertexNormals()
    const mat = mats.ceramic.clone()
    mat.side = THREE.DoubleSide
    const shell = cast(new THREE.Mesh(geo, mat))

    const footRing = cast(
      new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.32, 6, 28), mats.ceramic),
    )
    footRing.rotation.x = Math.PI / 2
    footRing.position.y = 0.06

    // a soft blue band, so the bowl separates from the cream cake behind it
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(5.72, 5.5, 0.9, 44, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x7fa6c4, roughness: 0.3 }),
    )
    band.position.y = 3.15

    this.bowl.add(shell, footRing, band)
    this.bowlLip.position.set(0, 4.3, 5.1)
    this.bowlInner.position.set(0, 1.05, 0)
    this.bowl.add(this.bowlLip, this.bowlInner)
    this.bowl.position.set(-9.8, DIM.tableTop, 18.5)
    this.bowl.add(contactDecal(8, 0.06, 0.7))
  }

  /* -- pastry knife --------------------------------------------------- */
  private buildKnife(mats: Mats) {
    // blade profile in XY: length along X, width along Y, edge at y = 0
    const s = new THREE.Shape()
    s.moveTo(-11.5, 0.15)
    s.lineTo(8.6, 0.0)
    s.quadraticCurveTo(11.4, 0.12, 11.9, 1.5)
    s.lineTo(11.2, 3.05)
    s.lineTo(-11.5, 3.3)
    s.closePath()
    const bladeGeo = new THREE.ExtrudeGeometry(s, {
      depth: 0.17,
      bevelEnabled: true,
      bevelSize: 0.07,
      bevelThickness: 0.05,
      bevelSegments: 1,
      curveSegments: 4,
    })
    bladeGeo.translate(0, 0, -0.085)
    bladeGeo.computeVertexNormals()
    const blade = cast(new THREE.Mesh(bladeGeo, mats.steel))

    const bolster = cast(
      new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.7, 1.05), mats.darkSteel),
    )
    bolster.position.set(-12.1, 1.75, 0)

    const handleGeo = new THREE.CylinderGeometry(1.0, 0.82, 10.5, 16)
    handleGeo.rotateZ(Math.PI / 2)
    const handle = cast(new THREE.Mesh(handleGeo, mats.handle))
    handle.position.set(-18.0, 1.75, 0)
    const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(0.84, 14, 10), mats.handle))
    cap.position.set(-23.2, 1.75, 0)

    for (let i = 0; i < 3; i++) {
      const rivet = cast(
        new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.9, 10), mats.steel),
      )
      rivet.rotation.x = Math.PI / 2
      rivet.position.set(-15.2 - i * 2.4, 1.75, 0)
      this.knife.add(rivet)
    }

    this.knifeEdge.position.set(6, 0, 0)
    this.knife.add(blade, bolster, handle, cap, this.knifeEdge)
    this.knife.position.set(15.5, DIM.tableTop + 0.2, 9)
    this.knife.rotation.set(Math.PI / 2, 0, -0.9)
  }

  /* -- offset spatula -------------------------------------------------- */
  private buildSpatula(mats: Mats) {
    const bladeGeo = new THREE.BoxGeometry(9, 0.16, 2.6, 1, 1, 1)
    const pos = bladeGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      // round the working end
      if (pos.getX(i) > 4) pos.setZ(i, pos.getZ(i) * 0.72)
    }
    bladeGeo.computeVertexNormals()
    const blade = cast(new THREE.Mesh(bladeGeo, mats.steel))
    blade.position.set(4.4, 0, 0)

    const neck = cast(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.6), mats.steel))
    neck.position.set(-1.1, 0.5, 0)
    const handleGeo = new THREE.CylinderGeometry(0.78, 0.62, 7.4, 14)
    handleGeo.rotateZ(Math.PI / 2)
    const handle = cast(new THREE.Mesh(handleGeo, mats.handle))
    handle.position.set(-6.0, 0.95, 0)

    this.spatulaTip.position.set(8.6, 0, 0)
    this.spatula.add(blade, neck, handle, this.spatulaTip)
    this.spatula.position.set(16.5, DIM.tableTop + 0.5, -8)
    this.spatula.rotation.set(0, -0.5, 0)
    this.spatula.visible = false
  }
}
