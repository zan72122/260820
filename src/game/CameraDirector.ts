import * as THREE from 'three'

export type Orientation = 'portrait' | 'landscape'

export type ShotRequest = {
  key: string
  /** unit direction from the target toward the eye */
  dir: THREE.Vector3
  dist: number
  target: THREE.Vector3
  fov: number
  /** world points that must stay inside the safe frame */
  must: THREE.Vector3[]
  minDist?: number
  maxDist?: number
  /** damping speed, higher snaps faster */
  speed?: number
  /** minimum eye height above the water line */
  minEyeY?: number
}

/**
 * The player never controls the camera. The director keeps a small set of
 * scripted framings and guarantees the subject never leaves the safe area,
 * on any phone or tablet, in either orientation.
 */
export class CameraDirector {
  camera: THREE.PerspectiveCamera
  private eye = new THREE.Vector3(3, 2.4, 4)
  private look = new THREE.Vector3(0, 0, 0)
  private fov = 45
  private key = ''
  orientation: Orientation = 'landscape'
  private probe = new THREE.PerspectiveCamera()

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.06, 400)
    this.camera.position.copy(this.eye)
    this.camera.lookAt(this.look)
  }

  setViewport(w: number, h: number) {
    this.camera.aspect = w / h
    this.orientation = h >= w ? 'portrait' : 'landscape'
    this.camera.updateProjectionMatrix()
  }

  /** how much of the frame we are allowed to use, in NDC */
  private safe(): { x: number; y: number } {
    return this.orientation === 'portrait' ? { x: 0.86, y: 0.74 } : { x: 0.80, y: 0.86 }
  }

  cut() {
    this.key = ''
  }

  update(dt: number, req: ShotRequest) {
    const isNew = req.key !== this.key
    this.key = req.key

    let dist = req.dist
    const minD = req.minDist ?? 0.5
    const maxD = req.maxDist ?? 40

    // fit: push the camera back until every must-see point is inside the safe box
    const safe = this.safe()
    this.probe.fov = req.fov
    this.probe.aspect = this.camera.aspect
    this.probe.near = this.camera.near
    this.probe.far = this.camera.far
    const tmp = new THREE.Vector3()
    for (let iter = 0; iter < 4; iter++) {
      const eye = req.target.clone().addScaledVector(req.dir, dist)
      if (req.minEyeY !== undefined) eye.y = Math.max(eye.y, req.minEyeY)
      this.probe.position.copy(eye)
      this.probe.up.set(0, 1, 0)
      this.probe.lookAt(req.target)
      this.probe.updateMatrixWorld(true)
      this.probe.updateProjectionMatrix()
      let over = 1
      for (const p of req.must) {
        tmp.copy(p).project(this.probe)
        if (tmp.z > 1) {
          over = Math.max(over, 1.35)
          continue
        }
        over = Math.max(over, Math.abs(tmp.x) / safe.x, Math.abs(tmp.y) / safe.y)
      }
      if (over <= 1.001) break
      dist = Math.min(maxD, dist * (1 + (over - 1) * 0.55))
    }
    dist = Math.max(minD, Math.min(maxD, dist))

    const wantEye = req.target.clone().addScaledVector(req.dir, dist)
    if (req.minEyeY !== undefined) wantEye.y = Math.max(wantEye.y, req.minEyeY)

    const speed = req.speed ?? 2.6
    const k = isNew ? 1 - Math.exp(-dt * speed * 0.75) : 1 - Math.exp(-dt * speed)
    this.eye.lerp(wantEye, k)
    this.look.lerp(req.target, k)
    this.fov += (req.fov - this.fov) * k

    this.camera.position.copy(this.eye)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(this.look)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  snap(req: ShotRequest) {
    this.eye.copy(req.target).addScaledVector(req.dir, req.dist)
    if (req.minEyeY !== undefined) this.eye.y = Math.max(this.eye.y, req.minEyeY)
    this.look.copy(req.target)
    this.fov = req.fov
    this.camera.position.copy(this.eye)
    this.camera.lookAt(this.look)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    this.key = req.key
  }
}
