import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'
import { FLUME, PLAY, waterY } from '../config'
import { innerRadius } from '../world/Flume'
import { makeRng } from '../gfx/noise'

const NODES = 10
const LINK = 0.0235
const RINGS = 18
const RADIAL = 4
const COLS = RADIAL + 1
const MAX_STRANDS = 14
const RADIUS = 0.00082
/** Which node the chopsticks take hold of — off centre, so it drapes. */
const GRAB_NODE = 4

export type BundleState = 'off' | 'flowing' | 'held' | 'dropping' | 'soaking'

export interface Pattern {
  name: string
  strands: number
  speedScale: number
  /** Lateral bias as a fraction of the free surface half-width. */
  lane: number
  laneSwing: number
  spread: number
  /** Length scale of the strands, so a fat bundle also reads as heavier. */
  sag: number
}

export const PATTERNS: Pattern[] = [
  { name: 'single', strands: 1, speedScale: 1.0, lane: 0, laneSwing: 0.25, spread: 0.004, sag: 1 },
  { name: 'small', strands: 4, speedScale: 0.96, lane: -0.15, laneSwing: 0.3, spread: 0.010, sag: 1 },
  { name: 'fat', strands: 12, speedScale: 0.80, lane: 0.05, laneSwing: 0.15, spread: 0.017, sag: 1.15 },
  { name: 'fast-centre', strands: 7, speedScale: 1.30, lane: 0, laneSwing: 0.05, spread: 0.009, sag: 0.95 },
  { name: 'wall-hug', strands: 6, speedScale: 0.88, lane: 0.62, laneSwing: 0.5, spread: 0.012, sag: 1 },
  { name: 'pair', strands: 2, speedScale: 1.08, lane: -0.45, laneSwing: 0.35, spread: 0.006, sag: 1 },
]

