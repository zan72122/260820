import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  Plane,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  type BufferGeometry,
  type WebGLRenderer,
} from 'three'
import { CameraDirector, type SafeInsets, type Shot } from './cameraDirector'
import { GameState, type Side } from './state'
import {
  BENCH,
  FRUIT,
  HANDLE_FINGER_OFFSET_PX,
  HANDLE_PICK_PX,
  NET_GEOMETRY,
  STEM,
  tautnessForSpan,
} from './layout'
import { NetSim, type StepContext } from '../sim/netSim'
import { FruitSim } from '../sim/fruitSim'
import { NetView } from '../world/netMesh'
import { BranchRig } from '../world/branch'
import { Greenhouse } from '../world/greenhouse'
import { DynamicTube } from '../world/tube'
import {
  buildMangoGeometry,
  makeMangoMaterial,
  makeMangoMesh,
  makeMangoShape,
  mangoExtents,
  mangoRadiusAt,
  type MangoMaterialHandle,
  type MangoShape,
} from '../world/mango'
import type { TextureBundle } from '../gfx/textureLab'
import type { QualitySettings } from '../core/quality'
import type { Audio } from '../core/audio'
import { SingleTouch, type PointerPhase, type PointerSample } from '../core/input'
import { clamp, clamp01, damp, oscillatorStep, smoothstep, type SpringState } from '../core/math'
import { Rng } from '../core/rng'

const UP = new Vector3(0, 1, 0)

type DragMode = 'none' | 'handle' | 'time' | 'push'

interface HarvestedFruit {
  mesh: Mesh
  handle: MangoMaterialHandle
  geometry: BufferGeometry
}

export interface GameDeps {
  renderer: WebGLRenderer
  canvas: HTMLCanvasElement
  textures: TextureBundle
  quality: QualitySettings
  audio: Audio
  seed: number
}

/**
 * The whole experience, wired together: one branch, one fruit, one net, and a
 * camera that carries the child from "what is this thing" to "oh - it catches
 * it" without a single word.
 */
export class Game {
  readonly scene = new Scene()
  readonly director = new CameraDirector()
  readonly state: GameState
  readonly netSim: NetSim
  readonly fruitSim: FruitSim

  private readonly deps: GameDeps
  private readonly touch: SingleTouch
  private readonly netView: NetView
  private readonly branch: BranchRig
  private readonly greenhouse: Greenhouse
  private readonly stem: DynamicTube
  private readonly stemMaterial: MeshPhysicalMaterial
  private readonly stemPts: Vector3[] = []

  private mangoShape: MangoShape
  private mangoGeo: BufferGeometry
  private mangoMat: MangoMaterialHandle
  private mangoMesh: Mesh
  private mangoScale = 1
  private mangoScaleTarget = 1
  private mangoMax = FRUIT.radius
  private mangoBottom = FRUIT.radius
  private squash = 0

  private readonly harvested: HarvestedFruit[] = []
  private harvestTween: {
    t: number
    from: Vector3
    to: Vector3
    rot: Quaternion
    done: boolean
  } | null = null

  // --- pendulum for the still-attached fruit --------------------------------
  private swingX: SpringState = { value: 0, velocity: 0 }
  private swingZ: SpringState = { value: 0, velocity: 0 }
  private stemStretch = 0
  private stemStub = 0

  // --- interaction ---------------------------------------------------------
  private dragMode: DragMode = 'none'
  private dragSide: Side = 'left'
  private dragPlane = new Plane()
  private dragOffset = new Vector3()
  private dragOffsetDecay = 0
  private dragTarget = new Vector3()
  private dragStart = new Vector3()
  private dragDetached = false
  private magnetHook = -1
  private pushPoint = new Vector3()
  private lastPushWorld = new Vector3()
  private pushDelta = new Vector3()
  private timeAccumForTick = 0

  private readonly ray = new Raycaster()
  private readonly ndc = new Vector2()
  private readonly screenA = new Vector2()
  private readonly screenB = new Vector2()
  private readonly tmpA = new Vector3()
  private readonly tmpB = new Vector3()
  private readonly tmpC = new Vector3()
  private readonly invQuat = new Quaternion()
  /** A hanging mango never points straight down; this is its lean. */
  private readonly lean = new Quaternion()
  private readonly restQuat = new Quaternion()
  private readonly lowPoint = { x: 0, y: 0, z: 0 }
  private readonly restLow = { x: 0, y: 0, z: 0 }

  private viewportW = 1
  private viewportH = 1
  private timeScale = 1
  private elapsed = 0
  private playTime = 0
  private gripRamp = 0
  private settledOnce = false
  private openingGlintDone = false
  private hintGlintDone = false
  private fallShot: Shot | null = null
  private forceCloseup = false

