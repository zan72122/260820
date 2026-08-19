import * as THREE from 'three'
import { CameraDirector, type ShotCtx } from './camera'
import { Combine } from './combine'
import {
  COMBINE,
  HALF_L,
  HALF_W,
  LANE_COUNT,
  PADDY_HALF_L,
  QUALITY,
  TANK,
  laneX,
} from './config'
import { Controls } from './controls'
import { ROAD_X, buildEnvironment, type EnvHandles } from './environment'
import { Field, type CutHit } from './field'
import { GameAudio } from './audio'
import { Hud } from './hud'
import { GrainStream, PourColumn, PuffField, StrawSpray } from './particles'
import { angleDelta, clamp, damp, lerp } from './rng'
import { terrainY } from './terrain'
import { makeCloud, makeGrain, makeGrassland, makePaintRoughness, makePuff, makeSoil } from './textures'
import { Truck } from './truck'

type State =
  | 'intro'
  | 'lowering'
  | 'harvest'
  | 'cutaway'
  | 'turning'
  | 'tankfull'
  | 'trucking'
  | 'augerOut'
  | 'unloading'
  | 'augerIn'
  | 'finished'

/** how many grains one rice hill is worth, for the tally at the end */
const GRAINS_PER_CLUMP = 2200
/** the header must reach this far to clear the last row */
const Z_CUT_END = HALF_L + 0.35
const Z_TURN = Z_CUT_END - COMBINE.headerFront
const Z_START = Z_CUT_END + COMBINE.headerFront
const TRUCK_WAIT_X = ROAD_X + 1.2
const TRUCK_WAIT_Z = -3

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private dir = new CameraDirector()
  private env!: EnvHandles
  private field!: Field
  private combine!: Combine
  private truck!: Truck
  private hud: Hud
  private audio = new GameAudio()
  private controls: Controls

  private grain!: GrainStream
  private pour!: PourColumn
  private straw!: StrawSpray
  private dust!: PuffField
  private smoke!: PuffField
  private worldGroup = new THREE.Group()

  private tex!: {
    soil: ReturnType<typeof makeSoil>
    grain: ReturnType<typeof makeGrain>
    paint: THREE.Texture
    puff: THREE.Texture
    cloud: THREE.Texture
    grass: THREE.Texture
  }

  /* ---- machine state ---- */
  private mx = 0
  private mz = 0
  private mh = 0
  private mSpeed = 0
  private lane = 0
  private laneDir: 1 | -1 = 1
  private lanePass = new Int32Array(LANE_COUNT)
  private steerOffset = 0
  private headerT = 0

  /* ---- game state ---- */
  private state: State = 'intro'
  private stateT = 0
  private tankUnits = 0
  private pending: { at: number; n: number }[] = []
  private loads = 0
  private grainsDelivered = 0
  private cutRate = 0
  private nextCutaway = 6
  private cutawayLeft = 0
  /** the chase shot is broken up with closer looks at the header and the tank */
  private camCycle = 5
  private camMode: 'chase' | 'header' | 'tank' = 'chase'
  private tankPeeked = false
  private nextPrompt = 9
  private seed = 1
  private turn: { pts: THREE.Vector2[]; dur: number; t: number; newLane: number } | null = null

  private clock = new THREE.Clock()
  private now = 0
  private running = true
  private hits: CutHit[] = []
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()
  private tmpC = new THREE.Vector3()
  private shotCtx: ShotCtx = {
    pos: new THREE.Vector3(),
    heading: 0,
    intake: new THREE.Vector3(),
    spout: new THREE.Vector3(),
    truck: new THREE.Vector3(),
    augerSide: -1,
    cutSide: -1,
    roomSide: 1,
    unloadT: 0,
    time: 0,
  }

  /* ---- adaptive quality ---- */
  private frames = 0
  private fpsAcc = 0
  private quality = 2
  private raf = 0

  constructor(
    private canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0xbfcfd6, 1)

    this.hud = new Hud(uiRoot)
    this.controls = new Controls(canvas)
    this.controls.attachKeyboard()
    this.controls.onFirstTouch = () => this.audio.start()
    this.controls.onTouchChange = (a, x, y) => this.hud.setTouch(a, x, y)
    this.hud.onAction = (k) => this.onAction(k)
    this.hud.onSound = (on) => this.audio.setMuted(!on)
  }

  /* ------------------------------ build ------------------------------ */

  async build() {
    // `?fx=low` keeps the software renderer in CI usable; it is never on for players
    const q = new URLSearchParams(location.search)
    if (q.get('fx') === 'low') {
      this.quality = 1
      this.renderer.shadowMap.enabled = false
    }
    this.tex = {
      soil: makeSoil(256),
      grain: makeGrain(256),
      paint: makePaintRoughness(256),
      puff: makePuff(128),
      cloud: makeCloud(256),
      grass: makeGrassland(256),
    }
    this.tex.paint.repeat.set(3, 3)

    this.scene.add(this.worldGroup)
    this.env = buildEnvironment(this.scene, this.tex.cloud, this.tex.grass)

    this.combine = new Combine(this.tex.paint, this.tex.grain.color.clone())
    this.worldGroup.add(this.combine.root)

    this.truck = new Truck(this.tex.grain.color.clone())
    this.worldGroup.add(this.truck.root)

    this.grain = new GrainStream(QUALITY.maxGrains)
    this.straw = new StrawSpray(QUALITY.maxStraw)
    this.dust = new PuffField(QUALITY.maxChaff, this.tex.puff, 0xdccfb4)
    this.smoke = new PuffField(46, this.tex.puff, 0x8b867c)
    this.pour = new PourColumn(this.tex.grain.color)
    this.worldGroup.add(this.grain.mesh, this.straw.mesh, this.dust.mesh, this.smoke.mesh, this.pour.mesh)

    this.newField(Math.floor(Math.random() * 1e6) + 1)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', this.onResize)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden
      if (this.running) this.clock.getDelta()
    })
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      cancelAnimationFrame(this.raf)
    })
    this.canvas.addEventListener('webglcontextrestored', () => {
      // canvas-backed textures do not survive the loss; force a re-upload
      this.field.refreshLod(this.mx, this.mz, this.now, true)
      this.field.reupload()
      this.clock.getDelta()
      this.loop()
    })
    this.onResize()
  }

  private newField(seed: number) {
    this.seed = seed
    if (this.field) {
      this.worldGroup.remove(this.field.group)
      this.field.dispose()
    }
    this.field = new Field(seed, this.tex.soil)
    this.worldGroup.add(this.field.group)
    this.field.laneThreshold = 6

    this.lane = 0
    this.laneDir = 1
    this.lanePass.fill(0)
    this.mx = laneX(0)
    this.mz = -Z_START
    this.mh = 0
    this.mSpeed = 0
    this.steerOffset = 0
    this.headerT = 0
    this.tankUnits = 0
    this.pending.length = 0
    this.loads = 0
    this.grainsDelivered = 0
    this.cutRate = 0
    this.nextCutaway = 6
    this.cutawayLeft = 0
    this.turn = null
    this.combine.tankFill = 0
    this.combine.augerOut = 0
    this.combine.headerDown = 0
    this.combine.setCutaway(0)
    this.grain.clear()
    this.straw.clear()
    this.dust.clear()
    this.smoke.clear()
    this.truck.fill = 0
    this.truck.place(TRUCK_WAIT_X, TRUCK_WAIT_Z, Math.PI)
    this.applyMachine()
    this.field.refreshLod(this.mx, this.mz, 0, true)

    this.setState('intro')
    this.hud.hideFinish()
    this.hud.setTank(0)
    this.hud.setProgress(0)
    this.dir.setShot('establish')
    this.dir.teleport(this.buildShotCtx())
  }

  /* ------------------------------ input ------------------------------ */

  private onAction(k: 'lower' | 'auger' | 'unload' | 'again') {
    this.audio.start()
    if (k === 'lower' && this.state === 'intro') {
      this.audio.clunk()
      this.setState('lowering')
      this.hud.setAction(null)
    } else if (k === 'auger' && this.state === 'trucking') {
      this.audio.clunk()
      this.setState('augerOut')
      this.hud.setAction(null)
    } else if (k === 'unload' && this.state === 'augerOut') {
      this.audio.blip()
      this.setState('unloading')
      this.hud.setAction(null)
      this.hud.showBanner('rice', 'ザーーッ')
    } else if (k === 'again') {
      this.audio.blip()
      this.hud.setAction(null)
      this.newField((this.seed * 7919 + 13) % 1000000 || 7)
    }
  }

  private onResize = () => {
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.dir.resize(w, h)
    document.documentElement.style.setProperty(
      '--ui-scale',
      String(clamp(Math.min(w, h) / 390, 0.86, 1.35)),
    )
  }

  /* --------------------------- state machine -------------------------- */

  private setState(s: State) {
    this.state = s
    this.stateT = 0
    switch (s) {
      case 'intro':
        this.dir.setShot('establish')
        this.nextPrompt = 9
        this.hud.setAction('lower')
        this.hud.setSteerHint(false)
        this.hud.showBanner('lower', 'ヘッダを さげよう')
        break
      case 'lowering':
        this.dir.setShot('header')
        break
      case 'harvest':
        this.dir.setShot('harvest')
        this.camMode = 'chase'
        this.camCycle = 5
        break
      case 'cutaway':
        this.dir.setShot('cutaway', true)
        this.cutawayLeft = 3.8
        this.hud.showBanner('rice', 'なかで お米を わけているよ')
        break
      case 'turning':
        this.dir.setShot('turn')
        break
      case 'tankfull':
        this.dir.setShot('tank')
        this.hud.showBanner('tankFull', 'タンクが いっぱい！')
        this.audio.chime(0)
        this.chooseAugerSide()
        this.sendTruck()
        break
      case 'trucking':
        this.dir.setShot('unload')
        break
      case 'augerOut':
        this.dir.setShot('unload')
        break
      case 'unloading':
        this.dir.setShot('unload')
        break
      case 'augerIn':
        this.truck.driveTo(TRUCK_WAIT_X, TRUCK_WAIT_Z, Math.PI)
        break
      case 'finished':
        this.dir.setShot('finish', true)
        this.hud.setAction(null)
        this.hud.showFinish(this.loads, this.grainsDelivered)
        this.audio.fanfare()
        break
    }
  }

  /**
   * The auger always swings out over ground the machine has already cut,
   * so the truck parks on clean stubble and the shot is never buried in
   * standing crop.
   */
  private chooseAugerSide() {
    this.combine.augerSide = Math.cos(this.mh) >= 0 ? -1 : 1
  }

  private truckTarget(out: THREE.Vector2) {
    const side = this.combine.augerSide
    const rx = Math.cos(this.mh)
    const rz = -Math.sin(this.mh)
    const fx = Math.sin(this.mh)
    const fz = Math.cos(this.mh)
    out.set(this.mx + rx * side * 3.3 - fx * 0.85, this.mz + rz * side * 3.3 - fz * 0.85)
  }

  private tv = new THREE.Vector2()
  private sendTruck() {
    this.truckTarget(this.tv)
    this.truck.driveTo(this.tv.x, this.tv.y, this.mh)
  }

  /* ------------------------------- drive ------------------------------ */

  private applyMachine() {
    this.combine.root.position.set(this.mx, terrainY(this.mx, this.mz), this.mz)
    this.combine.root.rotation.y = this.mh
    // ride the undulation: pitch and roll follow the mud under the tracks
    const f = 1.3
    const ahead = terrainY(this.mx + Math.sin(this.mh) * f, this.mz + Math.cos(this.mh) * f)
    const behind = terrainY(this.mx - Math.sin(this.mh) * f, this.mz - Math.cos(this.mh) * f)
    const rgt = terrainY(this.mx + Math.cos(this.mh) * 0.8, this.mz - Math.sin(this.mh) * 0.8)
    const lft = terrainY(this.mx - Math.cos(this.mh) * 0.8, this.mz + Math.sin(this.mh) * 0.8)
    this.combine.root.rotation.x = -Math.atan2(ahead - behind, f * 2)
    this.combine.root.rotation.z = Math.atan2(rgt - lft, 1.6)
    this.combine.root.rotation.order = 'YXZ'
  }

  private laneBaseHeading() {
    return this.laneDir > 0 ? 0 : Math.PI
  }

  private driveAlongLane(dt: number, allowPlayer: boolean) {
    // How far the player may wander shrinks with each repeat pass, so a
    // finger held to one side can never leave a strip the machine will not
    // reach on the next run down the row.
    const room = [0.62, 0.3, 0][Math.min(2, this.lanePass[this.lane])]
    if (allowPlayer && this.controls.active && room > 0) {
      this.steerOffset = clamp(this.steerOffset + this.controls.steer * 1.15 * dt, -room, room)
    } else {
      this.steerOffset = damp(this.steerOffset, 0, room > 0 ? 1.1 : 2.4, dt)
    }
    const target = laneX(this.lane) + this.steerOffset
    // cross-track controller: aim the nose back at the row
    const err = clamp((target - this.mx) * 0.55, -0.55, 0.55)
    const want = this.laneBaseHeading() + (this.laneDir > 0 ? err : -err)
    const turn = clamp(angleDelta(this.mh, want) * 2.8, -1, 1)
    this.mh += turn * COMBINE.turnRate * dt
    this.mSpeed = damp(this.mSpeed, COMBINE.speed, 2.2, dt)
    this.mx += Math.sin(this.mh) * this.mSpeed * dt
    this.mz += Math.cos(this.mh) * this.mSpeed * dt
    this.mx = clamp(this.mx, -HALF_W - 0.6, HALF_W + 0.6)
    this.mz = clamp(this.mz, -PADDY_HALF_L + 0.4, PADDY_HALF_L - 0.4)
  }

  private harvestStep(dt: number, allowPlayer: boolean) {
    const px = this.mx
    const pz = this.mz
    this.driveAlongLane(dt, allowPlayer)
    const travel = Math.hypot(this.mx - px, this.mz - pz)

    this.headerT = damp(this.headerT, 1, 6, dt)
    this.combine.headerDown = this.headerT
    this.combine.speedFrac = this.mSpeed / COMBINE.speed

    const hx = this.mx + Math.sin(this.mh) * COMBINE.headerFront
    const hz = this.mz + Math.cos(this.mh) * COMBINE.headerFront
    let n = 0
    if (this.headerT > 0.6) {
      this.hits.length = 0
      n = this.field.cut(
        hx,
        hz,
        this.mh,
        COMBINE.headerWidth / 2 + 0.07,
        Math.max(0.45, travel * 0.5 + 0.45),
        this.now,
        this.hits,
      )
      if (n > 0) {
        this.pending.push({ at: this.now + TANK.throughputDelay, n })
        this.field.paintCut(
          hx - Math.sin(this.mh) * travel * 0.5,
          hz - Math.cos(this.mh) * travel * 0.5,
          this.mh,
          COMBINE.headerWidth / 2 + 0.06,
          travel + COMBINE.headerDepth,
        )
      }
    }
    this.field.paintTracks(
      this.mx - Math.sin(this.mh) * travel * 0.5,
      this.mz - Math.cos(this.mh) * travel * 0.5,
      this.mh,
      0.76,
      travel + 0.7,
    )
    this.cutRate = damp(this.cutRate, n / Math.max(dt, 1e-3) / 90, 5, dt)

    // chaff at the mouth of the header, dust off the crawlers, straw out the back
    if (n > 0) this.dust.stream(hx, 0.95, hz, 12, dt, 0.6)
    if (this.mSpeed > 0.5) {
      this.dust.stream(
        this.mx - Math.sin(this.mh) * 1.3,
        0.18,
        this.mz - Math.cos(this.mh) * 1.3,
        5,
        dt,
        0.5,
      )
      this.straw.emit(
        this.tmpA.set(
          this.mx - Math.sin(this.mh) * 2.35,
          0.95,
          this.mz - Math.cos(this.mh) * 2.35,
        ),
        this.tmpB.set(-Math.sin(this.mh), 0, -Math.cos(this.mh)),
        n > 0 ? 26 : 0,
        dt,
      )
    }

    // has this lane run out, or the pass reached the headland?
    const done = this.laneDir > 0 ? this.mz >= Z_TURN : this.mz <= -Z_TURN
    if (done) this.beginTurn()
  }

  private beginTurn() {
    const remaining = this.field.laneRemaining[this.lane]
    let target = this.lane
    this.lanePass[this.lane]++
    if (remaining <= this.field.laneThreshold || this.lanePass[this.lane] >= 3) {
      // four runs and still standing means something is wrong; leave it
      if (this.lanePass[this.lane] >= 4) this.field.laneBlocked[this.lane] = 1
      const nl = this.field.nextLane(this.mx, this.lane)
      if (nl < 0) {
        // the paddy is done — empty the tank, then celebrate
        this.headerT = 0
        this.combine.headerDown = 0
        this.mSpeed = 0
        if (this.tankUnits > 12) this.setState('tankfull')
        else this.setState('finished')
        return
      }
      target = nl
    }

    const x0 = this.mx
    const z0 = this.mz
    const x1 = laneX(target)
    const dirSign = this.laneDir
    const z1 = dirSign * Z_START
    const t0 = new THREE.Vector2(Math.sin(this.mh), Math.cos(this.mh)).multiplyScalar(6.6)
    const t1 = new THREE.Vector2(-Math.sin(this.mh), -Math.cos(this.mh)).multiplyScalar(6.6)
    const p0 = new THREE.Vector2(x0, z0)
    const p1 = new THREE.Vector2(x1, z1)
    const pts: THREE.Vector2[] = []
    const N = 24
    let len = 0
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1
      const h10 = t ** 3 - 2 * t ** 2 + t
      const h01 = -2 * t ** 3 + 3 * t ** 2
      const h11 = t ** 3 - t ** 2
      const v = new THREE.Vector2(
        h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
        h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
      )
      if (i > 0) len += v.distanceTo(pts[i - 1])
      pts.push(v)
    }
    this.turn = { pts, dur: Math.max(2.0, len / 3.4), t: 0, newLane: target }
    this.setState('turning')
  }

  private turnStep(dt: number) {
    const T = this.turn
    if (!T) {
      this.setState('harvest')
      return
    }
    T.t += dt
    const u = clamp(T.t / T.dur, 0, 1)
    // header up over the headland, back down as the next row comes up
    this.headerT = damp(this.headerT, u > 0.82 ? 1 : 0, 5, dt)
    this.combine.headerDown = this.headerT
    this.combine.speedFrac = 0.75

    const f = u * (T.pts.length - 1)
    const i = Math.min(T.pts.length - 2, Math.floor(f))
    const k = f - i
    const a = T.pts[i]
    const b = T.pts[i + 1]
    const nx = lerp(a.x, b.x, k)
    const nz = lerp(a.y, b.y, k)
    const dx = nx - this.mx
    const dz = nz - this.mz
    if (dx * dx + dz * dz > 1e-6) this.mh += angleDelta(this.mh, Math.atan2(dx, dz)) * Math.min(1, dt * 7)
    this.mx = nx
    this.mz = nz
    this.field.paintTracks(this.mx, this.mz, this.mh, 0.76, 0.9)
    this.dust.stream(this.mx - Math.sin(this.mh) * 1.3, 0.18, this.mz - Math.cos(this.mh) * 1.3, 7, dt, 0.55)

    if (u >= 1) {
      this.lane = T.newLane
      this.laneDir = this.laneDir > 0 ? -1 : 1
      this.mh = this.laneBaseHeading()
      this.steerOffset = 0
      this.turn = null
      if (this.tankUnits >= TANK.capacity) this.setState('tankfull')
      else this.setState('harvest')
    }
  }

  /** Keeps the chase shot from going stale: a look at the header, then at the tank. */
  private cycleShots(dt: number) {
    if (!this.tankPeeked && this.tankUnits / TANK.capacity > 0.55) {
      this.tankPeeked = true
      this.camMode = 'tank'
      this.camCycle = 2.7
      this.dir.setShot('tank', true)
      return
    }
    this.camCycle -= dt
    if (this.camCycle > 0) return
    if (this.camMode === 'chase') {
      this.camMode = 'header'
      this.camCycle = 3.6
      this.dir.setShot('header', true)
    } else {
      this.camMode = 'chase'
      this.camCycle = 11
      this.dir.setShot('harvest', true)
    }
  }

  /* ----------------------------- unloading ---------------------------- */

  private unloadStep(dt: number) {
    const rate = TANK.capacity / 4.4
    const before = this.tankUnits
    this.tankUnits = Math.max(0, this.tankUnits - rate * dt)
    const moved = before - this.tankUnits
    this.grainsDelivered += Math.round(moved * GRAINS_PER_CLUMP)

    this.combine.worldSpout(this.tmpA)
    this.truck.binTop(this.tmpB)
    const strength = clamp(this.tankUnits > 0 ? 1 : 0, 0, 1)
    this.pour.set(this.tmpA, this.tmpB, strength, dt)
    if (strength > 0) {
      this.tmpC.copy(this.tmpB).sub(this.tmpA).normalize()
      this.grain.emit(this.tmpA, this.tmpC, 2.1, 700, dt, 0.85)
      this.truck.addGrain((moved / TANK.capacity) * 0.24)
      this.dust.stream(this.tmpB.x, this.tmpB.y + 0.1, this.tmpB.z, 9, dt, 0.5)
      this.dir.kick(dt * 0.5)
    }
    this.grain.update(dt, this.tmpB.y - 0.05)
    this.audio.setPour(strength)

    if (this.tankUnits <= 0.5) {
      this.tankUnits = 0
      this.tankPeeked = false
      this.loads++
      this.audio.setPour(0)
      this.audio.chime(1)
      this.hud.showBanner('truck', 'つみこみ かんりょう！')
      this.setState('augerIn')
    }
  }

  /* ------------------------------- loop ------------------------------- */

  private buildShotCtx(): ShotCtx {
    const c = this.shotCtx
    c.pos.set(this.mx, terrainY(this.mx, this.mz), this.mz)
    c.heading = this.mh
    this.combine.worldIntake(c.intake)
    this.combine.worldSpout(c.spout)
    c.truck.set(this.truck.x, 0, this.truck.z)
    c.augerSide = this.combine.augerSide
    // lanes are worked from -X to +X, so the opened ground is always world -X;
    // express that along the machine's local +X so the shots can use it
    c.cutSide = Math.cos(this.mh) >= 0 ? -1 : 1
    // whichever local side has more paddy left before the bank
    const roomWorld = this.mx > 0 ? -1 : 1
    c.roomSide = Math.cos(this.mh) >= 0 ? roomWorld : -roomWorld
    c.unloadT = this.state === 'unloading' ? clamp(this.stateT / 4.4, 0, 1) : 0
    c.time = this.now
    return c
  }

  start() {
    this.clock.start()
    this.loop()
  }

  private tick(dt: number) {
    this.now += dt
    this.stateT += dt
    this.step(dt)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    let dt = this.clock.getDelta()
    if (!this.running) return
    dt = Math.min(dt, 1 / 20)
    this.tick(dt)
    this.renderer.render(this.scene, this.dir.camera)
    this.trackPerf(dt)
  }

  private step(dt: number) {
    switch (this.state) {
      case 'intro':
        this.combine.speedFrac = 0
        this.headerT = damp(this.headerT, 0, 4, dt)
        this.combine.headerDown = this.headerT
        // nobody has pressed it yet: say so again rather than sit silent
        if (this.stateT > this.nextPrompt) {
          this.nextPrompt += 9
          this.hud.showBanner('lower', 'ヘッダを さげよう')
        }
        break
      case 'lowering':
        this.headerT = damp(this.headerT, 1, 4.5, dt)
        this.combine.headerDown = this.headerT
        this.combine.speedFrac = damp(this.combine.speedFrac, 0.25, 3, dt)
        if (this.stateT > 1.35) {
          this.setState('harvest')
          this.hud.showBanner('cut', 'いねを かるよ！')
        }
        break
      case 'harvest':
        this.harvestStep(dt, true)
        this.cycleShots(dt)
        // Send the receiver over before the tank is quite full, so the
        // truck is rolling into place while the last rows go in.
        if (this.tankUnits > TANK.capacity * 0.82) {
          this.chooseAugerSide()
          this.sendTruck()
        }
        this.nextCutaway -= dt
        if (this.nextCutaway <= 0 && this.field.standing > 40) {
          this.nextCutaway = 34
          this.setState('cutaway')
        }
        break
      case 'cutaway':
        this.harvestStep(dt, false)
        this.cutawayLeft -= dt
        this.combine.setCutaway(clamp(Math.min(this.stateT * 2.6, this.cutawayLeft * 2.6), 0, 1))
        this.audio.setThresh(1)
        if (this.cutawayLeft <= 0) {
          this.combine.setCutaway(0)
          this.audio.setThresh(0)
          this.dir.setShot('harvest', true)
          this.setState('harvest')
        }
        break
      case 'turning':
        this.turnStep(dt)
        break
      case 'tankfull':
        this.mSpeed = damp(this.mSpeed, 0, 4, dt)
        this.combine.speedFrac = damp(this.combine.speedFrac, 0, 3, dt)
        this.headerT = damp(this.headerT, 0.15, 3, dt)
        this.combine.headerDown = this.headerT
        if (this.stateT > 1.4) this.setState('trucking')
        break
      case 'trucking':
        this.combine.speedFrac = damp(this.combine.speedFrac, 0, 3, dt)
        if (this.truck.nearlyThere || this.stateT > 7) this.hud.setAction('auger')
        break
      case 'augerOut':
        this.combine.augerOut = damp(this.combine.augerOut, 1, 2.6, dt)
        if (this.stateT > 1.5) this.hud.setAction('unload')
        break
      case 'unloading':
        this.combine.augerOut = damp(this.combine.augerOut, 1, 3, dt)
        this.unloadStep(dt)
        break
      case 'augerIn':
        this.combine.augerOut = damp(this.combine.augerOut, 0, 2.4, dt)
        if (this.stateT > 1.6) {
          if (this.truck.fill > 0.9) this.truck.fill = 0
          if (this.field.nextLane(this.mx) < 0) this.setState('finished')
          else this.setState('harvest')
        }
        break
      case 'finished':
        this.combine.speedFrac = damp(this.combine.speedFrac, 0, 2, dt)
        this.mSpeed = 0
        break
    }

    // grain arriving in the tank a beat after it was cut
    while (this.pending.length && this.pending[0].at <= this.now) {
      const p = this.pending.shift()!
      if (this.state !== 'unloading') this.tankUnits = Math.min(TANK.capacity, this.tankUnits + p.n)
    }
    const fill = this.tankUnits / TANK.capacity
    this.combine.tankFill = fill
    this.hud.setTank(fill)
    this.hud.setProgress(this.state === 'finished' ? 1 : Math.min(1, this.field.progress * 1.03))

    if (
      this.tankUnits >= TANK.capacity &&
      (this.state === 'harvest' || this.state === 'cutaway')
    ) {
      this.combine.setCutaway(0)
      this.audio.setThresh(0)
      this.setState('tankfull')
    }

    this.applyMachine()
    this.combine.update(dt, this.now)
    // Everything that reads a world position off the machine — the spout,
    // the header intake, the exhaust — needs the matrices current, and the
    // renderer would only refresh them after this point.
    this.combine.root.updateMatrixWorld(true)
    this.truck.update(
      dt,
      this.now,
      this.state === 'tankfull' || this.state === 'trucking',
      this.state === 'augerIn' && this.stateT < 2.6,
    )
    this.field.update(dt, this.now)
    this.field.refreshLod(
      this.mx + Math.sin(this.mh) * 3,
      this.mz + Math.cos(this.mh) * 3,
      this.now,
    )

    if (this.state !== 'unloading') {
      this.pour.set(this.tmpA, this.tmpB, 0, dt)
      this.grain.update(dt, -5)
      this.audio.setPour(0)
    }
    // exhaust: harder under load, idling when the machine is stopped
    if (this.state !== 'intro') {
      this.combine.worldStack(this.tmpA)
      this.smoke.stream(this.tmpA.x, this.tmpA.y, this.tmpA.z, 2 + this.combine.speedFrac * 6, dt, 0.3)
    }
    this.straw.update(dt)
    this.dust.update(dt, this.dir.camera.quaternion)
    this.smoke.update(dt, this.dir.camera.quaternion)

    const ctx = this.buildShotCtx()
    this.env.update(dt, ctx.pos)
    this.dir.update(dt, ctx)

    // the steering affordance belongs to exactly one situation: driving
    // the chase shot with nothing else asked of the player
    const steering = this.state === 'harvest' && this.camMode === 'chase'
    this.hud.setSteerHint(steering)
    this.hud.setSteer(steering && this.controls.active ? this.controls.steer : 0)
    const driving = this.state === 'harvest' || this.state === 'cutaway' || this.state === 'turning'
    this.audio.setEngine(driving ? this.combine.speedFrac : 0.1, this.state !== 'intro')
    this.audio.setCut(driving ? clamp(this.cutRate, 0, 1) * this.headerT : 0)
  }

  private slowWindows = 0

  private trackPerf(dt: number) {
    this.frames++
    this.fpsAcc += dt
    // ignore the first seconds: shader compilation and texture upload make
    // the opening frames slow on every device, and that is not a verdict
    if (this.now < 6) {
      this.frames = 0
      this.fpsAcc = 0
      return
    }
    if (this.fpsAcc >= 2.5) {
      const fps = this.frames / this.fpsAcc
      this.frames = 0
      this.fpsAcc = 0
      if (fps >= 42) {
        this.slowWindows = 0
        return
      }
      if (++this.slowWindows < 2) return
      this.slowWindows = 0
      if (fps < 42 && this.quality > 1) {
        this.quality = this.quality === 2 ? 1.5 : 1
        this.onResize()
      } else if (fps < 38 && this.field.nearBudgetIsFull) {
        this.field.setDetailBudget(QUALITY.nearCap * 0.45)
      } else if (fps < 32 && this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false
        this.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.material) {
            const mm = m.material as THREE.Material | THREE.Material[]
            if (Array.isArray(mm)) mm.forEach((x) => (x.needsUpdate = true))
            else mm.needsUpdate = true
          }
        })
      }
    }
  }

  /** Runs the simulation without drawing, so a test can play a whole round. */
  debugAdvance(seconds: number, dt = 1 / 60) {
    const steps = Math.min(60 * 60 * 10, Math.round(seconds / dt))
    for (let i = 0; i < steps; i++) this.tick(dt)
  }

  debugStats() {
    const i = this.renderer.info
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      programs: i.programs?.length ?? 0,
      textures: i.memory.textures,
      geometries: i.memory.geometries,
      pixelRatio: this.renderer.getPixelRatio(),
      shadows: this.renderer.shadowMap.enabled,
    }
  }

  debugCamera() {
    const c = this.dir.camera
    return { shot: this.dir.shot, x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov }
  }

  /** exposed for the smoke tests */
  debugState() {
    return {
      state: this.state,
      standing: this.field.standing,
      total: this.field.count,
      tank: this.tankUnits / TANK.capacity,
      loads: this.loads,
      lane: this.lane,
      x: this.mx,
      z: this.mz,
      progress: this.field.progress,
      truckFill: this.truck.fill,
      grains: this.grainsDelivered,
    }
  }

  /** test hook: pretend the player pressed the on-screen button */
  debugAction(k: 'lower' | 'auger' | 'unload' | 'again') {
    this.onAction(k)
  }
}
