import * as THREE from 'three'
import { applyMurk } from './murk'

/** The low harvest boat that floats beside the worker. */
export class Boat {
  group = new THREE.Group()
  private bob = 0
  private slots = 0
  cargo = new THREE.Group()

  constructor(murkColor: THREE.Color) {
    const hull = new THREE.MeshStandardMaterial({ color: 0x9aa39c, roughness: 0.62, metalness: 0.02 })
    const inner = new THREE.MeshStandardMaterial({ color: 0x7d857e, roughness: 0.72 })
    applyMurk(hull, murkColor, 0.2)
    const L = 1.55
    const W = 0.72
    const H = 0.2
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, W), inner)
    floor.position.y = -0.055
    floor.receiveShadow = true
    const wall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hull)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      return m
    }
    this.group.add(
      floor,
      wall(L, H, 0.05, 0, 0.03, W / 2),
      wall(L, H, 0.05, 0, 0.03, -W / 2),
      wall(0.05, H, W, L / 2, 0.03, 0),
      wall(0.05, H, W, -L / 2, 0.03, 0),
    )
    // rim rail, a little brighter where hands grab it
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb3bab2, roughness: 0.5 })
    applyMurk(rimMat, murkColor, 0.2)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.018, 5, 8), rimMat)
    rim.visible = false
    this.group.add(rim)
    for (const [x, z] of [
      [0, W / 2],
      [0, -W / 2],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(L + 0.06, 0.03, 0.075), rimMat)
      bar.position.set(x, 0.135, z)
      bar.castShadow = true
      this.group.add(bar)
    }
    this.group.add(this.cargo)
  }

  /** Drop a harvested root in, stacked loosely. */
  store(mesh: THREE.Object3D) {
    const row = this.slots % 3
    const col = Math.floor(this.slots / 3)
    mesh.position.set(-0.35 + col * 0.3, -0.01 + col * 0.03, -0.2 + row * 0.2)
    mesh.rotation.set(0, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.12)
    this.cargo.add(mesh)
    this.slots++
  }

  update(dt: number, t: number) {
    void dt
    this.bob = Math.sin(t * 0.9) * 0.008 + Math.sin(t * 1.7 + 1) * 0.004
    this.group.position.y = -0.045 + this.bob
    this.group.rotation.z = Math.sin(t * 0.7) * 0.012
    this.group.rotation.x = Math.sin(t * 0.55 + 2) * 0.008
  }
}