  constructor(deps: GameDeps) {
    this.deps = deps
    this.state = new GameState(deps.seed)

    this.greenhouse = new Greenhouse(this.scene, deps.textures, deps.quality, deps.seed)
    this.scene.add(this.greenhouse.group)
    this.scene.environment = deps.textures.env

    this.branch = new BranchRig(deps.textures, deps.quality, deps.seed)
    this.scene.add(this.branch.group)

    this.netSim = new NetSim({ ...NET_GEOMETRY, iterations: deps.quality.netIterations })
    // Start draped over the bench, both ends loose, exactly as found.
    this.netSim.layFlat(0.0, BENCH.top + 0.05, (BENCH.z0 + BENCH.z1) / 2)
    this.netSim.settle(2.2, this.simContext(0))
    this.netView = new NetView(this.netSim, deps.textures, deps.quality)
    this.scene.add(this.netView.group)

    this.fruitSim = new FruitSim({ radius: FRUIT.radius })

    // A peduncle is green wood, not bark: only the relief map is shared.
    this.stemMaterial = new MeshPhysicalMaterial({
      normalMap: deps.textures.barkNormal,
      color: new Color(0.145, 0.175, 0.052),
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.55,
    })
    this.stemMaterial.normalScale.set(0.35, 0.35)
    this.stem = new DynamicTube(9, 7, this.stemMaterial)
    this.scene.add(this.stem.mesh)
    for (let i = 0; i < 9; i++) this.stemPts.push(new Vector3())

    this.mangoShape = makeMangoShape(this.state.profile, FRUIT.radius)
    this.applyExtents()
    this.mangoGeo = buildMangoGeometry(this.mangoShape, ...this.mangoSegments())
    this.mangoMat = makeMangoMaterial(deps.textures)
    this.mangoMat.setProfile(this.state.profile)
    this.mangoMesh = makeMangoMesh(this.mangoGeo, this.mangoMat.material)
    this.scene.add(this.mangoMesh)

    this.netSim.setSurfaceRadiusFn((dx, dy, dz) => this.fruitSurfaceRadius(dx, dy, dz))

    this.touch = new SingleTouch(deps.canvas)
    this.touch.on((phase, s) => this.onPointer(phase, s))

    this.placeAttachedFruit(0)
    this.director.setShot(this.attachShot(), true)
  }

  // ------------------------------------------------------------------ setup

  /** Gravity, breeze and the surfaces the net is allowed to land on. */
  private simContext(wind: number): StepContext {
    return {
      gravity: 9.81,
      wind,
      windPhase: this.state.profile.seed % 100,
      collider: null,
      support: {
        floorY: 0.004,
        benchTop: BENCH.top,
        x0: BENCH.x0,
        x1: BENCH.x1,
        z0: BENCH.z0,
        z1: BENCH.z1,
      },
    }
  }

  private mangoSegments(): [number, number] {
    const t = this.deps.quality.tier
    return t === 'high' ? [104, 68] : t === 'mid' ? [76, 50] : [52, 34]
  }

  private fruitSurfaceRadius(dx: number, dy: number, dz: number): number {
    this.tmpC.set(dx, dy, dz).applyQuaternion(this.invQuat)
    return mangoRadiusAt(this.mangoShape, this.tmpC.x, this.tmpC.y, this.tmpC.z) * this.mangoScale
  }

  /**
   * The fruit rests on the net at its lowest point, which on a mango is well
   * below any nominal radius. Measure it, and tell the catch about it.
   */
  private applyExtents(): void {
    this.lean.setFromAxisAngle(
      this.tmpC.set(0.72, 0.1, 1).normalize(),
      this.mangoShape.tilt * 0.7,
    )
    const e = mangoExtents(this.mangoShape)
    this.mangoMax = e.max
    this.mangoBottom = e.bottom
    this.fruitSim.tuning.radius = e.bottom
  }

  /** Radius used for broad-phase tests and for the grip footprint. */
  private get fruitRadius(): number {
    return this.mangoMax * this.mangoScale
  }

  setViewport(w: number, h: number, insets: SafeInsets): void {
    this.viewportW = w
    this.viewportH = h
    this.director.setViewport(w, h, insets)
  }

  // ------------------------------------------------------------------ input

  private worldToScreen(v: Vector3, out: Vector2): Vector2 {
    this.tmpA.copy(v).project(this.director.camera)
    out.set(
      ((this.tmpA.x + 1) / 2) * this.viewportW,
      ((1 - this.tmpA.y) / 2) * this.viewportH,
    )
    return out
  }

  private screenToPlane(x: number, y: number, out: Vector3): boolean {
    this.ndc.set((x / this.viewportW) * 2 - 1, -((y / this.viewportH) * 2 - 1))
    this.ray.setFromCamera(this.ndc, this.director.camera)
    return this.ray.ray.intersectPlane(this.dragPlane, out) !== null
  }

  private handleNode(side: Side): number {
    return side === 'left' ? this.netSim.handleLeft : this.netSim.handleRight
  }

  private handleWorld(side: Side, out: Vector3): Vector3 {
    const i = this.handleNode(side)
    return out.set(this.netSim.getX(i), this.netSim.getY(i), this.netSim.getZ(i))
  }

  private onPointer(phase: PointerPhase, s: PointerSample): void {
    if (phase === 'down') {
      this.deps.audio.unlock()
      this.deps.audio.resume()
      this.state.noteTouch()
      this.beginDrag(s)
    } else if (phase === 'move') {
      this.continueDrag(s)
    } else {
      this.endDrag()
    }
  }

