/** Keyboard state → per-tick move direction. The direction is rotated by the
 * camera yaw so "W" always walks away from the camera (third-person norm). */
export class KeyboardInput {
  private readonly down = new Set<string>()
  private interactQueued = false

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.down.add(e.code)
      if (e.code === 'KeyE') this.interactQueued = true
    })
    target.addEventListener('keyup', (e) => this.down.delete(e.code))
    target.addEventListener('blur', () => this.down.clear())
  }

  /** World-space move direction for this tick, or null when idle. */
  moveDir(cameraYaw: number): { dirX: number; dirZ: number } | null {
    let fwd = 0
    let side = 0
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) fwd += 1
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) fwd -= 1
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) side -= 1
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) side += 1
    if (fwd === 0 && side === 0) return null
    // Camera looks along -Z when yaw=0; forward = -Z, right = +X.
    const sin = Math.sin(cameraYaw)
    const cos = Math.cos(cameraYaw)
    const dirX = side * cos - fwd * sin
    const dirZ = -fwd * cos - side * sin
    return { dirX, dirZ }
  }

  /** One-shot: true once per E press. */
  takeInteract(): boolean {
    const q = this.interactQueued
    this.interactQueued = false
    return q
  }
}
