/**
 * 建設工程の state machine。部材ごとに状態を持ち、接続位置・許容範囲・使用 gesture・
 * camera preset・次工程を data（layout.ts）から読む。
 */
import * as THREE from 'three'
import { FAST_MODE, detectQuality, downgrade, type QualitySettings } from './core/env'
import { clamp, damp, smoothstep } from './core/rng'
import { createPalette, type Palette } from './world/materials'
import { buildEnvironment, buildSite, type SiteRefs } from './world/site'
import {
  CAMERAS,
  FASTENERS,
  PLACEMENTS,
  ROUND1,
  ROUND2,
  SITE,
  type ChuteVariant,
  type FastenerId,
  type PartId,
  type PartStatus,
  type StepDef,
} from './build/layout'
import { buildPart, buildTestBall } from './build/parts'
import { chamferBox, hexNut, mergeInto, washer } from './build/geometry'
import { CRANE_RATES, Crane, type CraneInput } from './crane/crane'
import { CameraRig } from './camera/rig'
import { Child, Worker } from './actors/people'
import { Rider, buildSlidePath, type PathNode } from './play/rider'
import { Hud, type HotspotSpec } from './ui/hud'

const DEG = Math.PI / 180

/** 部材ごとの前提工程（画面回転や再読込のあと状態を復元するために使う） */
const LIFT_STEPS: Record<string, PartId> = {
  'r1-colA': 'columnA',
  'r1-colB': 'columnB',
  'r1-platform': 'platform',
  'r1-stair': 'stair',
  'r1-chute': 'chute',
  'r1-railL': 'handrailL',
  'r1-railR': 'handrailR',
  'r2-colA': 'columnA',
  'r2-colB': 'columnB',
  'r2-platform': 'platform',
  'r2-chute': 'chute',
}

interface SavedState {
  round: number
  stepIndex: number
  variant: ChuteVariant
}

