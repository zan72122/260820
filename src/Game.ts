import {
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Scene,
  Vector3,
} from 'three'
import { AudioEngine } from './audio/AudioEngine'
import { GameState } from './core/GameState'
import { LightingState } from './core/Lighting'
import { Input } from './input/Input'
import { CameraRig } from './render/CameraRig'
import { Renderer } from './render/Renderer'
import { ClockMachine } from './scene/ClockMachine'
import { LightRig } from './scene/Lights'
import { Park } from './scene/Park'
import { Sky } from './scene/Sky'
import { Town } from './scene/Town'
import { Swing } from './scene/Swing'
import { Pendulum } from './sim/Pendulum'
import { Hint } from './ui/Hint'
import { clamp, damp } from './util/math'

const SAVE_KEY = 'moon-pendulum-clock/v1'

/** Where the machine stands, and where its sensor mast watches the swing from. */
/** Near field: the swing bay, set at an angle so its arc reads across the frame. */
const SWING_POS = new Vector3(-3.1, 0, 0.9)
const SWING_YAW = -0.75
/** Middle ground: the machine, well clear of the swing's arc. */
const CLOCK_POS = new Vector3(0.4, 0, -6.0)
/** Heading that turns the dial towards the authored viewpoint. */
const CLOCK_YAW = 0.28
/** The machine is scaled up: this is a public sculpture, not a station clock. */
const CLOCK_SCALE = 1.45
/**
 * The sensor mast, in the machine's local frame. It stands beside the swing,
 * outside the arc, and watches the seat go past without touching it.
 */
const SENSOR_LOCAL = new Vector3(-0.68, 0, 2.13)
/** What the sensor head is pointed at: the swing's pivot, in the machine's frame. */
const SENSOR_AIM = new Vector3(-3.63, 0, 3.91)

export class Game {
  readonly scene = new Scene()
  private rig = new CameraRig()
  private renderer: Renderer
  private lightRig = new LightRig()

  private state = new GameState()
  private L = new LightingState()
  private pendulum: Pendulum
  private swing: Swing
  private clock: ClockMachine
  private park: Park
  private town: Town
  private sky: Sky
  private hint: Hint
  private audio = new AudioEngine()
  private input: Input

  private hemi: HemisphereLight
  private sun: DirectionalLight
  private moonLight: DirectionalLight
  private fill: DirectionalLight
  private fog: FogExp2

  private windTimer = 1.4
  private stageTimer = 0
  private breathPulse = 0
  private finaleTimer = 0
  private running = true
  private last = 0
  private replayEl: HTMLButtonElement | null = null
  private tmpV = new Vector3()
  /** Ignition level of the clock's own dial lamp, driven through the light rig. */
  private clockDialLevel = 0

  constructor(canvas: HTMLCanvasElement, private overlay: HTMLElement) {
    this.renderer = new Renderer(canvas)
    if (!this.renderer.supported) throw new Error('no-webgl')

    // --- simulation ---------------------------------------------------------
    this.pendulum = new Pendulum({
      bottomPass: (e) => this.onBottomPass(e.dir, e.speed, e.amplitude),
      apex: (e) => this.audio.chainCreak(e.amplitude),
    })

    // --- world --------------------------------------------------------------
    this.swing = new Swing(this.pendulum)
    this.swing.group.position.set(SWING_POS.x, 0, SWING_POS.z)
    this.swing.group.rotation.y = SWING_YAW

    this.clock = new ClockMachine(SENSOR_LOCAL, SENSOR_AIM)
    this.clock.group.position.copy(CLOCK_POS)
    this.clock.group.rotation.y = CLOCK_YAW
    this.clock.group.scale.setScalar(CLOCK_SCALE)
    this.clock.group.updateWorldMatrix(true, true)

    this.park = new Park(this.lightRig)
    this.town = new Town(this.lightRig)
    this.sky = new Sky(this.renderer.pixelScale)

    // The gesture hint lives inside the bay, so it always lies along the real arc.
    this.hint = new Hint(this.swing.pivot, this.pendulum.length)
    this.swing.group.add(this.hint.group)

    const world = new Group()
    world.add(
      this.park.group,
      this.town.group,
      this.swing.group,
      this.clock.group,
      this.lightRig.root,
    )
    this.scene.add(world, this.sky.group)

    // --- lights -------------------------------------------------------------
    this.hemi = new HemisphereLight(new Color('#a8bcdf'), new Color('#7a6350'), 1)
    this.scene.add(this.hemi)

    this.sun = new DirectionalLight(new Color('#ffd0a0'), 1)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -16
    this.sun.shadow.camera.right = 16
    this.sun.shadow.camera.top = 16
    this.sun.shadow.camera.bottom = -12
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 90
    this.sun.shadow.bias = -0.0009
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)

