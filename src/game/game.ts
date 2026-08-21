import * as THREE from 'three'
import { RenderSystem } from '../core/renderer'
import { InputSystem } from '../core/input'
import { AudioSystem } from '../core/audio'
import type { QualitySettings } from '../core/quality'
import { AdaptiveScale } from '../core/quality'
import { buildMaterials } from '../core/materials'
import { approach, clamp, clamp01, lerp, smoothstep } from '../core/math'
import { Sky } from '../world/sky'
import { buildGround, Moths } from '../world/ground'
import { buildTrees, buildBenches, buildPavilion, buildHorizon } from '../world/props'
import { buildSlideStructure, RollerBank } from '../world/slide'
import { Machinery, type SelectorLever } from '../world/machinery'
import { FixtureSystem } from '../world/fixtures'
import { ContactShadows } from '../world/decals'
import { Child } from '../world/child'
import { CameraDirector } from './director'
import { CircuitModel } from './circuits'
import { UI } from '../ui/ui'
import {
  CLIMB_ROUTE,
  DISCOVERY_FIXTURE,
  SHAFT,
  SLIDE,
  ZONES,
  bedPitch,
  bedPoint,
  distanceAtU,
  slideLength,
  uAtDistance,
  type CircuitId,
} from '../world/layout'

type Phase =
  | 'intro'
  | 'climb'
  | 'seat'
  | 'ride'
  | 'arrive'
  | 'discover'
  | 'select'
  | 'reveal'
  | 'finale'
  | 'freeCrank'

/** Physical constants of the run. Tuned so a run reads as calm, never fast. */
const GRAVITY = 9.81
const FRICTION = 0.3
const DRAG = 0.16
const MAT_FRICTION = 0.62
const RUNOUT = 0.75

/** Shaft speed treated as the generator's rated output. */
const RATED_SHAFT = 20.5

/** Route the child trots along to get back to the foot of the stairs. */
const RETURN_ROUTE: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 2.5),
  new THREE.Vector3(2.15, 0, 1.1),
  new THREE.Vector3(2.5, 0, -4.0),
  new THREE.Vector3(2.0, 0, -10.0),
  new THREE.Vector3(0.6, 0, -13.9),
  CLIMB_ROUTE[0].clone(),
]

function routeLength(route: THREE.Vector3[]): number[] {
  const acc = [0]
  for (let i = 1; i < route.length; i++) acc.push(acc[i - 1] + route[i].distanceTo(route[i - 1]))
  return acc
}

function samplePath(
  route: THREE.Vector3[],
  acc: number[],
  d: number,
  out: THREE.Vector3,
): { yaw: number } {
  const total = acc[acc.length - 1]
  const t = clamp(d, 0, total)
  let i = 1
  while (i < acc.length - 1 && acc[i] < t) i++
  const span = acc[i] - acc[i - 1] || 1
  const f = (t - acc[i - 1]) / span
  out.copy(route[i - 1]).lerp(route[i], f)
  const dir = route[i].clone().sub(route[i - 1])
  return { yaw: Math.atan2(dir.x, dir.z) }
}

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _screen = new THREE.Vector2()

export class Game {
  readonly scene = new THREE.Scene()
  readonly director: CameraDirector
  readonly circuits = new CircuitModel()

  private readonly render: RenderSystem
  private readonly input: InputSystem
  private readonly audio: AudioSystem
  private readonly ui: UI
  private readonly adaptive: AdaptiveScale

  private readonly sky: Sky
  private readonly rollers: RollerBank
  private readonly machinery: Machinery
  private readonly fixtures: FixtureSystem
  private readonly moths: Moths
  private readonly child = new Child()

  private readonly raycaster = new THREE.Raycaster()
  private rollerProxy!: THREE.Mesh
  private readonly zoneProxies: THREE.Mesh[] = []

  private phase: Phase = 'intro'
  private phaseTime = 0
  private runCount = 0

  /* --- ride state --- */
  private rideDistance = 0
  private rideSpeed = 0
  private readonly riderPos = new THREE.Vector3()

