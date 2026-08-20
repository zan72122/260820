import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Euler,
  Matrix4,
  Quaternion,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { BENCH } from '../game/layout'
import { clamp01, lerp, smoothstep } from '../core/math'
import { buildLeafGeometry, makeLeafParams } from './leaf'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Rng } from '../core/rng'
import type { TextureBundle } from '../gfx/textureLab'
import type { QualitySettings } from '../core/quality'

/**
 * The room around the one branch: concrete floor, benches, posts and a glass
 * roof that turns the sun into soft, directional daylight. Time of day drives
 * the sun's arc, the colour temperature, the window patch on the floor and the
 * ambient bounce, all together, so compressing time reads as time passing.
 */

function windowPatchTexture(): CanvasTexture {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, s, s)
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.5)
  g.addColorStop(0, 'rgba(255,246,225,0.95)')
  g.addColorStop(0.55, 'rgba(255,242,215,0.5)')
  g.addColorStop(1, 'rgba(255,240,210,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  // Mullion bars, softened: the shadow of the glazing structure.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.filter = 'blur(5px)'
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  for (let i = 1; i < 4; i++) {
    ctx.fillRect((i * s) / 4 - 5, 0, 10, s)
  }
  ctx.fillRect(0, s * 0.5 - 5, s, 10)
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

function dustTexture(): CanvasTexture {
  const s = 32
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(c)
}

export interface SunState {
  direction: Vector3
  color: Color
  intensity: number
}

export class Greenhouse {
  readonly group = new Group()
  readonly sun: DirectionalLight
  readonly hemi: HemisphereLight
  readonly fill: DirectionalLight
  readonly sunState: SunState = {
    direction: new Vector3(0.4, 0.8, 0.4),
    color: new Color(1, 1, 1),
    intensity: 1,
  }

  private readonly patch: Mesh
  private readonly glow: Mesh
  private readonly dust: Points | null
  private readonly dustSeeds: Float32Array | null
  private readonly fogColor = new Color()
  private readonly scene: Scene
  private time = 0

  constructor(scene: Scene, tex: TextureBundle, q: QualitySettings, seed: number) {
    this.scene = scene
    const rng = new Rng(seed ^ 0x7f31)

    // ---- floor -----------------------------------------------------------
    const floorColor = tex.floorColor.clone()
    floorColor.wrapS = floorColor.wrapT = RepeatWrapping
    floorColor.repeat.set(7, 7)
    floorColor.needsUpdate = true
    const floorNormal = tex.floorNormal.clone()
    floorNormal.wrapS = floorNormal.wrapT = RepeatWrapping
    floorNormal.repeat.set(7, 7)
    floorNormal.needsUpdate = true
    const floor = new Mesh(
      new PlaneGeometry(14, 14),
      new MeshStandardMaterial({
        map: floorColor,
        normalMap: floorNormal,
        roughness: 0.94,
        metalness: 0,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.group.add(floor)

    // ---- benches ---------------------------------------------------------
    const wood = new MeshPhysicalMaterial({
      map: tex.barkColor,
      normalMap: tex.barkNormal,
      color: new Color(0.66, 0.55, 0.41),
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.4,
    })
    this.group.add(makeBench(wood, BENCH.x0, BENCH.x1, BENCH.z0, BENCH.z1, BENCH.top))
    // A second bench further back gives the room depth.
    this.group.add(makeBench(wood, -1.9, -0.7, -1.35, -0.85, 0.34))
    this.group.add(makeBench(wood, 0.85, 2.1, -1.5, -1.0, 0.34))

    // ---- structure -------------------------------------------------------
    const steel = new MeshStandardMaterial({
      color: new Color(0.21, 0.23, 0.225),
      roughness: 0.62,
      metalness: 0.55,
    })
    // Kept clear of the centre line: nothing structural crosses the fruit.
    for (const px of [-1.55, 1.55, -3.1, 3.1]) {
      for (const pz of [-3.2, 1.8]) {
        const post = new Mesh(new BoxGeometry(0.075, 3.4, 0.075), steel)
        post.position.set(px, 1.7, pz)
        post.castShadow = false
        post.receiveShadow = true
        this.group.add(post)
      }
    }
    // Glass roof: a bright diffusing plane with rafters under it.
    const roof = new Mesh(
      new PlaneGeometry(9, 9),
      new MeshBasicMaterial({ color: new Color(1.35, 1.4, 1.32), side: DoubleSide, fog: false }),
    )
    roof.rotation.x = Math.PI / 2
    roof.position.y = 3.35
    this.group.add(roof)
    for (let i = -6; i <= 6; i++) {
      const rafter = new Mesh(new BoxGeometry(6.4, 0.05, 0.05), steel)
      rafter.position.set(0, 3.24, i * 0.55)
      this.group.add(rafter)
    }
    // The room's far shell: bright diffuse glazing overhead falling away to a
    // deeper green at bench height, so the scene has somewhere to sit.
    const shellGeo = new SphereGeometry(11, 24, 16)
    const shellPos = shellGeo.getAttribute('position')
    const shellCol = new Float32Array(shellPos.count * 3)
    const top = new Color(0.72, 0.78, 0.72)
    const mid = new Color(0.40, 0.49, 0.38)
    const low = new Color(0.17, 0.21, 0.16)
    const tmpCol = new Color()
    for (let i = 0; i < shellPos.count; i++) {
      const h = shellPos.getY(i) / 11
      if (h > 0.05) tmpCol.copy(mid).lerp(top, smoothstep(0.05, 0.75, h))
      else tmpCol.copy(mid).lerp(low, smoothstep(0.05, -0.5, h))
      // A hint of the glazing structure, high up only.
      const bars = Math.pow(Math.abs(Math.sin(Math.atan2(shellPos.getZ(i), shellPos.getX(i)) * 7)), 18)
      tmpCol.multiplyScalar(1 - bars * 0.35 * clamp01(h * 2))
      shellCol[i * 3] = tmpCol.r
      shellCol[i * 3 + 1] = tmpCol.g
      shellCol[i * 3 + 2] = tmpCol.b
    }
    shellGeo.setAttribute('color', new BufferAttribute(shellCol, 3))
    const wall = new Mesh(
      shellGeo,
      new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false }),
    )
    this.group.add(wall)

    // Foliage well behind the branch: depth, and something for the light to
    // bounce off, merged down to one draw call per clump.
    this.group.add(makeBackdropFoliage(q, seed))

    // A few leaves that came down before this one. Merged, static, and just
    // enough to stop the floor reading as an empty plane.
    const litter = makeClump(
      new Rng(seed ^ 0x11ee),
      new MeshStandardMaterial({
        color: new Color(0.19, 0.2, 0.1),
        roughness: 0.9,
        metalness: 0,
        side: DoubleSide,
      }),
      q.tier === 'low' ? 6 : 14,
      0.75,
      0.004,
      [0.85, 1.25],
      false,
    )
    if (litter) {
      litter.position.set(-0.15, 0.006, 0.55)
      litter.rotation.x = -Math.PI / 2
      litter.receiveShadow = true
      this.group.add(litter)
    }

    // ---- window light patch on the floor ---------------------------------
    this.patch = new Mesh(
      new PlaneGeometry(2.0, 1.6),
      new MeshBasicMaterial({
        map: windowPatchTexture(),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0.9,
        fog: false,
      }),
    )
    this.patch.rotation.x = -Math.PI / 2
    this.patch.position.y = 0.004
    this.group.add(this.patch)

    // ---- the sun itself, seen through the glass --------------------------
    // This is the only thing on screen that says "time can move".
    this.glow = new Mesh(
      new PlaneGeometry(1.5, 1.5),
      new MeshBasicMaterial({
        map: dustTexture(),
        color: new Color(1.0, 0.92, 0.72),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    )
    this.glow.renderOrder = -1
    this.group.add(this.glow)

    // ---- dust ------------------------------------------------------------
    if (q.dust > 0) {
      const n = q.dust
      const pos = new Float32Array(n * 3)
      this.dustSeeds = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = rng.range(-1.5, 1.5)
        pos[i * 3 + 1] = rng.range(0.25, 2.2)
        pos[i * 3 + 2] = rng.range(-1.4, 1.0)
        this.dustSeeds[i * 3] = rng.range(0, Math.PI * 2)
        this.dustSeeds[i * 3 + 1] = rng.range(0.4, 1.3)
        this.dustSeeds[i * 3 + 2] = rng.range(0, Math.PI * 2)
      }
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(pos, 3))
      this.dust = new Points(
        geo,
        new PointsMaterial({
          size: 0.0075,
          map: dustTexture(),
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: 0.5,
          sizeAttenuation: true,
        }),
      )
      this.group.add(this.dust)
    } else {
      this.dust = null
      this.dustSeeds = null
    }

    // ---- lights ----------------------------------------------------------
    this.sun = new DirectionalLight(0xffffff, 4.4)
    this.sun.castShadow = q.shadows
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    this.sun.shadow.camera.near = 0.4
    this.sun.shadow.camera.far = 6.5
    this.sun.shadow.camera.left = -1.1
    this.sun.shadow.camera.right = 1.1
    this.sun.shadow.camera.top = 1.5
    this.sun.shadow.camera.bottom = -1.0
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.012
    this.sun.shadow.radius = 2.2
    this.sun.target.position.set(0, 0.75, 0)
    this.group.add(this.sun, this.sun.target)

    this.hemi = new HemisphereLight(0xd7e8ff, 0x40502f, 0.62)
    this.group.add(this.hemi)

    this.fill = new DirectionalLight(0xbfd6e6, 0.4)
    this.fill.position.set(-1.6, 1.1, 1.9)
    this.group.add(this.fill)

    scene.fog = new Fog(0x5d6d52, 5.5, 18)
    this.setTimeOfDay(0.28)
  }

  /**
   * One number moves the whole day: sun arc, colour temperature, the patch of
   * window light on the floor, the ambient bounce and the fog.
   */
  setTimeOfDay(t: number): void {
    // Wrap so the child can scrub as far as they like in either direction.
    const day = ((t % 1) + 1) % 1
    const arc = clamp01(day)
    const az = lerp(-1.05, 1.05, arc)
    const elevation = Math.sin(Math.PI * clamp01(arc * 0.94 + 0.03)) * 0.95 + 0.16

    const dir = this.sunState.direction
    dir.set(Math.sin(az) * 0.9, elevation + 0.35, Math.cos(az) * 0.55 + 0.35).normalize()
    this.sun.position.copy(dir).multiplyScalar(3.4)
    this.sun.position.y += 0.6

    // Warm at both ends of the day, neutral through the middle.
    const noon = 1 - Math.abs(arc - 0.5) * 2
    const warm = smoothstep(0.75, 0.05, noon)
    this.sunState.color.setRGB(
      lerp(1.0, 1.0, warm),
      lerp(0.965, 0.74, warm),
      lerp(0.9, 0.5, warm),
    )
    this.sunState.intensity = lerp(2.9, 5.1, noon)
    this.sun.color.copy(this.sunState.color)
    this.sun.intensity = this.sunState.intensity

    this.hemi.intensity = lerp(0.45, 0.72, noon)
    this.hemi.color.setRGB(lerp(0.95, 0.86, warm), lerp(0.96, 0.9, warm), lerp(1.0, 0.94, warm))
    this.fill.intensity = lerp(0.22, 0.42, noon)

    // The window patch slides across the floor as the sun swings.
    this.patch.position.x = -az * 0.8
    this.patch.position.z = -0.4 - noon * 0.45
    this.patch.scale.set(1 + (1 - noon) * 0.55, 1 + (1 - noon) * 0.3, 1)
    ;(this.patch.material as MeshBasicMaterial).opacity = 0.42 + noon * 0.55

    // The sun blob itself, kept high and clear of the fruit.
    this.glow.position.set(Math.sin(az) * 2.7, 2.05 + elevation * 0.75, -2.2)
    const gm = this.glow.material as MeshBasicMaterial
    gm.color.setRGB(1.0, lerp(0.94, 0.72, warm), lerp(0.82, 0.46, warm))
    gm.opacity = 0.55 + noon * 0.25

    this.fogColor.setRGB(lerp(0.34, 0.42, noon), lerp(0.39, 0.48, noon), lerp(0.30, 0.35, noon))
    if (this.scene.fog instanceof Fog) this.scene.fog.color.copy(this.fogColor)
  }

  /** The sun glow can be pulsed once, as a wordless "this can move" nudge. */
  setGlowBoost(v: number): void {
    const gm = this.glow.material as MeshBasicMaterial
    gm.opacity = clamp01(0.55 + v * 0.5)
    this.glow.scale.setScalar(1 + v * 0.22)
  }

  update(dt: number, camera: { position: Vector3 }): void {
    this.time += dt
    this.glow.lookAt(camera.position)
    if (this.dust && this.dustSeeds) {
      const attr = this.dust.geometry.getAttribute('position') as BufferAttribute
      const arr = attr.array as Float32Array
      for (let i = 0; i < arr.length / 3; i++) {
        const s = this.dustSeeds
        arr[i * 3] += Math.sin(this.time * 0.32 * s[i * 3 + 1] + s[i * 3]) * dt * 0.012
        arr[i * 3 + 1] += (Math.sin(this.time * 0.22 + s[i * 3 + 2]) * 0.5 + 0.35) * dt * 0.012
        arr[i * 3 + 2] += Math.cos(this.time * 0.26 * s[i * 3 + 1] + s[i * 3 + 2]) * dt * 0.01
        if (arr[i * 3 + 1] > 2.4) arr[i * 3 + 1] = 0.2
      }
      attr.needsUpdate = true
    }
  }
}

/**
 * A plant: a dark rounded mass with leaves growing out of it, merged into one
 * draw call. The mass is what stops a scatter of blades reading as leaves
 * hanging in mid air.
 */
function makeClump(
  rng: Rng,
  material: MeshStandardMaterial,
  count: number,
  spread: number,
  rise: number,
  leafScale: [number, number],
  withMass = true,
): Group | null {
  const group = new Group()
  const parts: BufferGeometry[] = []
  const centre = new Vector3(0, rise * 0.45, 0)
  const out = new Vector3()
  for (let i = 0; i < count; i++) {
    const p = makeLeafParams(rng)
    const geo = buildLeafGeometry(p, 6, 3)
    // Leaves sprout outwards and downwards from the body of the plant.
    const phi = rng.range(0, Math.PI * 2)
    const lift = rng.range(-0.35, 0.9)
    out.set(Math.cos(phi), lift, Math.sin(phi)).normalize()
    const rot = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), out)
    rot.multiply(new Quaternion().setFromEuler(new Euler(0, rng.range(0, Math.PI * 2), 0)))
    const scale = rng.range(leafScale[0], leafScale[1])
    geo.applyMatrix4(
      new Matrix4().compose(
        new Vector3(
          centre.x + out.x * spread * rng.range(0.15, 0.8),
          centre.y + out.y * rise * rng.range(0.1, 0.7),
          centre.z + out.z * spread * rng.range(0.15, 0.8),
        ),
        rot,
        new Vector3(scale, scale, scale),
      ),
    )
    parts.push(geo)
  }
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  if (!merged) return null
  group.add(new Mesh(merged, material))
  if (withMass) {
    const mass = new Mesh(
      new IcosahedronGeometry(0.5, 1),
      new MeshStandardMaterial({
        color: new Color(0.045, 0.075, 0.03),
        roughness: 0.95,
        metalness: 0,
      }),
    )
    mass.scale.set(spread * 0.95, rise * 0.75, spread * 0.85)
    mass.position.copy(centre)
    group.add(mass)

    // A pot. Nothing grounds a plant like something for it to grow out of.
    const pot = new Mesh(
      new CylinderGeometry(spread * 0.62, spread * 0.46, spread * 0.9, 10),
      new MeshStandardMaterial({
        color: new Color(0.28, 0.145, 0.085),
        roughness: 0.92,
        metalness: 0,
      }),
    )
    pot.position.y = spread * 0.45
    pot.castShadow = true
    pot.receiveShadow = true
    group.add(pot)
  }
  return group
}