    this.moonLight = new DirectionalLight(new Color('#9fb4e6'), 0)
    this.moonLight.shadow.mapSize.set(1024, 1024)
    this.moonLight.shadow.camera.left = -16
    this.moonLight.shadow.camera.right = 16
    this.moonLight.shadow.camera.top = 16
    this.moonLight.shadow.camera.bottom = -12
    this.moonLight.shadow.camera.near = 1
    this.moonLight.shadow.camera.far = 90
    this.moonLight.shadow.bias = -0.0012
    this.moonLight.shadow.normalBias = 0.04
    this.scene.add(this.moonLight, this.moonLight.target)

    // A soft fill from behind the camera. It exists for one reason: the child must
    // still be able to read the swing, the rider and the clock after dark.
    this.fill = new DirectionalLight(new Color('#8fa2c6'), 0)
    this.scene.add(this.fill)

    this.fog = new FogExp2(0xc8a08c, 0.006)
    this.scene.fog = this.fog

    // --- input --------------------------------------------------------------
    this.input = new Input(canvas)
    this.input.onFirstTouch = () => void this.audio.unlock()
    this.input.onSwipe = (e) => this.onSwipe(e.length, e.alignment)

    // The dial lamp is a fixture like any other, so it gets the same warm-up
    // flicker and the same place in the ignition order as the park lamps.
    this.lightRig.add({
      group: 'clockDial',
      index: 0,
      position: this.clock.dialWorldPosition(),
      color: new Color('#ffdca8'),
      haloSize: 2.6,
      onLevel: (v) => {
        this.clockDialLevel = v
      },
    })

    this.restore()
    this.buildReplayButton()