  /* --- climb state --- */
  private climbProgress = 0
  private readonly climbAcc = routeLength(CLIMB_ROUTE)
  private readonly returnAcc = routeLength(RETURN_ROUTE)
  private returnDistance = 0
  private returning = false

  /* --- discovery state --- */
  private crankIndex = -1
  private crankOmega = 0
  private crankTime = 0
  private crankReleased = false

  /* --- selector state --- */
  private draggingLever: SelectorLever | null = null
  private leverStartY = 0
  private armedPending: CircuitId | null = null

  private lastFrame = 0
  private running = false

  /* --- debug-adjustable values, all shipped at their tuned defaults --- */
  debugSkyBrightness = 1
  debugLampGain = 1
  debugExposure = 1.06
  debugChargeScale = 1
  debugRollerScale = 1

  constructor(canvas: HTMLCanvasElement, quality: QualitySettings, uiRoot: HTMLElement) {
    this.render = new RenderSystem(canvas, quality)
    this.input = new InputSystem(canvas)
    this.audio = new AudioSystem()
    this.ui = new UI(uiRoot)
    this.adaptive = new AdaptiveScale(quality.renderScale)
    this.director = new CameraDirector(this.render.viewport.aspect)

    buildMaterials()
    const contacts = new ContactShadows(220)

    this.sky = new Sky(this.scene)
    if (quality.shadows) this.sky.enableShadows(quality.shadowMapSize)

    const ground = buildGround(quality)
    this.scene.add(ground.root)

    const structure = new THREE.Group()
    structure.name = 'structure'
    buildSlideStructure(structure, contacts)
    buildTrees(structure, contacts)
    buildBenches(structure, contacts)
    buildPavilion(structure, contacts)
    buildHorizon(structure)
    this.scene.add(structure)

    this.rollers = new RollerBank({ segments: quality.rollerSegments })
    this.scene.add(this.rollers.mesh, this.rollers.driveMesh)

    this.machinery = new Machinery(contacts)
    this.scene.add(this.machinery.root)

    this.fixtures = new FixtureSystem(quality.maxRealLights, contacts)
    this.scene.add(this.fixtures.root)

    this.moths = new Moths(quality.mothCount)
    this.scene.add(this.moths.points)

    this.scene.add(contacts.mesh)
    this.scene.add(this.child.root)

    this.buildProxies()

    // The path circuit is the one the box was left switched to. Nothing says so.
    this.machinery.setArmed('path', true)
    this.circuits.active = 'path'

    this.placeChildAtRouteStart()
    this.render.attachPostProcessing(this.scene, this.director.camera)
    this.render.setExposure(this.debugExposure)
    this.applyViewport()
  }

  /* ------------------------------------------------------------------ */

