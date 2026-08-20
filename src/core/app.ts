/**
 * Wiring. The whole game is one causal loop:
 *   finger -> sheet pose -> analytic bounce -> what you see now and what ripens.
 * Nothing in here explains that in words. It only makes it legible.
 */
import * as THREE from 'three'
import {
  createState,
  deserialize,
  hintTarget,
  interactable,
  moveSun,
  nextRound,
  noteActivity,
  placeSheet,
  pullBag,
  pullSheet,
  reportCoverage,
  serialize,
  tick,
  type GameState,
  type Target,
} from './state'
import { detectTier, LoadGovernor, settingsFor, type QualitySettings, type Tier } from './quality'
import { PointerInput, type PointerSample } from './input'
import { Sound } from './audio'
import { loadSnapshot, saveSnapshot, snapshotMask } from './storage'
import { LightRig } from '../scene/lightRig'
import { CameraRig, type Shot } from '../scene/cameraRig'
import { Orchard, layoutForRound, type RoundLayout } from '../scene/orchard'
import { Peach } from '../scene/peach'
import { PaperBag, makeBagShape } from '../scene/bag'
import { ReflectorSheet } from '../scene/sheet'
import { Motes } from '../scene/motes'
import { makeSkyTexture } from '../scene/textures'
import { makePeachShape } from '../scene/peachShape'
import { BLUSH_RES_U, BLUSH_RES_V } from '../sim/blush'
import { groundHeight } from '../scene/terrain'

const MAX_DT = 0.05
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.008)

interface Shots {
  wide: Shot
  bag: Shot
  sheet: Shot
  causal: Shot
  blush: Shot
  play: Shot
}

interface Grab {
  id: Target
  /** Value the control had when the finger went down. */
  base: number
  offset: THREE.Vector3
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize()

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private rig: LightRig
  private cam: CameraRig
  private orchard: Orchard
  private peach: Peach
  private bag: PaperBag
  private sheet: ReflectorSheet
  private motes: Motes
  private sound = new Sound()
  private pointer: PointerInput
  private governor: LoadGovernor
  private q: QualitySettings
  private tier: Tier

  private state: GameState
  private layout: RoundLayout
  private shots!: Shots
  private peachWorld = new THREE.Vector3()
  private sheetBase = new THREE.Vector3()