  private beginDrag(s: PointerSample): void {
    this.dragMode = 'none'
    this.magnetHook = -1
    this.dragDetached = false

    // 1. A cord end, with a pick radius far larger than the cord itself.
    if (this.state.canDragHandles) {
      const screen = new Vector2()
      let best: Side | null = null
      let bestD = HANDLE_PICK_PX
      for (const side of ['left', 'right'] as const) {
        this.handleWorld(side, this.tmpB)
        this.worldToScreen(this.tmpB, screen)
        const d = Math.hypot(screen.x - s.x, screen.y - s.y)
        if (d < bestD) {
          bestD = d
          best = side
        }
      }
      if (best) {
        this.dragSide = best
        this.dragMode = 'handle'
        this.handleWorld(best, this.tmpB)
        this.setDragPlaneAt(this.tmpB)
        this.dragStart.copy(this.tmpB)
        if (this.screenToPlane(s.x, s.y - HANDLE_FINGER_OFFSET_PX, this.tmpA)) {
          // Grab without a jump, then let the cord end rise clear of the
          // fingertip over the next moment so the finger never covers it.
          this.dragOffset.subVectors(this.tmpB, this.tmpA)
          this.dragOffsetDecay = 1
        } else {
          this.dragOffset.set(0, 0, 0)
          this.dragOffsetDecay = 0
        }
        this.dragTarget.copy(this.tmpB)
        return
      }
    }

    // 2. The net itself, once there is a fruit resting in it. The mesh is
    //    tried first, then a generous area around the belly of the sheet, so
    //    a fingertip near the net always counts as touching it.
    if (this.state.canPushNet) {
      let hit: Vector3 | null = null
      if (this.netView.fine) {
        this.ndc.set((s.x / this.viewportW) * 2 - 1, -((s.y / this.viewportH) * 2 - 1))
        this.ray.setFromCamera(this.ndc, this.director.camera)
        const hits = this.ray.intersectObject(this.netView.fine, false)
        if (hits.length > 0) hit = this.tmpA.copy(hits[0].point)
      }
      if (!hit) {
        const reach = this.magnetRadiusPx() * 1.7
        for (const probe of [this.netSim.lowestPanelPoint, this.netSim.centre] as const) {
          probe.call(this.netSim, this.lowPoint)
          this.tmpB.set(this.lowPoint.x, this.lowPoint.y, this.lowPoint.z)
          this.worldToScreen(this.tmpB, this.screenA)
          if (Math.hypot(this.screenA.x - s.x, this.screenA.y - s.y) < reach) {
            hit = this.tmpA.copy(this.tmpB)
            break
          }
        }
      }
      if (hit) {
        this.dragMode = 'push'
        this.pushPoint.copy(hit)
        this.setDragPlaneAt(this.pushPoint)
        this.lastPushWorld.copy(this.pushPoint)
        this.state.notePush()
        return
      }
    }

    // 3. Anywhere else moves the light, and with it the day.
    if (this.state.canScrubTime) this.dragMode = 'time'
  }

  private setDragPlaneAt(point: Vector3): void {
    this.director.camera.getWorldDirection(this.tmpA)
    this.dragPlane.setFromNormalAndCoplanarPoint(this.tmpA.negate(), point)
  }

  private continueDrag(s: PointerSample): void {
    if (this.dragMode === 'handle') {
      if (!this.screenToPlane(s.x, s.y - HANDLE_FINGER_OFFSET_PX, this.tmpA)) return
      this.dragTarget.copy(this.tmpA).addScaledVector(this.dragOffset, this.dragOffsetDecay)
      // Keep the cord end inside the room.
      this.dragTarget.y = clamp(this.dragTarget.y, 0.05, 1.35)
      this.dragTarget.x = clamp(this.dragTarget.x, -1.0, 1.0)
      this.dragTarget.z = clamp(this.dragTarget.z, -0.7, 0.7)
      // Taking a hooked end back off requires a deliberate pull.
      if (!this.dragDetached && this.state.attach[this.dragSide] !== null) {
        if (this.dragTarget.distanceTo(this.dragStart) > 0.038) {
          this.state.detachEnd(this.dragSide)
          this.dragDetached = true
          this.onDetached()
        }
      }
      this.deps.audio.cordSlide(Math.min(1, Math.hypot(s.dx, s.dy) / 26))
    } else if (this.dragMode === 'time') {
      const delta = (s.dx / Math.max(200, this.viewportW)) * 0.9
      const before = this.state.ripeness
      this.state.scrubTime(delta)
      this.greenhouse.setTimeOfDay(this.state.timeOfDay)
      this.timeAccumForTick += Math.abs(delta)
      if (this.timeAccumForTick > 0.085) {
        this.timeAccumForTick = 0
        this.deps.audio.timeTick(this.state.ripeness)
      }
      void before
    } else if (this.dragMode === 'push') {
      if (!this.screenToPlane(s.x, s.y, this.tmpA)) return
      this.tmpB.subVectors(this.tmpA, this.lastPushWorld)
      this.lastPushWorld.copy(this.tmpA)
      const move = this.tmpB.length()
      if (move < 1e-5) return
      // The mesh answers the fingertip at once; the fruit follows heavily.
      this.netSim.addImpulse(
        this.tmpA.x, this.tmpA.y, this.tmpA.z,
        0.115,
        this.tmpB.x * 0.55, this.tmpB.y * 0.55, this.tmpB.z * 0.55,
      )
      this.pushPoint.copy(this.tmpA)
      this.pushDelta.add(this.tmpB)
      this.deps.audio.sway(Math.min(1, move * 14))
    }
  }

  private endDrag(): void {
    if (this.dragMode === 'handle') {
      if (this.magnetHook >= 0) {
        this.state.attachEnd(this.dragSide, this.magnetHook)
        this.branch.glint(this.magnetHook, 1)
        this.deps.audio.hookClick()
      }
      // If it was not hooked, the cord simply hangs from where it was let go
      // and swings down under its own weight. It never snaps back.
    }
    this.dragMode = 'none'
    this.magnetHook = -1
  }

  private onDetached(): void {
    if (this.state.stage === 'oneEnd' || this.state.stage === 'idle') {
      if (this.fruitSim.state.phase === 'cradling' || this.fruitSim.state.phase === 'resting') {
        this.startHarvest()
      }
    }
  }

  // ------------------------------------------------------------------- loop

