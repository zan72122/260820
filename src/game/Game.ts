import * as THREE from 'three'
import { buildSky, type SkyRig } from '../world/Sky'
import { Water } from '../world/Water'
import { Field } from '../world/Field'
import { Plot, type PlotSpec } from '../world/Plot'
import { buildLotusGeometry, makeLotusMaterial, type LotusSpec, type LotusBuild, PROFILE_SIZE } from '../world/Lotus'
import { Hose } from '../world/Hose'
import { Turbidity } from '../world/Turbidity'
import { Worker } from '../world/Worker'
import { Boat } from '../world/Boat'
import { Bubbles } from './Bubbles'
import { CameraDirector, type ShotRequest } from './CameraDirector'
import { Cutaway } from './Cutaway'
import type { Input } from '../core/Input'
import type { Settings } from '../core/Settings'
import type { Quality } from '../core/Quality'
import type { GameAudio } from '../audio/Audio'

export const WATER_Y = 0
export const BED_Y = -0.5
/** the jet lands this far above the finger so the hand never covers the find */
const FINGER_OFFSET_PX = 66
/** the nozzle is held at waist height; the stream arcs down into the water */
const HAND_Y = 0.72
/** a lifted root is carried just clear of the surface so it can be sluiced */
const CARRY_Y = 0.34

const MURK = new THREE.Color(0x5d5747)

type Phase = 'intro' | 'idle' | 'probe' | 'dig' | 'lift' | 'hold' | 'stored'

type Archetype = {
  nodes: number
  curve: number
  depth: number
  radius: number
  branch: boolean
  dirt: number
  hardness: number
  maxDepth: number
}

const ARCHETYPES: Archetype[] = [
  // the teaching one: shallow, soft, four clear joints
  { nodes: 4, curve: 0.16, depth: 0.075, radius: 0.055, branch: false, dirt: 0.7, hardness: 0.8, maxDepth: 0.3 },
  // long and strongly curved
  { nodes: 6, curve: 0.34, depth: 0.115, radius: 0.049, branch: false, dirt: 0.9, hardness: 1.1, maxDepth: 0.34 },
  // short and very fat, caked in clay
  { nodes: 3, curve: -0.1, depth: 0.06, radius: 0.066, branch: false, dirt: 1.0, hardness: 0.75, maxDepth: 0.28 },
  // the long one with a side shoot, deep and stiff clay
  { nodes: 7, curve: -0.24, depth: 0.14, radius: 0.050, branch: true, dirt: 0.85, hardness: 1.3, maxDepth: 0.37 },
  // an S-curve
  { nodes: 5, curve: 0.42, depth: 0.1, radius: 0.057, branch: false, dirt: 0.8, hardness: 0.95, maxDepth: 0.32 },
]

/** kept at least one plot-width apart so no two dug patches overlap */
const PLOT_SIZE = 2.0
const PLOT_POS: [number, number][] = [
  [0, 0],
  [2.35, 0.9],
  [-1.9, 1.6],
  [0.6, 3.0],
  [3.6, 3.2],
]

type ActivePlot = {
  index: number
  plot: Plot
  build: LotusBuild
  mesh: THREE.Mesh
  mat: ReturnType<typeof makeLotusMaterial>
  spec: LotusSpec
  exposure: Float32Array
  dirt: Float32Array
  wet: Float32Array
  clean: Float32Array
  discovered: boolean[]
  grabS: number
  liftT: number
  rise: number
  stored: boolean
  holdOffset: THREE.Vector3
  /** azimuth the camera watches this plot from; keeps staging deterministic */
  viewAz: number
}

export class Game {
  scene = new THREE.Scene()
  renderer: THREE.WebGLRenderer
  director: CameraDirector
  sky: SkyRig
  water: Water
  field: Field
  worker: Worker
  boat: Boat
  hose: Hose
  turbidity: Turbidity
  bubbles: Bubbles
  cutaway: Cutaway

  phase: Phase = 'intro'
  time = 0
  private plotTimer = 0
  private phaseTimer = 0
  private interacted = false
  private plots: ActivePlot[] = []
  private cur!: ActivePlot
  private nextPrepared: ActivePlot | null = null
  private plotIndex = 0
  harvested = 0
  canReplay = false
  replaying = false

  private width = 1
  private height = 1
  private ray = new THREE.Raycaster()
  private grip = new THREE.Vector3()
  /** where the free hand carries the lifted root; only used once it is out */
  private holdPoint = new THREE.Vector3()
  private impact = new THREE.Vector3()
  private prevImpact = new THREE.Vector3()
  private jetOn = false
  private mode: 'none' | 'spray' | 'grab' = 'none'
  private rippleAcc = 0
  private gaze = new THREE.Vector3()
  private hintTilt = 0
  private trailAcc = 0
  private tugAcc = 0
  private lastLotusGeometry: THREE.BufferGeometry | null = null
  private storeAnim = 0
  private storeFrom = new THREE.Vector3()
  private mudAudio = 0
  private onLotusAudio = 0
  private ndc = new THREE.Vector2()
  private v3 = new THREE.Vector3()

