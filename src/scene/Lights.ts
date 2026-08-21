import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Vector3,
} from 'three'
import type { LightingState } from '../core/Lighting'
import { clamp, damp, lerp } from '../util/math'
import { makeGlowTexture } from '../util/textures'

let glowTex: ReturnType<typeof makeGlowTexture> | null = null
const glow = () => (glowTex ??= makeGlowTexture(128, 2.5))

export interface FixtureSpec {
  /** Which GameState lamp group this fixture belongs to. */
  group: string
  index: number
  position: Vector3
  color: Color
  /** Emissive material of the lamp's own glass/globe. */
  glass?: MeshStandardMaterial
  /**
   * Escape hatch for fixtures that are not a single glass — a whole strip of road
   * lights, a harbour, a ridge. Receives the fixture's output level each frame.
   */
  onLevel?: (level: number, L: LightingState) => void
  /** A real PointLight is only spent on fixtures close enough to matter. */
  dynamic?: boolean
  lightRange?: number
  lightPower?: number
  haloSize?: number
  /** Radius of the pool of light thrown on the ground. 0 = none. */
  poolRadius?: number
  poolY?: number
}

/**
 * One physical light fixture. Everything about it is visible hardware: a glass
 * that glows, a halo in the evening air, and a pool of light on the ground.
 * Distant fixtures skip the PointLight and keep only the emissive + halo, which
 * is why hundreds of town lights cost almost nothing.
 */
export class Fixture {
  readonly group: string
  readonly index: number
  readonly position: Vector3

  /** Steady-state target, 0 or 1. */
  target = 0
  /** Animated output including warm-up flicker. */
  level = 0

  private igniting = 0
  private flickerT = 0
  private pulse = 0

  private glass: MeshStandardMaterial | null
  private onLevel: ((level: number, L: LightingState) => void) | null
  private halo: Mesh | null = null
  private pool: Mesh | null = null
  private light: PointLight | null = null
  private colour: Color
  private lightPower: number

  constructor(spec: FixtureSpec, parent: Object3D) {
    this.group = spec.group
    this.index = spec.index
    this.position = spec.position.clone()
    this.glass = spec.glass ?? null
    this.onLevel = spec.onLevel ?? null
    this.colour = spec.color.clone()
    this.lightPower = spec.lightPower ?? 6

    const haloSize = spec.haloSize ?? 1.1
    if (haloSize > 0) {
      this.halo = new Mesh(
        new PlaneGeometry(haloSize, haloSize),
        new MeshBasicMaterial({
          map: glow(),
          color: this.colour,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: 0,
          fog: false,
        }),
      )
      this.halo.position.copy(this.position)
      this.halo.renderOrder = 10
      parent.add(this.halo)
    }

    const pr = spec.poolRadius ?? 0
    if (pr > 0) {
      this.pool = new Mesh(
        new PlaneGeometry(pr * 2, pr * 2),
        new MeshBasicMaterial({
          map: glow(),
          color: this.colour,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: 0,
        }),
      )
      this.pool.rotation.x = -Math.PI / 2
      this.pool.position.set(this.position.x, (spec.poolY ?? 0) + 0.02, this.position.z)
      this.pool.renderOrder = 4
      parent.add(this.pool)
    }

    if (spec.dynamic) {
      this.light = new PointLight(this.colour, 0, spec.lightRange ?? 9, 2)
      this.light.position.copy(this.position)
      parent.add(this.light)
    }
  }

  /** Switch on for good, with a short warm-up flicker like a real discharge lamp. */
  ignite(): void {
    if (this.target >= 1) return
    this.target = 1
    this.igniting = 1
    this.flickerT = 0
  }

  /** A brief, weak glimmer that does not stay on — used for the opening mystery. */
  glimmer(strength = 0.5): void {
    this.pulse = Math.max(this.pulse, strength)
  }

  setInstant(on: boolean): void {
    this.target = on ? 1 : 0
    this.level = this.target
    this.igniting = 0
  }

  update(dt: number, L: LightingState, camera: Object3D): void {
    if (this.igniting > 0) {
      this.flickerT += dt
      this.igniting = Math.max(0, this.igniting - dt / 1.15)
      // two stutters then a steady climb
      const f = this.flickerT
      const stutter =
        f < 0.09 ? 0.75 : f < 0.16 ? 0.06 : f < 0.26 ? 0.85 : f < 0.32 ? 0.18 : clamp((f - 0.32) / 0.75)
      this.level = damp(this.level, Math.max(stutter, this.level * 0.8), 22, dt)
    } else {
      this.level = damp(this.level, this.target, 5.5, dt)
    }
    if (this.pulse > 0) this.pulse = damp(this.pulse, 0, 3.4, dt)

    const out = clamp(Math.max(this.level, this.pulse))
    const emissive = out * L.lampEmissive

    if (this.glass) {
      this.glass.emissiveIntensity = emissive * 2.4
      this.glass.color.copy(this.colour).multiplyScalar(0.28 + emissive * 0.4)
    }
    this.onLevel?.(emissive, L)

    if (this.halo) {
      const m = this.halo.material as MeshBasicMaterial
      m.opacity = emissive * lerp(0.16, 0.42, L.starVisibility)
      this.halo.quaternion.copy(camera.quaternion)
    }
    if (this.pool) {
      const m = this.pool.material as MeshBasicMaterial
      m.opacity = emissive * L.groundPool * 0.5
    }
    if (this.light) {
      this.light.intensity = emissive * this.lightPower * L.lampLightIntensity
    }
  }
}

/**
 * Registry of every fixture in the world. It is the only thing that translates
 * "GameState says group X has N lamps lit" into photons.
 */
export class LightRig {
  readonly root = new Group()
  private fixtures: Fixture[] = []
  private byGroup = new Map<string, Fixture[]>()

  add(spec: FixtureSpec): Fixture {
    const f = new Fixture(spec, this.root)
    this.fixtures.push(f)
    const arr = this.byGroup.get(spec.group) ?? []
    arr.push(f)
    arr.sort((a, b) => a.index - b.index)
    this.byGroup.set(spec.group, arr)
    return f
  }

  get(group: string, index: number): Fixture | undefined {
    return this.byGroup.get(group)?.find((f) => f.index === index)
  }

  ignite(group: string, index: number): void {
    this.get(group, index)?.ignite()
  }

  glimmer(group: string, index: number, strength = 0.5): void {
    this.get(group, index)?.glimmer(strength)
  }

  /** Force the rig to match a GameState snapshot without animating (used on restore). */
  syncInstant(litOf: (group: string) => number): void {
    for (const [g, arr] of this.byGroup) {
      const n = litOf(g)
      arr.forEach((f, i) => f.setInstant(i < n))
    }
  }

  allOn(): void {
    for (const f of this.fixtures) f.ignite()
  }

  reset(): void {
    for (const f of this.fixtures) f.setInstant(false)
  }

  update(dt: number, L: LightingState, camera: Object3D): void {
    for (const f of this.fixtures) f.update(dt, L, camera)
  }
}