  update(dtRaw: number): void {
    const dt = Math.min(dtRaw, 1 / 20)
    this.elapsed += dt

    // A gentle ramp into slow motion for the fall and the catch: the physics
    // is untouched, it is simply given time to be read.
    const slow =
      this.state.stage === 'falling' ||
      (this.state.stage === 'cradling' && this.fruitSim.state.contactElapsed < 0.42)
    const target = slow ? 0.62 : this.state.stage === 'loosening' ? 0.88 : 1
    this.timeScale = damp(this.timeScale, target, slow ? 9 : 3.2, dt)
    const sdt = dt * this.timeScale

    this.state.update(dt, this.touch.down)
    this.applyHints(dt)
    this.updateDragDrive(sdt)
    this.syncHandles()

    this.mangoMat.setRipeness(this.state.ripeness)

    const wind =
      this.state.profile.wind *
      (this.state.inCatchWindow ? 0.22 : this.state.stage === 'idle' ? 1.0 : 0.6)

    this.applyPush(dt)
    this.updateFruit(sdt)
    this.applyBreezeBias(sdt)

    const sphere = {
      x: this.fruitSim.state.x,
      y: this.fruitSim.state.y,
      z: this.fruitSim.state.z,
      r: this.fruitRadius,
    }
    const touching =
      this.fruitSim.state.phase === 'cradling' || this.fruitSim.state.phase === 'resting'
    this.netSim.setGripSphere(sphere)
    this.netSim.setGripAmount(this.gripRamp)
    this.netSim.step(sdt, {
      ...this.simContext(wind),
      collider: touching ? sphere : null,
    })
    if (this.state.stage === 'hung') this.netSim.updateRestSnapshot(1 - Math.exp(-3.0 * dt))
    this.netView.update()

    this.branch.setLoad(this.branchLoad())
    this.branch.update(sdt, wind)
    this.branch.setSun(
      this.greenhouse.sunState.direction,
      this.greenhouse.sunState.color,
      this.greenhouse.sunState.intensity / 3.2,
    )
    this.greenhouse.update(dt, this.director.camera)

    this.updateCamera(dt)
    this.updateHarvest(dt)
  }

  render(): void {
    this.deps.renderer.render(this.scene, this.director.camera)
  }

  // -------------------------------------------------------------- mechanics

  private branchLoad(): number {
    let load = 0.45
    if (this.state.bothHooked) load += 0.3
    if (this.fruitSim.state.phase === 'cradling' || this.fruitSim.state.phase === 'resting') {
      load += 0.25
    }
    return clamp01(load)
  }

  /** Drive whichever cord end the finger currently holds. */
  private updateDragDrive(dt: number): void {
    if (this.dragMode !== 'handle') return
    const side = this.dragSide
    const node = this.handleNode(side)
    this.netSim.setPinned(node, false)
    this.dragOffsetDecay = damp(this.dragOffsetDecay, 0, 7, dt)

    // Wide, forgiving magnet, measured on screen rather than in the world:
    // the branch sweeps in depth, so a hook that looks close to the fingertip
    // can be a long way behind it. What the child sees is what counts.
    this.magnetHook = -1
    const radiusPx = this.magnetRadiusPx()
    let bestPx = radiusPx
    const wanted = side === 'left' ? -1 : 1
    this.worldToScreen(this.dragTarget, this.screenA)
    for (const h of this.branch.hooks) {
      if (h.side !== wanted) continue
      this.branch.hookPosition(h.id, this.tmpB)
      // A hook on the far side of the room must never grab the cord.
      if (this.tmpB.distanceTo(this.dragTarget) > 0.5) continue
      this.worldToScreen(this.tmpB, this.screenB)
      const d = Math.hypot(this.screenA.x - this.screenB.x, this.screenA.y - this.screenB.y)
      if (d < bestPx) {
        bestPx = d
        this.magnetHook = h.id
      }
    }

    this.tmpA.copy(this.dragTarget)
    if (this.magnetHook >= 0) {
      this.branch.hookPosition(this.magnetHook, this.tmpB)
      const pull = 1 - smoothstep(radiusPx * 0.12, radiusPx, bestPx)
      this.tmpA.lerp(this.tmpB, pull * 0.9)
      this.branch.glint(this.magnetHook, Math.max(0.35, pull))
    }

    // Approach rather than teleport, so the mesh is pulled, not snapped.
    const k = 1 - Math.exp(-26 * dt)
    this.tmpB.set(this.netSim.getX(node), this.netSim.getY(node), this.netSim.getZ(node))
    this.tmpB.lerp(this.tmpA, k)
    this.netSim.driveNode(node, this.tmpB.x, this.tmpB.y, this.tmpB.z)
  }

  /** Hooked ends stay exactly on their hook, bending branch included. */
  private syncHandles(): void {
    for (const side of ['left', 'right'] as const) {
      const node = this.handleNode(side)
      const hook = this.state.attach[side]
      const dragging = this.dragMode === 'handle' && this.dragSide === side
      if (hook !== null && !dragging) {
        this.branch.hookPosition(hook, this.tmpB)
        this.netSim.setNode(node, this.tmpB.x, this.tmpB.y - 0.012, this.tmpB.z, true)
        this.netSim.setPinned(node, true)
      } else if (!dragging) {
        this.netSim.setPinned(node, false)
      }
    }
  }

  /** How close, on screen, a cord end has to come before a hook takes it. */
  private magnetRadiusPx(): number {
    return clamp(Math.min(this.viewportW, this.viewportH) * 0.22, 78, 165)
  }