const vert = /* glsl */ `
  attribute float aStrand;
  attribute float aT;
  varying vec3 vN;
  varying vec3 vW;
  varying float vStrand;
  varying float vT;
  #include <fog_pars_vertex>
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vW = world.xyz;
    vStrand = aStrand;
    vT = aT;
    vec4 mvPosition = viewMatrix * world;
    #include <fog_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vW;
  varying float vStrand;
  varying float vT;

  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSky;
  uniform vec3 uGround;
  uniform vec3 uColor;
  uniform float uWet;
  uniform float uFade;
  uniform float uShade;

  #include <fog_pars_fragment>

  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vW);

    float ndl = dot(N, uSunDir);
    // Wrapped diffuse: a translucent noodle never goes fully dark.
    float wrap = clamp((ndl + 0.62) / 1.62, 0.0, 1.0);

    float jitter = fract(sin(vStrand * 91.7) * 4137.13);
    vec3 albedo = uColor * (0.90 + 0.18 * jitter);
    // The cut ends are a touch more translucent.
    float thin = 0.55 + 0.45 * (1.0 - abs(vT * 2.0 - 1.0));

    vec3 sun = uSunColor * wrap * uShade;
    float back = pow(clamp(dot(V, -uSunDir) * 0.5 + 0.5, 0.0, 1.0), 3.0);
    vec3 sss = uSunColor * back * thin * 0.55 * uShade;
    vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);

    vec3 H = normalize(V + uSunDir);
    float spec = pow(max(dot(N, H), 0.0), 150.0) * (0.25 + uWet * 1.9);

    vec3 col = albedo * (sun + amb + sss) + uSunColor * spec * uShade;
    gl_FragColor = vec4(col, uFade);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function buildGeometry(): BufferGeometry {
  const verts = MAX_STRANDS * RINGS * COLS
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(verts * 3), 3))
  const aStrand = new Float32Array(verts)
  const aT = new Float32Array(verts)
  let k = 0
  for (let s = 0; s < MAX_STRANDS; s++) {
    for (let r = 0; r < RINGS; r++) {
      for (let c = 0; c < COLS; c++) {
        aStrand[k] = s + 1
        aT[k] = r / (RINGS - 1)
        k++
      }
    }
  }
  geo.setAttribute('aStrand', new BufferAttribute(aStrand, 1))
  geo.setAttribute('aT', new BufferAttribute(aT, 1))

  const idx: number[] = []
  for (let s = 0; s < MAX_STRANDS; s++) {
    const sb = s * RINGS * COLS
    for (let r = 0; r < RINGS - 1; r++) {
      for (let c = 0; c < RADIAL; c++) {
        const a = sb + r * COLS + c
        const b = a + 1
        const d = a + COLS
        const e = d + 1
        idx.push(a, d, b, b, d, e)
      }
    }
  }
  geo.setIndex(idx)
  geo.boundingSphere = null
  return geo
}

const INDICES_PER_STRAND = (RINGS - 1) * RADIAL * 6

const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpT = new Vector3()
const tmpN = new Vector3()
const tmpBi = new Vector3()
const ringPts: Vector3[] = []
for (let i = 0; i < RINGS; i++) ringPts.push(new Vector3())

export class Bundle {
  readonly mesh: Mesh
  readonly material: ShaderMaterial
  state: BundleState = 'off'
  pattern: Pattern = PATTERNS[0]
  strandCount = 1
  bornAt = 0
  stateAt = 0
  wet = 1
  /** Set once the player has taken it — used to stop double captures. */
  captured = false

  private pos = new Float32Array(MAX_STRANDS * NODES * 3)
  private vel = new Float32Array(MAX_STRANDS * NODES * 3)
  private pin = new Float32Array(MAX_STRANDS * 3)
  private laneBase = 0
  private laneSwing = 0
  private lanePhase = 0
  private speed = 1
  private rng = makeRng(1)
  private fade = 1

  constructor(seed: number) {
    this.rng = makeRng(seed * 7919 + 13)
    this.material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: DoubleSide,
      transparent: false,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color(1, 1, 1) },
          uSky: { value: new Color(0.35, 0.42, 0.52) },
          uGround: { value: new Color(0.16, 0.15, 0.11) },
          uColor: { value: new Color(0.95, 0.945, 0.90) },
          uWet: { value: 1 },
          uFade: { value: 1 },
          uShade: { value: 1 },
        },
      ]),
    })
    this.mesh = new Mesh(buildGeometry(), this.material)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.castShadow = true
  }

  /** Copy shared lighting uniforms in from the scene setup. */
  applyLighting(sunDir: Vector3, sunColor: Color, sky: Color, ground: Color): void {
    ;(this.material.uniforms.uSunDir.value as Vector3).copy(sunDir)
    ;(this.material.uniforms.uSunColor.value as Color).copy(sunColor)
    ;(this.material.uniforms.uSky.value as Color).copy(sky)
    ;(this.material.uniforms.uGround.value as Color).copy(ground)
  }

  spawn(pattern: Pattern, time: number, zStart: number): void {
    this.pattern = pattern
    this.strandCount = Math.min(MAX_STRANDS, pattern.strands)
    this.speed = pattern.speedScale
    this.laneBase = pattern.lane
    this.laneSwing = pattern.laneSwing
    this.lanePhase = this.rng() * 6.283
    this.state = 'flowing'
    this.bornAt = time
    this.stateAt = time
    this.captured = false
    this.wet = 1
    this.fade = 1
    this.material.uniforms.uFade.value = 1
    this.material.transparent = false
    this.mesh.visible = true

    const rng = this.rng
    for (let s = 0; s < this.strandCount; s++) {
      const ox = (rng() - 0.5) * pattern.spread * 2
      const oz = (rng() - 0.5) * pattern.spread * 3.2
      const oy = rng() * 0.004
      const wig = rng() * 6.283
      for (let j = 0; j < NODES; j++) {
        const z = zStart + oz + j * LINK * pattern.sag
        const i = (s * NODES + j) * 3
        this.pos[i] = FLUME.xAt(z) + ox + Math.sin(j * 0.9 + wig) * pattern.spread * 0.6
        this.pos[i + 1] = waterY(z) - 0.0022 + oy
        this.pos[i + 2] = z
        this.vel[i] = 0
        this.vel[i + 1] = 0
        this.vel[i + 2] = 1.0
      }
    }
  }

  laneX(z: number, halfWidth: number): number {
    const swing = Math.sin(z * 0.55 + this.lanePhase) * this.laneSwing
    return FLUME.xAt(z) + (this.laneBase + swing) * halfWidth * 0.72
  }

  /** Centroid of the strands around the natural grab point. */
  grabPoint(out: Vector3): Vector3 {
    out.set(0, 0, 0)
    let n = 0
    for (let s = 0; s < this.strandCount; s++) {
      for (const j of [GRAB_NODE - 1, GRAB_NODE, GRAB_NODE + 1]) {
        const i = (s * NODES + j) * 3
        out.x += this.pos[i]
        out.y += this.pos[i + 1]
        out.z += this.pos[i + 2]
        n++
      }
    }
    return out.multiplyScalar(1 / n)
  }

  /** Squared distance from a point to the nearest strand node. */
  nearestNodeDist(p: Vector3): number {
    let best = Infinity
    for (let s = 0; s < this.strandCount; s++) {
      for (let j = 1; j < NODES; j += 2) {
        const i = (s * NODES + j) * 3
        const dx = this.pos[i] - p.x
        const dy = this.pos[i + 1] - p.y
        const dz = this.pos[i + 2] - p.z
        const d = dx * dx + dy * dy + dz * dz
        if (d < best) best = d
      }
    }
    return Math.sqrt(best)
  }

  /** Mean z of the bundle, for despawn and camera tracking. */
  centre(out: Vector3): Vector3 {
    out.set(0, 0, 0)
    const n = this.strandCount * NODES
    for (let s = 0; s < this.strandCount; s++) {
      for (let j = 0; j < NODES; j++) {
        const i = (s * NODES + j) * 3
        out.x += this.pos[i]
        out.y += this.pos[i + 1]
        out.z += this.pos[i + 2]
      }
    }
    return out.multiplyScalar(1 / n)
  }

  /** Lowest node, where drips come from. */
  lowestNode(out: Vector3): Vector3 {
    let best = Infinity
    out.set(0, 0, 0)
    for (let s = 0; s < this.strandCount; s++) {
      for (let j = 0; j < NODES; j++) {
        const i = (s * NODES + j) * 3
        if (this.pos[i + 1] < best) {
          best = this.pos[i + 1]
          out.set(this.pos[i], this.pos[i + 1], this.pos[i + 2])
        }
      }
    }
    return out
  }

  grab(tip: Vector3, time: number): void {
    this.state = 'held'
    this.stateAt = time
    this.captured = true
    for (let s = 0; s < this.strandCount; s++) {
      const i = (s * NODES + GRAB_NODE) * 3
      this.pin[s * 3] = this.pos[i] - tip.x
      this.pin[s * 3 + 1] = this.pos[i + 1] - tip.y
      this.pin[s * 3 + 2] = this.pos[i + 2] - tip.z
      // Shrink the offsets so the strands gather into the chopsticks.
      this.pin[s * 3] *= 0.35
      this.pin[s * 3 + 1] *= 0.2
      this.pin[s * 3 + 2] *= 0.35
    }
  }

  release(time: number): void {
    this.state = 'dropping'
    this.stateAt = time
  }

  soak(time: number): void {
    this.state = 'soaking'
    this.stateAt = time
  }

  kill(): void {
    this.state = 'off'
    this.mesh.visible = false
  }

  update(dt: number, time: number, flow: number, tip: Vector3, bowl: Vector3, bowlR: number): void {
    if (this.state === 'off') return

    if (this.state === 'held') {
      const k = 1 - Math.exp(-dt * 30)
      for (let s = 0; s < this.strandCount; s++) {
        const i = (s * NODES + GRAB_NODE) * 3
        this.pos[i] += (tip.x + this.pin[s * 3] - this.pos[i]) * k
        this.pos[i + 1] += (tip.y + this.pin[s * 3 + 1] - this.pos[i + 1]) * k
        this.pos[i + 2] += (tip.z + this.pin[s * 3 + 2] - this.pos[i + 2]) * k
        this.vel[i] = this.vel[i + 1] = this.vel[i + 2] = 0
      }
    }

    for (let s = 0; s < this.strandCount; s++) {
      for (let j = 0; j < NODES; j++) {
        if (this.state === 'held' && j === GRAB_NODE) continue
        const i = (s * NODES + j) * 3
        const x = this.pos[i]
        const y = this.pos[i + 1]
        const z = this.pos[i + 2]

        let inLiquid = 0
        let targetY = 0
        let targetX = x
        let flowZ = 0

        if (z > FLUME.zStart && z < PLAY.despawnZ + 1.6) {
          const wy = waterY(z)
          const half = Math.sqrt(
            Math.max(1e-6, innerRadius(z) ** 2 - (innerRadius(z) - FLUME.waterDepth) ** 2),
          )
          const sub = Math.max(0, Math.min(1, (wy + 0.004 - y) / 0.012))
          if (sub > 0) {
            inLiquid = sub
            targetY = wy - 0.0024
            targetX = this.laneX(z, half)
            flowZ = flow * this.speed
          }
        }
        // The tsuyu bowl catches it at the end.
        const dxB = x - bowl.x
        const dzB = z - bowl.z
        if (dxB * dxB + dzB * dzB < bowlR * bowlR && y < bowl.y + 0.006) {
          inLiquid = Math.max(inLiquid, Math.min(1, (bowl.y + 0.006 - y) / 0.012))
          targetY = bowl.y - 0.004
          targetX = bowl.x + (x - bowl.x) * 0.96
          flowZ = 0
        }

        let vx = this.vel[i]
        let vy = this.vel[i + 1]
        let vz = this.vel[i + 2]

        if (inLiquid > 0) {
          const k = 1 - Math.exp(-dt * 13 * inLiquid)
          const dx = (targetX - x) * 3.4
          const dy = (targetY - y) * 7.0
          vx += (dx - vx) * k
          vy += (dy - vy) * k
          vz += (flowZ - vz) * k
          // a little turbulence so nothing looks rigid
          const t2 = time * 3.1 + s * 1.7 + j * 0.6
          vx += Math.sin(t2) * 0.010 * inLiquid * dt * 30
          vy += Math.sin(t2 * 1.37 + 2.1) * 0.006 * inLiquid * dt * 30
        } else {
          vy -= 9.81 * dt
          const air = Math.exp(-dt * 0.9)
          vx *= air
          vy *= air
          vz *= air
        }

        this.vel[i] = vx
        this.vel[i + 1] = vy
        this.vel[i + 2] = vz
        this.pos[i] = x + vx * dt
        this.pos[i + 1] = y + vy * dt
        this.pos[i + 2] = z + vz * dt
      }
    }

    // --- constraints -------------------------------------------------------
    const iterations = this.state === 'held' ? 3 : 2
    for (let it = 0; it < iterations; it++) {
      for (let s = 0; s < this.strandCount; s++) {
        for (let j = 0; j < NODES - 1; j++) {
          const a = (s * NODES + j) * 3
          const b = a + 3
          const dx = this.pos[b] - this.pos[a]
          const dy = this.pos[b + 1] - this.pos[a + 1]
          const dz = this.pos[b + 2] - this.pos[a + 2]
          const d = Math.hypot(dx, dy, dz) || 1e-6
          const corr = (d - LINK * this.pattern.sag) / d
          const pinnedA = this.state === 'held' && j === GRAB_NODE
          const pinnedB = this.state === 'held' && j + 1 === GRAB_NODE
          const wa = pinnedA ? 0 : pinnedB ? 1 : 0.5
          const wb = pinnedB ? 0 : pinnedA ? 1 : 0.5
          this.pos[a] += dx * corr * wa
          this.pos[a + 1] += dy * corr * wa
          this.pos[a + 2] += dz * corr * wa
          this.pos[b] -= dx * corr * wb
          this.pos[b + 1] -= dy * corr * wb
          this.pos[b + 2] -= dz * corr * wb
        }
      }
      if (this.state === 'flowing') this.clampToTrough()
    }
    if (this.state !== 'flowing') this.clampToTrough()

    // --- surface wetness dries off once it is out of the water --------------
    let above = 0
    for (let s = 0; s < this.strandCount; s++) {
      const i = (s * NODES + GRAB_NODE) * 3
      if (this.pos[i + 1] > waterY(this.pos[i + 2]) + 0.02) above++
    }
    if (above > this.strandCount * 0.5) this.wet = Math.max(0.25, this.wet - dt * 0.22)
    this.material.uniforms.uWet.value = this.wet

    if (this.state === 'soaking') {
      const age = time - this.stateAt
      if (age > 0.7) {
        this.fade = Math.max(0, 1 - (age - 0.7) / 0.8)
        this.material.transparent = true
        this.material.uniforms.uFade.value = this.fade
        if (this.fade <= 0.001) this.kill()
      }
    }
  }

  private clampToTrough(): void {
    for (let s = 0; s < this.strandCount; s++) {
      for (let j = 0; j < NODES; j++) {
        const i = (s * NODES + j) * 3
        const z = this.pos[i + 2]
        if (z < FLUME.zStart || z > FLUME.zEnd) continue
        const cx = FLUME.xAt(z)
        const cy = FLUME.yAt(z) + FLUME.rInner
        const dx = this.pos[i] - cx
        const dy = this.pos[i + 1] - cy
        const r = Math.hypot(dx, dy)
        const rmax = innerRadius(z) - RADIUS - 0.0008
        if (r > rmax && dy < 0.001) {
          const f = rmax / r
          this.pos[i] = cx + dx * f
          this.pos[i + 1] = cy + dy * f
          this.vel[i] *= 0.4
          this.vel[i + 1] *= 0.4
        }
      }
    }
  }

  /** Rewrite the tube geometry from the current node positions. */
  rebuild(): void {
    const geo = this.mesh.geometry as BufferGeometry
    const pAttr = geo.getAttribute('position') as BufferAttribute
    const nAttr = geo.getAttribute('normal') as BufferAttribute
    const P = pAttr.array as Float32Array
    const N = nAttr.array as Float32Array

    for (let s = 0; s < this.strandCount; s++) {
      const base = s * NODES * 3
      // Catmull-Rom resample.
      for (let r = 0; r < RINGS; r++) {
        const u = (r / (RINGS - 1)) * (NODES - 1)
        const j = Math.min(NODES - 2, Math.floor(u))
        const t = u - j
        const i0 = base + Math.max(0, j - 1) * 3
        const i1 = base + j * 3
        const i2 = base + (j + 1) * 3
        const i3 = base + Math.min(NODES - 1, j + 2) * 3
        const t2 = t * t
        const t3 = t2 * t
        const c0 = -0.5 * t3 + t2 - 0.5 * t
        const c1 = 1.5 * t3 - 2.5 * t2 + 1
        const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t
        const c3 = 0.5 * t3 - 0.5 * t2
        ringPts[r].set(
          this.pos[i0] * c0 + this.pos[i1] * c1 + this.pos[i2] * c2 + this.pos[i3] * c3,
          this.pos[i0 + 1] * c0 + this.pos[i1 + 1] * c1 + this.pos[i2 + 1] * c2 + this.pos[i3 + 1] * c3,
          this.pos[i0 + 2] * c0 + this.pos[i1 + 2] * c1 + this.pos[i2 + 2] * c2 + this.pos[i3 + 2] * c3,
        )
      }

      // Parallel-transported frame.
      tmpT.subVectors(ringPts[1], ringPts[0])
      if (tmpT.lengthSq() < 1e-12) tmpT.set(0, 0, 1)
      tmpT.normalize()
      tmpN.set(0, 1, 0)
      if (Math.abs(tmpN.dot(tmpT)) > 0.9) tmpN.set(1, 0, 0)
      tmpN.addScaledVector(tmpT, -tmpN.dot(tmpT)).normalize()

      for (let r = 0; r < RINGS; r++) {
        const a = ringPts[Math.max(0, r - 1)]
        const b = ringPts[Math.min(RINGS - 1, r + 1)]
        tmpA.subVectors(b, a)
        if (tmpA.lengthSq() < 1e-12) tmpA.copy(tmpT)
        tmpA.normalize()
        // transport
        tmpN.addScaledVector(tmpA, -tmpN.dot(tmpA))
        if (tmpN.lengthSq() < 1e-10) {
          tmpN.set(0, 1, 0).addScaledVector(tmpA, -tmpA.y)
        }
        tmpN.normalize()
        tmpBi.crossVectors(tmpA, tmpN)
        const tt = r / (RINGS - 1)
        const rad = RADIUS * Math.sqrt(0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, Math.max(0, tt))))
        const vBase = (s * RINGS + r) * COLS
        const c = ringPts[r]
        for (let k = 0; k < COLS; k++) {
          const ang = (k / RADIAL) * Math.PI * 2
          const cs = Math.cos(ang)
          const sn = Math.sin(ang)
          tmpB.set(
            tmpN.x * cs + tmpBi.x * sn,
            tmpN.y * cs + tmpBi.y * sn,
            tmpN.z * cs + tmpBi.z * sn,
          )
          const o = (vBase + k) * 3
          P[o] = c.x + tmpB.x * rad
          P[o + 1] = c.y + tmpB.y * rad
          P[o + 2] = c.z + tmpB.z * rad
          N[o] = tmpB.x
          N[o + 1] = tmpB.y
          N[o + 2] = tmpB.z
        }
      }
    }

    geo.setDrawRange(0, this.strandCount * INDICES_PER_STRAND)
    pAttr.needsUpdate = true
    nAttr.needsUpdate = true
  }
}

export class NoodlePool {
  readonly group = new Group()
  readonly bundles: Bundle[] = []

  constructor(size = 5) {
    for (let i = 0; i < size; i++) {
      const b = new Bundle(i + 1)
      this.bundles.push(b)
      this.group.add(b.mesh)
    }
  }

  free(): Bundle | null {
    for (const b of this.bundles) if (b.state === 'off') return b
    return null
  }

  get active(): Bundle[] {
    return this.bundles.filter((b) => b.state !== 'off')
  }
}

export { NODES, GRAB_NODE, RADIUS as NOODLE_RADIUS }
