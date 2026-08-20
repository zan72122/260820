import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  MeshBasicMaterial,
  PCFShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { BOWL, FLUME, PLAY, SUN_DIR, waterY } from '../config'
import { GameAudio } from '../core/Audio'
import { Input } from '../core/Input'
import { Post } from '../core/Post'
import { Sky } from '../gfx/Sky'
import { makeRng } from '../gfx/noise'
import { Bowl } from '../world/Bowl'
import { Chopsticks } from '../world/Chopsticks'
import { Flume, innerRadius } from '../world/Flume'
import { Garden } from '../world/Garden'
import { Water } from '../world/Water'
import { Bundle, NoodlePool, PATTERNS, Pattern } from '../sim/Noodles'
import { Droplets } from '../sim/Particles'
import { Aim } from './Aim'
import { CameraRig } from './CameraRig'

type Phase = 'opening' | 'firstPass' | 'invite' | 'playing'
type Hold = 'none' | 'follow' | 'carry' | 'release'

const SUN_COLOR = new Color(1.0, 0.945, 0.86)
const SUN_STRENGTH = 1.9
const SKY_AMBIENT = new Color(0.20, 0.25, 0.33)
const GROUND_AMBIENT = new Color(0.11, 0.11, 0.07)

export class Game {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private rig = new CameraRig()
  private post: Post
  private sky: Sky
  private flume: Flume
  private water: Water
  private garden: Garden
  private bowl: Bowl
  private sticks = new Chopsticks()
  private noodles = new NoodlePool(5)
  private drops = new Droplets(190)
  private aim = new Aim()
  private audio = new GameAudio()
  private input = new Input()
  private sun: DirectionalLight

  private width = 1
  private height = 1
  private dpr = 1
  private scale = 1
  private frameAvg = 16
  private qualityTier = 2
  private qualityCooldown = 0
  private qualityLocked = false

  private clock = 0
  private lastT = 0
  private rng = makeRng(9182736)

  // --- director state -----------------------------------------------------
  private phase: Phase = 'opening'
  private nextSpawn = 2.9
  private tutorialIndex = 0
  private captures = 0
  private lastCaptureAt = -99
  private lastGlint = -99
  private trackBundle: Bundle | null = null

  // --- chopstick control --------------------------------------------------
  private aimS = 1.0
  private aimH = 0.17
  private velS = 0
  private velH = 0
  private tip = new Vector3()
  private tipSmooth = new Vector3()
  private hand = new Vector3()
  private hold: Hold = 'none'
  private holdAt = 0
  private held: Bundle | null = null
  private dripAcc = 0
  private lastDripSound = 0
  private stickRippleAt = 0
  private lastTouchAt = -99
  private lastNodeIdx = new Map<Bundle, number>()

  private tmp = new Vector3()
  private tmp2 = new Vector3()
  /** Non-zero when the page asked for a deterministic timestep (?fixed). */
  private fixedStep = 0

  constructor(private container: HTMLElement) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.88
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.renderer.setClearColor(0x0d1410, 1)
    container.appendChild(this.renderer.domElement)

    this.post = new Post(this.renderer)

    const sunDir = new Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize()
    this.sky = new Sky(sunDir)
    this.scene.add(this.sky.mesh)
    this.scene.environment = this.sky.buildEnvironment(this.renderer)
    this.scene.environmentIntensity = 0.9
    this.scene.fog = new FogExp2(0xb6c5d2, 0.020)

    this.sun = new DirectionalLight(SUN_COLOR.getHex(), SUN_STRENGTH)
    this.sun.color.copy(SUN_COLOR)
    this.sun.position.copy(sunDir).multiplyScalar(14).add(new Vector3(0, 0.8, -0.3))
    this.sun.target.position.set(0, 0.8, -0.3)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = -4.4
    sc.right = 4.4
    sc.top = 4.4
    sc.bottom = -4.4
    sc.near = 4
    sc.far = 28
    sc.updateProjectionMatrix()
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.018
    this.scene.add(this.sun, this.sun.target)

    this.flume = new Flume()
    this.scene.add(this.flume.group)