  private currentSpan(): number {
    const l = this.state.attach.left
    const r = this.state.attach.right
    if (l === null || r === null) return 0.5
    return Math.abs(this.branch.hooks[r].x - this.branch.hooks[l].x)
  }

  private updateFruit(dt: number): void {
    const s = this.fruitSim.state
    const stage = this.state.stage

    if (this.harvestTween) return

    if (stage === 'idle' || stage === 'oneEnd' || stage === 'hung' || stage === 'loosening') {
      this.hangFromStem(dt, stage === 'loosening')
      if (stage === 'loosening') {
        const t = clamp01(this.state.stageElapsed / this.state.profile.loosenDuration)
        this.stemStretch = t * t * 0.006
      } else {
        this.stemStretch = damp(this.stemStretch, 0, 6, dt)
      }
    } else {
      // The state machine says the stem has finished letting go.
      if (s.phase === 'attached' || s.phase === 'loosening') this.release()
      const tautness = tautnessForSpan(this.currentSpan())
      this.fruitSim.setRest(
        this.netSim.restHeightAt(s.x, s.z, 0.075),
        this.restLow.x,
        this.restLow.z,
      )
      this.fruitSim.tuning.radius = this.mangoBottom * this.mangoScale
      this.fruitSim.update(dt, tautness)
      if (s.justTouched) this.onContact()
      if (s.phase === 'resting' && !this.settledOnce) {
        this.settledOnce = true
        this.state.noteSettled()
        this.playTime = 0
      }
      this.stemStub = damp(this.stemStub, 1, 5, dt)
    }

    this.gripRamp = damp(this.gripRamp, this.netSim.gripCount > 0 ? 1 : 0, 22, dt)
    this.squash = damp(this.squash, 0, 7, dt)
    this.mangoScale = damp(this.mangoScale, this.mangoScaleTarget, 2.2, dt)

    // Pose the fruit: stem end up towards where it hangs (or hung) from.
    this.mangoMesh.position.set(s.x, s.y, s.z)
    if (s.phase === 'attached' || s.phase === 'loosening') {
      this.branch.stemAnchor(STEM.anchor.x + this.state.profile.stemOffset, this.tmpA)
      this.tmpB.subVectors(this.tmpA, this.mangoMesh.position).normalize()
      this.mangoMesh.quaternion.setFromUnitVectors(UP, this.tmpB).multiply(this.lean)
    } else {
      // Free fruit keeps the attitude it left with, easing upright in the net.
      this.tmpB.set(this.mangoShape.tilt * 0.3, 1, this.mangoShape.tilt * 0.18).normalize()
      this.restQuat.setFromUnitVectors(UP, this.tmpB).multiply(this.lean)
      this.mangoMesh.quaternion.slerp(this.restQuat, 1 - Math.exp(-2.4 * dt))
    }
    const sq = 1 - this.squash
    this.mangoMesh.scale.set(
      this.mangoScale * (1 + this.squash * 0.5),
      this.mangoScale * sq,
      this.mangoScale * (1 + this.squash * 0.5),
    )
    this.invQuat.copy(this.mangoMesh.quaternion).invert()

    this.updateStem()
  }

  /** The still-attached fruit swings on its peduncle, heavier as it ripens. */
  private hangFromStem(dt: number, loosening: boolean): void {
    const p = this.state.profile
    const ripe = this.state.ripeness
    const wind = p.wind * (this.state.inCatchWindow ? 0.3 : 0.75)
    const drive = Math.sin(this.elapsed * 0.83 + p.seed % 7) * 0.0065 * wind
    const driveZ = Math.sin(this.elapsed * 0.61 + 2.1) * 0.004 * wind
    // As the abscission layer forms the fruit hangs lower and trembles.
    const tremor = loosening
      ? Math.sin(this.elapsed * 34) * 0.0022 * clamp01(this.state.stageElapsed * 1.6)
      : 0
    oscillatorStep(this.swingX, drive + tremor, 44 - ripe * 8, 3.1, dt)
    oscillatorStep(this.swingZ, driveZ, 40 - ripe * 7, 3.0, dt)

    this.branch.stemAnchor(STEM.anchor.x + p.stemOffset, this.tmpA)
    const len = STEM.length + FRUIT.hangOffset + this.stemStretch + ripe * 0.004
    const dx = Math.sin(this.swingX.value) * len
    const dz = Math.sin(this.swingZ.value) * len
    const dy = -Math.sqrt(Math.max(0.0001, len * len - dx * dx - dz * dz))
    const s = this.fruitSim.state
    const nx = this.tmpA.x + dx
    const ny = this.tmpA.y + dy
    const nz = this.tmpA.z + dz
    s.vx = dt > 0 ? (nx - s.x) / dt : 0
    s.vy = dt > 0 ? (ny - s.y) / dt : 0
    s.vz = dt > 0 ? (nz - s.z) / dt : 0
    s.x = nx
    s.y = ny
    s.z = nz
    this.mangoScaleTarget = 1 + this.state.ripeness * 0.035
  }

  private placeAttachedFruit(dt: number): void {
    this.stemStub = 0
    this.fruitSim.state.phase = 'attached'
    this.hangFromStem(Math.max(dt, 1 / 60), false)
    this.mangoMesh.position.set(
      this.fruitSim.state.x,
      this.fruitSim.state.y,
      this.fruitSim.state.z,
    )
    this.updateStem()
  }

