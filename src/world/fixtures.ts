import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { FIXTURES, type FixtureDef } from './layout'
import { LightPools, ContactShadows } from './decals'
import type { LampState } from '../game/circuits'
import { approach, clamp01 } from '../core/math'

export interface FixtureVisual {
  def: FixtureDef
  group: THREE.Group
  diffuser: THREE.MeshStandardMaterial
  glow: THREE.Sprite
  poolIndex: number
  washIndex: number
  /** World position a real point light would occupy for this fitting. */
  anchor: THREE.Vector3
  emissiveGain: number
  poolGain: number
}

const _v = new THREE.Vector3()

function diffuserMaterial(colour: number): THREE.MeshStandardMaterial {
  const { tex } = buildMaterials()
  return new THREE.MeshStandardMaterial({
    color: 0x9a968c,
    map: tex.diffuserMap,
    emissive: new THREE.Color(colour),
    emissiveMap: tex.diffuserMap,
    emissiveIntensity: 0,
    roughness: 0.78,
    metalness: 0,
  })
}

function glowSprite(colour: number, size: number): THREE.Sprite {
  const { tex } = buildMaterials()
  const mat = new THREE.SpriteMaterial({
    map: tex.glow,
    color: new THREE.Color(colour),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
    fog: true,
  })
  const s = new THREE.Sprite(mat)
  s.scale.setScalar(size)
  return s
}

/* ------------------------------------------------------------------ *
 * Fitting geometry
 * ------------------------------------------------------------------ */

function buildBollard(def: FixtureDef): { group: THREE.Group; diffuser: THREE.MeshStandardMaterial; anchor: THREE.Vector3; glow: THREE.Sprite } {
  const m = buildMaterials()
  const g = new THREE.Group()

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.075, 12), m.concrete)
  base.position.y = 0.0375
  base.receiveShadow = true
  g.add(base)

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.5, 12), m.galvanised)
  post.position.y = 0.325
  post.castShadow = true
  g.add(post)

  // Two service bolts where the head clamps onto the post.
  for (const s of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), m.darkSteel)
    bolt.rotation.z = Math.PI / 2
    bolt.position.set(s * 0.048, 0.565, 0)
    g.add(bolt)
  }

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.035, 12), m.paintedSteel)
  collar.position.y = 0.578
  g.add(collar)

  const diffuser = diffuserMaterial(def.colour)
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.08, 0.09, 14, 1, true),
    diffuser,
  )
  glass.position.y = 0.64
  g.add(glass)

  // A shallow reflector cone: the fitting throws downward, not in every direction.
  const reflector = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.055, 14, 1, true), m.dial)
  reflector.position.y = 0.655
  reflector.rotation.x = Math.PI
  g.add(reflector)

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.096, 0.072, 14), m.paintedSteel)
  cap.position.y = 0.722
  cap.castShadow = true
  g.add(cap)

  const glow = glowSprite(def.colour, 0.3)
  glow.position.y = 0.635
  g.add(glow)

  return { group: g, diffuser, anchor: new THREE.Vector3(0, 0.6, 0), glow }
}

function buildBenchLamp(def: FixtureDef): { group: THREE.Group; diffuser: THREE.MeshStandardMaterial; anchor: THREE.Vector3; glow: THREE.Sprite } {
  const m = buildMaterials()
  const g = new THREE.Group()

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), m.galvanised)
  body.position.set(0, 0.345, 0.05)
  g.add(body)

  for (const s of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05), m.darkSteel)
    bracket.position.set(s * 0.2, 0.375, 0.1)
    g.add(bracket)
  }

  const diffuser = diffuserMaterial(def.colour)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.016, 0.055), diffuser)
  glass.position.set(0, 0.313, 0.05)
  g.add(glass)

  // Short flexible drop into a surface conduit clipped along the bench frame.
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.3, 6), m.conduit)
  drop.position.set(0.24, 0.2, 0.09)
  g.add(drop)

  const glow = glowSprite(def.colour, 0.18)
  glow.position.set(0, 0.3, 0.05)
  g.add(glow)

  return { group: g, diffuser, anchor: new THREE.Vector3(0, 0.3, 0.05), glow }
}

function buildLantern(def: FixtureDef): { group: THREE.Group; diffuser: THREE.MeshStandardMaterial; anchor: THREE.Vector3; glow: THREE.Sprite } {
  const m = buildMaterials()
  const g = new THREE.Group()

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.3, 6), m.darkSteel)
  rod.position.y = 0.245
  g.add(rod)

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.085, 4), m.paintedSteel)
  cap.rotation.y = Math.PI / 4
  cap.position.y = 0.128
  cap.castShadow = true
  g.add(cap)

  const diffuser = diffuserMaterial(def.colour)
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.092, 0.175, 12), diffuser)
  g.add(glass)

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.086, 0.016, 12), m.paintedSteel)
  plate.position.y = -0.094
  g.add(plate)

  const glow = glowSprite(def.colour, 0.42)
  g.add(glow)

  return { group: g, diffuser, anchor: new THREE.Vector3(0, -0.02, 0), glow }
}

