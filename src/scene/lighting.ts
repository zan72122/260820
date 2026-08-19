import * as THREE from 'three'
import { damp } from '../core/math'

/**
 * Patisserie morning: one soft cool key from the window (the only shadow
 * caster), a warm bounce from the oven side, and a low fill that keeps the
 * underside of an upside-down cake from going black.
 */
export class Lighting {
  readonly root = new THREE.Group()
  readonly key: THREE.DirectionalLight
  readonly fill: THREE.DirectionalLight
  readonly rim: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly warm: THREE.PointLight
  private focus = new THREE.Vector3(0, 0.08, 0)
  private target = new THREE.Vector3(0, 0.08, 0)
  private warmth = 0

  constructor(quality: 'high' | 'low') {
    this.hemi = new THREE.HemisphereLight(0xdfe9f5, 0xb59a76, 0.62)

    this.key = new THREE.DirectionalLight(0xfdfaf4, 2.3)
    this.key.castShadow = true
    const size = quality === 'high' ? 2048 : 1024
    this.key.shadow.mapSize.set(size, size)
    this.key.shadow.camera.near = 0.05
    this.key.shadow.camera.far = 2.2
    const s = 0.34
    this.key.shadow.camera.left = -s
    this.key.shadow.camera.right = s
    this.key.shadow.camera.top = s
    this.key.shadow.camera.bottom = -s
    this.key.shadow.bias = -0.00022
    this.key.shadow.normalBias = 0.0015
    this.key.shadow.radius = 2

    this.fill = new THREE.DirectionalLight(0xe8eef6, 0.5)
    this.fill.position.set(-0.6, -0.15, 0.85)

    this.rim = new THREE.DirectionalLight(0xfff2df, 0.8)
    this.rim.position.set(-0.5, 0.75, -1.0)

    this.warm = new THREE.PointLight(0xffa04a, 0, 1.2, 2)

    this.root.add(this.hemi, this.key, this.key.target, this.fill, this.rim, this.warm)
  }

  /** Keep the single shadow frustum tight around whatever the shot is about. */
  lookAt(x: number, y: number, z: number) {
    this.target.set(x, y, z)
  }

  /** 0 = daylight bench, 1 = oven-side warmth. */
  setWarmth(v: number) {
    this.warmth = Math.max(0, Math.min(1, v))
  }

  update(dt: number) {
    this.focus.x = damp(this.focus.x, this.target.x, 4, dt)
    this.focus.y = damp(this.focus.y, this.target.y, 4, dt)
    this.focus.z = damp(this.focus.z, this.target.z, 4, dt)
    this.key.position.set(this.focus.x + 0.9, this.focus.y + 1.05, this.focus.z + 0.42)
    this.key.target.position.copy(this.focus)
    this.key.target.updateMatrixWorld()
    const w = this.warmth
    this.key.color.setRGB(0.995 - w * 0.02, 0.982 - w * 0.03, 0.957 - w * 0.09)
    this.hemi.intensity = 0.62 - w * 0.1
    this.rim.color.setRGB(1, 0.95 - w * 0.03, 0.874 - w * 0.09)
  }
}