/**
 * The rest of the nursery: potted growth standing on the far benches and a
 * couple of larger plants on the floor behind them. They never move and never
 * take focus; they exist so the branch is not arching through an empty room.
 */
function makeBackdropFoliage(q: QualitySettings, seed: number): Group {
  const g = new Group()
  const rng = new Rng(seed ^ 0x5ee1)
  const material = new MeshStandardMaterial({
    color: new Color(0.085, 0.135, 0.055),
    roughness: 0.8,
    metalness: 0,
    side: DoubleSide,
  })
  const dense = q.tier === 'low' ? 0.45 : 1
  // On the two far benches.
  for (const [bx, bz] of [
    [-1.62, -1.1],
    [-1.02, -1.15],
    [1.12, -1.25],
    [1.78, -1.2],
  ] as const) {
    const m = makeClump(rng, material, Math.round(46 * dense), 0.22, 0.4, [0.6, 1.05])
    if (!m) continue
    m.position.set(bx + rng.jitter(0.1), 0.335, bz + rng.jitter(0.08))
    g.add(m)
  }
  // A low run of growth along the back of the house, kept small enough that
  // it never competes with the branch for attention.
  // Kept off the centre line so nothing stands directly behind the net.
  for (const bx of [-3.1, -2.0, 2.0, 3.1]) {
    const m = makeClump(rng, material, Math.round(46 * dense), 0.3, 0.55, [0.7, 1.15])
    if (!m) continue
    m.position.set(bx + rng.jitter(0.25), 0.0, rng.range(-4.6, -3.4))
    g.add(m)
  }
  return g
}

function makeBench(
  material: MeshPhysicalMaterial,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  top: number,
): Group {
  const g = new Group()
  const w = x1 - x0
  const d = z1 - z0
  const slats = 5
  const slatD = (d / slats) * 0.82
  for (let i = 0; i < slats; i++) {
    const slat = new Mesh(new BoxGeometry(w, 0.022, slatD), material)
    slat.position.set((x0 + x1) / 2, top - 0.011, z0 + ((i + 0.5) * d) / slats)
    slat.castShadow = true
    slat.receiveShadow = true
    g.add(slat)
  }
  for (const lx of [x0 + 0.07, x1 - 0.07]) {
    for (const lz of [z0 + 0.06, z1 - 0.06]) {
      const leg = new Mesh(new BoxGeometry(0.04, top, 0.04), material)
      leg.position.set(lx, top / 2, lz)
      leg.castShadow = true
      leg.receiveShadow = true
      g.add(leg)
    }
  }
  return g
}