function buildUplight(def: FixtureDef): { group: THREE.Group; diffuser: THREE.MeshStandardMaterial; anchor: THREE.Vector3; glow: THREE.Sprite } {
  const m = buildMaterials()
  const g = new THREE.Group()

  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), m.concrete)
  pit.position.y = 0.02
  g.add(pit)

  const can = new THREE.Group()
  can.rotation.x = -0.45
  can.position.y = 0.075
  g.add(can)

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.12, 12), m.galvanised)
  body.rotation.x = Math.PI / 2
  can.add(body)

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.016, 12), m.darkSteel)
  ring.rotation.x = Math.PI / 2
  ring.position.z = 0.062
  can.add(ring)

  const diffuser = diffuserMaterial(def.colour)
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.058, 14), diffuser)
  glass.position.z = 0.058
  can.add(glass)

  // The buried supply enters the back of the can through a compression gland.
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 6), m.conduit)
  gland.rotation.x = Math.PI / 2
  gland.position.z = -0.075
  can.add(gland)

  const glow = glowSprite(def.colour, 0.22)
  glow.position.set(0, 0.1, 0.05)
  g.add(glow)

  return { group: g, diffuser, anchor: new THREE.Vector3(0, 0.14, 0.05), glow }
}

function buildSafetyLamp(def: FixtureDef): { group: THREE.Group; diffuser: THREE.MeshStandardMaterial; anchor: THREE.Vector3; glow: THREE.Sprite } {
  const m = buildMaterials()
  const g = new THREE.Group()

  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.11), m.darkSteel)
  bracket.position.z = -0.055
  g.add(bracket)

  // A low fitting has nothing to bolt to, so it gets its own short post.
  if (def.pos.y < 1.4) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.032, def.pos.y - 0.06, 8),
      m.galvanised,
    )
    post.position.set(0, -(def.pos.y - 0.06) / 2 - 0.05, -0.1)
    post.castShadow = true
    g.add(post)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 10), m.concrete)
    base.position.set(0, -def.pos.y + 0.03, -0.1)
    g.add(base)
  }

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 12, 1, false, 0, Math.PI), m.paintedSteel)
  body.rotation.z = Math.PI / 2
  body.rotation.y = Math.PI / 2
  body.castShadow = true
  g.add(body)

  const diffuser = diffuserMaterial(def.colour)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.11), diffuser)
  glass.position.y = -0.008
  g.add(glass)

  const glow = glowSprite(def.colour, 0.2)
  glow.position.y = -0.02
  g.add(glow)

  return { group: g, diffuser, anchor: new THREE.Vector3(0, -0.06, 0), glow }
}

/* ------------------------------------------------------------------ *
 * Real-light budget
 * ------------------------------------------------------------------ */

interface Slot {
  light: THREE.PointLight
  fixtureId: string | null
  pendingId: string | null
  gain: number
}

/**
 * A strictly bounded set of real point lights, handed to whichever fittings are
 * brightest and closest to the camera. Everything else is carried by emissive
 * diffusers and ground pools.
 */
class RealLightBudget {
  private readonly slots: Slot[] = []
  private timer = 0

  constructor(scene: THREE.Group, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 7.5, 2)
      l.castShadow = false
      scene.add(l)
      this.slots.push({ light: l, fixtureId: null, pendingId: null, gain: 0 })
    }
  }

  update(dt: number, camera: THREE.Camera, visuals: FixtureVisual[], levels: Map<string, number>): void {
    this.timer -= dt
    if (this.timer <= 0) {
      this.timer = 0.4
      const ranked = visuals
        .map((v) => {
          const level = levels.get(v.def.id) ?? 0
          const d = v.anchor.distanceTo(camera.position)
          return { v, score: level < 0.06 ? -1 : (level * v.def.power) / (1 + d * 0.55) }
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.slots.length)

      const wanted = ranked.map((r) => r.v.def.id)
      const keep = new Set<string>()
      for (const s of this.slots) {
        if (s.fixtureId && wanted.includes(s.fixtureId)) keep.add(s.fixtureId)
      }
      const free = wanted.filter((id) => !keep.has(id))
      for (const s of this.slots) {
        if (s.fixtureId && keep.has(s.fixtureId)) {
          s.pendingId = s.fixtureId
          continue
        }
        s.pendingId = free.shift() ?? null
      }
    }

    for (const s of this.slots) {
      if (s.pendingId !== s.fixtureId) {
        // Fade the slot out before it moves, so a re-assignment never pops.
        s.gain = approach(s.gain, 0, 0.09, dt)
        if (s.gain < 0.02) {
          s.fixtureId = s.pendingId
          s.gain = 0
        }
      } else {
        s.gain = approach(s.gain, 1, 0.12, dt)
      }

      if (!s.fixtureId) {
        s.light.intensity = 0
        s.light.visible = false
        continue
      }
      const v = visuals.find((x) => x.def.id === s.fixtureId)
      if (!v) {
        s.light.intensity = 0
        s.light.visible = false
        continue
      }
      const level = levels.get(v.def.id) ?? 0
      s.light.visible = true
      s.light.position.copy(v.anchor)
      s.light.color.set(v.def.colour)
      s.light.intensity = level * v.def.power * s.gain
      s.light.distance = 4 + v.def.poolRadius * 2.4
    }
  }
}