  constructor(
    canvas: HTMLCanvasElement,
    private input: Input,
    private settings: Settings,
    private quality: Quality,
    private audio: GameAudio,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.14
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.localClippingEnabled = true
    this.renderer.autoClear = true

    this.sky = buildSky(this.scene, this.renderer)
    this.director = new CameraDirector(1)
    this.water = new Water(this.sky.sunDir, this.scene.fog as THREE.FogExp2)
    this.scene.add(this.water.group)
    this.field = new Field(BED_Y, MURK)
    this.scene.add(this.field.group)
    this.worker = new Worker(BED_Y, MURK)
    this.scene.add(this.worker.group)
    this.boat = new Boat(MURK)
    this.scene.add(this.boat.group)
    this.hose = new Hose(this.field.pumpPos.clone().setY(0.34), MURK)
    this.scene.add(this.hose.group)
    this.turbidity = new Turbidity(220)
    this.scene.add(this.turbidity.points)
    this.bubbles = new Bubbles()
    this.scene.add(this.bubbles.points)
    this.cutaway = new Cutaway(this.sky.envTexture)

    this.cur = this.makePlot(0)
    this.scene.add(this.cur.plot.group, this.cur.mesh)
    this.worker.stance.set(this.cur.plot.spec.center.x + 0.5, BED_Y, this.cur.plot.spec.center.z + 0.8)
    this.boat.group.position.set(this.cur.plot.spec.center.x + 1.45, 0, this.cur.plot.spec.center.z + 0.55)
    this.water.setCenter(this.cur.plot.spec.center.x, this.cur.plot.spec.center.z)
    this.grip.set(this.cur.plot.spec.center.x, 0.12, this.cur.plot.spec.center.z + 0.4)
    this.impact.copy(this.grip).setY(0)
    this.prevImpact.copy(this.impact)

    this.applyQuality()
    this.quality.onChange(() => this.applyQuality())
    this.settings.onChange((d) => {
      this.water.setCalm(d.calmVisuals)
      this.turbidity.setCalm(d.calmVisuals)
      this.audio.setVolume(d.volume)
      this.applyQuality()
    })
    this.water.setCalm(this.settings.data.calmVisuals)
    this.turbidity.setCalm(this.settings.data.calmVisuals)
  }