  private buildProxies(): void {
    const invisible = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })

    // Finger target over the drive rollers, sized to the band the shaft serves.
    const zFrom = SLIDE.driveZFrom - 0.2
    const zTo = SLIDE.driveZTo + 0.2
    bedPoint(uAtDistance(distanceAtU(1) - 0.2), _v)
    const proxyGeo = new THREE.BoxGeometry(SLIDE.width + 0.5, 0.4, zTo - zFrom)
    this.rollerProxy = new THREE.Mesh(proxyGeo, invisible)
    const midU = uAtDistance(
      (distanceAtU(uForZ(zFrom)) + distanceAtU(uForZ(zTo))) / 2,
    )
    bedPoint(midU, _v)
    this.rollerProxy.position.set(0, _v.y + 0.05, (zFrom + zTo) / 2)
    this.rollerProxy.rotation.x = -bedPitch(midU) * 0.3
    this.rollerProxy.renderOrder = -10
    this.scene.add(this.rollerProxy)

    for (const z of ZONES) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(z.tapRadius, 10, 8), invisible)
      s.position.copy(z.anchor)
      s.renderOrder = -10
      s.visible = false
      this.zoneProxies.push(s)
      this.scene.add(s)
    }
  }

  private placeChildAtRouteStart(): void {
    this.child.root.position.copy(CLIMB_ROUTE[0])
    this.child.root.rotation.set(0, 0, 0)
    this.child.setPose('stand')
  }

  /* ------------------------------------------------------------------ */

  async start(): Promise<void> {
    this.ui.setLoadProgress(0.5)
    // Compile shaders before the first visible frame so the opening does not hitch.
    this.sky.buildEnvironment(this.render.renderer)
    this.director.update(0.016)
    await this.render.renderer.compileAsync(this.scene, this.director.camera)
    this.ui.setLoadProgress(1)

    await this.ui.waitForStart()
    await this.audio.unlock()
    this.ui.dismissBoot()

    this.director.play('overview', 0)
    this.phase = 'intro'
    this.phaseTime = 0
    this.running = true
    this.lastFrame = performance.now()
    requestAnimationFrame(this.loop)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private readonly onResize = (): void => {
    this.render.resize()
    this.applyViewport()
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.audio.suspend()
    else {
      this.audio.resume()
      this.lastFrame = performance.now()
    }
  }

  private applyViewport(): void {
    const v = this.render.viewport
    this.director.setViewport(v.aspect, v.portrait)
  }

  /* ------------------------------------------------------------------ */

  private readonly loop = (now: number): void => {
    if (!this.running) return
    requestAnimationFrame(this.loop)
    // A long stall (tab switch, incoming call) must not teleport the run.
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.lastFrame) / 1000))
    this.lastFrame = now
    this.lastDt = dt
    this.step(dt)
  }

  private step(dt: number): void {
    this.input.beginFrame(dt)
    this.phaseTime += dt

    this.updatePhase(dt)
    this.updateReturnWalk(dt)

    this.rollers.update(dt)

    const shaftOmega = this.rollers.driveOmega() * SHAFT.ratio
    const output = clamp01(shaftOmega / RATED_SHAFT)
    this.circuits.update(dt, output * this.debugChargeScale)

    const active = this.circuits.circuits[this.circuits.active]
    this.machinery.update(dt, shaftOmega, output, active.charge)

    for (const ig of this.circuits.ignitions) {
      this.audio.relayClick()
      this.audio.lampSwell(1 - ig.order * 0.06)
    }

    this.fixtures.setLampGain(this.debugLampGain)
    this.fixtures.update(dt, this.director.camera, this.circuits.all.values())

    // The park drifts from dusk into night as its own lamps take over.
    const night = smoothstep(0, 0.55, this.circuits.overallLight()) * 0.75 + smoothstep(0, 190, this.elapsedTotal) * 0.25
    this.sky.setNight(clamp01(night), this.debugSkyBrightness)

    this.updateMoths()
    this.moths.update(dt)

    this.director.setRider(this.riderPos, this.rideSpeed)
    this.director.update(dt)
    this.render.setCamera(this.director.camera)

    this.audio.setRollerNoise(this.rollers.peakNormalised(), dt)
    this.audio.setGenerator(output)
    this.audio.tickAmbience(dt)

    this.child.update(dt, this.rideSpeed)

    const scale = this.adaptive.update(dt)
    if (scale !== null) this.render.setRenderScale(scale)

    this.render.render(this.scene, this.director.camera)
    this.input.endFrame()
  }

  private elapsedTotal = 0

  /* ------------------------------------------------------------------ */

  private updateMoths(): void {
    const anchors: THREE.Vector3[] = []
    for (const v of this.fixtures.visuals) {
      if (v.def.kind === 'uplight' || v.def.kind === 'safety') continue
      const lamp = this.circuits.all.get(v.def.id)
      if (lamp && lamp.level > 0.55) anchors.push(v.anchor)
      if (anchors.length >= 4) break
    }
    this.moths.setAnchors(anchors)
  }

  /* ------------------------------------------------------------------ */

  private setPhase(p: Phase): void {
    this.phase = p
    this.phaseTime = 0
    this.ui.hideAllHints()
  }

  private updatePhase(dt: number): void {
    this.elapsedTotal += dt
    switch (this.phase) {
      case 'intro':
        this.updateIntro()
        break
      case 'climb':
        this.updateClimb(dt)
        break
      case 'seat':
        this.updateSeat()
        break
      case 'ride':
        this.updateRide(dt)
        break
      case 'arrive':
        this.updateArrive()
        break
      case 'discover':
        this.updateDiscover(dt)
        break
      case 'select':
        this.updateSelect()
        break
      case 'reveal':
        this.updateReveal()
        break
      case 'finale':
        this.updateFinale()
        break
      case 'freeCrank':
        this.updateFreeCrank(dt)
        break
    }
  }

  /* ---------------- intro ---------------- */

  private updateIntro(): void {
    this.riderPos.copy(this.child.root.position).add(_v.set(0, 0.55, 0))
    if (this.phaseTime > 3.4) {
      this.hintSwipeUp()
      if (this.input.active && this.input.totalDy < -26) {
        this.director.play('climb', 2.0)
        this.setPhase('climb')
      }
    }
  }

  private hintSwipeUp(): void {
    _v.copy(this.child.root.position).add(_v2.set(0, 1.1, 0))
    if (this.director.project(_v, _screen)) {
      this.ui.showHint(0, 'up', _screen.x, _screen.y + 0.1)
    } else {
      this.ui.showHint(0, 'up', 0.5, 0.7)
    }
  }

  /* ---------------- climb ---------------- */

  private updateClimb(dt: number): void {
    if (this.returning) {
      this.hintWaitForReturn()
      return
    }
    const total = this.climbAcc[this.climbAcc.length - 1]
    let moved = false
    if (this.input.active && this.input.dy < 0) {
      const gain = -this.input.dy / (this.render.viewport.height * 0.85)
      this.climbProgress = clamp01(this.climbProgress + gain)
      moved = true
    }
    // A little forgiving carry so a short swipe still makes visible progress.
    this.climbCarry = approach(this.climbCarry, moved ? 1 : 0, 0.05, dt)
    if (!moved && this.climbCarry > 0.02) {
      this.climbProgress = clamp01(this.climbProgress + this.climbCarry * dt * 0.16)
    }

    const d = this.climbProgress * total
    const { yaw } = samplePath(CLIMB_ROUTE, this.climbAcc, d, _v)
    this.child.root.position.copy(_v)
    this.child.root.rotation.y = yaw
    this.child.root.rotation.x = 0
    this.child.setPose(moved || this.climbCarry > 0.15 ? 'walk' : 'stand')
    if (moved) this.stepSound(dt)

    this.riderPos.copy(_v).add(_v2.set(0, 0.62, 0))

    if (this.climbProgress < 1) {
      this.hintSwipeUp()
    } else {
      this.seatChild(0.12)
      this.director.play('top', 1.8)
      this.setPhase('seat')
    }
  }

  private climbCarry = 0
  private stepClock = 0

  private stepSound(dt: number): void {
    this.stepClock -= dt
    if (this.stepClock <= 0) {
      this.stepClock = 0.42
      this.audio.footstep()
    }
  }

  private hintWaitForReturn(): void {
    _v.copy(this.child.root.position).add(_v2.set(0, 1.1, 0))
    if (this.director.project(_v, _screen)) this.ui.showHint(0, 'hold', _screen.x, _screen.y)
  }

  /* ---------------- seated at the top ---------------- */

  private seatChild(d: number): void {
    const u = uAtDistance(d)
    bedPoint(u, _v)
    const pitch = bedPitch(u)
    this.child.root.position.set(0, _v.y + 0.22 - Child.HIP_HEIGHT, _v.z)
    this.child.root.rotation.set(pitch * 0.85, 0, 0)
    this.child.setPose('sit')
    this.rideDistance = d
    this.rideSpeed = 0
    this.riderPos.set(0, _v.y + 0.5, _v.z)
  }

  private updateSeat(): void {
    _v.copy(this.riderPos)
    if (this.director.project(_v, _screen)) {
      this.ui.showHint(0, this.input.active ? 'hold' : 'up', _screen.x, _screen.y + 0.14)
    }
    if (this.phaseTime < 0.9) return
    // Any release starts the run; holding simply waits, exactly as at a real slide.
    if (this.input.justUp && this.input.released && !this.input.released.moved) {
      this.beginRide()
    } else if (this.input.justUp && this.input.released && this.input.released.totalDy > 20) {
      this.beginRide()
    }
  }

  private beginRide(): void {
    this.rideSpeed = 0.45
    this.child.setPose('slide')
    this.child.setPosture(0.25, 0)
    this.director.play('ride', 1.1)
    this.setPhase('ride')
  }

  /* ---------------- the run ---------------- */

  private updateRide(dt: number): void {
    const u = uAtDistance(this.rideDistance)
    const pitch = bedPitch(Math.min(u, 0.999))
    const onBed = this.rideDistance < slideLength
    const mu = onBed ? FRICTION : MAT_FRICTION
    const accel =
      GRAVITY * Math.sin(onBed ? pitch : 0.02) -
      GRAVITY * Math.cos(pitch) * mu * Math.sign(Math.max(this.rideSpeed, 0.001)) -
      DRAG * this.rideSpeed * this.rideSpeed
    this.rideSpeed = Math.max(0, this.rideSpeed + accel * dt)
    this.rideDistance += this.rideSpeed * dt

    // Optional posture: leaning changes how the child looks, never the outcome.
    if (this.input.active) {
      const spread = clamp01(Math.abs(this.input.totalDx) / (this.render.viewport.width * 0.28))
      const tuck = clamp01(this.input.totalDy / (this.render.viewport.height * 0.22))
      this.child.setPosture(spread, tuck)
    } else {
      this.child.setPosture(0.25, 0)
    }

    if (onBed) {
      this.rollers.driveFromRider(this.rideDistance, this.rideSpeed * this.debugRollerScale, dt)
      bedPoint(u, _v)
      this.child.root.position.set(0, _v.y + 0.22 - Child.HIP_HEIGHT, _v.z)
      this.child.root.rotation.set(pitch * 0.85, 0, 0)
      this.riderPos.set(0, _v.y + 0.46, _v.z)
    } else {
      bedPoint(1, _v)
      const over = this.rideDistance - slideLength
      this.child.root.position.set(0, _v.y + 0.18 - Child.HIP_HEIGHT, _v.z + over)
      this.child.root.rotation.set(0.1, 0, 0)
      this.riderPos.set(0, _v.y + 0.44, _v.z + over)
    }

    if (this.rideSpeed <= 0.05 || this.rideDistance > slideLength + RUNOUT) {
      this.rideSpeed = 0
      this.runCount++
      this.director.bump(0.7)
      this.child.setPose('sit')
      this.setPhase('arrive')
    }
  }

  /* ---------------- arriving ---------------- */

  private updateArrive(): void {
    if (this.phaseTime > 1.15 && this.phaseTime < 1.2) {
      this.director.play('firstLight', 2.2)
    }
    if (this.phaseTime > 2.4 && !this.returning) this.beginReturnWalk()
    if (this.phaseTime > 4.6) {
      if (this.runCount === 1) {
        this.circuits.chargeCeiling = 0.66
        this.director.play('discovery', 2.6)
        this.setPhase('discover')
      } else {
        this.director.reveal(this.circuits.active, 3.0)
        this.setPhase('reveal')
      }
    }
  }

  /* ---------------- discovery ---------------- */

  private updateDiscover(dt: number): void {
    this.handleCrank(dt)

    // Point at the rollers, not at the generator: the link is for the child to find.
    bedPoint(uAtDistance(distanceAtU(uForZ(0)) ), _v)
    _v.set(0, _v.y + 0.14, 0)
    if (this.crankTime < 0.4 && this.director.project(_v, _screen)) {
      this.ui.showHint(0, 'side', _screen.x, _screen.y)
    } else {
      this.ui.hideHint(0)
    }

    const lamp = this.circuits.all.get(DISCOVERY_FIXTURE)
    const sawItRespond = (lamp?.level ?? 0) > 0.3
    const done =
      (this.crankTime > 3.2 && this.crankReleased && sawItRespond) ||
      this.crankTime > 9 ||
      this.phaseTime > 42
    if (done && this.phaseTime > 6) {
      this.circuits.chargeCeiling = 1
      this.director.play('selector', 2.8)
      this.setPhase('select')
    }
  }

  private handleCrank(dt: number): void {
    if (this.input.justDown) {
      this.raycaster.setFromCamera(this.input.ndc, this.director.camera)
      const hit = this.raycaster.intersectObject(this.rollerProxy, false)[0]
      this.crankIndex = hit ? this.rollers.nearestTo(hit.point) : -1
    }
    if (!this.input.active) {
      if (this.crankIndex >= 0) this.crankReleased = this.crankTime > 0.5
      this.crankIndex = -1
      this.crankOmega = approach(this.crankOmega, 0, 0.2, dt)
      return
    }
    if (this.crankIndex < 0) return

    // Screen-horizontal travel across the roller is the surface speed of a hand.
    const perPixel = 74 / Math.max(1, this.render.viewport.width)
    const target = clamp(-this.input.dx * perPixel * (1 / Math.max(dt, 0.008)) * 0.02, -30, 30)
    this.crankOmega = approach(this.crankOmega, target, 0.02, dt)
    this.rollers.driveByHand(this.crankIndex, this.crankOmega, dt)
    if (Math.abs(this.crankOmega) > 2.5) this.crankTime += dt
  }

  /* ---------------- selector ---------------- */

  private updateSelect(): void {
    this.handleLeverDrag()

    if (this.armedPending) {
      if (this.phaseTime > 1.35) {
        this.climbProgress = 0
        this.armedPending = null
        this.director.play('climb', 2.2)
        this.setPhase('climb')
      }
      return
    }

    this.machinery.levers.forEach((lever, i) => {
      lever.handle.getWorldPosition(_v)
      if (this.director.project(_v, _screen)) {
        this.ui.showHint(i, 'pull', _screen.x, _screen.y - 0.02)
      } else {
        this.ui.hideHint(i)
      }
    })
  }

  private handleLeverDrag(): void {
    if (this.input.justDown) {
      this.raycaster.setFromCamera(this.input.ndc, this.director.camera)
      const handles = this.machinery.levers.map((l) => l.handle)
      const hit = this.raycaster.intersectObjects(handles, false)[0]
      if (hit) {
        this.draggingLever = this.machinery.levers.find((l) => l.handle === hit.object) ?? null
        this.leverStartY = this.input.y
      }
    }
    if (!this.draggingLever) return

    const travel = (this.input.y - this.leverStartY) / (this.render.viewport.height * 0.16)
    const angle = lerp(-0.42, 0.5, clamp01(travel))
    this.machinery.setLeverAngle(this.draggingLever, angle)

    // A real over-centre switch: past the halfway point it goes, and stays.
    if (travel >= 0.95) {
      const id = this.draggingLever.id
      this.machinery.setArmed(id)
      this.circuits.active = id
      this.audio.leverThrow()
      this.audio.relayClick()
      this.armedPending = id
      this.draggingLever = null
      this.ui.hideAllHints()
      this.phaseTime = 0
      return
    }
    if (this.input.justUp) {
      this.machinery.setArmed(this.circuits.active)
      this.draggingLever = null
    }
  }

  /* ---------------- reveal ---------------- */

  private updateReveal(): void {
    if (this.phaseTime > 5.2) {
      if (this.circuits.allZonesLit()) {
        this.director.play('finale', 3.4)
        this.setPhase('finale')
      } else {
        this.director.play('selector', 3.0)
        this.setPhase('select')
      }
    }
  }

  /* ---------------- finale and free play ---------------- */

  private updateFinale(): void {
    ZONES.forEach((z, i) => {
      if (this.director.project(z.anchor, _screen)) {
        this.ui.showHint(i, 'tap', _screen.x, _screen.y)
      } else {
        this.ui.hideHint(i)
      }
    })

    if (this.phaseTime < 1.4) return
    if (!this.input.justUp || !this.input.released || this.input.released.moved) return

    this.raycaster.setFromCamera(this.input.released.ndc, this.director.camera)
    for (const proxy of this.zoneProxies) proxy.visible = true
    const zoneHit = this.raycaster.intersectObjects(this.zoneProxies, false)[0]
    for (const proxy of this.zoneProxies) proxy.visible = false
    if (zoneHit) {
      const idx = this.zoneProxies.indexOf(zoneHit.object as THREE.Mesh)
      const id = ZONES[idx].id
      this.machinery.setArmed(id)
      this.circuits.active = id
      this.audio.leverThrow()
      this.climbProgress = 0
      this.director.play('climb', 2.6)
      this.setPhase('climb')
      return
    }

    const slideHit = this.raycaster.intersectObject(this.rollerProxy, false)[0]
    if (slideHit) {
      this.director.play('discovery', 2.4)
      this.setPhase('freeCrank')
    }
  }

  private updateFreeCrank(dt: number): void {
    this.handleCrank(dt)
    bedPoint(uAtDistance(distanceAtU(uForZ(0))), _v)
    _v.set(0, _v.y + 0.14, 0)
    if (this.crankTime < 0.4 && this.director.project(_v, _screen)) {
      this.ui.showHint(0, 'side', _screen.x, _screen.y)
    } else {
      this.ui.hideHint(0)
    }
    // Leaving is a tap anywhere that is not the rollers.
    if (this.phaseTime > 2 && this.input.justUp && this.input.released && !this.input.released.moved) {
      this.raycaster.setFromCamera(this.input.released.ndc, this.director.camera)
      if (!this.raycaster.intersectObject(this.rollerProxy, false)[0]) {
        this.director.play('finale', 2.8)
        this.setPhase('finale')
      }
    }
  }

  /* ---------------- walking back ---------------- */

  private beginReturnWalk(): void {
    this.returning = true
    this.returnDistance = 0
    this.child.setPose('walk')
  }

  private updateReturnWalk(dt: number): void {
    if (!this.returning) return
    const total = this.returnAcc[this.returnAcc.length - 1]
    this.returnDistance += dt * 1.95
    const { yaw } = samplePath(RETURN_ROUTE, this.returnAcc, this.returnDistance, _v)
    this.child.root.position.copy(_v)
    this.child.root.rotation.set(0, yaw, 0)
    this.child.setPose('walk')
    this.stepSound(dt)
    if (this.returnDistance >= total) {
      this.returning = false
      this.placeChildAtRouteStart()
      this.climbProgress = 0
    }
  }

  /* ------------------------------------------------------------------ */

  get stats(): Record<string, number | string> {
    return {
      phase: this.phase,
      runs: this.runCount,
      fps: Math.round(1 / Math.max(0.001, this.lastDt)),
      scale: Number(this.render.renderScale.toFixed(2)),
      charge: Number(this.circuits.circuits[this.circuits.active].charge.toFixed(3)),
      active: this.circuits.active,
      shaft: Number((this.rollers.driveOmega() * SHAFT.ratio).toFixed(1)),
    }
  }

  private lastDt = 0.016

  setExposure(v: number): void {
    this.debugExposure = v
    this.render.setExposure(v)
  }

  setBloom(v: number): void {
    this.render.setBloom(v)
  }

  setShadowQuality(size: number): void {
    this.sky.enableShadows(size)
  }

  setRenderScale(v: number): void {
    this.render.setRenderScale(v)
  }

  jumpToShot(name: string): void {
    this.director.play(name, 1.4)
  }

  fillCircuits(v: number): void {
    this.circuits.debugFill(v)
  }
}

/** Normalised bed parameter for a given z, by linear inversion of the run. */
function uForZ(z: number): number {
  return clamp01((z - SLIDE.topZ) / (SLIDE.exitZ - SLIDE.topZ))
}