/* ------------------------------------------------------------------ */

export class FixtureSystem {
  readonly root = new THREE.Group()
  readonly pools: LightPools
  readonly visuals: FixtureVisual[] = []
  private readonly byId = new Map<string, FixtureVisual>()
  private readonly budget: RealLightBudget
  private readonly levels = new Map<string, number>()
  private lampGain = 1

  constructor(maxRealLights: number, contacts: ContactShadows) {
    this.root.name = 'fixtures'
    this.pools = new LightPools(FIXTURES.length * 2)

    for (const def of FIXTURES) {
      let built
      switch (def.kind) {
        case 'bollard':
          built = buildBollard(def)
          break
        case 'bench':
          built = buildBenchLamp(def)
          break
        case 'lantern':
          built = buildLantern(def)
          break
        case 'uplight':
          built = buildUplight(def)
          break
        default:
          built = buildSafetyLamp(def)
          break
      }
      built.group.position.copy(def.pos)
      built.group.rotation.y = def.yaw
      this.root.add(built.group)

      const anchor = built.anchor.clone()
      anchor.applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw).add(def.pos)

      // Ground pool, offset in the direction the fitting actually throws.
      const off = def.poolOffset.clone().rotateAround(new THREE.Vector2(0, 0), -def.yaw)
      const poolY = def.kind === 'lantern' ? 0.02 : 0.015
      const poolIndex = this.pools.add(
        def.pos.x + off.x,
        def.kind === 'lantern' ? poolY : poolY,
        def.pos.z + off.y,
        def.poolRadius,
        { squash: def.kind === 'bench' ? 0.65 : 1, yaw: def.yaw },
      )

      // Tree uplights also wash the trunk they are aimed at.
      let washIndex = -1
      if (def.kind === 'uplight') {
        washIndex = this.pools.add(def.pos.x - 0.05, 1.55, def.pos.z - 0.55, 1.15, {
          squash: 1.9,
          billboard: true,
        })
      }

      const emissiveGain = def.kind === 'uplight' ? 2.6 : def.kind === 'bench' ? 1.5 : def.kind === 'safety' ? 1.3 : 2.0
      const poolGain = def.kind === 'safety' ? 0.18 : 0.5

      const visual: FixtureVisual = {
        def,
        group: built.group,
        diffuser: built.diffuser,
        glow: built.glow,
        poolIndex,
        washIndex,
        anchor,
        emissiveGain,
        poolGain,
      }
      this.visuals.push(visual)
      this.byId.set(def.id, visual)

      if (def.kind === 'bollard') contacts.add(def.pos.x, 0, def.pos.z, 0.24, 0.5)
      if (def.kind === 'uplight') contacts.add(def.pos.x, 0, def.pos.z, 0.16, 0.42)
    }

    this.budget = new RealLightBudget(this.root, maxRealLights)
    this.root.add(this.pools.mesh)
  }

  setLampGain(g: number): void {
    this.lampGain = g
  }

  get lampGainValue(): number {
    return this.lampGain
  }

  update(dt: number, camera: THREE.Camera, lamps: Iterable<LampState>): void {
    for (const lamp of lamps) {
      const v = this.byId.get(lamp.def.id)
      if (!v) continue
      const level = clamp01(lamp.level) * this.lampGain
      this.levels.set(lamp.def.id, level)

      v.diffuser.emissiveIntensity = level * v.emissiveGain
      const mat = v.glow.material as THREE.SpriteMaterial
      mat.opacity = Math.pow(level, 1.3) * 0.85
      v.glow.visible = level > 0.02

      this.pools.setLevel(v.poolIndex, v.def.colour, level * v.poolGain)
      if (v.washIndex >= 0) this.pools.setLevel(v.washIndex, v.def.colour, level * 0.5)
    }
    this.pools.update(camera)
    this.budget.update(dt, camera, this.visuals, this.levels)
  }

  get(id: string): FixtureVisual | undefined {
    return this.byId.get(id)
  }

  /** World position of a fitting, for camera framing. */
  anchorOf(id: string, out = _v): THREE.Vector3 {
    const v = this.byId.get(id)
    return out.copy(v ? v.anchor : new THREE.Vector3())
  }
}
