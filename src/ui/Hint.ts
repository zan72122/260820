import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three'
import { clamp, damp } from '../util/math'
import { makeGlowTexture } from '../util/textures'

const DOTS = 15

/**
 * The one and only piece of teaching in the game, and it uses no words.
 *
 * A row of soft dots is laid along the exact arc the seat travels, and a single
 * brighter dot runs along them in the direction of the next push — a finger,
 * shown moving where a finger should move. It appears once, and the moment the
 * child pushes the swing themselves it fades out and never comes back.
 */
export class Hint {
  readonly group = new Group()
  private dots: Mesh[] = []
  private lead: Mesh
  private opacity = 0
  private target = 0
  private t = 0

  constructor(private pivot: Vector3, private radius: number) {
    const tex = makeGlowTexture(64, 2.2)
    for (let i = 0; i < DOTS; i++) {
      const m = new Mesh(
        new PlaneGeometry(0.48, 0.48),
        new MeshBasicMaterial({
          map: tex,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          opacity: 0,
          color: 0xfff0d0,
        }),
      )
      m.renderOrder = 40
      this.dots.push(m)
      this.group.add(m)
    }
    this.lead = new Mesh(
      new PlaneGeometry(1.2, 1.2),
      new MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
        color: 0xffe6b4,
      }),
    )
    this.lead.renderOrder = 41
    this.group.add(this.lead)
    this.layout()
  }

  private layout(): void {
    // Sit the dots slightly outside the seat's path so they never z-fight with it.
    const r = this.radius + 0.34
    this.dots.forEach((d, i) => {
      const f = i / (DOTS - 1)
      const a = -0.42 + f * 1.0
      // Same parametrisation as the seat itself — inside the bay the seat sits at
      // (0, -L cos t, +L sin t) — so the dots lie on the real arc and the sweep
      // runs in the direction that actually advances the clock.
      d.position.set(this.pivot.x, this.pivot.y - Math.cos(a) * r, this.pivot.z + Math.sin(a) * r)
    })
  }

  show(): void {
    this.target = 1
  }

  hide(): void {
    this.target = 0
  }

  get visible(): boolean {
    return this.opacity > 0.01
  }

  update(dt: number, camera: Object3D): void {
    this.t += dt
    this.opacity = damp(this.opacity, this.target, this.target > 0 ? 1.4 : 2.6, dt)
    if (this.opacity < 0.005) {
      this.group.visible = false
      return
    }
    this.group.visible = true

    // one sweep every 1.9s, with a pause between passes
    const cycle = 1.9
    const p = (this.t % cycle) / cycle
    const head = clamp(p / 0.68) * (DOTS - 1)

    this.dots.forEach((d, i) => {
      const dist = Math.abs(i - head)
      const glow = Math.exp(-dist * dist * 0.5)
      const m = d.material as MeshBasicMaterial
      m.opacity = this.opacity * (0.15 + glow * 0.78)
      d.quaternion.copy(camera.quaternion)
      const s = 1 + glow * 0.5
      d.scale.setScalar(s)
    })

    const li = clamp(head, 0, DOTS - 1)
    const i0 = Math.floor(li)
    const i1 = Math.min(DOTS - 1, i0 + 1)
    this.lead.position.lerpVectors(this.dots[i0].position, this.dots[i1].position, li - i0)
    this.lead.quaternion.copy(camera.quaternion)
    ;(this.lead.material as MeshBasicMaterial).opacity =
      this.opacity * 0.92 * (p < 0.72 ? 1 : Math.max(0, 1 - (p - 0.72) / 0.16))
  }
}