  private applyQuality() {
    const q = this.quality.state
    const calm = this.settings.data.calmVisuals
    this.renderer.shadowMap.enabled = q.shadows
    this.sky.sun.castShadow = q.shadows
    if (this.sky.sun.shadow.mapSize.width !== q.shadowSize) {
      this.sky.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize)
      this.sky.sun.shadow.map?.dispose()
      this.sky.sun.shadow.map = null
    }
    this.field.setDensity(q.leafDensity)
    this.water.setDetail(q.waveDetail)
    this.turbidity.setBudget(calm ? Math.round(q.turbidityBudget * 0.45) : q.turbidityBudget)
    this.hose.setSprayScale(calm ? 0.6 : 1)
    this.resize(this.width, this.height, true)
  }

  // ---------------------------------------------------------------- plots

  private makePlot(index: number): ActivePlot {
    const a = ARCHETYPES[index % ARCHETYPES.length]
    const base = PLOT_POS[index % PLOT_POS.length]
    const cycle = Math.floor(index / PLOT_POS.length)
    const seed = 1000 + index * 977
    const center = new THREE.Vector3(base[0] + cycle * 0.55, BED_Y, base[1] - cycle * 0.45)
    const heading = ((seed % 61) / 61) * Math.PI * 2
    const lotus: LotusSpec = {
      nodes: a.nodes,
      // start the chain half its length back so it stays inside the plot
      origin: new THREE.Vector3(
        center.x - Math.cos(heading) * a.nodes * 0.068,
        BED_Y,
        center.z - Math.sin(heading) * a.nodes * 0.068,
      ),
      heading,
      curve: a.curve * (cycle % 2 === 0 ? 1 : -1),
      depth: a.depth,
      radius: a.radius,
      branch: a.branch,
      dirt: a.dirt,
      seed,
    }
    const spec: PlotSpec = {
      center,
      size: PLOT_SIZE,
      hardness: a.hardness,
      maxDepth: a.maxDepth,
      petioles: 8,
      seed,
      lotus,
    }
    const plot = new Plot(spec, MURK, (p) => this.onClodBreak(p))
    const build = buildLotusGeometry(lotus)
    const mat = makeLotusMaterial(MURK)
    mat.uniforms.uSeed.value = (seed % 50) * 0.7
    mat.uniforms.uNodes.value = a.nodes
    const mesh = new THREE.Mesh(build.geometry, mat.material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const P = PROFILE_SIZE
    const ap: ActivePlot = {
      index,
      plot,
      build,
      mesh,
      mat,
      spec: lotus,
      exposure: new Float32Array(P),
      dirt: new Float32Array(P).fill(1),
      wet: new Float32Array(P),
      clean: new Float32Array(P),
      discovered: new Array(a.nodes).fill(false),
      grabS: 0.5,
      liftT: 0,
      rise: 0,
      stored: false,
      holdOffset: new THREE.Vector3(),
      viewAz: heading + Math.PI * 0.5,
    }
    for (let i = 0; i < P; i++) ap.dirt[i] = 0.55 + 0.45 * lotus.dirt
    this.plots.push(ap)
    this.refreshHoles()
    return ap
  }

  /** the paddy floor is cut open under every live plot so craters can be seen */
  private refreshHoles() {
    this.field.setHoles(
      this.plots.map((p) => ({
        x: p.plot.spec.center.x,
        z: p.plot.spec.center.z,
        half: p.plot.spec.size * 0.5 - 0.05,
      })),
    )
  }

  private prepareNext() {
    if (this.nextPrepared) return
    this.nextPrepared = this.makePlot(this.plotIndex + 1)
  }

  private activateNext() {
    this.prepareNext()
    const next = this.nextPrepared!
    this.nextPrepared = null
    this.plotIndex++
    this.cur = next
    this.scene.add(next.plot.group, next.mesh)
    this.water.setCenter(next.plot.spec.center.x, next.plot.spec.center.z)
    this.bubbles.setOrigin(next.plot.petioles[0].base)
    this.bubbles.start()
    this.audio.bubbles()
    this.phase = 'idle'
    this.plotTimer = 0
    this.phaseTimer = 0
    this.interacted = false
    this.hintTilt = 0
    this.firstRevealAt = -99
    this.firstRevealPos = null
    // keep only a couple of dug plots alive
    if (this.plots.length > 4) {
      const old = this.plots.shift()!
      if (old !== this.cur) {
        this.scene.remove(old.plot.group)
        this.scene.remove(old.mesh)
        old.plot.dispose()
      } else {
        this.plots.unshift(old)
      }
      this.refreshHoles()
    }
  }

  private onClodBreak(p: THREE.Vector3) {
    this.audio.clod()
    this.turbidity.spawn(p, 10, 0.14, 0.22)
    this.water.addRipple(p.x, p.z, 0.5)
  }

  // ---------------------------------------------------------------- input

  private rayToY(cssX: number, cssY: number, y: number, out: THREE.Vector3) {
    this.ndc.set((cssX / this.width) * 2 - 1, -(cssY / this.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.director.camera)
    const o = this.ray.ray.origin
    const d = this.ray.ray.direction
    if (Math.abs(d.y) < 1e-5) return out.set(o.x, y, o.z)
    let t = (y - o.y) / d.y
    if (t < 0.05) t = 40
    t = Math.min(t, 40)
    return out.set(o.x + d.x * t, y, o.z + d.z * t)
  }

  private worldToScreen(p: THREE.Vector3) {
    this.v3.copy(p).project(this.director.camera)
    return {
      x: ((this.v3.x + 1) / 2) * this.width,
      y: ((1 - this.v3.y) / 2) * this.height,
      behind: this.v3.z > 1,
    }
  }

  private nearestExposedSample(x: number, y: number) {
    let best = -1
    let bestD = Infinity
    const step = Math.max(1, Math.floor(this.cur.build.samples.length / 48))
    for (let i = 0; i < this.cur.build.samples.length; i += step) {
      const s = this.cur.build.samples[i]
      const e = this.cur.exposure[Math.min(PROFILE_SIZE - 1, Math.round(s.s * (PROFILE_SIZE - 1)))]
      if (e < 0.35) continue
      const w = this.v3.copy(s.pos)
      w.y += this.cur.rise * this.cur.liftT
      const sc = this.worldToScreen(w)
      if (sc.behind) continue
      const d = Math.hypot(sc.x - x, sc.y - y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return { index: best, dist: bestD }
  }

  private get liftReady() {
    let n = 0
    for (let i = 0; i < PROFILE_SIZE; i++) if (this.cur.exposure[i] > 0.5) n++
    return n / PROFILE_SIZE > 0.58
  }

  // ---------------------------------------------------------------- loop

  resize(w: number, h: number, force = false) {
    if (!force && w === this.width && h === this.height) return
    this.width = w
    this.height = h
    const scale = this.quality.state.renderScale
    this.renderer.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * scale))
    this.renderer.setSize(w, h, false)
    this.director.setViewport(w, h)
  }

  update(dt: number) {
    this.time += dt
    this.input.update(dt)

    if (this.replaying) {
      this.cutaway.update(dt, this.width / this.height)
      this.input.endFrame()
      return
    }

    this.plotTimer += dt
    this.phaseTimer += dt

    const cur = this.cur
    const plot = cur.plot

    // ---- pointer -> hand and jet impact, with the impact placed above the finger
    const gripTarget = new THREE.Vector3()
    const impactTarget = new THREE.Vector3()
    const carrying = this.phase === 'lift' || this.phase === 'hold'
    if (this.input.down) {
      this.rayToY(this.input.x, this.input.y, carrying ? CARRY_Y : HAND_Y, gripTarget)
      // the jet lands above the finger so the hand never hides the discovery
      this.rayToY(this.input.x, Math.max(4, this.input.y - FINGER_OFFSET_PX), WATER_Y, impactTarget)
    } else {
      // resting pose: the hose hangs in front of the worker, aimed at the bed
      const toPlot = new THREE.Vector3().subVectors(plot.spec.center, this.worker.stance).setY(0)
      if (toPlot.lengthSq() < 1e-4) toPlot.set(0, 0, 1)
      toPlot.normalize()
      gripTarget.copy(this.worker.stance).addScaledVector(toPlot, 0.36).setY(HAND_Y * 0.85)
      impactTarget.copy(plot.spec.center).addScaledVector(toPlot, -0.25).setY(WATER_Y)
    }
    if (carrying) {
      // the hose is laid down in the water; both hands are on the rhizome
      this.holdPoint.lerp(gripTarget, 1 - Math.exp(-dt * 14))
      const away = this.camAz() + Math.PI
      const side = new THREE.Vector3(Math.cos(away), 0, Math.sin(away))
      gripTarget.copy(this.worker.stance).addScaledVector(side, 0.55).setY(0.03)
      impactTarget.copy(gripTarget).addScaledVector(side, 0.6).setY(WATER_Y)
    } else {
      this.holdPoint.copy(gripTarget)
    }

    // The jet lands where the finger says. If the throw would be too short the
    // hand is drawn back instead of moving the impact, so aiming stays exact.
    const jetVec = new THREE.Vector3().subVectors(impactTarget, gripTarget).setY(0)
    const jetLen = jetVec.length()
    if (!isFinite(jetLen) || jetLen < 0.001) jetVec.set(0, 0, 1)
    else jetVec.normalize()
    if (jetLen > 1.2) {
      impactTarget.set(gripTarget.x + jetVec.x * 1.2, WATER_Y, gripTarget.z + jetVec.z * 1.2)
    } else if (jetLen < 0.42) {
      gripTarget.set(impactTarget.x - jetVec.x * 0.42, gripTarget.y, impactTarget.z - jetVec.z * 0.42)
    }

    // never let the arm reach further than a person can
    const reach = new THREE.Vector3().subVectors(gripTarget, this.worker.stance)
    reach.y = 0
    if (reach.length() > 0.95) {
      reach.setLength(0.95)
      gripTarget.set(this.worker.stance.x + reach.x, gripTarget.y, this.worker.stance.z + reach.z)
    }

    const k = 1 - Math.exp(-dt * 22)
    this.grip.lerp(gripTarget, k)
    this.prevImpact.copy(this.impact)
    this.impact.lerp(impactTarget, this.input.down ? k : 1 - Math.exp(-dt * 3))

    if (this.input.justPressed) this.onPress()
    if (this.input.justReleased) this.onRelease()

    this.jetOn = this.input.down && this.mode === 'spray' && this.phase !== 'probe' && this.phase !== 'intro'

    // ---- water removal
    let work = 0
    const pressure = this.input.pressure
    if (this.jetOn) {
      const speedNorm = Math.min(1, this.input.speed / 800)
      // a slow hand cuts a fine channel, a fast sweep takes a wide bite
      const radius = 0.048 + 0.055 * speedNorm + 0.02 * pressure
      const rate = (1.35 + 1.0 * pressure) * dt
      const seg = this.prevImpact.distanceTo(this.impact)
      const steps = Math.min(8, Math.max(1, Math.ceil(seg / 0.03)))
      for (let i = 1; i <= steps; i++) {
        const f = i / steps
        const x = this.prevImpact.x + (this.impact.x - this.prevImpact.x) * f
        const z = this.prevImpact.z + (this.impact.z - this.prevImpact.z) * f
        work += plot.paint(x, z, radius, rate / steps, 1)
      }
      plot.hitClods(this.impact.x, this.impact.z, pressure, dt)

      this.water.setJet(this.impact.x, this.impact.z, 0.085 + 0.075 * pressure, 0.4 + 0.6 * pressure)
      this.rippleAcc += dt
      if (this.rippleAcc > 0.22) {
        this.rippleAcc = 0
        this.water.addRipple(this.impact.x, this.impact.z, 0.6 + 0.5 * pressure)
      }
      const silt = Math.min(6, work * 34 + pressure * 0.6)
      if (silt > 0.2) this.turbidity.spawn(this.impact.clone().setY(-0.06), silt, 0.1 + 0.06 * pressure, 0.15)
      this.mudAudio += (Math.min(1, plot.removalAt(this.impact.x, this.impact.z) * 1.6 + 0.35) - this.mudAudio) * Math.min(1, dt * 6)
    } else {
      this.water.setJet(this.impact.x, this.impact.z, 0.1, 0)
      this.mudAudio *= Math.exp(-dt * 3)
    }

    plot.update(dt)
    this.updateProfile(dt, cur, work)

    // ---- phases
    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer > 3.2 || this.input.justPressed) {
          this.phase = 'idle'
          this.phaseTimer = 0
          this.plotTimer = 0
        }
        break
      case 'idle':
        this.updateHints(dt)
        break
      case 'probe':
        this.updateProbe(dt)
        break
      case 'dig':
        if (cur.liftT > 0) this.phase = 'lift'
        break
      case 'lift':
        this.updateLift(dt)
        break
      case 'hold':
        this.updateHold(dt)
        break
      case 'stored':
        this.updateStored(dt)
        break
    }

    // ---- actors
    const workPoint = carrying ? this.holdPoint.clone().setY(0) : this.grip.clone().setY(0)
    // The worker stands almost directly beyond the work point, so the reaching
    // arm arrives from behind the find rather than across it.
    const wa = this.camAz() + 2.3
    const carryNow = this.phase === 'lift' || this.phase === 'hold'
    this.worker.moveToward(workPoint, dt, new THREE.Vector3(Math.cos(wa), 0, Math.sin(wa)), carryNow ? 3.4 : 4.2)
    const support = this.supportPoint()
    const gazeTarget = this.phase === 'idle' && this.plotTimer > 6 && !this.interacted ? this.gaze : null
    let handPos = this.grip
    let handAim = this.impact
    if (this.phase === 'lift' || this.phase === 'hold') {
      // the glove cradles the rhizome from underneath, never over the top of it
      const along = new THREE.Vector3().subVectors(this.holdPoint, this.worker.stance).setY(0)
      if (along.lengthSq() < 1e-5) along.set(0, 0, 1)
      along.normalize()
      handPos = this.holdPoint.clone().addScaledVector(along, -0.03)
      handPos.y -= 0.055
      handAim = this.holdPoint.clone().addScaledVector(along, 0.4)
    }
    // working posture: a constant slight bend over the water, a deep one while
    // feeling under a stalk
    const crouch =
      this.phase === 'probe'
        ? 0.25 +
          0.75 *
            THREE.MathUtils.clamp((this.phaseTimer - 0.1) / 0.5, 0, 1) *
            (1 - THREE.MathUtils.clamp((this.phaseTimer - 1.3) / 0.5, 0, 1))
        : 0.24
    this.worker.update(dt, { handPos, aim: handAim, support, gaze: gazeTarget, crouch })
    const workerOut = new THREE.Vector3().subVectors(this.worker.stance, plot.spec.center).setY(0)
    if (workerOut.lengthSq() < 1e-4) workerOut.set(1, 0, 0)
    workerOut.normalize()
    const behind = this.worker.stance.clone().addScaledVector(workerOut, 0.55).setY(-0.02)
    this.field.setPumpPosition(plot.spec.center.clone().addScaledVector(workerOut, 9).setY(0.02))
    this.hose.setAnchor(this.field.pumpPos.clone().setY(0.3))
    // the nozzle rides in the glove wherever the arm can actually hold it
    this.hose.update(dt, this.time, {
      grip: this.worker.hoseHand.position,
      impact: this.impact,
      pressure,
      active: this.jetOn,
      behind,
      camPos: this.director.camera.position,
      particleBudget: Math.round(this.quality.state.turbidityBudget * 0.3),
    })
    this.turbidity.update(dt)
    this.bubbles.update(dt, -BED_Y)
    this.water.update(dt, this.time)
    this.boat.update(dt, this.time)
    plot.animatePetioles(
      this.time,
      this.settings.data.calmVisuals ? 1 : 0,
      this.phase === 'idle' ? this.hintTilt : 0,
      this.gaze,
      this.boat.group.position,
    )

    // boat drifts along with the worker
    const ba = this.camAz() - 1.5
    const boatTarget = new THREE.Vector3(
      plot.spec.center.x + Math.cos(ba) * 2.0,
      this.boat.group.position.y,
      plot.spec.center.z + Math.sin(ba) * 2.0,
    )
    this.boat.group.position.lerp(boatTarget, 1 - Math.exp(-dt * 0.7))

    // sun follows the work area so shadows stay crisp in the small shadow box
    this.sky.sun.position.copy(this.sky.sunDir).multiplyScalar(18).add(plot.spec.center)
    this.sky.sun.target.position.copy(plot.spec.center)
    this.sky.sun.target.updateMatrixWorld()

    this.audio.update({
      jet: this.jetOn ? 1 : 0,
      pressure,
      mud: this.mudAudio,
      onLotus: this.onLotusAudio,
    })

    this.updateCamera(dt)
    this.input.endFrame()
  }

  // ---------------------------------------------------------------- hints

  private updateHints(dt: number) {
    if (this.interacted) {
      this.hintTilt *= Math.exp(-dt * 2)
      return
    }
    const first = this.plotIndex === 0
    const t = this.plotTimer
    const tiltAt = first ? 3 : 2
    this.hintTilt = Math.min(1, Math.max(0, (t - tiltAt) / 1.2)) * (first ? 1 : 0.7)
    // the tug disturbs the surface around the stalk: a real consequence, not a marker
    if (this.hintTilt > 0.4) {
      this.tugAcc += dt
      if (this.tugAcc > 1.1) {
        this.tugAcc = 0
        const b = this.cur.plot.petioles[0].base
        this.water.addRipple(b.x, b.z, 0.32)
      }
    }
    if (t > (first ? 9 : 6)) {
      // a short ripple trail from the petiole to the spot beside it
      this.trailAcc += dt
      if (this.trailAcc > 0.55) {
        this.trailAcc = 0
        const p = this.cur.plot.petioles[0].base
        const a = this.cur.spec.heading
        const f = (Math.sin(this.time * 0.6) * 0.5 + 0.5) * 0.34
        this.water.addRipple(p.x + Math.cos(a) * f + 0.1, p.z + Math.sin(a) * f, 0.45)
      }
    }
  }

  private updateProbe(dt: number) {
    void dt
    const t = this.phaseTimer
    const p = this.cur.plot.petioles[0].base
    if (t > 0.35 && t < 1.15) {
      // the glove works under the petiole: silt clouds, no answer given away
      if (Math.random() < 0.5) this.turbidity.spawn(new THREE.Vector3(p.x, -0.2, p.z), 2, 0.11, 0.12)
      this.cur.plot.paint(p.x, p.z, 0.11, dt * 0.16, 0.5)
    }
    if (t > 1.8) {
      this.phase = 'dig'
      this.phaseTimer = 0
    }
  }

  private supportPoint(): THREE.Vector3 | null {
    const cur = this.cur
    if (this.phase === 'probe') {
      const p = cur.plot.petioles[0].base
      const t = Math.min(1, this.phaseTimer / 0.5)
      const out = Math.max(0, (this.phaseTimer - 1.2) / 0.6)
      const y = THREE.MathUtils.lerp(0.18, -0.3, Math.min(1, t) * (1 - Math.min(1, out)))
      return new THREE.Vector3(p.x + 0.03, y, p.z + 0.03)
    }
    if ((this.phase === 'lift' || this.phase === 'hold') && cur.liftT > 0.04) {
      const s = Math.min(0.95, Math.max(0.05, cur.grabS + (cur.grabS > 0.5 ? -0.3 : 0.3)))
      const idx = Math.round(s * (cur.build.samples.length - 1))
      const sm = cur.build.samples[idx]
      const p = sm.pos.clone()
      p.y += cur.rise * this.liftK(s)
      p.add(cur.holdOffset)
      p.y -= sm.radius + 0.03
      return p
    }
    if (this.phase === 'dig' && this.liftReady) {
      // the free hand hovers, ready to take the weight from underneath
      const idx = Math.round(0.5 * (this.cur.build.samples.length - 1))
      const sm = this.cur.build.samples[idx]
      return new THREE.Vector3(sm.pos.x, sm.pos.y + 0.14, sm.pos.z + 0.06)
    }
    return null
  }

  private liftK(s: number) {
    const delay = Math.abs(s - this.cur.grabS) * 0.62
    const t = this.cur.liftT
    return THREE.MathUtils.smoothstep(t, delay, delay + 0.42)
  }

  // ---------------------------------------------------------------- profile

  private updateProfile(dt: number, cur: ActivePlot, work: number) {
    void work
    const samples = cur.build.samples
    const P = PROFILE_SIZE
    const data = cur.mat.profileData
    const lifting = cur.liftT > 0.001
    let onLotus = 0
    let newNode = -1
    for (let i = 0; i < P; i++) {
      const s = i / (P - 1)
      const sm = samples[Math.min(samples.length - 1, Math.round(s * (samples.length - 1)))]
      const x = sm.pos.x + cur.holdOffset.x
      const z = sm.pos.z + cur.holdOffset.z
      let expo = cur.exposure[i]
      if (!lifting) {
        const bedSurf = cur.plot.bedSurfaceY(x, z)
        const top = sm.pos.y + sm.radius
        const e = THREE.MathUtils.clamp((top - bedSurf) / (2 * sm.radius), 0, 1)
        expo = Math.max(expo, e)
      } else {
        expo = 1
      }
      cur.exposure[i] = expo

      const cleanLocal = lifting ? 1 : cur.plot.cleanAt(x, z) * (0.35 + 0.65 * expo)
      cur.clean[i] += (cleanLocal - cur.clean[i]) * Math.min(1, dt * 6)

      // water washing the exposed surface
      const d = Math.hypot(this.impact.x - x, this.impact.z - z)
      const hit = this.jetOn && expo > 0.25 && d < 0.13
      if (hit) {
        const floor = lifting ? 0 : 0.42
        cur.dirt[i] = Math.max(floor, cur.dirt[i] - dt * (0.5 + 1.4 * this.input.pressure))
        cur.wet[i] = Math.min(1, cur.wet[i] + dt * 3)
        onLotus = Math.max(onLotus, 1 - d / 0.13)
      } else {
        cur.wet[i] = Math.max(lifting ? 0.35 : 0.55, cur.wet[i] - dt * 0.06)
      }

      const o = i * 4
      data[o] = (cur.clean[i] * 255) | 0
      data[o + 1] = (cur.dirt[i] * 255) | 0
      data[o + 2] = (cur.wet[i] * 255) | 0
      data[o + 3] = 255
    }
    cur.mat.profile.needsUpdate = true
    this.onLotusAudio += (onLotus - this.onLotusAudio) * Math.min(1, dt * 8)

    // joints announce themselves one at a time
    for (let n = 0; n < cur.discovered.length; n++) {
      if (cur.discovered[n]) continue
      const c = cur.build.nodeCenters[n]
      const e = cur.exposure[Math.min(P - 1, Math.round(c.s * (P - 1)))]
      if (e > 0.55) {
        cur.discovered[n] = true
        newNode = n
      }
    }
    if (newNode >= 0) {
      const found = cur.discovered.filter(Boolean).length
      this.audio.reveal()
      if (found === 1) {
        this.haptic(12)
        this.phaseTimer = 0
        this.firstRevealAt = this.time
        this.firstRevealPos = cur.build.nodeCenters[newNode].pos.clone()
      }
      if (found >= 2) this.prepareNext()
    }
  }

  private firstRevealAt = -99
  private firstRevealPos: THREE.Vector3 | null = null

  private haptic(ms: number) {
    if (this.settings.data.calmVisuals) return
    try {
      navigator.vibrate?.(ms)
    } catch {
      /* not supported on iOS */
    }
  }

  // ---------------------------------------------------------------- actions

  private onPress() {
    this.interacted = true
    const cur = this.cur
    if (this.phase === 'intro') {
      this.phase = 'idle'
      this.phaseTimer = 0
      this.plotTimer = 0
    }
    if (this.phase === 'idle') {
      const p = cur.plot.petioles[0]
      const top = p.base.clone().setY(p.height - (-BED_Y) + 0.02)
      const sc = this.worldToScreen(top)
      const d = Math.hypot(sc.x - this.input.x, sc.y - this.input.y)
      if (!sc.behind && d < Math.min(this.width, this.height) * 0.16) {
        this.phase = 'probe'
        this.phaseTimer = 0
        this.mode = 'none'
        this.audio.probe()
        this.water.addRipple(p.base.x, p.base.z, 0.8)
        this.bubbles.stop()
        return
      }
      this.phase = 'dig'
      this.phaseTimer = 0
    }
    this.bubbles.stop()

    if ((this.phase === 'dig' && this.liftReady) || this.phase === 'hold' || this.phase === 'lift') {
      const near = this.nearestExposedSample(this.input.x, this.input.y)
      const grabRadius = Math.min(this.width, this.height) * 0.14
      if (near.index >= 0 && near.dist < grabRadius) {
        this.mode = 'grab'
        if (cur.liftT < 0.001) {
          cur.grabS = cur.build.samples[near.index].s
          cur.mat.uniforms.uGrabS.value = cur.grabS
          cur.rise = -(cur.build.samples[near.index].pos.y) + 0.14
          this.audio.shed()
          this.phase = 'lift'
        }
        return
      }
    }
    this.mode = 'spray'
  }

  private onRelease() {
    if (this.mode === 'grab' && this.phase === 'hold') this.tryStore()
    this.mode = 'none'
  }

  private updateLift(dt: number) {
    const cur = this.cur
    if (this.mode === 'grab' && this.input.down) {
      const dy = this.input.prevY - this.input.y
      cur.liftT += Math.max(0, dy) / 220
    }
    // the worker's hands take over: a child cannot fail this
    // the worker's hands take over only once the child has really pulled
    if (cur.liftT > 0.12) cur.liftT += dt * 0.55
    cur.liftT = Math.min(1, cur.liftT)
    cur.mat.uniforms.uLift.value = cur.liftT
    cur.mat.uniforms.uRise.value = cur.rise
    cur.mat.uniforms.uAboveWater.value = THREE.MathUtils.clamp((cur.liftT - 0.35) / 0.4, 0, 1)

    // mud and water leave the body as it slides out
    if (Math.random() < dt * 26 * (1 - cur.liftT * 0.5)) {
      const s = Math.random()
      const sm = cur.build.samples[Math.round(s * (cur.build.samples.length - 1))]
      const p = sm.pos.clone()
      p.y += cur.rise * this.liftK(s)
      if (p.y < 0.05) this.turbidity.spawn(p, 2, 0.05, 0.05)
      else this.water.addRipple(p.x, p.z, 0.35)
    }
    if (cur.liftT >= 1) {
      this.phase = 'hold'
      this.phaseTimer = 0
      this.haptic(24)
      this.audio.splashSmall()
    }
  }

  private updateHold(dt: number) {
    const cur = this.cur
    const idx = Math.round(cur.grabS * (cur.build.samples.length - 1))
    const anchor = cur.build.samples[idx].pos.clone()
    anchor.y += cur.rise

    if (this.storeAnim > 0) {
      this.storeAnim -= dt
      const f = 1 - Math.max(0, this.storeAnim) / 0.55
      const target = this.boat.group.position.clone()
      target.y = 0.02
      const want = new THREE.Vector3().subVectors(target, anchor)
      cur.holdOffset.lerpVectors(this.storeFrom, want, THREE.MathUtils.smoothstep(f, 0, 1))
      cur.mesh.position.copy(cur.holdOffset)
      if (this.storeAnim <= 0) this.finishStore()
      return
    }

    if (this.mode === 'grab' && this.input.down) {
      const target = this.holdPoint.clone()
      target.y = Math.max(0.06, target.y)
      const want = new THREE.Vector3().subVectors(target, anchor)
      cur.holdOffset.lerp(want, 1 - Math.exp(-dt * 12))
      // sluicing it side to side in the water takes the last of the clay off
      const lowest = anchor.y + cur.holdOffset.y
      if (lowest < 0.46 && this.input.speed > 130) {
        const amount = dt * Math.min(1.2, this.input.speed / 700) * 1.6
        for (let i = 0; i < PROFILE_SIZE; i++) cur.dirt[i] = Math.max(0, cur.dirt[i] - amount * 0.7)
        for (let i = 0; i < PROFILE_SIZE; i++) cur.wet[i] = Math.min(1, cur.wet[i] + dt * 2)
        if (Math.random() < dt * 12) {
          this.water.addRipple(target.x, target.z, 0.5)
          this.turbidity.spawn(new THREE.Vector3(target.x, -0.05, target.z), 2, 0.12, 0.06)
        }
        if (Math.random() < dt * 3) this.audio.splashSmall()
      }
    }
    cur.mesh.position.copy(cur.holdOffset)
    cur.mat.uniforms.uAboveWater.value = 1
  }

  private tryStore() {
    const cur = this.cur
    const idx = Math.round(cur.grabS * (cur.build.samples.length - 1))
    const anchor = cur.build.samples[idx].pos.clone()
    anchor.y += cur.rise
    const world = anchor.clone().add(cur.holdOffset)
    const b = this.boat.group.position
    if (Math.hypot(world.x - b.x, world.z - b.z) < 1.2) {
      this.storeFrom.copy(cur.holdOffset)
      this.storeAnim = 0.55
    }
  }

  private finishStore() {
    const cur = this.cur
    this.storeAnim = 0
    cur.stored = true
    this.scene.remove(cur.mesh)
    const idx = Math.round(cur.grabS * (cur.build.samples.length - 1))
    const anchor = cur.build.samples[idx].pos.clone()
    anchor.y += cur.rise
    // re-root the mesh under the boat so it rides along
    cur.mesh.position.set(0, 0, 0)
    const holder = new THREE.Group()
    holder.add(cur.mesh)
    cur.mesh.position.copy(new THREE.Vector3().sub(anchor))
    cur.mesh.position.y += cur.rise * 0 // keep the shader's own rise
    this.boat.store(holder)
    this.audio.thunk()
    this.harvested++
    this.canReplay = true
    this.lastLotusGeometry = cur.build.geometry
    this.cutaway.setRoot(cur.build.geometry)
    this.phase = 'stored'
    this.phaseTimer = 0
    this.prepareNext()
  }

  private updateStored(dt: number) {
    void dt
    if (this.phaseTimer > 1.1) this.activateNext()
  }

  // ---------------------------------------------------------------- camera

  /**
   * The camera watches every plot from a staged azimuth derived from the way
   * the rhizome runs. Perpendicular would lay the joints flat across the frame,
   * which a portrait phone cannot hold, so the view is rotated toward the axis
   * until the chain reads diagonally in either orientation.
   */
  private camAz() {
    return this.cur.viewAz + (this.director.orientation === 'portrait' ? 0.66 : 0.22)
  }

  private updateCamera(dt: number) {
    const cur = this.cur
    const plot = cur.plot
    const portrait = this.director.orientation === 'portrait'
    const up = new THREE.Vector3(0, 1, 0)
    const az = this.camAz()
    const dirH = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
    const shot = (el: number) => dirH.clone().multiplyScalar(Math.cos(el)).addScaledVector(up, Math.sin(el)).normalize()

    const must: THREE.Vector3[] = []
    const exposedCenter = new THREE.Vector3()
    let exposedCount = 0
    const box = new THREE.Box3()
    const addExposed = () => {
      const S = cur.build.samples
      box.makeEmpty()
      const p = new THREE.Vector3()
      for (let i = 0; i < PROFILE_SIZE; i++) {
        if (cur.exposure[i] < 0.4) continue
        const u = i / (PROFILE_SIZE - 1)
        const sm = S[Math.round(u * (S.length - 1))]
        p.copy(sm.pos)
        p.y += cur.rise * this.liftK(u)
        p.add(cur.holdOffset)
        box.expandByPoint(p)
        exposedCenter.add(p)
        exposedCount++
      }
      if (!exposedCount) return
      exposedCenter.multiplyScalar(1 / exposedCount)
      box.expandByScalar(0.05)
      for (const c of [
        [box.min.x, box.min.y, box.min.z],
        [box.max.x, box.max.y, box.max.z],
        [box.min.x, box.max.y, box.max.z],
        [box.max.x, box.min.y, box.min.z],
        [box.min.x, box.min.y, box.max.z],
        [box.max.x, box.max.y, box.min.z],
      ]) {
        must.push(new THREE.Vector3(c[0], c[1], c[2]))
      }
    }

    let req: ShotRequest

    if (this.phase === 'intro') {
      // wide three quarter: paddy, worker, boat — the scale of the place
      must.push(
        this.worker.stance.clone().setY(0.95),
        plot.spec.center.clone().setY(0.06),
        this.boat.group.position.clone(),
        plot.petioles[0].base.clone().setY(0.18),
      )
      req = {
        key: 'establish',
        dir: shot(0.42),
        dist: portrait ? 6.2 : 5.0,
        target: plot.spec.center.clone().setY(0.02),
        fov: portrait ? 54 : 44,
        must,
        minDist: 3.4,
        maxDist: 14,
        speed: 1.0,
        minEyeY: 1.3,
      }
    } else if (this.time - this.firstRevealAt < (this.plotIndex === 0 ? 2.2 : 1.4) && this.firstRevealPos) {
      // the close look at the first pale surface — same azimuth as the working
      // shot, so the mud being cut never leaves the frame
      must.push(this.firstRevealPos.clone(), this.impact.clone())
      req = {
        key: 'closeup',
        dir: shot(0.60),
        dist: portrait ? 0.82 : 0.72,
        target: this.firstRevealPos.clone(),
        fov: portrait ? 48 : 40,
        must,
        minDist: 0.5,
        maxDist: 2.2,
        speed: 2.0,
        minEyeY: 0.3,
      }
    } else if (this.phase === 'lift') {
      // low reveal: the camera drops and pulls back as the body clears the mud
      addExposed()
      must.push(this.holdPoint.clone())
      const centre = exposedCount ? exposedCenter.clone() : this.holdPoint.clone()
      centre.y = -0.1 + cur.liftT * 0.32
      req = {
        key: 'reveal',
        dir: shot(THREE.MathUtils.lerp(0.52, 0.3, cur.liftT)),
        dist: (portrait ? 1.5 : 1.25) + cur.liftT * 0.75,
        target: centre,
        fov: portrait ? 52 : 44,
        must,
        minDist: 0.7,
        maxDist: 6,
        speed: 1.6,
        minEyeY: 0.35,
      }
    } else if (this.phase === 'hold' || this.phase === 'stored') {
      // one angle for before and after washing, so the change in the surface reads
      addExposed()
      const centre = exposedCount ? exposedCenter.clone() : this.holdPoint.clone()
      const toBoat = centre.distanceTo(this.boat.group.position)
      // the boat is only pulled into frame once the child carries the root over
      if (toBoat < 0.95 || this.phase === 'stored') {
        must.push(this.boat.group.position.clone().setY(0.16))
        centre.lerp(this.boat.group.position, 0.3)
      }
      req = {
        key: 'wash',
        dir: shot(0.52),
        dist: portrait ? 2.4 : 1.95,
        target: centre.setY(Math.max(0.12, centre.y)),
        fov: portrait ? 52 : 44,
        must,
        minDist: 0.75,
        maxDist: 7,
        speed: 1.4,
        minEyeY: 0.55,
      }
    } else {
      // the working shot: petiole, nozzle tip and mud all at once
      addExposed()
      // while water is running, both the nozzle and where it lands stay framed
      if (this.input.down) must.push(this.impact.clone(), this.grip.clone())
      // The frame is anchored to the plot, never to the finger: if the ground
      // slid under the hose the child could not aim at anything.
      const waiting = this.phase === 'idle' || this.phase === 'probe'
      const target = plot.spec.center.clone().setY(-0.04)
      if (exposedCount > 2) target.lerp(exposedCenter.setY(-0.04), 0.6)
      if (waiting) {
        // before anything is found, the one moving petiole is the whole subject
        must.push(plot.petioles[0].base.clone().setY(0.16))
        target.lerp(plot.petioles[0].base.clone().setY(-0.02), 0.8)
      }
      req = {
        key: 'work',
        dir: shot(waiting ? (portrait ? 0.68 : 0.56) : portrait ? 0.78 : 0.64),
        dist: waiting ? (portrait ? 1.5 : 1.3) : portrait ? 2.35 : 2.0,
        target,
        fov: portrait ? 54 : 46,
        must,
        minDist: 1.05,
        maxDist: 5.0,
        speed: 2.0,
        minEyeY: 0.8,
      }
    }

    this.director.update(dt, req)
  }

  // ---------------------------------------------------------------- render

  render() {
    if (this.replaying) {
      this.renderer.render(this.cutaway.scene, this.cutaway.camera)
      return
    }
    this.renderer.render(this.scene, this.director.camera)
  }

  // ---------------------------------------------------------------- test hooks
  // Small introspection helpers used by the automated playthrough. They only
  // read state; the game never depends on them.

  __probeTarget() {
    const p = this.cur.plot.petioles[0]
    const top = p.base.clone().setY(p.height - -BED_Y + 0.02)
    const sc = this.worldToScreen(top)
    return sc.behind ? null : { x: sc.x, y: sc.y }
  }

  /** finger positions that trace the buried rhizome, offset below the target */
  __digPath() {
    const out: { x: number; y: number }[] = []
    const S = this.cur.build.samples
    for (let i = 0; i <= 8; i++) {
      const sm = S[Math.round((0.06 + (i / 8) * 0.88) * (S.length - 1))]
      const sc = this.worldToScreen(new THREE.Vector3(sm.pos.x, WATER_Y, sm.pos.z))
      if (sc.behind) continue
      out.push({
        x: Math.max(6, Math.min(this.width - 6, sc.x)),
        y: Math.max(6, Math.min(this.height - 6, sc.y + FINGER_OFFSET_PX)),
      })
    }
    return out
  }

  __grabPoint() {
    const S = this.cur.build.samples
    let best: { x: number; y: number } | null = null
    for (let i = 0; i < PROFILE_SIZE; i++) {
      if (this.cur.exposure[i] < 0.5) continue
      const sm = S[Math.round((i / (PROFILE_SIZE - 1)) * (S.length - 1))]
      const sc = this.worldToScreen(sm.pos)
      if (sc.behind) continue
      best = { x: sc.x, y: sc.y }
      if (i > PROFILE_SIZE * 0.45) break
    }
    return best
  }

  __boatPoint() {
    const sc = this.worldToScreen(this.boat.group.position.clone().setY(0.12))
    return sc.behind ? null : { x: sc.x, y: sc.y }
  }

  __state() {
    let expo = 0
    let n = 0
    for (let i = 0; i < PROFILE_SIZE; i++) {
      if (this.cur.exposure[i] > 0.5) expo++
      if (this.cur.dirt[i] < 0.25) n++
    }
    let removed = 0
    const step = 7
    for (let x = 0; x < 192; x += step)
      for (let y = 0; y < 192; y += step) removed += this.cur.plot.removalAt(
        this.cur.plot.spec.center.x + (x / 192 - 0.5) * this.cur.plot.spec.size,
        this.cur.plot.spec.center.z + (y / 192 - 0.5) * this.cur.plot.spec.size,
      )
    return {
      phase: this.phase,
      plot: this.plotIndex,
      harvested: this.harvested,
      nodes: this.cur.discovered.length,
      discovered: this.cur.discovered.filter(Boolean).length,
      exposedFrac: +(expo / PROFILE_SIZE).toFixed(2),
      washedFrac: +(n / PROFILE_SIZE).toFixed(2),
      dirtMean: +(this.cur.dirt.reduce((a, b) => a + b, 0) / PROFILE_SIZE).toFixed(2),
      boatDist: +this.holdPoint.distanceTo(this.boat.group.position).toFixed(2),
      duqSum: +removed.toFixed(1),
      orientation: this.director.orientation,
    }
  }

  startReplay() {
    if (!this.canReplay || !this.lastLotusGeometry) return
    this.replaying = true
    this.cutaway.start()
  }
  stopReplay() {
    this.replaying = false
    this.cutaway.stop()
  }
}
