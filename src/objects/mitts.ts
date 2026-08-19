import * as THREE from 'three'
import { mittTexture } from '../core/textures'
import { damp } from '../core/math'

/**
 * The adult pastry chef's hands. A child never touches the hot pan — these do.
 * Quilted cloth, real thickness, and they compress a little when they grip.
 */
export class Mitt {
  readonly root = new THREE.Group()
  private palm: THREE.Mesh
  private thumb: THREE.Mesh
  private gripValue = 0
  private gripTarget = 0

  constructor(side: 1 | -1) {
    const cloth = new THREE.MeshStandardMaterial({
      map: mittTexture('#d8543f'),
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
    })
    const sleeve = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.88, metalness: 0 })
    const trim = new THREE.MeshStandardMaterial({ color: 0xb33f2e, roughness: 0.9, metalness: 0 })

    const palmGeo = new THREE.SphereGeometry(1, 26, 20)
    palmGeo.scale(0.036, 0.062, 0.05)
    this.palm = new THREE.Mesh(palmGeo, cloth)
    this.palm.castShadow = true

    const thumbGeo = new THREE.CapsuleGeometry(0.017, 0.03, 6, 14)
    thumbGeo.rotateZ(Math.PI * 0.5)
    thumbGeo.rotateY(-side * 0.5)
    this.thumb = new THREE.Mesh(thumbGeo, cloth)
    this.thumb.position.set(side * 0.017, 0.024, 0.036)
    this.thumb.castShadow = true

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.028, 20), trim)
    cuff.position.set(-side * 0.032, -0.052, 0)
    cuff.rotation.z = side * 0.38
    cuff.castShadow = true

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.16, 18), sleeve)
    arm.position.set(-side * 0.072, -0.126, -0.005)
    arm.rotation.z = side * 0.38
    arm.castShadow = true

    this.root.add(this.palm, this.thumb, cuff, arm)
    this.root.name = side > 0 ? 'mitt-right' : 'mitt-left'
  }

  /** 0 = open hand, 1 = clamped on the rim (cloth squashes). */
  set grip(v: number) {
    this.gripTarget = Math.max(0, Math.min(1, v))
  }

  update(dt: number) {
    this.gripValue = damp(this.gripValue, this.gripTarget, 9, dt)
    const g = this.gripValue
    this.palm.scale.set(1 - g * 0.16, 1 + g * 0.05, 1 - g * 0.06)
    this.thumb.rotation.z = -g * 0.5
    this.thumb.position.y = 0.024 - g * 0.012
  }
}

/** The pair, parented so they turn with the pan through the flip. */
export class MittPair {
  readonly root = new THREE.Group()
  readonly left = new Mitt(-1)
  readonly right = new Mitt(1)

  constructor(reach = 0.108) {
    this.left.root.position.set(-reach, 0, 0)
    this.right.root.position.set(reach, 0, 0)
    this.left.root.rotation.z = 0.12
    this.right.root.rotation.z = -0.12
    this.root.add(this.left.root, this.right.root)
    this.root.visible = false
    this.root.name = 'mitts'
  }
  set grip(v: number) {
    this.left.grip = v
    this.right.grip = v
  }
  update(dt: number) {
    this.left.update(dt)
    this.right.update(dt)
  }
}
