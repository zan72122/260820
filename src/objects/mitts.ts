import * as THREE from 'three'
import { mittTexture } from '../core/textures'
import { damp } from '../core/math'

/**
 * The adult pastry chef's hands. A child never touches the hot pan — these do.
 * Quilted cloth, real thickness, and they compress a little when they grip.
 */
export class Mitt {
  readonly root = new THREE.Group()
  private pad: THREE.Mesh
  private fingers: THREE.Mesh
  private thumb: THREE.Mesh
  private gripValue = 0
  private gripTarget = 0

  constructor(side: 1 | -1) {
    const cloth = new THREE.MeshStandardMaterial({
      map: mittTexture('#c8543c'),
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
    })
    const sleeve = new THREE.MeshStandardMaterial({ color: 0xcdc7ba, roughness: 0.92, metalness: 0 })
    const trim = new THREE.MeshStandardMaterial({ color: 0x9c3628, roughness: 0.92, metalness: 0 })

    // Palm pad: tall and shallow, so it hugs the pan wall rather than balling up.
    const padGeo = new THREE.SphereGeometry(1, 24, 18)
    padGeo.scale(0.028, 0.05, 0.056)
    this.pad = new THREE.Mesh(padGeo, cloth)
    this.pad.castShadow = true

    // Fingers folded over the rim — the thing that actually says "holding".
    const fingerGeo = new THREE.CapsuleGeometry(0.017, 0.062, 5, 14)
    fingerGeo.rotateX(Math.PI / 2)
    this.fingers = new THREE.Mesh(fingerGeo, cloth)
    this.fingers.position.set(-side * 0.012, 0.042, 0.002)
    this.fingers.rotation.z = side * 0.28
    this.fingers.castShadow = true

    const thumbGeo = new THREE.CapsuleGeometry(0.0145, 0.03, 5, 12)
    thumbGeo.rotateX(Math.PI * 0.42)
    this.thumb = new THREE.Mesh(thumbGeo, cloth)
    this.thumb.position.set(-side * 0.004, -0.004, 0.05)
    this.thumb.castShadow = true

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.031, 0.03, 18), trim)
    cuff.position.set(-side * 0.018, -0.052, -0.026)
    cuff.rotation.set(-0.5, 0, side * 0.34)
    cuff.castShadow = true

    // Forearms recede away from the lens: the chef stands opposite the camera.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.34, 16), sleeve)
    arm.position.set(-side * 0.052, -0.176, -0.03)
    arm.rotation.set(-1.02, 0, side * 0.3)
    arm.castShadow = true

    this.root.add(this.pad, this.fingers, this.thumb, cuff, arm)
    this.root.name = side > 0 ? 'mitt-right' : 'mitt-left'
  }

  /** 0 = open hand, 1 = clamped on the rim (cloth squashes). */
  set grip(v: number) {
    this.gripTarget = Math.max(0, Math.min(1, v))
  }

  update(dt: number) {
    this.gripValue = damp(this.gripValue, this.gripTarget, 9, dt)
    const g = this.gripValue
    this.pad.scale.set(1 - g * 0.2, 1 + g * 0.06, 1 + g * 0.04)
    this.fingers.position.y = 0.042 - g * 0.006
    this.fingers.scale.set(1 - g * 0.12, 1, 1)
    this.thumb.position.y = -0.004 - g * 0.008
    this.thumb.rotation.z = -g * 0.35
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
    // Sit the pair a touch toward the camera so the cloth reads as foreground
    // and the pan silhouette stays clean behind it.
    this.left.root.position.z = 0.03
    this.right.root.position.z = 0.03
    this.left.root.position.y = 0.014
    this.right.root.position.y = 0.014
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