  private raycaster = new THREE.Raycaster()
  private grab: Grab | null = null
  private lastSim = 0
  private clockPrev = 0
  private time = 0
  private running = true
  private contextLost = false
  private saveAccum = 0
  private hintPulse = 0
  private hintCycle = 0
  private preMoveT = 0
  private framingBias = 0
  private framingBiasGoal = 0
  private maxAlong = 0
  private bagFall = 0
  private bagRest = new THREE.Vector3()
  private nextBag: PaperBag | null = null
  private nextBagPos = new THREE.Vector3()
  private swapT = 0
  private pendingSwap = false
  private firstLightDone = false
  private tmpV = new THREE.Vector3()
  private tmpV2 = new THREE.Vector3()
  private sky: THREE.DataTexture
  private pmrem: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private veil: HTMLElement,
  ) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    if (!gl) throw new Error('WebGL2 is required')

    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.tier = detectTier(gl)
    this.q = settingsFor(this.tier)
    this.governor = new LoadGovernor((t) => this.applyTier(t), this.tier)

    this.sky = makeSkyTexture()
    this.scene.background = this.sky
    this.scene.fog = new THREE.Fog(0xa8c4dd, 7, 26)
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envRT = this.pmrem.fromEquirectangular(this.sky)
    this.scene.environment = this.envRT.texture

    const restored = loadSnapshot()
    this.state = (restored && deserialize(serialize(restored.state))) ?? createState(0)
    this.layout = layoutForRound(this.state.round)

    this.rig = new LightRig(this.scene, this.q)
    this.rig.setSunT(this.state.sunT)

    this.orchard = new Orchard(this.scene, this.rig, this.q, this.layout)

    this.peach = new Peach(this.rig, this.q, makePeachShape(this.layout.peachSeed, this.state.round))
    this.bag = new PaperBag(makeBagShape(this.layout.bagSeed), this.peach.shape)
    this.orchard.branchGroup.add(this.peach.group)
    this.orchard.branchGroup.add(this.bag.group)

    this.sheet = new ReflectorSheet(this.rig, this.q, {
      seed: this.layout.sheetSeed,
      length: this.layout.sheetLength,
      width: this.layout.sheetWidth,
      origin: new THREE.Vector3(),
      pullDir: new THREE.Vector3(-1, 0, -0.34).normalize(),
    })
    this.scene.add(this.sheet.group)

    this.motes = new Motes(140)
    this.motes.setCount(this.q.moteCount)
    this.scene.add(this.motes.points)

    this.placeRound(this.layout, true)

    if (restored) {
      const mask = new Float32Array(BLUSH_RES_U * BLUSH_RES_V)
      if (snapshotMask(restored, mask, BLUSH_RES_U, BLUSH_RES_V)) this.peach.blush.loadMask(mask)
      this.firstLightDone = this.state.sawFirstLight
    }

    this.cam = new CameraRig(this.shots.wide, window.innerWidth / Math.max(1, window.innerHeight))
    this.cam.cut(this.shotForPhase())

    this.pointer = new PointerInput(canvas, {
      onDown: (p) => this.onDown(p),
      onMove: (p) => this.onMove(p),
      onUp: () => this.onUp(),
    })

    this.bindWindow()
    this.resize()
    requestAnimationFrame((t) => {
      this.clockPrev = t
      this.loop(t)
    })
    setTimeout(() => this.veil.classList.add('clear'), 120)
  }

  // ------------------------------------------------------------- round setup

  private placeRound(layout: RoundLayout, initial: boolean): void {
    const localPeach = layout.peachPos
    this.peach.group.position.set(localPeach.x, localPeach.y, localPeach.z)
    this.bag.group.position.set(localPeach.x, localPeach.y + 0.012, localPeach.z)
    this.orchard.branchGroup.updateMatrixWorld(true)
    this.peachWorld.copy(localPeach).applyMatrix4(this.orchard.branchGroup.matrixWorld)

    this.sheetBase.set(this.peachWorld.x + 0.8, 0, this.peachWorld.z + 0.3)
    this.sheet.reseed({
      seed: layout.sheetSeed,
      length: layout.sheetLength,
      width: layout.sheetWidth,
      origin: this.sheetBase.clone(),
      pullDir: layout.sheetDir.clone(),
    })
    this.maxAlong = 0

    this.peach.syncTransform()
    this.motes.setCenter(new THREE.Vector3(this.peachWorld.x, 0.5, this.peachWorld.z))
    this.shots = this.buildShots()
    this.bagFall = 0
    this.bagRest.set(this.peachWorld.x - 0.24, 0, this.peachWorld.z + 0.3)
    if (!initial) this.cam.moveTo(this.shots.wide, 1.2)
  }

  private buildShots(): Shots {
    const P = this.peachWorld
    const work = new THREE.Vector3(P.x + 0.08, 0.55, P.z + 0.06)
    return {
      wide: { fov: 30, target: work.clone(), radius: 0.98, dir: v(0.34, 0.4, 1.0) },
      bag: { fov: 19, target: P.clone(), radius: 0.2, dir: v(0.26, 0.13, 1.0) },
      sheet: {
        fov: 33,
        target: new THREE.Vector3(P.x + 0.1, 0.42, P.z + 0.06),
        radius: 0.95,
        dir: v(0.44, 0.14, 1.0),
        lookLift: 0.2,
      },
      causal: {
        fov: 34,
        target: new THREE.Vector3(P.x - 0.02, 0.58, P.z + 0.02),
        radius: 0.82,
        dir: v(0.5, 0.26, 0.95),
        lookLift: 0.24,
      },
      blush: { fov: 15, target: new THREE.Vector3(P.x, P.y - 0.012, P.z), radius: 0.108, dir: v(0.3, -0.05, 1.0) },
      play: {
        fov: 30,
        target: new THREE.Vector3(P.x + 0.04, 0.52, P.z + 0.04),
        radius: 0.99,
        dir: v(0.38, 0.3, 1.0),
      },
    }
  }

  private shotForPhase(): Shot {
    const s = this.state
    switch (s.phase) {
      case 'intro':
      case 'bagged':
        return this.shots.wide
      case 'unbagging':
      case 'observing':
        return this.shots.bag
      case 'sheetIdle':
      case 'unrolling':
        return this.shots.sheet
      case 'firstLight':
        return this.shots.causal
      case 'ripening':
        // The frame that carries the causality is held while the first pigment
        // arrives; only once it is unmistakable do we move in to look at it.
        return s.blushCoverage > 0.18 && s.phaseTimer > 4 ? this.shots.blush : this.shots.causal
      case 'freeplay':
        return s.phaseTimer < 5 ? this.shots.blush : this.shots.play
      case 'handoff':
        return this.shots.play
    }
  }

  // ------------------------------------------------------------------ input

  private screenOf(world: THREE.Vector3, out: { x: number; y: number }): boolean {
    this.tmpV2.copy(world).project(this.cam.camera)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    out.x = (this.tmpV2.x * 0.5 + 0.5) * w
    out.y = (-this.tmpV2.y * 0.5 + 0.5) * h
    return this.tmpV2.z < 1
  }

  private groundAt(x: number, y: number, out: THREE.Vector3): boolean {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.raycaster.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), this.cam.camera)
    return this.raycaster.ray.intersectPlane(GROUND_PLANE, out) !== null
  }

  private anchors(): Array<{ id: Target; pos: THREE.Vector3; scale: number }> {
    const can = interactable(this.state)
    const out: Array<{ id: Target; pos: THREE.Vector3; scale: number }> = []
    if (can.has('bag')) {
      const p = new THREE.Vector3(0, this.bag.hemY(), 0)
      p.applyMatrix4(this.bag.group.matrixWorld)
      out.push({ id: 'bag', pos: p, scale: 1.25 })
    }
    if (can.has('sheet')) out.push({ id: 'sheet', pos: this.sheet.tipWorld(new THREE.Vector3()), scale: 1.15 })
    if (can.has('sheetBody')) out.push({ id: 'sheetBody', pos: this.sheet.centerWorld(new THREE.Vector3()), scale: 1.3 })
    if (can.has('sun')) out.push({ id: 'sun', pos: this.orchard.sunSprite.position.clone(), scale: 1.5 })
    if (can.has('nextBag') && this.nextBag) out.push({ id: 'nextBag', pos: this.nextBagPos.clone(), scale: 1.1 })
    return out
  }

  private onDown(p: PointerSample): void {
    this.sound.start()
    this.sound.resume()
    noteActivity(this.state)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const base = Math.min(w, h) * 0.2
    const screen = { x: 0, y: 0 }
    let best: { id: Target; d: number } | null = null
    for (const a of this.anchors()) {
      const visible = this.screenOf(a.pos, screen)
      if (!visible) continue
      const d = Math.hypot(screen.x - p.x, screen.y - p.y) / (base * a.scale)
      if (d <= 1 && (!best || d < best.d)) best = { id: a.id, d }
    }
    const can = interactable(this.state)
    if (!best) {
      // Forgiving fallbacks: the sky moves the sun, the ground moves the sheet.
      if (can.has('sun') && p.y < h * 0.42) best = { id: 'sun', d: 1 }
      else if (can.has('sheetBody') && p.y > h * 0.5) best = { id: 'sheetBody', d: 1 }
      else if (can.has('sheet') && p.y > h * 0.5) best = { id: 'sheet', d: 1 }
      else if (can.has('bag')) best = { id: 'bag', d: 1 }
    }
    if (!best) return

    const offset = new THREE.Vector3()
    let baseVal = 0
    if (best.id === 'bag') baseVal = this.state.bagPull
    if (best.id === 'sun') baseVal = this.state.sunT
    if (best.id === 'sheet') {
      const hit = new THREE.Vector3()
      if (this.groundAt(p.x, p.y, hit)) {
        const tip = this.sheet.tipWorld(new THREE.Vector3())
        offset.subVectors(tip, hit)
      }
    }
    if (best.id === 'sheetBody') {
      const hit = new THREE.Vector3()
      if (this.groundAt(p.x, p.y, hit)) {
        const c = this.sheet.centerWorld(new THREE.Vector3())
        offset.subVectors(c, hit)
      }
    }
    this.grab = { id: best.id, base: baseVal, offset }
    if (best.id === 'nextBag') {
      this.pendingSwap = true
      this.swapT = 0
      this.sound.paper(0.6)
    }
    this.framingBiasGoal = best.id === 'bag' ? 0 : -0.075
  }

  private onMove(p: PointerSample): void {
    const g = this.grab
    if (!g) return
    const h = this.canvas.clientHeight
    const w = this.canvas.clientWidth
    noteActivity(this.state)

    if (g.id === 'bag') {
      const want = g.base + p.totalY / (h * 0.3)
      pullBag(this.state, want - this.state.bagPull)
      this.sound.paper(Math.min(1, Math.abs(p.dy) / 12))
      return
    }
    if (g.id === 'sun') {
      const delta = (p.dx / (w * 0.85)) * 0.9
      const before = this.state.sunT
      moveSun(this.state, delta * 0.35)
      if (Math.abs(this.state.sunT - before) > 0.001) this.sound.breeze(0.4)
      return
    }
    if (g.id === 'sheet' || g.id === 'sheetBody') {
      const hit = new THREE.Vector3()
      if (!this.groundAt(p.x, p.y, hit)) return
      hit.add(g.offset)
      const rel = this.tmpV.subVectors(hit, this.sheetBase)
      const dir = this.layout.sheetDir
      const perp = this.tmpV2.set(-dir.z, 0, dir.x)
      const along = rel.dot(dir)
      const side = rel.dot(perp)
      const L = this.layout.sheetLength

      if (g.id === 'sheetBody') {
        placeSheet(this.state, { lateral: side / 0.26 })
      } else {
        const wantAlong = Math.max(0, along)
        this.maxAlong = Math.max(this.maxAlong, Math.min(L * 0.97, wantAlong))
        if (wantAlong >= this.maxAlong - 0.005) {
          const deploy = Math.min(1, wantAlong / (L * 0.82))
          const reach = Math.max(0, (wantAlong - L * 0.82) / (L * 0.15))
          if (this.state.phase === 'sheetIdle' || this.state.phase === 'unrolling' || this.state.phase === 'observing') {
            pullSheet(this.state, deploy - this.state.sheetDeploy)
          } else {
            placeSheet(this.state, { deploy, reach: Math.min(1, reach), fold: 0 })
          }
        } else if (this.state.phase !== 'sheetIdle' && this.state.phase !== 'unrolling' && this.state.phase !== 'observing') {
          const foldMax = 0.64 * L
          placeSheet(this.state, { fold: Math.min(1, (this.maxAlong - wantAlong) / foldMax) })
        }
      }
      this.sheet.disturb()
      this.sound.drag(Math.min(1, Math.hypot(p.dx, p.dy) / 14))
      return
    }
  }

  private onUp(): void {
    this.grab = null
    this.framingBiasGoal = 0
    this.sheet.disturb()
  }

  // ------------------------------------------------------------- frame logic

  private applyTier(t: Tier): void {
    this.tier = t
    this.q = settingsFor(t)
    this.rig.applyQuality(this.q)
    this.peach.setQuality(this.q)
    this.sheet.setQuality(this.q)
    this.orchard.setQuality(this.q)
    this.motes.setCount(this.q.moteCount)
    this.governor.reset(t)
  }

  private driveHints(dt: number): void {
    const target = hintTarget(this.state)
    this.hintCycle += dt
    // One slow breath every few seconds; never a loop of nagging.
    const period = this.state.hintLevel >= 2 ? 3.6 : 5.0
    if (this.hintCycle > period) this.hintCycle = 0
    const t = Math.min(1, this.hintCycle / 1.5)
    this.hintPulse = target ? Math.sin(t * Math.PI) : Math.max(0, this.hintPulse - dt * 2)

    this.bag.hemHint = target === 'bag' ? this.hintPulse * 0.7 : 0
    this.sheet.setHintLift(target === 'sheet' ? this.hintPulse : 0)

    // Level 2 adds a real, tiny preliminary movement of the thing itself.
    const strong = this.state.hintLevel >= 2 ? this.hintPulse : 0
    this.preMoveT = strong
    if (target === 'bag' && strong > 0.001) {
      this.bag.pull = Math.max(this.state.bagPull, this.state.bagPull + strong * 0.09)
    }
    if (target === 'sun' && strong > 0.001) this.sound.breeze(strong * 0.3)
  }

  private updateBag(dt: number): void {
    const s = this.state
    if (s.phase === 'bagged' || s.phase === 'intro') {
      this.bag.pull = Math.max(this.bag.pull * 0, s.bagPull)
      if (this.preMoveT > 0.001 && hintTarget(s) === 'bag') this.bag.pull = s.bagPull + this.preMoveT * 0.09
      this.bag.group.visible = true
    } else if (s.phase === 'unbagging') {
      this.bag.pull = Math.min(1, this.bag.pull + dt * 0.75)
      this.bagFall = Math.min(1, this.bagFall + dt * 0.62)
      const e = this.bagFall
      const local = this.bag.group.position
      const startY = this.layout.peachPos.y + 0.012
      const restLocal = this.orchard.branchGroup.worldToLocal(
        new THREE.Vector3(this.bagRest.x, groundHeight(this.bagRest.x, this.bagRest.z) + 0.035, this.bagRest.z),
      )
      local.lerpVectors(new THREE.Vector3(this.layout.peachPos.x, startY, this.layout.peachPos.z), restLocal, e * e)
      local.y += Math.sin(e * Math.PI) * 0.05
      this.bag.group.rotation.set(e * 1.5, e * 0.9, e * 1.1)
      this.bag.fall = e
      if (e >= 1 && !this.bagLanded) {
        this.bagLanded = true
        this.sound.thud()
      }
    }
    this.bag.update(dt)
  }

  private bagLanded = false

  private updateSheetPose(): void {
    const s = this.state
    const pose = this.sheet.pose
    pose.deploy = s.sheetDeploy
    pose.lateral = s.sheetLateral
    pose.reach = s.sheetReach
    // Before the first bounce the leading flap is still folded over itself; the
    // act of pulling is what opens it.
    pose.fold = s.sawFirstLight ? s.sheetFold : Math.max(0, 0.52 - s.sheetDeploy * 2.4)
  }

  private onFirstLight(): void {
    if (this.firstLightDone) return
    this.firstLightDone = true
    this.sheet.pulse(1)
    this.sound.shimmer()
    const from = this.sheet.centerWorld(new THREE.Vector3())
    const to = new THREE.Vector3(this.peachWorld.x, this.peachWorld.y - this.peach.shape.radius * 0.85, this.peachWorld.z)
    this.motes.showPath(from, to)
  }

  private updateHandoff(dt: number): void {
    const s = this.state
    if (s.phase === 'handoff' && !this.nextBag) {
      const next = layoutForRound(s.round + 1)
      this.nextBag = new PaperBag(makeBagShape(next.bagSeed), makePeachShape(next.peachSeed, s.round + 1))
      const local = new THREE.Vector3(this.layout.peachPos.x + 0.56, this.layout.peachPos.y + 0.05, this.layout.peachPos.z + 0.1)
      this.nextBag.group.position.copy(local)
      this.orchard.branchGroup.add(this.nextBag.group)
      this.nextBagPos.copy(local).applyMatrix4(this.orchard.branchGroup.matrixWorld)
    }
    if (this.nextBag) {
      this.nextBag.hemHint = 0.35 + Math.sin(this.time * 1.4) * 0.3
      this.nextBag.update(dt)
    }
    if (this.pendingSwap) {
      this.swapT += dt
      this.veil.classList.remove('clear')
      if (this.swapT > 0.5) {
        this.pendingSwap = false
        this.startNextRound()
        setTimeout(() => this.veil.classList.add('clear'), 60)
      }
    }
  }

  private startNextRound(): void {
    if (this.nextBag) {
      this.orchard.branchGroup.remove(this.nextBag.group)
      this.nextBag.dispose()
      this.nextBag = null
    }
    this.state = nextRound(this.state)
    this.layout = layoutForRound(this.state.round)
    this.orchard.relayout(this.layout)
    const shape = makePeachShape(this.layout.peachSeed, this.state.round)
    this.peach.reshape(shape)
    this.bag.reshape(makeBagShape(this.layout.bagSeed), shape)
    this.bagFall = 0
    this.bagLanded = false
    this.bag.group.rotation.set(0, 0, 0)
    this.firstLightDone = false
    this.placeRound(this.layout, false)
    this.rig.setSunT(this.state.sunT)
    this.cam.cut(this.shotForPhase())
  }

  private loop = (t: number): void => {
    requestAnimationFrame(this.loop)
    if (!this.running || this.contextLost) {
      this.clockPrev = t
      return
    }
    const frameStart = performance.now()
    const dt = Math.min(MAX_DT, Math.max(0, (t - this.clockPrev) / 1000))
    this.clockPrev = t
    this.time += dt

    const prevPhase = this.state.phase
    tick(this.state, dt)
    if (prevPhase !== 'firstLight' && this.state.phase === 'firstLight') this.onFirstLight()

    this.driveHints(dt)
    this.updateBag(dt)
    this.updateSheetPose()
    this.sheet.update(dt)
    this.rig.setSunT(this.state.sunT)
    this.rig.setTime(this.time)
    this.orchard.updateSun(this.rig)

    const dSim = Math.max(0, this.state.simTime - this.lastSim)
    this.lastSim = this.state.simTime
    this.peach.update(dt, dSim, this.orchard.occluders)
    reportCoverage(this.state, this.peach.blush.coverage)

    this.motes.update(dt, this.time)
    this.updateHandoff(dt)

    this.framingBias += (this.framingBiasGoal - this.framingBias) * Math.min(1, dt * 4)
    const shot = this.shotForPhase()
    if (shot !== this.cam.goalShot) this.cam.moveTo(shot, shot === this.shots.blush ? 2.4 : 1.7)
    shot.lookLift = (shot === this.shots.bag ? 0 : (shot.lookLift ?? 0)) + this.framingBias
    this.cam.update(dt)

    this.renderer.render(this.scene, this.cam.camera)

    this.governor.update(performance.now() - frameStart, dt)
    this.applyRenderScale()

    this.saveAccum += dt
    if (this.saveAccum > 2.5) {
      this.saveAccum = 0
      saveSnapshot(this.state, this.peach.blush.mask, BLUSH_RES_U, BLUSH_RES_V)
    }
  }

  private lastScale = -1
  private applyRenderScale(): void {
    const scale = this.governor.renderScale
    if (Math.abs(scale - this.lastScale) < 0.006) return
    this.lastScale = scale
    this.resize()
  }

  // ---------------------------------------------------------------- lifecycle

  private resize(): void {
    const w = Math.max(1, Math.round(window.innerWidth))
    const h = Math.max(1, Math.round(window.innerHeight))
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dprCap) * this.governor.renderScale
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    if (this.cam) this.cam.setAspect(w / h)
  }

  private bindWindow(): void {
    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', () => {
      this.pointer.cancel()
      setTimeout(onResize, 60)
      setTimeout(onResize, 320)
    })
    window.visualViewport?.addEventListener('resize', onResize)

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pointer.cancel()
        this.sound.suspend()
        saveSnapshot(this.state, this.peach.blush.mask, BLUSH_RES_U, BLUSH_RES_V)
      } else {
        this.sound.resume()
        this.clockPrev = performance.now()
      }
    })

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      this.pointer.cancel()
      this.veil.classList.remove('clear')
    })
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
      this.peach.blush.texture.needsUpdate = true
      this.envRT?.dispose()
      this.pmrem.dispose()
      this.pmrem = new THREE.PMREMGenerator(this.renderer)
      this.envRT = this.pmrem.fromEquirectangular(this.sky)
      this.scene.environment = this.envRT.texture
      this.resize()
      this.clockPrev = performance.now()
      setTimeout(() => this.veil.classList.add('clear'), 200)
    })
  }

  /** Test / tooling hook. */
  debug(): Record<string, unknown> {
    return {
      phase: this.state.phase,
      round: this.state.round,
      coverage: Number(this.state.blushCoverage.toFixed(4)),
      deploy: Number(this.state.sheetDeploy.toFixed(3)),
      lateral: Number(this.state.sheetLateral.toFixed(3)),
      fold: Number(this.state.sheetFold.toFixed(3)),
      sunT: Number(this.state.sunT.toFixed(3)),
      bagPull: Number(this.state.bagPull.toFixed(3)),
      tier: this.tier,
      renderScale: Number(this.governor.renderScale.toFixed(3)),
      hintLevel: this.state.hintLevel,
    }
  }

  /** Test hook: drive the game without a real finger. */
  testApi(): Record<string, (...args: number[]) => void> {
    return {
      bag: (amount: number) => pullBag(this.state, amount),
      sheet: (amount: number) => pullSheet(this.state, amount),
      lateral: (amount: number) => placeSheet(this.state, { lateral: amount }),
      fold: (amount: number) => placeSheet(this.state, { fold: amount }),
      reach: (amount: number) => placeSheet(this.state, { reach: amount }),
      sun: (amount: number) => moveSun(this.state, amount),
      skip: (seconds: number) => {
        for (let i = 0; i < Math.round(seconds / 0.05); i++) {
          tick(this.state, 0.05)
          this.peach.update(0.05, 0, this.orchard.occluders)
          reportCoverage(this.state, this.peach.blush.coverage)
        }
      },
      ripen: (steps: number) => {
        this.updateSheetPose()
        this.sheet.rebuildGeometry()
        this.peach.syncTransform()
        for (let i = 0; i < steps; i++) {
          this.peach.update(0.1, 0.9, this.orchard.occluders)
        }
        reportCoverage(this.state, this.peach.blush.coverage)
      },
    }
  }
}