type Mode = 'idle' | 'lift' | 'fasten' | 'inspect' | 'ballRun' | 'rideSeq' | 'wait'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private rig: CameraRig
  private q: QualitySettings
  private pal: Palette
  private site: SiteRefs
  private crane: Crane
  private hud: Hud
  private assembly = new THREE.Group()
  private layDown = new THREE.Group()
  private parts = new Map<PartId, THREE.Group>()
  private status = new Map<PartId, PartStatus>()
  private fasteners = new Map<FastenerId, { mesh: THREE.Group; progress: number }>()
  private workers: Worker[] = []
  private child: Child
  private ball: THREE.Mesh
  private tool: THREE.Group
  private rider: Rider
  private childRider: Rider
  private slidePath: PathNode[]

  private steps: StepDef[] = ROUND1
  private stepIndex = 0
  private round = 1
  private variant: ChuteVariant = 'straight'
  private mode: Mode = 'idle'
  private timer = 0
  private speedScale = FAST_MODE ? 3 : 1

  private dragStartU = 0
  private wasSwiping = false
  private activeFastenIndex = 0
  private rideStage = 0
  private rideT = 0
  private gateOpen = 0
  private clock = new THREE.Clock()
  private fpsAccum = 0
  private fpsFrames = 0
  private started = false
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private tmp3 = new THREE.Vector3()

  constructor(private container: HTMLElement) {
    this.q = detectQuality()
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.q.tier !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setPixelRatio(this.q.pixelRatio)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    if (this.q.shadowMapSize > 0) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = this.q.tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    }
    container.appendChild(this.renderer.domElement)

    this.scene.environment = buildEnvironment(this.renderer)
    this.scene.environmentIntensity = 1.0
    this.pal = createPalette(Math.min(this.renderer.capabilities.getMaxAnisotropy(), Math.max(this.q.anisotropy, 8)))
    this.site = buildSite(this.scene, this.pal, this.q)
    this.scene.add(this.assembly, this.layDown)
    this.rig = new CameraRig(1)
    this.crane = new Crane(this.pal, this.q, this.speedScale)
    this.scene.add(this.crane.group)

    for (let i = 0; i < 3; i++) {
      const w = new Worker(this.pal, 1.7 + i * 0.03)
      w.group.position.set(-2.4 + i * 1.6, 0, 2.0 + i * 0.7)
      w.target.copy(w.group.position)
      this.scene.add(w.group)
      this.workers.push(w)
    }
    this.child = new Child(this.pal)
    this.child.group.position.set(0.4, 0, SITE.fence.minZ - 1.1)
    this.child.target.copy(this.child.group.position)
    this.scene.add(this.child.group)

    this.ball = buildTestBall(this.pal)
    this.ball.visible = false
    this.scene.add(this.ball)
    this.tool = this.buildTool()
    this.tool.visible = false
    this.scene.add(this.tool)

    this.slidePath = buildSlidePath(this.variant)
    this.rider = new Rider(this.slidePath, this.variant, 'ball')
    this.childRider = new Rider(this.slidePath, this.variant, 'child')

    this.hud = new Hud(container)
    this.hud.bindCanvas(this.renderer.domElement)
    this.hud.setBadge(`${this.q.tier}${FAST_MODE ? ' / fast' : ''}`)
    this.hud.onHotspotProgress = (id, d) => this.onFastenProgress(id, d)
    this.hud.onHotspotSwipe = (id) => this.onSwipeHotspot(id)
    this.hud.onTapAdvance = () => this.onTap()

    this.resize()
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120))

    this.resetSite()
    this.restore()
    this.hud.showStart(() => this.begin())
    this.renderer.setAnimationLoop(() => this.frame())
    this.exposeTestApi()
  }

  // ------------------------------------------------------------ 生成物

  private buildTool(): THREE.Group {
    const g = new THREE.Group()
    const body = mergeInto(g, chamferBox(0.12, 0.15, 0.26, 0.008), this.pal.craneBody)
    body.position.set(0, 0.17, 0.06)
    const grip = mergeInto(g, chamferBox(0.07, 0.16, 0.08, 0.006), this.pal.rubber)
    grip.position.set(0, 0.09, 0.16)
    const socket = mergeInto(g, new THREE.CylinderGeometry(0.036, 0.036, 0.1, 8), this.pal.boltSteel)
    socket.position.set(0, 0.06, 0)
    g.userData.socket = socket
    return g
  }

  private ensurePart(id: PartId): THREE.Group {
    let p = this.parts.get(id)
    if (p && (id !== 'chute' || p.userData.variant === this.variant)) return p
    if (p) {
      p.parent?.remove(p)
      p.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
    }
    p = buildPart(id, this.pal, this.q, this.variant)
    p.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.parts.set(id, p)
    return p
  }

  private placeAtLaydown(id: PartId) {
    const p = this.ensurePart(id)
    const pl = PLACEMENTS[id]
    p.position.set(pl.layDown.x, pl.layDown.y, pl.layDown.z)
    p.quaternion.setFromEuler(
      new THREE.Euler(pl.layDown.pitchDeg * DEG, pl.layDown.yawDeg * DEG, (pl.layDown.rollDeg ?? 0) * DEG, 'YXZ'),
    )
    p.visible = true
    if (p.parent !== this.layDown) this.layDown.add(p)
    this.status.set(id, 'stored')
  }

  private seatPart(id: PartId) {
    const p = this.ensurePart(id)
    const pl = PLACEMENTS[id]
    p.position.set(pl.seat.x, pl.seat.y, pl.seat.z)
    p.quaternion.setFromEuler(new THREE.Euler(pl.seat.pitchDeg * DEG, pl.seat.yawDeg * DEG, 0, 'YXZ'))
    p.visible = true
    if (p.parent !== this.assembly) this.assembly.add(p)
    this.status.set(id, 'connected')
  }

  /** 現場を初期状態へ戻す（部材を仮置き場へ並べ直す） */
  private resetSite() {
    for (const id of Object.keys(PLACEMENTS) as PartId[]) this.placeAtLaydown(id)
    for (const [, f] of this.fasteners) f.mesh.parent?.remove(f.mesh)
    this.fasteners.clear()
    this.crane.endLift()
    this.ball.visible = false
    this.rider.reset()
    this.childRider.reset()
    this.child.pose = 'stand'
    this.child.autoWalk = true
    this.child.group.position.set(0.4, 0, SITE.fence.minZ - 1.1)
    this.child.target.copy(this.child.group.position)
    this.gateOpen = 0
    this.workers.forEach((w, i) => {
      w.mode = 0
      w.group.position.set(-2.4 + i * 1.6, 0, 2.0 + i * 0.7)
      w.target.copy(w.group.position)
    })
  }

  private makeFastener(id: FastenerId): THREE.Group {
    const spec = FASTENERS[id]
    const g = new THREE.Group()
    // 代表ピン・代表ボルトは大きめにする（全ボルトは省略するが、接合の意味は残す）
    if (spec.axis === 'x') {
      const pin = mergeInto(g, new THREE.CylinderGeometry(0.019, 0.019, 0.24, 12), this.pal.boltSteel)
      pin.rotation.z = Math.PI / 2
      const head = mergeInto(g, new THREE.CylinderGeometry(0.038, 0.038, 0.022, 12), this.pal.boltSteel)
      head.rotation.z = Math.PI / 2
      head.position.x = -0.13
      const clip = mergeInto(g, new THREE.TorusGeometry(0.026, 0.005, 6, 14), this.pal.boltSteel)
      clip.rotation.y = Math.PI / 2
      clip.position.x = 0.115
    } else {
      const w = mergeInto(g, washer(0.086, 0.04, 0.008), this.pal.boltSteel)
      w.position.y = 0
      const nut = mergeInto(g, hexNut(0.066, 0.036), this.pal.boltSteel)
      nut.position.y = 0.008
      const shank = mergeInto(g, new THREE.CylinderGeometry(0.019, 0.019, 0.11, 12), this.pal.boltSteel)
      shank.position.y = 0.005
    }
    g.position.set(spec.pos[0], spec.pos[1], spec.pos[2])
    this.assembly.add(g)
    return g
  }

  private setFastenerProgress(id: FastenerId, p: number) {
    const f = this.fasteners.get(id)
    if (!f) return
    f.progress = clamp(p, 0, 1)
    const spec = FASTENERS[id]
    if (spec.axis === 'x') {
      f.mesh.position.x = spec.pos[0] + (1 - f.progress) * 0.22 * (spec.pos[0] < 0 ? -1 : 1)
    } else {
      f.mesh.position.y = spec.pos[1] + (1 - f.progress) * 0.05
      f.mesh.rotation.y = f.progress * Math.PI * 6
    }
  }

  // ------------------------------------------------------------ 工程

  private begin() {
    this.started = true
    this.clock.getDelta()
    this.enterStep(this.stepIndex, true)
  }

  private get step(): StepDef {
    return this.steps[Math.min(this.stepIndex, this.steps.length - 1)]
  }

  private enterStep(index: number, snapCamera = false) {
    this.stepIndex = clamp(index, 0, this.steps.length - 1)
    const step = this.step
    this.save()
    this.hud.setStep(step.title, step.hint, this.stepIndex, this.steps.length)
    this.rig.setPreset(step.camera, snapCamera)
    this.rig.setOffset(0, 0, 0)
    this.rig.clearLiftBlend()
    this.timer = 0
    this.pending.length = 0
    this.mode = 'idle'
    this.hud.setHotspots([])
    this.hud.showDirHint(0)
    this.tool.visible = false
    this.workers.forEach((w) => (w.mode = 0))

    switch (step.kind) {
      case 'beat':
        this.mode = 'wait'
        this.hud.showPendant(false)
        this.hud.showRotary(false)
        break
      case 'lift':
        this.startLift(step.part!)
        break
      case 'fasten':
        this.startFasten(step)
        break
      case 'inspect':
        this.mode = 'inspect'
        this.hud.showPendant(false)
        this.hud.showRotary(false)
        this.workers[0].target.set(1.35, 0, -1.5)
        this.workers[0].mode = 3
        this.workers[1].target.set(1.4, 0, 0.7)
        this.workers[1].mode = 3
        this.workers[2].target.set(1.2, 0, -3.4)
        this.workers[2].mode = 3
        break
      case 'ball':
        this.startBall()
        break
      case 'ride':
        this.startRide()
        break
      case 'choose':
        this.hud.showPendant(false)
        this.hud.showRotary(false)
        this.mode = 'wait'
        this.hud.showChooser(this.variant, (v) => {
          this.variant = v
          this.slidePath = buildSlidePath(v)
          this.rider.setPath(this.slidePath, v)
          this.childRider.setPath(this.slidePath, v)
          this.assembly.clear()
          this.resetSite()
          this.next()
        })
        break
      case 'auto':
        this.mode = 'wait'
        this.hud.showPendant(false)
        this.hud.showRotary(false)
        for (const id of step.autoInstall ?? []) this.seatPart(id)
        this.workers[0].target.set(-1.0, 0, 1.6)
        this.workers[0].mode = 3
        this.workers[1].target.set(1.0, 0, 1.6)
        this.workers[1].mode = 3
        break
    }
  }

  private next() {
    if (this.stepIndex >= this.steps.length - 1) {
      this.finishRound()
      return
    }
    this.enterStep(this.stepIndex + 1)
  }

  private finishRound() {
    const first = this.round === 1
    this.hud.showFinish(
      first ? 'できあがり！' : 'できた！',
      first
        ? 'なにも　なかった　ばしょが、すべりだいに　なりました。つぎは　さいごの　すべるところを　じぶんで　えらべます。'
        : 'さいごの　いちくかんを　かえると、すべりかたが　かわります。ほかのも　ためしてみよう。',
      [
        {
          label: first ? 'つぎを　つくる' : 'べつの　さいごを　ためす',
          run: () => {
            this.round = 2
            this.steps = ROUND2
            this.enterStep(0, true)
          },
        },
        {
          label: 'もういちど　すべる',
          ghost: true,
          run: () => {
            this.enterStep(this.steps.length - 1, false)
          },
        },
      ],
    )
    this.mode = 'wait'
  }

  private startLift(part: PartId) {
    const p = this.ensurePart(part)
    if (p.parent !== this.layDown) this.layDown.add(p)
    const pl = PLACEMENTS[part]
    p.position.set(pl.layDown.x, pl.layDown.y, pl.layDown.z)
    p.quaternion.setFromEuler(
      new THREE.Euler(pl.layDown.pitchDeg * DEG, pl.layDown.yawDeg * DEG, (pl.layDown.rollDeg ?? 0) * DEG, 'YXZ'),
    )
    this.status.set(part, 'rigged')
    this.mode = 'lift'
    this.hud.showPendant(true)
    this.hud.showRotary(true)
    this.dragStartU = 0
    this.crane.beginLift(p, pl, () => {
      this.status.set(part, 'connected')
      this.seatPart(part)
      this.crane.endLift()
      this.hud.toast(part === 'platform' ? 'たかい　ゆかが　できた' : 'ついた！', 1.6)
      this.next()
    })
    // 作業員：合図者と介錯ロープ係。吊荷の下には入らない。
    this.workers[0].mode = 1
    this.workers[1].mode = 2
    this.workers[2].mode = 0
  }

  private startFasten(step: StepDef) {
    this.mode = 'fasten'
    this.hud.showPendant(false)
    this.hud.showRotary(false)
    this.activeFastenIndex = 0
    for (const id of step.fasteners ?? []) {
      if (!this.fasteners.has(id)) {
        this.fasteners.set(id, { mesh: this.makeFastener(id), progress: 0 })
        this.setFastenerProgress(id, 0)
      }
    }
    this.workers[0].mode = 3
    this.workers[0].target.set(-1.5, 0, 0.4)
    this.updateFastenUi()
  }

  private updateFastenUi() {
    const step = this.step
    const list = step.fasteners ?? []
    const id = list[this.activeFastenIndex]
    if (!id) return
    const spec = FASTENERS[id]
    this.rig.setPreset(spec.camera)
    const f = this.fasteners.get(id)!
    this.hud.setHotspots([
      {
        id,
        world: new THREE.Vector3(spec.pos[0], spec.pos[1] + (spec.axis === 'y' ? 0.06 : 0.0), spec.pos[2]),
        kind: step.fastenMode === 'pin' ? 'push' : 'turn',
        progress: f.progress,
        done: f.progress >= 1,
      } satisfies HotspotSpec,
    ])
    // 工具・ボルト・接合する二部材を同時に見せる
    this.tool.visible = step.fastenMode === 'bolt'
    this.tool.position.set(spec.pos[0] + 0.12, spec.pos[1] + 0.02, spec.pos[2] + 0.1)
    this.tool.rotation.y = -0.6
  }

  private onFastenProgress(id: string, delta: number) {
    if (this.mode !== 'fasten') return
    const f = this.fasteners.get(id as FastenerId)
    if (!f || f.progress >= 1) return
    this.crane.resetIdle()
    this.setFastenerProgress(id as FastenerId, f.progress + delta * 1.25)
    if (f.progress >= 1) {
      this.hud.toast('しまった！', 1.2)
      const list = this.step.fasteners ?? []
      if (this.activeFastenIndex < list.length - 1) {
        this.activeFastenIndex++
        this.after(0.42, () => this.updateFastenUi())
      } else {
        this.hud.setHotspots([])
        this.tool.visible = false
        this.after(0.7, () => this.next())
      }
    } else {
      this.updateFastenUi()
    }
  }

  private startBall() {
    this.mode = 'ballRun'
    this.hud.showPendant(false)
    this.hud.showRotary(false)
    this.rider.setPath(this.slidePath, this.variant)
    this.rider.reset()
    this.ball.visible = true
    const n = this.slidePath[2]
    this.ball.position.copy(n.pos).addScaledVector(n.up, 0.115)
    this.hud.setHotspots([{ id: 'ball', world: this.ball.position.clone(), kind: 'swipe', progress: 0, done: false }])
    // 試験ボールを見る作業員はカメラ側（-x）に立たせない
    this.workers[0].mode = 3
    this.workers[0].target.set(2.2, 0, -3.2)
    this.workers[1].target.set(2.3, 0, -0.6)
    this.workers[2].target.set(2.0, 0, 4.6)
  }

  private startRide() {
    this.mode = 'rideSeq'
    this.rideStage = 0
    this.rideT = 0
    this.hud.showPendant(false)
    this.hud.showRotary(false)
    this.hud.setHotspots([])
    this.childRider.setPath(this.slidePath, this.variant)
    this.childRider.reset()
    this.child.autoWalk = true
    this.child.pose = 'walk'
    this.child.group.position.set(0.35, 0, SITE.fence.minZ - 1.2)
    this.child.target.set(0.35, 0, SITE.fence.minZ - 1.2)
    this.rig.setPreset('gate')
    // 柵を開けたら作業員は区域の外へ出て見守る（吊荷も工事も終わっている）
    const standBy: Array<[number, number]> = [
      [3.2, -6.4],
      [2.3, -6.9],
      [-2.8, -6.6],
    ]
    this.workers.forEach((w, i) => {
      w.mode = 0
      w.target.set(standBy[i][0], 0, standBy[i][1])
    })
  }

  private onSwipeHotspot(id: string) {
    this.crane.resetIdle()
    if (id === 'ball' && this.mode === 'ballRun') {
      this.rider.start()
      this.hud.setHotspots([])
      this.hud.toast('ためしすべり', 1.4)
    } else if (id === 'child' && this.mode === 'rideSeq' && this.rideStage === 3) {
      this.childRider.start()
      this.child.pose = 'slide'
      this.rideStage = 4
      this.hud.setHotspots([])
    }
  }

  private onTap() {
    if (this.mode === 'wait' && this.step.kind === 'beat') this.next()
  }

  // ------------------------------------------------------------ ループ

  private resize() {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.renderer.setPixelRatio(this.q.pixelRatio)
    this.rig.setViewport(w, h)
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta())
    if (!this.started) {
      this.rig.update(dt)
      this.renderer.render(this.scene, this.rig.camera)
      return
    }
    this.tick(dt)
    this.renderer.render(this.scene, this.rig.camera)
    this.watchPerformance(dt)
  }

  /** テストから時間を直接進められるようにしておく */
  advance(seconds: number) {
    const stepDt = 1 / 60
    let left = seconds
    while (left > 0) {
      this.tick(Math.min(stepDt, left))
      left -= stepDt
    }
  }

  /** 実時間の setTimeout ではなく、シミュレーション時間で遅延実行する */
  private after(seconds: number, fn: () => void) {
    this.pending.push({ t: seconds / this.speedScale, fn })
  }

  private pending: Array<{ t: number; fn: () => void }> = []

  private tick(dt: number) {
    this.hud.tick(dt)
    this.timer += dt
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].t -= dt
      if (this.pending[i].t <= 0) {
        const fn = this.pending[i].fn
        this.pending.splice(i, 1)
        fn()
      }
    }

    switch (this.mode) {
      case 'wait':
        if (this.step.kind === 'beat' && this.timer > (this.step.duration ?? 4) / this.speedScale) this.next()
        if (this.step.kind === 'auto' && this.timer > (this.step.duration ?? 3) / this.speedScale) this.next()
        break
      case 'lift':
        this.tickLift(dt)
        break
      case 'inspect':
        if (this.timer > (this.step.duration ?? 5) / this.speedScale) {
          for (const id of this.parts.keys()) if (this.status.get(id) === 'connected') this.status.set(id, 'inspected')
          this.hud.toast('てんけん　かんりょう', 1.4)
          this.next()
        }
        break
      case 'ballRun':
        this.tickBall(dt)
        break
      case 'rideSeq':
        this.tickRide(dt)
        break
      default:
        break
    }

    if (this.mode !== 'lift') this.hud.showDirHint(0)
    this.crane.update(dt, this.mode === 'lift' ? this.craneInput(dt) : { hoist: 0, slew: 0, yaw: 0 }, this.hasInput())
    for (const w of this.workers) w.update(dt, this.mode === 'lift' ? this.crane.hookPosition : undefined)
    this.child.update(dt, this.mode === 'rideSeq' ? undefined : this.craneOrStructure())
    this.updateGate(dt)
    this.rig.update(dt)
    this.hud.projectHotspots(this.rig.camera, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight)
    if (this.q.shadowMapSize > 0) {
      const f = this.rig.camera.position
      // 影マップの範囲を注視点まわりに保つ。朝の低めの太陽を保った移動。
      const look = this.rig.camera.position
      this.site.sun.position.set(look.x * 0.15 - 10.5, 7.6, look.z * 0.15 + 7.2)
      this.site.sun.target.position.set(look.x * 0.15, 0.6, look.z * 0.15)
      void f
      this.site.sun.target.updateMatrixWorld()
    }
  }

  private craneOrStructure(): THREE.Vector3 {
    return this.tmp2.set(0, 1.3, -0.4)
  }

  private hasInput(): boolean {
    return this.hud.hoist !== 0 || this.hud.swipeActive || Math.abs(this.hud.yawDelta) > 1e-4
  }

  private craneInput(dt: number): CraneInput {
    const yawRate = CRANE_RATES.yawDeg * DEG * this.speedScale
    // 旋回：画面右方向がどちらの旋回になるかを毎フレーム求め、gesture と機械動作を一致させる
    const tangent = this.crane.pathTangentWorld(this.tmp)
    const hook = this.crane.hookPosition
    const a = hook.clone().project(this.rig.camera)
    const b = hook.clone().addScaledVector(tangent, 0.6).project(this.rig.camera)
    const sign = b.x - a.x >= 0 ? 1 : -1

    if (this.hud.swipeActive && !this.wasSwiping) this.dragStartU = this.crane.u
    this.wasSwiping = this.hud.swipeActive
    let slew = 0
    if (this.hud.swipeActive) {
      const width = this.renderer.domElement.clientWidth || 1
      const desired = clamp(this.dragStartU + (sign * this.hud.swipeDx) / (width * 0.5), 0, 1)
      slew = clamp((desired - this.crane.u) * 7, -1, 1)
    }

    let yaw = 0
    if (Math.abs(this.hud.yawDelta) > 1e-5) {
      const step = yawRate * dt
      yaw = clamp(this.hud.yawDelta / Math.max(1e-5, step), -1, 1)
      this.hud.yawDelta -= yaw * step
      if (Math.abs(this.hud.yawDelta) < 1e-4) this.hud.yawDelta = 0
    }

    let input: CraneInput = { hoist: this.hud.hoist, slew, yaw }

    // 迷ったときの補助。工程が止まらないようにゆっくり正解方向へ寄せる。
    const idleLimit = 13 / this.speedScale
    if (this.crane.idleTime > idleLimit && this.crane.phase === 'manual') {
      const a2 = this.crane.autoAssistInput()
      input = { hoist: a2.hoist, slew: a2.slew, yaw: a2.yaw }
    }
    return input
  }

  private tickLift(_dt: number) {
    const phase = this.crane.phase
    // 画角：吊荷を追いながら、取付位置へ近づくにつれて工程の preset へ寄る。
    // 縦画面でも吊荷が小さくならないよう、部材の大きさから必要な画角を決める。
    const id = this.step.part!
    const part = this.parts.get(id)
    const r = this.partRadius(id)
    const load = this.tmp2.copy(this.partCenter(id))
    if (part) load.applyMatrix4(part.matrixWorld)
    // 吊荷と取付先の両方が入る最小の画角。寄りすぎて接続先を見失わせない。
    const seat = CAMERAS[this.step.camera]?.target ?? [0, 1.2, 0]
    const seatV = this.tmp3.set(seat[0], seat[1], seat[2])
    const gap = load.distanceTo(seatV) / 2
    const centre = this.tmp3.lerpVectors(load, seatV, 0.38)
    const closeIn = phase === 'settle' || phase === 'landed' ? 1 : smoothstep((this.crane.u - 0.28) / 0.5)
    this.rig.setLiftBlend(centre, Math.max(1.35, gap * 0.72 + r * 0.55), Math.max(1.1, gap * 0.45 + r * 0.5), closeIn)
    const aligned = this.crane.isWithinAssist
    // 玉掛け中も触れる状態のままにして、押した瞬間だけ操作が死ぬのを避ける
    this.hud.showPendant(
      true,
      this.crane.needsHoist || this.crane.idleTime > 5 / this.speedScale,
      phase === 'manual',
    )
    this.hud.showRotary(true, aligned, phase === 'manual')
    if (this.crane.needsHoist && this.timer - this.lastHoistHint > 3.5) {
      this.lastHoistHint = this.timer
      this.hud.toast('もっと　たかく　あげてから', 1.6)
    }
    if (this.crane.tagCorrecting && this.timer - this.lastTagHint > 4) {
      this.lastTagHint = this.timer
      this.hud.toast('むきを　なおしています', 1.6)
    }
    if (phase === 'manual' && !this.crane.needsHoist) {
      const need = 1 - this.crane.u
      if (Math.abs(need) > (PLACEMENTS[this.step.part!].uTol ?? 0.05) && this.crane.idleTime > 5 / this.speedScale) {
        const tangent = this.crane.pathTangentWorld(this.tmp)
        const hook = this.crane.hookPosition
        const a = hook.clone().project(this.rig.camera)
        const b = hook.clone().addScaledVector(tangent, 0.6).project(this.rig.camera)
        const sign = b.x - a.x >= 0 ? 1 : -1
        this.hud.showDirHint(need * sign > 0 ? 1 : -1)
      } else {
        this.hud.showDirHint(0)
      }
    } else {
      this.hud.showDirHint(0)
    }
    // 介錯ロープ係は吊荷の真下に入らない。部材の短辺側へ回り込む。
    this.workers[1].target.copy(this.crane.tagHandPoint)
    this.workers[1].target.y = 0
    // 合図者は取付位置の向こう側（カメラの反対側）に立つ。手前で画を塞がない。
    const pl2 = PLACEMENTS[this.step.part!]
    const cam = this.rig.camera.position
    const away = this.tmp.set(pl2.placeXZ.x - cam.x, 0, pl2.placeXZ.z - cam.z)
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1)
    away.normalize()
    this.workers[0].target.set(
      clamp(pl2.placeXZ.x + away.x * 1.7 - away.z * 0.9, SITE.fence.minX + 0.7, SITE.fence.maxX - 0.7),
      0,
      clamp(pl2.placeXZ.z + away.z * 1.7 + away.x * 0.9, SITE.fence.minZ + 0.7, SITE.fence.maxZ - 0.7),
    )
    this.workers[2].target.set(2.1, 0, 4.4)
    this.crane.viewPoint.copy(cam)
    // 位置合わせの寄り（全体姿勢が分からなくなるほどは寄らない）
    if (this.step.part === 'chute') {
      if (phase === 'settle') this.rig.setPreset(this.timerHalf() ? 'alignBottom' : 'alignTop')
      else if (this.rig.key !== 'chuteLift') this.rig.setPreset('chuteLift')
    }
  }

  private radiusCache = new Map<PartId, number>()
  private centreCache = new Map<PartId, THREE.Vector3>()

  /** 部材ローカル座標での重心相当（外接箱の中心） */
  private partCenter(id: PartId): THREE.Vector3 {
    const cached = this.centreCache.get(id)
    if (cached) return cached
    const p = this.parts.get(id)
    const v = new THREE.Vector3()
    if (p) {
      const saveP = p.position.clone()
      const saveQ = p.quaternion.clone()
      p.position.set(0, 0, 0)
      p.quaternion.identity()
      p.updateMatrixWorld(true)
      new THREE.Box3().setFromObject(p).getCenter(v)
      p.position.copy(saveP)
      p.quaternion.copy(saveQ)
      p.updateMatrixWorld(true)
    }
    this.centreCache.set(id, v)
    return v
  }

  /** 部材の外接半径。画角を決めるのに使う。 */
  private partRadius(id: PartId): number {
    const cached = this.radiusCache.get(id)
    if (cached !== undefined) return cached
    const p = this.parts.get(id)
    if (!p) return 1.2
    const box = new THREE.Box3().setFromObject(p)
    const r = box.getSize(new THREE.Vector3()).length() / 2
    const v = Math.max(0.7, Math.min(2.4, r))
    this.radiusCache.set(id, v)
    return v
  }

  private timerHalf(): boolean {
    return (Date.now() / 900) % 2 < 1
  }

  private tickBall(dt: number) {
    if (this.rider.running || this.rider.finished) {
      const n = this.rider.update(dt)
      this.ball.position.copy(n.pos).addScaledVector(n.up, 0.115)
      this.ball.rotation.x = -this.rider.spin
      this.rig.setOffset(0, clamp(n.pos.y - 1.0, -0.75, 0.9), clamp(n.pos.z + 1.9, -2.2, 1.5))
      if (this.rider.finished) {
        this.timer = Math.min(this.timer, 999)
        if (!this.ballDone) {
          this.ballDone = true
          this.hud.toast('ちゃんと　ながれた', 1.6)
          this.after(1.4, () => {
            this.ballDone = false
            this.ball.visible = false
            this.rig.setOffset(0, 0, 0)
            this.next()
          })
        }
      }
    } else {
      // 発進前も滑走面の上端を画面に入れておく（下の走路も見えるよう控えめに寄せる）
      this.rig.setOffset(0, 0.5, 1.0)
      this.hud.setHotspots([{ id: 'ball', world: this.ball.position.clone(), kind: 'swipe', progress: 0, done: false }])
    }
  }
  private ballDone = false
  private lastHoistHint = -9
  private lastTagHint = -9

  private tickRide(dt: number) {
    this.rideT += dt
    const s = this.speedScale
    switch (this.rideStage) {
      case 0: {
        this.gateOpen = Math.min(1, this.gateOpen + dt * 0.8 * s)
        this.child.pose = 'walk'
        this.child.target.set(0.35, 0, SITE.fence.minZ + 0.9)
        this.followChild(dt, 0.75)
        if (this.gateOpen >= 1 && this.child.group.position.z > SITE.fence.minZ + 0.75) {
          this.rideStage = 1
          this.rideT = 0
          this.rig.setPreset('stairSet')
        }
        break
      }
      case 1: {
        // 柵の外周を通って階段へ（吊荷や作業区域の中央は通らない）
        const wp: Array<[number, number]> = [
          [2.0, -3.4],
          [2.1, 0.8],
          [0.6, 2.45],
        ]
        const i = Math.min(wp.length - 1, Math.floor(this.rideT * 0.62 * s))
        this.child.target.set(wp[i][0], 0, wp[i][1])
        this.followChild(dt, 0.8)
        const d = this.child.group.position.distanceTo(new THREE.Vector3(0.6, 0, 2.45))
        if (d < 0.25) {
          this.rideStage = 2
          this.rideT = 0
          this.child.autoWalk = false
          this.child.pose = 'climb'
        }
        break
      }
      case 2: {
        if (this.rig.key !== 'climb') this.rig.setPreset('climb')
        this.followChild(dt, 0.55)
        const t = clamp(this.rideT * 0.55 * s, 0, 1)
        const z = 2.25 - t * (2.25 - 0.16)
        const y = t * (SITE.deckTop - 0.02)
        this.child.group.position.set(0.12, y, z)
        this.child.group.rotation.y = Math.PI
        if (t >= 1) {
          this.rideStage = 3
          this.rideT = 0
          this.child.pose = 'sit'
          const n = this.slidePath[3]
          this.child.group.position.copy(n.pos).addScaledVector(n.up, 0.02)
          this.child.group.rotation.y = Math.PI
          this.rig.setPreset('ride')
          this.rig.setOffset(0, 0.5, 1.0)
          this.hud.setHotspots([
            { id: 'child', world: this.child.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), kind: 'swipe', progress: 0, done: false },
          ])
        }
        break
      }
      case 3: {
        this.rig.setOffset(0, 0.5, 1.0)
        const n = this.slidePath[3]
        this.child.group.position.copy(n.pos).addScaledVector(n.up, 0.02)
        this.hud.setHotspots([
          { id: 'child', world: this.child.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), kind: 'swipe', progress: 0, done: false },
        ])
        break
      }
      case 4: {
        const n = this.childRider.update(dt)
        this.child.group.position.copy(n.pos).addScaledVector(n.up, 0.02)
        this.child.group.rotation.y = Math.PI
        this.rig.setOffset(0, clamp(n.pos.y - 1.0, -0.75, 0.9), clamp(n.pos.z + 1.9, -2.2, 1.5))
        if (this.childRider.finished) {
          this.rideStage = 5
          this.rideT = 0
          this.child.pose = 'cheer'
          this.child.autoWalk = false
          this.hud.toast('すべれた！', 2)
        }
        break
      }
      default: {
        if (this.rideT > 2.2 / s) {
          this.rig.setOffset(0, 0, 0)
          this.next()
        }
      }
    }
  }

  /** 子どもを追う注視点オフセット（カメラ操作は gesture に割り当てない） */
  private followChild(dt: number, weight: number) {
    const base = CAMERAS[this.rig.key]?.target ?? [0, 1, 0]
    const p = this.child.group.position
    this.followOffset.x = damp(this.followOffset.x, (p.x - base[0]) * weight, 3, dt)
    this.followOffset.y = damp(this.followOffset.y, (p.y + 0.55 - base[1]) * weight, 3, dt)
    this.followOffset.z = damp(this.followOffset.z, (p.z - base[2]) * weight, 3, dt)
    this.rig.setOffset(this.followOffset.x, this.followOffset.y, this.followOffset.z)
  }

  private followOffset = new THREE.Vector3()

  private updateGate(dt: number) {
    const leaves = this.site.gate.children
    for (const leaf of leaves) {
      const sx = (leaf.userData.sx as number) ?? 1
      leaf.rotation.y = damp(leaf.rotation.y, -sx * this.gateOpen * 1.5, 4, dt)
    }
  }

  private watchPerformance(dt: number) {
    if (FAST_MODE) return
    this.fpsAccum += dt
    this.fpsFrames++
    if (this.fpsAccum >= 3) {
      const fps = this.fpsFrames / this.fpsAccum
      this.fpsAccum = 0
      this.fpsFrames = 0
      if (fps < 26) {
        const lower = downgrade(this.q)
        if (lower) {
          this.q = lower
          this.renderer.setPixelRatio(this.q.pixelRatio)
          this.renderer.shadowMap.enabled = this.q.shadowMapSize > 0
          this.hud.setBadge(this.q.tier)
        }
      }
    }
  }

  // ------------------------------------------------------------ 保存・復元

  private save() {
    try {
      const s: SavedState = { round: this.round, stepIndex: this.stepIndex, variant: this.variant }
      sessionStorage.setItem('park-slide', JSON.stringify(s))
    } catch {
      /* プライベートモードなど。保存できなくても進行は続く */
    }
  }

  private restore() {
    let s: SavedState | null = null
    try {
      const raw = sessionStorage.getItem('park-slide')
      if (raw) s = JSON.parse(raw) as SavedState
    } catch {
      s = null
    }
    if (!s) return
    this.round = s.round === 2 ? 2 : 1
    this.steps = this.round === 2 ? ROUND2 : ROUND1
    this.variant = s.variant ?? 'straight'
    this.slidePath = buildSlidePath(this.variant)
    this.rider.setPath(this.slidePath, this.variant)
    this.childRider.setPath(this.slidePath, this.variant)
    this.stepIndex = clamp(s.stepIndex, 0, this.steps.length - 1)
    this.rebuildTo(this.stepIndex)
  }

  /** 指定工程の直前までの取り付け状態を復元する（画面回転で巻き戻らないように） */
  private rebuildTo(index: number) {
    for (let i = 0; i < index; i++) {
      const st = this.steps[i]
      const part = LIFT_STEPS[st.id]
      if (st.kind === 'lift' && part) this.seatPart(part)
      if (st.kind === 'auto') for (const id of st.autoInstall ?? []) this.seatPart(id)
      if (st.kind === 'fasten') {
        for (const id of st.fasteners ?? []) {
          if (!this.fasteners.has(id)) this.fasteners.set(id, { mesh: this.makeFastener(id), progress: 1 })
          this.setFastenerProgress(id, 1)
        }
      }
    }
  }

  // ------------------------------------------------------------ テスト用 API

  private exposeTestApi() {
    const api = {
      ready: true,
      state: () => ({
        round: this.round,
        stepId: this.step.id,
        stepIndex: this.stepIndex,
        stepCount: this.steps.length,
        mode: this.mode,
        variant: this.variant,
        cranePhase: this.crane.phase,
        u: this.crane.u,
        installed: Array.from(this.status.entries())
          .filter(([, v]) => v === 'connected' || v === 'inspected')
          .map(([k]) => k),
        quality: this.q.tier,
        portrait: window.innerHeight > window.innerWidth,
      }),
      start: () => {
        this.hud.hideScreen()
        if (!this.started) this.begin()
      },
      advance: (s: number) => this.advance(s),
      /** 工程を自動で完了させる（E2E 用） */
      completeStep: () => this.completeStepForTest(),
      chooseVariant: (v: ChuteVariant) => {
        this.variant = v
        this.slidePath = buildSlidePath(v)
        this.rider.setPath(this.slidePath, v)
        this.childRider.setPath(this.slidePath, v)
      },
      riderSpeed: () => ({ ball: this.rider.speed, child: this.childRider.speed }),
      /** 完成パネルなどの全画面 UI を閉じて次の建設へ進む（E2E 用） */
      nextRound: () => {
        this.hud.hideScreen()
        this.round = 2
        this.steps = ROUND2
        this.enterStep(0, true)
      },
    }
    ;(window as unknown as Record<string, unknown>).__slide = api
  }

  private completeStepForTest() {
    const step = this.step
    switch (step.kind) {
      case 'beat':
      case 'inspect':
      case 'auto':
        this.next()
        break
      case 'lift': {
        this.seatPart(step.part!)
        this.crane.endLift()
        this.next()
        break
      }
      case 'fasten': {
        for (const id of step.fasteners ?? []) {
          if (!this.fasteners.has(id)) this.fasteners.set(id, { mesh: this.makeFastener(id), progress: 1 })
          this.setFastenerProgress(id, 1)
        }
        this.hud.setHotspots([])
        this.next()
        break
      }
      case 'ball': {
        // すでに流れている／流れ終わっているなら、時間の経過に任せる
        if (!this.rider.running && !this.rider.finished) this.rider.start()
        break
      }
      case 'ride': {
        if (this.rideStage >= 4) break
        if (this.rideStage < 3) {
          this.rideStage = 3
          this.child.autoWalk = false
          this.child.pose = 'sit'
        }
        this.onSwipeHotspot('child')
        break
      }
      case 'choose': {
        this.assembly.clear()
        this.resetSite()
        this.next()
        break
      }
    }
  }
}