  private release(): void {
    const s = this.fruitSim.state
    this.netSim.lowestRestPoint(this.restLow)
    const restY = this.netSim.restHeightAt(s.x, s.z, 0.075)
    this.fruitSim.release(restY, this.restLow.x, this.restLow.z)
    // Carry the swing through, but never enough to miss the net.
    s.vx = clamp(s.vx, -0.12, 0.12)
    s.vz = clamp(s.vz, -0.1, 0.1)
    s.vy = clamp(s.vy, -0.25, 0)
    this.stemStub = 0
  }

  private onContact(): void {
    const s = this.fruitSim.state
    this.netSim.beginGrip({ x: s.x, y: s.y, z: s.z, r: this.fruitRadius })
    this.netSim.setGripAmount(0)
    this.gripRamp = 0
    this.state.noteContact()
    this.branch.impulse(0.16 * clamp(s.impactSpeed, 0.4, 2.4))
    this.squash = clamp(s.impactSpeed * 0.012, 0, 0.028)
    this.deps.audio.contact(clamp(s.impactSpeed / 2.1, 0.25, 1))
  }

  private updateStem(): void {
    const p = this.state.profile
    this.branch.stemAnchor(STEM.anchor.x + p.stemOffset, this.tmpA)
    const attached =
      this.fruitSim.state.phase === 'attached' || this.fruitSim.state.phase === 'loosening'

    if (attached) {
      // A curved peduncle from the branch down to the fruit's shoulder.
      this.tmpB.copy(this.mangoMesh.position)
      this.tmpB.y += this.mangoBottom * this.mangoScale * 0.94
      for (let i = 0; i < this.stemPts.length; i++) {
        const t = i / (this.stemPts.length - 1)
        this.stemPts[i].lerpVectors(this.tmpA, this.tmpB, t)
        this.stemPts[i].x += Math.sin(t * Math.PI) * 0.006
        this.stemPts[i].z += Math.sin(t * Math.PI) * 0.004
      }
      const thin = 1 - this.state.ripeness * 0.34
      this.stem.update(this.stemPts, (t) =>
        STEM.radius * (1.35 - 0.5 * t) * (t > 0.55 ? thin : 1) * (1 - this.stemStretch * 12),
      )
    } else {
      // After the fruit lets go a short stalk is left on the branch, recoiling
      // gently. It stays clearly readable: it is one of the three things the
      // child has to be able to see at once.
      const len = STEM.length * 0.52
      for (let i = 0; i < this.stemPts.length; i++) {
        const t = i / (this.stemPts.length - 1)
        this.stemPts[i].set(
          this.tmpA.x + Math.sin(t * 1.4) * 0.008 * this.stemStub,
          this.tmpA.y - t * len * (1 - 0.18 * this.stemStub),
          this.tmpA.z + Math.sin(t * 2.1) * 0.005,
        )
      }
      this.stem.update(this.stemPts, (t) => STEM.radius * (1.5 - 0.55 * t))
    }
  }

  /**
   * Turn this frame's fingertip travel into a slow shove on the fruit. Capped,
   * so no amount of scrubbing can throw the fruit out of the net.
   */
  private applyPush(dt: number): void {
    if (this.dragMode !== 'push' || dt <= 0) {
      this.pushDelta.set(0, 0, 0)
      return
    }
    if (this.pushDelta.lengthSq() < 1e-10) return
    this.tmpB.copy(this.pushDelta).divideScalar(dt)
    const speed = this.tmpB.length()
    if (speed > 1.4) this.tmpB.multiplyScalar(1.4 / speed)
    this.fruitSim.nudgeVelocity(
      this.tmpB.x * 0.3,
      this.tmpB.y * 0.3,
      this.tmpB.z * 0.3,
      1 - Math.exp(-4.5 * dt),
    )
    this.pushDelta.set(0, 0, 0)
  }

  private applyBreezeBias(dt: number): void {
    // Only one side stirs at the start: the loose end is the live thing here.
    if (this.state.stage !== 'idle' && this.state.stage !== 'oneEnd') return
    if (this.dragMode === 'handle') return
    const side: Side = this.state.attach.left === null ? 'left' : 'right'
    if (this.state.attach[side] !== null) return
    this.handleWorld(side, this.tmpA)
    const a = 0.00055 * this.state.profile.wind * dt * 60
    this.netSim.addImpulse(
      this.tmpA.x, this.tmpA.y, this.tmpA.z,
      0.16,
      Math.sin(this.elapsed * 1.31) * a,
      Math.sin(this.elapsed * 1.9) * a * 0.35,
      Math.cos(this.elapsed * 0.97) * a * 0.7,
    )
  }

  // ------------------------------------------------------------------ hints

  private applyHints(dt: number): void {
    // One reflection off the hooks at the very start: the branch says "here".
    if (!this.openingGlintDone && this.elapsed > 1.1) {
      this.openingGlintDone = true
      this.branch.glint(1, 0.9)
      this.branch.glint(5, 0.9)
    }

    const phase = this.state.hintPhase
    if (this.state.hintKind === 'reachForHook' && phase > 0) {
      const side: Side = this.state.attach.left === null ? 'left' : 'right'
      if (this.state.attach[side] === null) {
        const hook = this.nearestHook(side)
        if (hook >= 0) {
          if (!this.hintGlintDone) {
            this.branch.glint(hook, 0.8)
            this.hintGlintDone = true
          }
          this.handleWorld(side, this.tmpA)
          this.branch.hookPosition(hook, this.tmpB)
          this.tmpB.sub(this.tmpA).normalize()
          // A short reach and back. It never gets there on its own.
          const swing = Math.sin(phase * Math.PI * 2) * 0.0022 * dt * 60
          this.netSim.addImpulse(
            this.tmpA.x, this.tmpA.y, this.tmpA.z,
            0.13,
            this.tmpB.x * swing, this.tmpB.y * swing, this.tmpB.z * swing,
          )
        }
      }
    } else {
      this.hintGlintDone = false
    }

    if (this.state.hintKind === 'nudgeTime' && phase > 0) {
      const k = Math.sin(phase * Math.PI)
      this.greenhouse.setGlowBoost(k)
      this.greenhouse.setTimeOfDay(this.state.timeOfDay + k * 0.03)
    } else if (this.state.hintKind !== 'nudgeTime') {
      this.greenhouse.setGlowBoost(0)
    }
  }