    window.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.onResize()
  }

  // --------------------------------------------------------------- lifecycle

  start(): void {
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  private onResize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    // Nothing here touches game state: rotating the device must never rewind the evening.
    this.renderer.setSize(w, h)
    this.rig.setViewport(w, h)
    this.sky.setPixelScale(this.renderer.pixelScale)
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      this.running = false
      this.audio.suspend()
      this.save()
    } else {
      this.running = true
      this.audio.resume()
      this.last = performance.now()
      requestAnimationFrame(this.frame)
    }
  }

  private frame = (now: number): void => {
    if (!this.running) return
    // A long tab switch must not fast-forward the simulation.
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000))
    this.last = now
    this.update(dt)
    this.renderer.gl.render(this.scene, this.rig.camera)
    this.renderer.measure(dt)
    requestAnimationFrame(this.frame)
  }

  // ------------------------------------------------------------------ update

  private update(dt: number): void {
    this.updateStage(dt)

    this.pendulum.step(dt)
    this.state.update(dt, this.pendulum.amplitude01)
    this.L.update(this.state, dt, this.rig.framing())

    this.rig.update(dt, this.pendulum.amplitude01)
    const cam = this.rig.camera

    this.swing.update(dt)
    this.clock.update(dt, this.L, this.clockDialLevel)
    this.park.update(this.L.moonGlow * this.L.starVisibility)
    this.breathPulse = damp(this.breathPulse, 0, 0.35, dt)
    this.town.update(
      dt,
      this.L,
      cam,
      this.state.totalLit / Math.max(1, this.state.totalFixtures),
      this.breathPulse,
    )
    this.sky.update(this.L, dt, this.state.moonReveal, cam)
    this.lightRig.update(dt, this.L, cam)
    this.hint.update(dt, cam)

    this.applyLighting(dt)
    this.audio.update(dt, this.L, this.pendulum.amplitude01)
    this.updateSwipeDirection()
  }

  private applyLighting(dt: number): void {
    const L = this.L
    this.hemi.color.copy(L.ambientSky)
    this.hemi.groundColor.copy(L.ambientGround)
    this.hemi.intensity = L.ambientIntensity

    const target = this.swing.seatWorld
    this.sun.position.copy(L.sunDir).multiplyScalar(46).add(target)
    this.sun.target.position.copy(target)
    this.sun.color.copy(L.warmBand)
    this.sun.intensity = L.sunIntensity

    this.moonLight.position.copy(L.moonDir).multiplyScalar(46).add(target)
    this.moonLight.target.position.copy(target)
    this.moonLight.intensity = L.moonIntensity

    // Exactly one shadow-casting light at a time; the hand-off happens while both
    // are dim enough that nothing visibly jumps.
    const moonShadows = L.sunIntensity < 0.09 && L.moonIntensity > 0.08
    if (this.sun.castShadow === moonShadows) {
      this.sun.castShadow = !moonShadows
      this.moonLight.castShadow = moonShadows
    }

    this.fill.position.copy(this.rig.camera.position).add(new Vector3(0, 5, 0))
    this.fill.color.copy(L.ambientSky).lerp(new Color('#ffe0bb'), 0.25)
    this.fill.intensity = L.readFill

    this.fog.color.copy(L.fogColor)
    this.fog.density = L.fogDensity * 0.75

    this.renderer.setExposure(L.exposure, dt)
  }

  private updateSwipeDirection(): void {
    // Project the seat's direction of travel to screen pixels so the hint gesture
    // and the swipe test agree with what the child can see moving.
    const p = this.pendulum
    const R = p.length
    const t = this.tmpV.set(0, Math.sin(p.theta), -Math.cos(p.theta)).multiplyScalar(0.9)
    const a = this.swing.seatWorld.clone().project(this.rig.camera)
    const b = this.swing.seatWorld.clone().add(t.multiplyScalar(R * 0.35)).project(this.rig.camera)
    const dx = (b.x - a.x) * window.innerWidth * 0.5
    const dy = -(b.y - a.y) * window.innerHeight * 0.5
    const n = Math.hypot(dx, dy)
    if (n > 0.001) this.input.swingDir = { x: dx / n, y: dy / n }
  }

  // ------------------------------------------------------------------- stages

  private updateStage(dt: number): void {
    this.stageTimer += dt
    const s = this.state

    switch (s.stage) {
      case 'mystery': {
        // A gust of wind keeps nudging the swing, so the puzzle replays until it lands.
        this.windTimer -= dt
        if (this.windTimer <= 0 && this.pendulum.amplitude01 < 0.05) {
          this.windTimer = 7.5
          this.pendulum.nudge(0.34)
        }
        break
      }
      case 'hint': {
        this.hint.show()
        break
      }
      case 'first':
      case 'confirm':
        break
      case 'play':
        break
      case 'finale': {
        this.finaleTimer += dt
        this.rig.setPullBack(clamp(this.finaleTimer / 6))
        if (this.finaleTimer > 9) {
          s.stage = 'night'
          this.showReplay(true)
        }
        break
      }
      case 'night':
        break
    }
  }

  private onSwipe(length: number, alignment: number): void {
    void this.audio.unlock()
    const s = this.state
    if (s.stage === 'mystery' || s.stage === 'hint') {
      s.stage = 'first'
      this.stageTimer = 0
    }
    // Never a failure: a backwards swipe still pumps, just a little less.
    const strength = 0.55 + length * 0.55 + Math.max(0, alignment) * 0.45
    this.pendulum.queuePump(strength)
    if (this.pendulum.amplitude01 < 0.04) this.pendulum.nudge(0.5)
  }

  /**
   * The swing has crossed its lowest point. This is the only place a time event
   * can be born, and only the driving direction produces one — so a cycle can
   * never advance the clock twice.
   */
  private onBottomPass(dir: 1 | -1, speed: number, amplitude: number): void {
    this.audio.bottomPass(clamp(speed / 2.4))
    if (dir !== 1) {
      this.clock.recock()
      this.audio.recock()
      return
    }
    if (amplitude < 0.015) return

    const s = this.state
    if (s.stage === 'mystery') {
      // The opening: the mechanism really does move, but the evening has not started.
      s.tick(amplitude, { playerDriven: false, countTowardsNight: false })
      this.clock.advance(1)
      this.audio.mechanism(0.05)
      this.audio.click(1, 0.15)
      // one lamp glimmers, and does not stay on
      this.lightRig.glimmer('pathLights', 0, 0.55)
      this.audio.lightOn(0.1, 0.32)
      window.setTimeout(() => {
        if (this.state.stage === 'mystery') {
          this.state.stage = 'hint'
          this.stageTimer = 0
        }
      }, 2100)
      return
    }

    const firstRealTick = s.stage === 'first' && s.playerCycles === 0
    const result = s.tick(amplitude, {
      playerDriven: true,
      countTowardsNight: true,
      // The very first push the child makes has to visibly move the sky.
      nightBoost: firstRealTick ? 3 : 0,
    })

    this.clock.advance(result.teeth)
    this.audio.mechanism(0.05)
    this.audio.click(result.teeth, 0.15)

    result.turnedOn.forEach((t, i) => {
      this.lightRig.ignite(t.group, t.index)
      const f = this.lightRig.get(t.group, t.index)
      const d = f ? clamp(f.position.distanceTo(this.rig.camera.position) / 320) : 0.4
      this.audio.lightOn(d, 0.3 + i * 0.14)
      // Only once the causal link is understood do we ever look away from the swing.
      if (f && s.understood && t.tier >= 2) {
        this.rig.glanceAt(f.position, 0.6, 2.6)
      }
    })

    if (result.revealedMoon) {
      this.audio.moonReveal(0.45)
      if (s.understood) this.rig.glanceAt(this.sky.moonWorldPosition(), 0.75, 3.4)
    }

    if (result.townBreath) this.triggerBreath()

    // stage transitions
    if (s.stage === 'first') {
      this.hint.hide()
      s.stage = 'confirm'
      this.stageTimer = 0
    } else if (s.stage === 'confirm' && s.playerCycles >= 2) {
      s.stage = 'play'
      this.stageTimer = 0
    }

    // the whole valley finishing at once, if the child never found the steady rhythm
    if (s.stage === 'play' && s.night >= 0.999 && !s.townBreathDone) {
      s.townBreathDone = true
      this.lightRig.allOn()
      for (const g of s.groups.values()) g.lit = g.count
      this.triggerBreath()
    }

    this.save()
  }

  private triggerBreath(): void {
    this.town.triggerBreath()
    this.breathPulse = 1
    this.lightRig.allOn()
    this.audio.bell(0.95)
  }

  // ------------------------------------------------------------------ replay

  private buildReplayButton(): void {
    const b = document.createElement('button')
    b.setAttribute('aria-label', 'replay')
    b.style.cssText = [
      'position:absolute',
      'right:calc(env(safe-area-inset-right,0px) + 16px)',
      'bottom:calc(env(safe-area-inset-bottom,0px) + 18px)',
      'width:58px',
      'height:58px',
      'border-radius:50%',
      'border:1.5px solid rgba(238,226,198,0.42)',
      'background:rgba(18,22,34,0.34)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:grid',
      'place-items:center',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity 700ms ease',
      'cursor:pointer',
      'padding:0',
    ].join(';')
    b.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(244,232,206,0.9)" stroke-width="1.9" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.6V8h-4.4"/></svg>'
    b.addEventListener('click', (e) => {
      e.preventDefault()
      this.replay()
    })
    this.overlay.appendChild(b)
    this.replayEl = b
  }

  private showReplay(v: boolean): void {
    if (!this.replayEl) return
    this.replayEl.style.opacity = v ? '1' : '0'
    this.replayEl.style.pointerEvents = v ? 'auto' : 'none'
  }

  private replay(): void {
    this.state.reset()
    this.lightRig.reset()
    this.clock.reset()
    this.pendulum.reset()
    this.audio.resetChimes()
    this.rig.setPullBack(0)
    this.finaleTimer = 0
    this.windTimer = 1.2
    this.breathPulse = 0
    this.hint.hide()
    this.showReplay(false)
    try {
      sessionStorage.removeItem(SAVE_KEY)
    } catch {
      /* private mode */
    }
  }

  // ------------------------------------------------------------ persistence

  private save(): void {
    try {
      sessionStorage.setItem(SAVE_KEY, this.state.serialise())
    } catch {
      /* storage may be unavailable; the game just starts over next time */
    }
  }

  private restore(): void {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(SAVE_KEY)
    } catch {
      raw = null
    }
    if (!raw) return
    if (!this.state.restore(raw)) return
    this.lightRig.syncInstant((g) => this.state.litOf(g))
    if (this.state.stage === 'mystery' || this.state.stage === 'hint') this.state.stage = 'hint'
    if (this.state.stage === 'finale' || this.state.stage === 'night') {
      this.state.stage = 'night'
      this.rig.setPullBack(1)
      this.showReplay(true)
    }
  }

  /** Exposed for the end-to-end check: drive the evening without a human thumb. */
  debugPump(strength = 1.4): void {
    this.onSwipe(strength, 1)
  }

  debugInfo(): Record<string, unknown> {
    return {
      stage: this.state.stage,
      teeth: this.state.teeth,
      nightTeeth: this.state.nightTeeth,
      night: +this.state.night.toFixed(3),
      amplitude: +this.pendulum.amplitude01.toFixed(3),
      lit: this.state.totalLit,
      fixtures: this.state.totalFixtures,
      moon: this.state.moonRevealed,
      breath: this.state.townBreathDone,
      clock: this.L.clockHands(),
      exposure: +this.renderer.gl.toneMappingExposure.toFixed(3),
      pixelScale: +this.renderer.pixelScale.toFixed(2),
    }
  }
}
