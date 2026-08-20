import { PerspectiveCamera, Vector3 } from 'three'
import { FLUME, PLAY, waterY } from '../config'

interface Sample {
  world: Vector3
  up: Vector3
  sx: number
  sy: number
  /** Screen pixels per metre of height at this point. */
  scale: number
}

/**
 * Turns a finger position into "where along the flume" and "how high above the
 * water" — the only two numbers the player actually controls.
 *
 * It works by projecting the waterline itself to the screen every frame, so
 * the mapping stays natural whatever the camera is doing and whichever way the
 * device is held. There is no fixed interaction plane to get edge-on with.
 */
export class Aim {
  private samples: Sample[] = []
  private tmp = new Vector3()

  constructor() {
    const z0 = PLAY.sMin - 1.2
    const z1 = PLAY.sMax + 0.6
    const n = 96
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * i) / (n - 1)
      this.samples.push({
        world: new Vector3(FLUME.xAt(z), waterY(z), z),
        up: new Vector3(FLUME.xAt(z), waterY(z) + 0.12, z),
        sx: 0,
        sy: 0,
        scale: 1,
      })
    }
  }

  project(camera: PerspectiveCamera, width: number, height: number): void {
    for (const s of this.samples) {
      this.tmp.copy(s.world).project(camera)
      s.sx = (this.tmp.x * 0.5 + 0.5) * width
      s.sy = (-this.tmp.y * 0.5 + 0.5) * height
      this.tmp.copy(s.up).project(camera)
      const ux = (this.tmp.x * 0.5 + 0.5) * width
      const uy = (-this.tmp.y * 0.5 + 0.5) * height
      s.scale = Math.max(24, Math.hypot(ux - s.sx, uy - s.sy) / 0.12)
    }
  }

  /** @returns flume coordinate `s` (world z) and height `h` above the water. */
  pick(px: number, py: number): { s: number; h: number } {
    let bestD = Infinity
    let bestI = 0
    let bestT = 0
    const S = this.samples
    for (let i = 0; i < S.length - 1; i++) {
      const ax = S[i].sx
      const ay = S[i].sy
      const bx = S[i + 1].sx
      const by = S[i + 1].sy
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      let t = len2 > 1e-6 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const cx = ax + dx * t
      const cy = ay + dy * t
      const d = (px - cx) ** 2 + (py - cy) ** 2
      if (d < bestD) {
        bestD = d
        bestI = i
        bestT = t
      }
    }
    const a = this.samples[bestI]
    const b = this.samples[bestI + 1]
    const s = a.world.z + (b.world.z - a.world.z) * bestT
    const cy = a.sy + (b.sy - a.sy) * bestT
    const scale = a.scale + (b.scale - a.scale) * bestT
    const h = (cy - py) / scale
    return {
      s: Math.max(PLAY.sMin, Math.min(PLAY.sMax, s)),
      h: Math.max(PLAY.hMin, Math.min(PLAY.hMax, h)),
    }
  }

  /** Screen position of a point on the flume — used to place the sound field. */
  screenOf(s: number): { x: number; y: number } {
    let i = 0
    while (i < this.samples.length - 2 && this.samples[i + 1].world.z < s) i++
    return { x: this.samples[i].sx, y: this.samples[i].sy }
  }

  static point(s: number, h: number, out = new Vector3()): Vector3 {
    return out.set(FLUME.xAt(s), waterY(s) + h, s)
  }
}