  private nearestHook(side: Side): number {
    this.handleWorld(side, this.tmpA)
    const wanted = side === 'left' ? -1 : 1
    let best = -1
    let bestD = Infinity
    for (const h of this.branch.hooks) {
      if (h.side !== wanted) continue
      this.branch.hookPosition(h.id, this.tmpB)
      const d = this.tmpB.distanceTo(this.tmpA)
      if (d < bestD) {
        bestD = d
        best = h.id
      }
    }
    return best
  }

  // ----------------------------------------------------------------- camera

  private attachShot(): Shot {
    return {
      name: 'attach',
      target: [0, 0.685, 0],
      halfW: 0.44,
      halfH: 0.43,
      focal: 52,
      yaw: 0.2,
      pitch: 0.03,
      smooth: 1.5,
    }
  }

  private ripenShot(): Shot {
    return {
      name: 'ripen',
      target: [0, 0.79, 0],
      halfW: 0.35,
      halfH: 0.35,
      focal: 58,
      yaw: 0.15,
      pitch: 0.01,
      smooth: 1.7,
    }
  }

  /**
   * The shot the game is built around. It is computed once, before the fruit
   * lets go, and then never changes: peduncle, fruit and net stay inside one
   * frame from before the release until well after the catch.
   */
  private computeFallShot(): Shot {
    this.netSim.lowestRestPoint(this.restLow)
    const top = this.fruitSim.state.y + this.fruitRadius + 0.075
    const bottom = this.restLow.y - 0.155
    const cy = (top + bottom) / 2
    const hh = (top - bottom) / 2 + 0.015
    const span = this.currentSpan()
    return {
      name: 'fall',
      target: [0, cy, 0],
      halfW: clamp(span * 0.33 + 0.13, 0.26, 0.42),
      halfH: Math.max(0.24, hh),
      focal: 60,
      yaw: 0.13,
      pitch: 0.0,
      smooth: 1.9,
    }
  }

  private updateCamera(dt: number): void {
    if (this.forceCloseup) {
      const f = this.fruitSim.state
      this.director.freeze(false)
      this.director.setShot({
        name: 'audit',
        target: [f.x, f.y, f.z],
        halfW: 0.115,
        halfH: 0.115,
        focal: 92,
        yaw: 0.22,
        pitch: 0.03,
        smooth: 0.35,
      })
      this.director.update(dt)
      return
    }
    const st = this.state.stage
    if (st === 'idle' || st === 'oneEnd') {
      this.fallShot = null
      this.settledOnce = this.fruitSim.state.phase === 'resting' ? this.settledOnce : false
      this.director.freeze(false)
      this.director.setShot(this.attachShot())
    } else if (st === 'hung') {
      this.director.freeze(false)
      if (this.state.ripeness < 0.48) {
        this.fallShot = null
        this.director.setShot(this.ripenShot())
      } else {
        // Settle into the catch framing well before anything happens.
        if (!this.fallShot) this.fallShot = this.computeFallShot()
        this.director.setShot(this.fallShot)
      }
    } else if (st === 'loosening' || st === 'falling' || st === 'cradling') {
      if (!this.fallShot) this.fallShot = this.computeFallShot()
      this.director.setShot(this.fallShot)
      // Absolutely no move between letting go and coming to rest.
      this.director.freeze(true)
    } else {
      this.director.freeze(false)
      this.playTime += dt
      if (this.playTime < 0.5 && this.fallShot) {
        this.director.setShot(this.fallShot)
      } else if (this.playTime < 4.4) {
        const s = this.fruitSim.state
        this.director.setShot({
          name: 'close',
          target: [s.x * 0.6, s.y + 0.012, s.z * 0.5],
          halfW: 0.155,
          halfH: 0.15,
          focal: 88,
          yaw: 0.17,
          pitch: -0.02,
          smooth: 2.5,
        })
      } else {
        this.netSim.centre(this.lowPoint)
        this.director.setShot({
          name: 'play',
          target: [this.lowPoint.x * 0.5, this.lowPoint.y + 0.055, 0],
          halfW: 0.28,
          halfH: 0.26,
          focal: 70,
          yaw: 0.15,
          pitch: 0.0,
          smooth: 2.2,
        })
      }
    }
    this.director.update(dt)
  }

  // ---------------------------------------------------------------- harvest

  private startHarvest(): void {
    this.netSim.releaseGrip()
    this.gripRamp = 0
    const s = this.fruitSim.state
    const slot = this.harvested.length % 5
    const rng = new Rng(this.state.profile.seed ^ 0x1177)
    const to = new Vector3(
      -0.3 + slot * 0.135 + rng.jitter(0.012),
      BENCH.top + this.fruitRadius * 0.74,
      0.055 + rng.jitter(0.02),
    )
    this.harvestTween = {
      t: 0,
      from: new Vector3(s.x, s.y, s.z),
      to,
      rot: new Quaternion().setFromAxisAngle(
        new Vector3(0.25, 0.2, 1).normalize(),
        Math.PI * 0.46 + rng.jitter(0.3),
      ),
      done: false,
    }
    s.phase = 'attached'
  }

