import * as THREE from 'three'
import { World } from './world'
import { CameraRig } from './core/camera'
import { Input } from './core/gestures'
import { Audio } from './core/audio'
import { Hud } from './ui/hud'
import { FLAVORS, flavorById, type Flavor } from './core/flavors'
import { POSES } from './scene/poses'
import type { Ctx, Stage, StageId } from './stages/types'
import { introStage, mixStage, pourStage, toOvenStage } from './stages/mixPour'
import { bakeStage, coolStage, flipStage, mountStage, takeoutStage } from './stages/bakeFlip'
import { liftStage, pressStage, releaseStage } from './stages/unmold'
import { LAYOUT } from './world'
import type { ChiffonState } from './automation'

const ORDER: StageId[] = [
  'intro',
  'mix',
  'pour',
  'toOven',
  'bake',
  'takeout',
  'flip',
  'mount',
  'cool',
  'release',
  'lift',
  'press',
  'done',
]

export class Game {
  readonly world: World
  readonly rig = new CameraRig()
  readonly input: Input
  readonly hud: Hud
  readonly audio = new Audio()
  private stage: Stage | null = null
  private stageElapsed = 0
  private clock = 0
  flavor: Flavor = FLAVORS[0]
  /** Stage entries in order — the automated play-throughs assert on this. */
  readonly history: ChiffonState[] = []
  nextFlavor: Flavor = FLAVORS[0]
  plays = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    canvas: HTMLCanvasElement,
    quality: 'high' | 'low',
  ) {
    this.world = new World(renderer, quality, this.flavor)
    this.input = new Input(canvas)
    this.hud = new Hud(this.input)

    this.hud.onSound = (m) => this.audio.setMuted(m)
    this.hud.onRestart = () => this.restart(this.flavor)
    this.hud.onFlavor = (f) => {
      this.nextFlavor = f
    }
    this.hud.onAgain = () => {
      this.plays++
      this.restart(this.nextFlavor)
    }

    // Any first touch unlocks WebAudio on iOS.
    canvas.addEventListener('pointerdown', () => this.audio.ensure(), { once: false })
  }

  private ctx(): Ctx {
    return {
      world: this.world,
      rig: this.rig,
      input: this.input,
      hud: this.hud,
      audio: this.audio,
      flavor: this.flavor,
      plays: this.plays,
      next: () => this.advance(),
      goto: (id) => this.goto(id),
    }
  }

  private build(id: StageId): Stage {
    const c = this.ctx()
    switch (id) {
      case 'intro':
        return introStage(c)
      case 'mix':
        return mixStage(c)
      case 'pour':
        return pourStage(c)
      case 'toOven':
        return toOvenStage(c)
      case 'bake':
        return bakeStage(c)
      case 'takeout':
        return takeoutStage(c)
      case 'flip':
        return flipStage(c)
      case 'mount':
        return mountStage(c)
      case 'cool':
        return coolStage(c)
      case 'release':
        return releaseStage(c)
      case 'lift':
        return liftStage(c)
      case 'press':
        return pressStage(c)
      default:
        return this.doneStage()
    }
  }

  private doneStage(): Stage {
    return {
      id: 'done',
      enter: () => {
        this.input.set(null)
        this.hud.hideGuide()
        this.rig.goTo(POSES.final, 1.4)
        this.nextFlavor = this.flavor
        this.hud.showFinish(FLAVORS, this.flavor.id)
      },
      update: () => {},
      exit: () => this.hud.hideFinish(),
    }
  }

  goto(id: StageId) {
    this.stage?.exit?.()
    this.stage = this.build(id)
    this.stageElapsed = 0
    this.stage.enter()
    if (this.history.length < 400) this.history.push(this.debugState())
  }

  advance() {
    const i = this.stage ? ORDER.indexOf(this.stage.id) : -1
    this.goto(ORDER[Math.min(ORDER.length - 1, i + 1)])
  }

  start() {
    this.goto('intro')
  }

  restart(flavor: Flavor) {
    this.flavor = flavor
    this.nextFlavor = flavor
    this.hud.hideFinish()
    this.world.reattachCake()
    this.world.reset(flavor)
    this.goto('intro')
  }

  /** Screen rotation, tab switch or a lost pointer: park everything safely. */
  interrupt() {
    this.input.abort()
  }

  resize(w: number, h: number) {
    this.input.resize(w, h)
    this.rig.resize(w, h)
    this.hud.layout()
  }

  update(dt: number) {
    this.clock += dt
    this.stageElapsed += dt
    this.stage?.update(dt, this.stageElapsed)
    this.rig.update(dt)
    this.world.lighting.update(dt)
    this.world.kitchen.oven.update(dt)
    this.world.mitts.update(dt)
    this.world.steam.update(this.clock)
    this.world.haze.update(this.clock)

    // Steam and shimmer live above whatever the pan is doing right now.
    const p = this.world.pan.root.position
    const flipped = Math.abs(this.world.pan.flipPivot.rotation.z) > Math.PI * 0.5
    this.world.steam.points.position.set(p.x, p.y + (flipped ? 0.02 : 0.09), p.z)
    this.world.haze.mesh.position.set(p.x, p.y + 0.16, p.z + 0.02)
    this.world.haze.mesh.lookAt(this.rig.camera.position)
    this.world.haze.amount = this.world.pan.heat
    this.world.haze.mesh.visible = this.world.pan.heat > 0.05
  }

  get currentStage(): StageId {
    return this.stage?.id ?? 'intro'
  }

  /** Deterministic hooks for automated play-throughs. */
  debugState(): ChiffonState {
    return {
      stage: this.currentStage,
      flavor: this.flavor.id,
      plays: this.plays,
      rise: this.world.chiffon.mesh.morphTargetInfluences?.[1] ?? 0,
      fill: this.world.chiffon.mesh.morphTargetInfluences?.[0] ?? 0,
      flipDeg: (this.world.pan.flipPivot.rotation.z * 180) / Math.PI,
      panY: this.world.pan.root.position.y,
      mountedOnBottle:
        this.world.bottle.visible &&
        Math.abs(this.world.pan.root.position.y - LAYOUT.mountY) < 0.02 &&
        Math.abs(this.world.pan.flipPivot.rotation.z - Math.PI) < 0.25,
      cakeDetached: this.world.chiffon.group.parent === this.world.cakeAnchor,
      press: this.world.chiffon.mesh.morphTargetInfluences?.[2] ?? 0,
      finishVisible: !document.getElementById('finish')!.classList.contains('hidden'),
    }
  }

  setFlavorById(id: string) {
    this.nextFlavor = flavorById(id)
  }
}