    this.water = new Water(this.flume.innerMaterial.map!)
    this.applyWaterLighting(sunDir)
    this.scene.add(this.water.mesh)

    this.garden = new Garden()
    this.scene.add(this.garden.group)

    this.bowl = new Bowl()
    this.bowl.applyLighting(sunDir, SUN_COLOR.clone().multiplyScalar(SUN_STRENGTH))
    this.scene.add(this.bowl.group)

    this.scene.add(this.sticks.group)
    this.scene.add(this.noodles.group)
    this.scene.add(this.drops.mesh)

    for (const b of this.noodles.bundles) {
      b.applyLighting(sunDir, SUN_COLOR.clone().multiplyScalar(SUN_STRENGTH), SKY_AMBIENT, GROUND_AMBIENT)
    }
    this.drops.applyLighting(sunDir, SUN_COLOR.clone().multiplyScalar(SUN_STRENGTH))

    const q = new URLSearchParams(location.search)
    if (q.has('fixed')) this.fixedStep = Number(q.get('fixed')) || 1 / 30
    if (q.has('quality')) {
      this.qualityTier = Number(q.get('quality'))
      this.qualityLocked = true
      this.applyQuality()
    }
    this.installDebugHooks()

    this.input.attach(this.renderer.domElement, () => this.audio.unlock())
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250))
    this.resize()
  }

  /** A tiny inspection surface so the scene can be checked in a real browser. */
  private installDebugHooks(): void {
    const w = window as unknown as { __somen?: unknown }
    w.__somen = {
      info: () => ({
        clock: +this.clock.toFixed(2),
        phase: this.phase,
        hold: this.hold,
        captures: this.captures,
        shot: this.rig.current,
        bundles: this.noodles.active.map((b) => ({
          p: b.pattern.name,
          s: b.state,
          at: b.centre(new Vector3()).toArray().map((v) => +v.toFixed(2)),
        })),
        ms: +this.frameAvg.toFixed(1),
        tier: this.qualityTier,
        aim: [+this.aimS.toFixed(2), +this.aimH.toFixed(3)],
        cam: this.rig.camera.position.toArray().map((v) => +v.toFixed(3)),
        camFov: +this.rig.camera.fov.toFixed(1),
        subjectDist: this.noodles.active.length
          ? +this.rig.camera.position.distanceTo(this.noodles.active[0].centre(new Vector3())).toFixed(3)
          : -1,
      }),
      cut: (shot: string) => this.rig.cut(shot as never, this.clock),
      skipTo: (phase: Phase) => {
        this.phase = phase
        if (phase !== 'opening') this.revealChopsticks(this.clock)
        this.nextSpawn = this.clock + 0.2
        if (phase === 'playing') this.captures = Math.max(1, this.captures)
      },
      spawn: (i: number, z?: number) => {
        const b = this.noodles.free()
        if (!b) return
        b.spawn(PATTERNS[i % PATTERNS.length], this.clock, z ?? PLAY.spawnZ)
        this.lastNodeIdx.set(b, Math.floor(((z ?? PLAY.spawnZ) - FLUME.nodePhase) / FLUME.nodeSpacing))
      },
      aimTo: (s: number, h: number) => {
        this.aimS = s
        this.aimH = h
      },
      look: (p: number[], t: number[], fov: number) => this.rig.override(p, t, fov),
      vis: (name: string, v: boolean) => {
        const m: Record<string, { visible: boolean }> = {
          water: this.water.mesh,
          flume: this.flume.group,
          garden: this.garden.group,
          bowl: this.bowl.group,
          sticks: this.sticks.group,
        }
        if (m[name]) m[name].visible = v
      },
      noodleMat: (kind: string) => {
        for (const b of this.noodles.bundles) {
          b.mesh.material = kind === 'basic' ? new MeshBasicMaterial({ color: 0xff0000 }) : b.material
        }
      },
      noodleDebug: () => {
        const b = this.noodles.bundles.find((x) => x.state !== 'off')
        if (!b) return 'no active bundle'
        const g = b.mesh.geometry
        const pos = g.getAttribute('position').array as Float32Array
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9
        const n = b.strandCount * 18 * 5
        for (let i = 0; i < n; i++) {
          minX = Math.min(minX, pos[i * 3]); maxX = Math.max(maxX, pos[i * 3])
          minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1])
          minZ = Math.min(minZ, pos[i * 3 + 2]); maxZ = Math.max(maxZ, pos[i * 3 + 2])
        }
        return {
          state: b.state,
          strands: b.strandCount,
          visible: b.mesh.visible,
          drawRange: g.drawRange,
          indexCount: g.getIndex()?.count,
          bbox: [minX, minY, minZ, maxX, maxY, maxZ].map((v) => +v.toFixed(4)),
          matVisible: (b.material as unknown as { visible: boolean }).visible,
          program: !!(b.material as unknown as { program?: unknown }).program,
        }
      },
      screenAt: (sPos: number, h: number) => {
        const p = Aim.point(sPos, h, new Vector3()).project(this.rig.camera)
        return [
          Math.round((p.x * 0.5 + 0.5) * this.width),
          Math.round((-p.y * 0.5 + 0.5) * this.height),
        ]
      },
      bundleScreen: () => {
        const b = this.noodles.active[0]
        if (!b) return null
        const p = b.centre(new Vector3()).project(this.rig.camera)
        return [
          Math.round((p.x * 0.5 + 0.5) * this.width),
          Math.round((-p.y * 0.5 + 0.5) * this.height),
        ]
      },
      post: (bloom: boolean, dof: boolean) => {
        this.post.options.bloom = bloom
        this.post.options.dof = dof
      },
      water: (k: string, v: number) => {
        const u = this.water.material.uniforms[k]
        if (u) u.value = v
      },
      waterDbg: (a: number, b: number, c: number, d: number) => {
        ;(this.water.material.uniforms.uDbg.value as { set: (a: number, b: number, c: number, d: number) => void }).set(a, b, c, d)
      },
      // L = lateral offset, H = height above the water, A = degrees off the
      // flume axis, T = the flume coordinate being framed.
      frame: (L: number, H: number, A: number, T: number, fov: number) => {
        const wy = waterY(T)
        const dz = L / Math.tan((A * Math.PI) / 180)
        this.rig.override([L, wy + H, T + dz], [FLUME.xAt(T), wy - 0.004, T], fov)
        return [L, +(wy + H).toFixed(3), +(T + dz).toFixed(3)]
      },
      free: () => this.rig.clearOverride(),
    }
  }

  private applyWaterLighting(sunDir: Vector3): void {
    const u = this.water.material.uniforms
    ;(u.uSunDir.value as Vector3).copy(sunDir)
    ;(u.uSunColor.value as Color).copy(SUN_COLOR).multiplyScalar(SUN_STRENGTH)
    ;(u.uBedLight.value as Color).setRGB(0.90, 0.88, 0.80)
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.width = w
    this.height = h
    // Never let a 3x phone render 3x pixels; cap the total pixel budget too.
    const raw = Math.min(window.devicePixelRatio || 1, 2.25)
    const budget = 2_300_000
    const cap = Math.sqrt(budget / Math.max(1, w * h))
    this.dpr = Math.min(raw, cap)
    this.applyResolution()
    this.rig.setAspect(w, h)
  }

  private applyResolution(): void {
    const px = Math.round(this.width * this.dpr * this.scale)
    const py = Math.round(this.height * this.dpr * this.scale)
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.width, this.height, true)
    this.renderer.domElement.style.width = `${this.width}px`
    this.renderer.domElement.style.height = `${this.height}px`
    this.post.setSize(px, py)
  }

  // ---------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------

  start(): void {
    const loop = (ms: number) => {
      requestAnimationFrame(loop)
      const t = ms / 1000
      let dt = this.lastT ? t - this.lastT : 1 / 60
      this.lastT = t
      dt = this.fixedStep || Math.min(0.05, Math.max(0.001, dt))
      this.clock += dt
      this.step(dt)
      this.measure(dt)
    }
    requestAnimationFrame(loop)
  }

  private measure(dt: number): void {
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05
    this.qualityCooldown -= dt
    if (this.qualityLocked || this.qualityCooldown > 0 || this.clock < 3) return
    if (this.frameAvg > 21 && this.qualityTier > 0) {
      this.qualityTier--
      this.applyQuality()
      this.qualityCooldown = 2.5
    } else if (this.frameAvg < 13.5 && this.qualityTier < 2) {
      this.qualityTier++
      this.applyQuality()
      this.qualityCooldown = 5
    }
  }

  private applyQuality(): void {
    if (this.qualityTier === 2) {
      this.scale = 1
      this.post.setSamples(4)
      this.post.options.bloom = true
      this.post.options.dof = true
      this.sun.shadow.mapSize.set(2048, 2048)
    } else if (this.qualityTier === 1) {
      this.scale = 0.85
      this.post.setSamples(0)
      this.post.options.bloom = true
      this.post.options.dof = true
      this.sun.shadow.mapSize.set(1024, 1024)
    } else {
      this.scale = 0.68
      this.post.setSamples(0)
      this.post.options.bloom = false
      this.post.options.dof = false
      this.sun.shadow.mapSize.set(1024, 1024)
    }
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    this.applyResolution()
  }

  private step(dt: number): void {
    const t = this.clock
    this.water.update(t)
    this.garden.update(t)
    this.bowl.update(t, dt)
    this.aim.project(this.rig.camera, this.width, this.height)

    this.director(dt, t)
    this.controlChopsticks(dt, t)
    this.simulate(dt, t)
    this.audioTick(t)

    this.rig.update(dt, t)
    this.post.setFocus(this.rig.focusDistance)
    this.sticks.update(t)
    this.input.endFrame()

    this.post.render(this.renderer, this.scene, this.rig.camera)
  }

  // ---------------------------------------------------------------------
  // Director — the whole tutorial is choreography, not text
  // ---------------------------------------------------------------------

  private assistCaptureRadius(b: Bundle): number {
    const learned = Math.min(1, this.captures / 3)
    const base = 0.150 - learned * 0.072
    return base + Math.min(0.030, b.strandCount * 0.0022)
  }

  private assistSnap(): number {
    const learned = Math.min(1, this.captures / 3)
    return 1.0 - learned * 0.58
  }

  private director(dt: number, t: number): void {
    void dt
    const active = this.noodles.active

    switch (this.phase) {
      case 'opening':
        // Just water, sunlight and the sound of the garden.
        if (t >= this.nextSpawn) {
          // The first bundle starts inside the stretch the travelling camera
          // will ride, so the mystery beat lands within the first few seconds.
          this.spawn({ ...PATTERNS[1], strands: 10, spread: 0.0105, speedScale: 0.80 }, t, -4.3)
          if (this.trackBundle) {
            this.trackBundle.centre(this.tmp)
            this.rig.setSubject(this.tmp)
            this.rig.cut('travel', t)
          }
          this.phase = 'firstPass'
        }
        break

      case 'firstPass': {
        const b = this.trackBundle
        if (b && b.state === 'flowing') {
          b.centre(this.tmp)
          this.rig.setSubject(this.tmp)
          if (this.tmp.z > 0.15) {
            this.rig.cut('play', t)
            this.revealChopsticks(t)
            this.phase = 'invite'
            this.nextSpawn = t + 2.4
          }
        } else if (!b) {
          this.rig.cut('play', t)
          this.revealChopsticks(t)
          this.phase = 'invite'
          this.nextSpawn = t + 2.4
        }
        break
      }

      case 'invite': {
        // Keep offering. The only hint is a tiny movement of the chopsticks.
        if (this.hold === 'none' && t - this.lastGlint > 2.6 && !this.input.down) {
          this.lastGlint = t
          this.sticks.flash(t)
        }
        if (t >= this.nextSpawn && active.length < 2) {
          const seq = [PATTERNS[1], PATTERNS[0], PATTERNS[2], PATTERNS[1]]
          const p = { ...seq[this.tutorialIndex % seq.length] }
          this.tutorialIndex++
          // Slower than normal until the idea has landed.
          p.speedScale *= 0.80
          this.spawn(p, t)
          this.nextSpawn = t + 3.6
        }
        if (this.captures > 0) {
          this.phase = 'playing'
          this.nextSpawn = t + 2.2
        }
        break
      }

      case 'playing': {
        if (t >= this.nextSpawn && active.length < 3) {
          this.spawn(this.pickPattern(), t)
          this.nextSpawn = t + 2.4 + this.rng() * 1.7
        }
        // If the player has stopped for a while, offer one quiet reminder.
        if (t - this.lastCaptureAt > 14 && t - this.lastGlint > 6 && this.hold === 'none') {
          this.lastGlint = t
          this.sticks.flash(t)
        }
        break
      }
    }
  }

  private revealChopsticks(t: number): void {
    if (this.sticks.group.visible) return
    this.sticks.group.visible = true
    this.aimS = -0.62
    this.aimH = 0.15
    this.lastGlint = t - 1.6
  }

  private lastPattern = -1
  private pickPattern(): Pattern {
    let i = Math.floor(this.rng() * PATTERNS.length)
    if (i === this.lastPattern) i = (i + 1) % PATTERNS.length
    this.lastPattern = i
    return PATTERNS[i]
  }

  private spawn(p: Pattern, t: number, z: number = PLAY.spawnZ): void {
    const b = this.noodles.free()
    if (!b) return
    b.spawn(p, t, z)
    this.lastNodeIdx.set(b, Math.floor((z - FLUME.nodePhase) / FLUME.nodeSpacing))
    if (this.phase === 'opening' || this.phase === 'firstPass') this.trackBundle = b
  }

  // ---------------------------------------------------------------------
  // Chopsticks
  // ---------------------------------------------------------------------

  private controlChopsticks(dt: number, t: number): void {
    if (!this.sticks.group.visible) return

    // --- where the player is asking for -----------------------------------
    let wantS = this.aimS
    let wantH = this.aimH
    if (this.input.down && this.hold !== 'carry' && this.hold !== 'release') {
      // Lift the chopsticks above the fingertip so the hand never covers the
      // somen it is about to catch.
      const py = this.input.y - this.height * 0.085
      const picked = this.aim.pick(this.input.x, py)
      wantS = picked.s
      wantH = picked.h
    } else if (this.hold === 'none') {
      // Resting pose: hovering just downstream, waiting.
      wantS = -0.62
      wantH = 0.155 + Math.sin(t * 0.9) * 0.006
    }

    if (this.hold === 'follow') {
      // Even a child who does not lift gets the somen out of the water.
      const age = t - this.holdAt
      wantH = Math.max(wantH, 0.02 + Math.min(0.20, age * 0.42))
    }

    // Speed limit + critically damped follow: fast swipes stay graceful.
    const maxS = 5.0
    const maxH = 2.6
    const ds = Math.max(-maxS * dt, Math.min(maxS * dt, wantS - this.aimS))
    const dh = Math.max(-maxH * dt, Math.min(maxH * dt, wantH - this.aimH))
    const omega = 15
    this.velS += (ds / dt) * omega * dt - this.velS * Math.min(1, 2 * omega * dt)
    this.velH += (dh / dt) * omega * dt - this.velH * Math.min(1, 2 * omega * dt)
    this.aimS += this.velS * dt
    this.aimH += this.velH * dt
    this.aimS = Math.max(PLAY.sMin, Math.min(PLAY.sMax, this.aimS))
    this.aimH = Math.max(PLAY.hMin, Math.min(PLAY.hMax, this.aimH))

    Aim.point(this.aimS, this.aimH, this.tip)

    // --- carry: the reward beat plays out on its own ----------------------
    if (this.hold === 'carry' || this.hold === 'release') {
      const age = t - this.holdAt
      const k = Math.min(1, (age - 0.62) / 1.15)
      const e = k * k * (3 - 2 * k)
      this.tmp2.set(BOWL.x, BOWL.liquidY + 0.155, BOWL.z)
      this.tip.lerp(this.tmp2, e)
      this.tip.y += Math.sin(Math.min(1, e) * Math.PI) * 0.055
    }

    if (this.input.down) this.lastTouchAt = t

    // --- soft snap towards whatever is nearby -----------------------------
    // Only while the player is holding on: chopsticks resting by themselves
    // must never catch anything, or the first discovery is stolen from them.
    let closeness = 0
    if (this.hold === 'none' && t - this.lastTouchAt < 0.4) {
      let best: Bundle | null = null
      let bestD = Infinity
      for (const b of this.noodles.active) {
        if (b.state !== 'flowing' || b.captured) continue
        const d = b.nearestNodeDist(this.tip)
        if (d < bestD) {
          bestD = d
          best = b
        }
      }
      if (best) {
        const radius = this.assistCaptureRadius(best)
        const snapR = radius * 2.1
        if (bestD < snapR) {
          const w = 1 - Math.min(1, Math.max(0, (bestD - radius * 0.25) / (snapR - radius * 0.25)))
          closeness = w
          best.grabPoint(this.tmp2)
          this.tip.lerp(this.tmp2, w * this.assistSnap() * 0.85)
        }
        if (bestD < radius) this.capture(best, t)
      }
    }

    // --- pose --------------------------------------------------------------
    this.tipSmooth.lerp(this.tip, 1 - Math.exp(-dt * 34))
    const cam = this.rig.camera
    this.hand
      .set(0.30, -0.30, -0.40)
      .applyQuaternion(cam.quaternion)
      .add(cam.position)
    this.sticks.closedness =
      this.hold === 'none' ? Math.min(0.7, closeness * 0.8) : 1
    this.sticks.place(this.tipSmooth, this.hand)

    // Ripples and a wet sound if the tips are actually in the stream.
    const surface = waterY(this.tipSmooth.z)
    if (
      this.tipSmooth.y < surface + 0.004 &&
      this.tipSmooth.z > PLAY.sMin &&
      this.tipSmooth.z < PLAY.sMax &&
      t - this.stickRippleAt > 0.07
    ) {
      this.stickRippleAt = t
      this.water.addRipple(this.tipSmooth.x, this.tipSmooth.z, 0.7, t)
    }
  }

  private capture(b: Bundle, t: number): void {
    b.grab(this.tipSmooth, t)
    this.held = b
    this.hold = 'follow'
    this.holdAt = t
    this.captures++
    this.lastCaptureAt = t
    this.sticks.closedness = 1
    const pan = this.panOf(this.tipSmooth)
    this.audio.chopstickTick(pan)
    this.audio.lift(pan)
    this.water.addRipple(this.tipSmooth.x, this.tipSmooth.z, 1.6, t)
    b.centre(this.tmp)
    this.drops.burst(this.tmp.x, waterY(this.tmp.z), this.tmp.z, 9, 0.55, this.rng)
    this.rig.setSubject(this.tipSmooth)
    this.rig.cut('lift', t)
    this.dripAcc = 0
  }

  // ---------------------------------------------------------------------
  // Simulation + reward beats
  // ---------------------------------------------------------------------

  private simulate(dt: number, t: number): void {
    const bowlCentre = this.bowl.centre
    const flow = this.water.flowSpeed

    for (const b of this.noodles.active) {
      b.update(dt, t, flow, this.tipSmooth, bowlCentre, BOWL.rim * 0.86)
      b.rebuild()

      if (b.state === 'flowing') {
        b.centre(this.tmp)
        // A wake behind every bundle.
        if (this.rng() < dt * 14) this.water.addRipple(this.tmp.x, this.tmp.z, 0.55, t)
        // The note the water plays when the bundle crosses a culm node.
        const idx = Math.floor((this.tmp.z - FLUME.nodePhase) / FLUME.nodeSpacing)
        const prev = this.lastNodeIdx.get(b)
        if (prev !== undefined && idx > prev) {
          this.lastNodeIdx.set(b, idx)
          if (this.tmp.z > -5.5 && this.tmp.z < PLAY.sMax + 0.6) {
            this.audio.nodePass(this.panOf(this.tmp), Math.min(1, 0.35 + b.strandCount * 0.06))
            this.water.addRipple(this.tmp.x, this.tmp.z, 0.8, t)
          }
        }
        if (this.tmp.z > PLAY.despawnZ) {
          b.kill()
          if (this.trackBundle === b) this.trackBundle = null
        }
      }
    }

    this.holdBeats(dt, t)

    // Droplets: they ring the flume water and the tsuyu when they land.
    this.drops.update(
      dt,
      (x, z) => {
        const dxB = x - BOWL.x
        const dzB = z - BOWL.z
        if (dxB * dxB + dzB * dzB < BOWL.rim * BOWL.rim) return BOWL.liquidY
        if (z < FLUME.zStart || z > FLUME.zEnd) return null
        const half = Math.sqrt(
          Math.max(1e-6, innerRadius(z) ** 2 - (innerRadius(z) - FLUME.waterDepth) ** 2),
        )
        if (Math.abs(x - FLUME.xAt(z)) > half) return null
        return waterY(z)
      },
      (x, y, z, r) => {
        if (Math.abs(y - BOWL.liquidY) < 0.001) {
          this.bowl.splash(x - BOWL.x, z - BOWL.z, 0.7, t)
        } else {
          this.water.addRipple(x, z, 0.5 + r * 60, t)
        }
        if (t - this.lastDripSound > 0.11 && r > 0.0016) {
          this.lastDripSound = t
          this.audio.drip(this.panOf(this.tmp.set(x, y, z)))
        }
      },
    )
  }

  private holdBeats(dt: number, t: number): void {
    const b = this.held
    if (!b) return
    const age = t - this.holdAt

    // Water running off the bundle, thinning out as it dries.
    if (b.state === 'held') {
      const rate = Math.max(0, 26 * Math.exp(-age * 1.5))
      this.dripAcc += rate * dt
      while (this.dripAcc >= 1) {
        this.dripAcc -= 1
        b.lowestNode(this.tmp)
        this.drops.emit(
          this.tmp.x + (this.rng() - 0.5) * 0.012,
          this.tmp.y - 0.002,
          this.tmp.z + (this.rng() - 0.5) * 0.012,
          (this.rng() - 0.5) * 0.05,
          -0.02,
          (this.rng() - 0.5) * 0.05,
          0.0013 + this.rng() * 0.0016,
          1.6,
        )
      }
      this.rig.setSubject(this.tipSmooth)
    }

    if (this.hold === 'follow' && age > 0.62) {
      this.hold = 'carry'
    }
    if (this.hold === 'carry') {
      if (age > 1.15 && this.rig.current !== 'bowl') this.rig.cut('bowl', t)
      if (age > 1.90) {
        this.hold = 'release'
        b.release(t)
        this.sticks.closedness = 0
        this.audio.chopstickTick(this.panOf(this.tipSmooth))
      }
    }
    if (this.hold === 'release') {
      b.centre(this.tmp)
      if (this.tmp.y < BOWL.liquidY + 0.012) {
        b.soak(t)
        this.bowl.splash(this.tmp.x - BOWL.x, this.tmp.z - BOWL.z, 1.5, t)
        this.audio.chapun(this.panOf(this.tmp))
        this.drops.burst(this.tmp.x, BOWL.liquidY, this.tmp.z, 7, 0.35, this.rng)
        this.hold = 'none'
        this.held = null
        this.rig.cut('play', t)
      } else if (age > 3.2) {
        this.hold = 'none'
        this.held = null
        this.rig.cut('play', t)
      }
    }
  }

  // ---------------------------------------------------------------------

  private panOf(p: Vector3): number {
    this.tmp2.copy(p).project(this.rig.camera)
    return Math.max(-1, Math.min(1, this.tmp2.x * 0.8))
  }

  private audioTick(t: number): void {
    if (!this.audio.ready) return
    const s = this.aim.screenOf(0.2)
    this.audio.setStreamPan(((s.x / Math.max(1, this.width)) * 2 - 1) * 0.55)
    this.audio.maybeChime(t)
  }
}