  private updateHarvest(dt: number): void {
    const h = this.harvestTween
    if (!h) return
    h.t += dt / 0.85
    const t = clamp01(h.t)
    const e = t * t * (3 - 2 * t)
    this.mangoMesh.position.lerpVectors(h.from, h.to, e)
    // A small arc so it rolls out of the net rather than teleporting down.
    this.mangoMesh.position.y += Math.sin(t * Math.PI) * 0.035
    this.mangoMesh.quaternion.slerp(h.rot, 1 - Math.exp(-4 * dt))
    this.fruitSim.state.x = this.mangoMesh.position.x
    this.fruitSim.state.y = this.mangoMesh.position.y
    this.fruitSim.state.z = this.mangoMesh.position.z

    if (t >= 1 && !h.done) {
      h.done = true
      this.deps.audio.woodKnock()
      this.harvested.push({
        mesh: this.mangoMesh,
        handle: this.mangoMat,
        geometry: this.mangoGeo,
      })
      while (this.harvested.length > 5) {
        const old = this.harvested.shift()
        if (old) {
          this.scene.remove(old.mesh)
          old.geometry.dispose()
          old.handle.dispose()
        }
      }
      this.spawnNextFruit()
      this.harvestTween = null
    }
  }

  private spawnNextFruit(): void {
    this.mangoShape = makeMangoShape(this.state.profile, FRUIT.radius)
    this.applyExtents()
    this.mangoGeo = buildMangoGeometry(this.mangoShape, ...this.mangoSegments())
    this.mangoMat = makeMangoMaterial(this.deps.textures)
    this.mangoMat.setProfile(this.state.profile)
    this.mangoMat.setRipeness(0)
    this.mangoMesh = makeMangoMesh(this.mangoGeo, this.mangoMat.material)
    this.scene.add(this.mangoMesh)
    // The new fruit is already there, still small, still hard green.
    this.mangoScale = 0.42
    this.mangoScaleTarget = 1
    this.settledOnce = false
    this.fallShot = null
    this.swingX.value = 0
    this.swingX.velocity = 0
    this.swingZ.value = 0
    this.swingZ.velocity = 0
    this.placeAttachedFruit(1 / 60)
  }

  // ------------------------------------------------------------- e2e helper

  /** Snapshot of everything a test needs, with no rendering involved. */
  debugState(): Record<string, unknown> {
    const s = this.fruitSim.state
    this.netSim.lowestPanelPoint(this.lowPoint)
    const f = this.director.debugFraming()
    return {
      stage: this.state.stage,
      round: this.state.round,
      harvested: this.state.harvested,
      ripeness: Number(this.state.ripeness.toFixed(4)),
      timeOfDay: Number(this.state.timeOfDay.toFixed(4)),
      attach: { ...this.state.attach },
      fruit: { x: s.x, y: s.y, z: s.z, phase: s.phase, sink: s.sink, maxSink: s.maxSink },
      netLow: { ...this.lowPoint },
      gripCount: this.netSim.gripCount,
      hint: this.state.hintKind,
      drag: this.dragMode,
      camera: {
        dist: f.dist,
        focal: f.focal,
        halfW: f.halfW,
        halfH: f.halfH,
        pos: this.director.camera.position.toArray(),
      },
      timeScale: this.timeScale,
    }
  }

  /** Screen position of a cord end, in CSS pixels (capture and tests only). */
  handleScreen(side: Side): { x: number; y: number } {
    this.handleWorld(side, this.tmpB)
    const out = new Vector2()
    this.worldToScreen(this.tmpB, out)
    return { x: out.x, y: out.y }
  }

  hookScreen(id: number): { x: number; y: number } {
    this.branch.hookPosition(id, this.tmpB)
    const out = new Vector2()
    this.worldToScreen(this.tmpB, out)
    return { x: out.x, y: out.y }
  }

  netScreen(): { x: number; y: number } {
    this.netSim.centre(this.lowPoint)
    const out = new Vector2()
    this.worldToScreen(this.tmpB.set(this.lowPoint.x, this.lowPoint.y, this.lowPoint.z), out)
    return { x: out.x, y: out.y }
  }

  /** Attach both ends without a finger, for deterministic capture. */
  forceAttach(leftHook: number, rightHook: number): void {
    this.state.attachEnd('left', leftHook)
    this.state.attachEnd('right', rightHook)
    this.syncHandles()
    this.netSim.settle(2.2, this.simContext(0))
    this.netSim.snapshotRest()
    this.netView.update()
  }

  setCloseup(on: boolean): void {
    this.forceCloseup = on
  }

  scrub(amount: number): void {
    this.state.scrubTime(amount)
    this.greenhouse.setTimeOfDay(this.state.timeOfDay)
  }

  /** Push the net from underneath, as a fingertip would. */
  pokeNet(strength = 0.006): void {
    this.netSim.lowestPanelPoint(this.lowPoint)
    this.netSim.addImpulse(
      this.lowPoint.x, this.lowPoint.y, this.lowPoint.z,
      0.13,
      0, strength, 0,
    )
    this.fruitSim.addImpulse(0.05, 0.32, 0)
    this.state.notePush()
  }

  dispose(): void {
    this.touch.dispose()
    this.netView.dispose()
    this.branch.dispose()
    this.stem.dispose()
    this.stemMaterial.dispose()
    this.mangoGeo.dispose()
    this.mangoMat.dispose()
    for (const h of this.harvested) {
      h.geometry.dispose()
      h.handle.dispose()
    }
  }
}
