import * as THREE from 'three'
import { Stage } from '../core/renderer'
import { CameraRig, type ShotName } from '../core/cameraRig'
import { Input } from '../core/input'
import { Audio } from '../core/audio'
import { Hud } from '../ui/hud'
import { buildMaterials } from '../world/materials'
import { Cake, type CreamKey, type LayerKey } from '../world/cake'
import { Props } from '../world/props'
import { buildKitchen } from '../world/kitchen'
import { setupLighting } from '../world/lighting'
import { CandySystem } from '../sim/candy'
import { Crumbs } from '../sim/crumbs'
import { DIM, WEDGE_END, WEDGE_START, Y } from '../world/dims'
import { clamp, damp, smoothstep, TAU } from '../core/rng'
import { FAST, SEED } from '../core/flags'

const MAX_DT = FAST ? 1 / 8 : 1 / 24

export type StageId =
  | 'intro'
  | 'placeBase'
  | 'cream1'
  | 'placeRing1'
  | 'cream2'
  | 'placeRing2'
  | 'pour'
  | 'cream3'
  | 'placeLid'
  | 'secret'
  | 'coat'
  | 'cut'
  | 'reveal'
  | 'done'

const HINTS: Record<StageId, string> = {
  intro: '',
  placeBase: 'ケーキを　まんなかへ　はこぼう',
  cream1: 'クリームを　ぬろう',
  placeRing1: 'あなの　あいた　ケーキを　かさねよう',
  cream2: 'クリームを　ぬろう',
  placeRing2: 'もう　いちど　かさねよう',
  pour: 'あなの　うえで　ながく　おして\nおかしを　いれよう',
  cream3: 'クリームを　ぬろう',
  placeLid: 'ふたを　して　かくそう',
  secret: 'おかしが　かくれた',
  coat: 'よこに　なぞって　まわそう',
  cut: 'うえから　したへ　きろう',
  reveal: 'わあ　でてきた！',
  done: 'できあがり！',
}

/**
 * Where the tools live. Portrait stacks them into the foreground below the cake;
 * landscape spreads them left and right, because a short screen has no room
 * underneath. Both keep the cake itself unobstructed.
 */
const LAYOUT = {
  portrait: {
    bowl: new THREE.Vector3(-9.8, DIM.tableTop, 18.5),
    bowlRest: new THREE.Vector3(-16.5, DIM.tableTop, 8),
    knife: new THREE.Vector3(15.5, DIM.tableTop + 0.2, 9),
    knifeRot: new THREE.Euler(Math.PI / 2, 0, -0.9),
    layer: new THREE.Vector3(5.6, -1.0, 17.5),
  },
  landscape: {
    bowl: new THREE.Vector3(-15.2, DIM.tableTop, 9),
    bowlRest: new THREE.Vector3(-18.5, DIM.tableTop, 1),
    knife: new THREE.Vector3(17.5, DIM.tableTop + 0.2, -2),
    knifeRot: new THREE.Euler(Math.PI / 2, 0, 1.95),
    layer: new THREE.Vector3(13.5, -1.0, 7.5),
  },
} as const

const CENTER = new THREE.Vector3(0, 0, 0)

/** Which sponge layer each "place" stage is asking for. */
const PLACE_TARGET: Partial<Record<StageId, LayerKey>> = {
  placeBase: 'base',
  placeRing1: 'ring1',
  placeRing2: 'ring2',
  placeLid: 'lid',
}
const CREAM_TARGET: Partial<Record<StageId, CreamKey>> = {
  cream1: 'cream1',
  cream2: 'cream2',
  cream3: 'cream3',
}
const SHOT_FOR: Record<StageId, ShotName> = {
  intro: 'stack',
  placeBase: 'stack',
  cream1: 'stack',
  placeRing1: 'stack',
  cream2: 'stack',
  placeRing2: 'stack',
  pour: 'pour',
  cream3: 'stack',
  placeLid: 'stack',
  secret: 'stack',
  coat: 'coat',
  cut: 'cut',
  reveal: 'reveal',
  done: 'done',
}

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpNdc = new THREE.Vector2()
const IDENTITY = new THREE.Quaternion()

/**
 * One cake, start to finish. Every scene asks for exactly one thing, and any
 * touch anywhere on screen drives that one thing — a four year old never has to
 * find a small target.
 */
export class Game {
  readonly stageObj: Stage
  private rig: CameraRig
  private input: Input
  private audio = new Audio()
  private hud: Hud
  private mats = buildMaterials()
  private cake: Cake
  private props: Props
  private candy: CandySystem
  private crumbs: Crumbs

  stage: StageId = 'intro'
  private t = 0
  private idle = 0
  private seed = SEED || 1

  // per-stage scratch state
  private dragging = false
  private returning = false
  private settleT = -1
  private settleKey: LayerKey | null = null
  private creamProgress = 0
  private coatProgress = 0
  private spinVel = 0
  private cutProgress = 0
  private cutPhase = 0
  private cutTimer = 0
  private cutY = 0
  private revealT = 0
  private opened = false
  private openedAt = 0
  private pouring = false
  private bowlTilt = 0
  private bowlHome = new THREE.Vector3()
  private bowlRest = new THREE.Vector3()
  private knifeHome = new THREE.Vector3()
  private knifeHomeRot = new THREE.Euler()
  private spatulaHome = new THREE.Vector3()
  private layerStage = new THREE.Vector3()
  private pourAccum = 0
  private pourIdle = 0
  private tickBudget = 0

  constructor(canvas: HTMLCanvasElement) {
    this.stageObj = new Stage(canvas)
    this.rig = new CameraRig(this.stageObj.camera)
    this.input = new Input(canvas)
    this.hud = new Hud(() => this.restart())

    this.cake = new Cake(this.mats)
    this.props = new Props(this.mats)
    this.candy = new CandySystem(this.mats)
    this.crumbs = new Crumbs()

    setupLighting(this.stageObj.scene)
    this.stageObj.scene.add(buildKitchen(this.mats))
    this.stageObj.scene.add(this.props.root)
    this.props.turntable.add(this.cake.root)
    this.stageObj.scene.add(this.candy.root, this.candy.ghostRoot, this.crumbs.mesh)

    this.spatulaHome.copy(this.props.spatula.position)
    this.applyLayout(true)

    this.input.onFirstInteraction(() => this.audio.unlock())
    this.candy.reset(this.newSeed())
    this.rig.set('stack', this.stageObj.viewport, true)
    this.syncCavity()
  }

  /** Re-place the tools for the current orientation, snapping anything at rest. */
  private applyLayout(snap: boolean) {
    const L = this.stageObj.viewport.portrait ? LAYOUT.portrait : LAYOUT.landscape
    this.bowlHome.copy(L.bowl)
    this.bowlRest.copy(L.bowlRest)
    this.knifeHome.copy(L.knife)
    this.knifeHomeRot.copy(L.knifeRot)
    this.layerStage.copy(L.layer)
    const idleStages: StageId[] = [
      'intro',
      'placeBase',
      'cream1',
      'placeRing1',
      'cream2',
      'placeRing2',
      'cream3',
      'placeLid',
    ]
    if (snap || idleStages.includes(this.stage)) {
      this.props.bowl.position.copy(this.bowlHome)
    }
    if (snap || this.stage !== 'cut') {
      this.props.knife.position.copy(this.knifeHome)
      this.props.knife.rotation.copy(this.knifeHomeRot)
    }
    const key = PLACE_TARGET[this.stage]
    if (key && !this.dragging) {
      const l = this.cake.layer(key)
      if (!l.placed) l.holder.position.copy(this.layerStage)
    }
  }

  private newSeed() {
    if (SEED) return SEED
    this.seed = (this.seed * 1664525 + 1013904223 + Date.now() % 100003) >>> 0
    return this.seed
  }

  /* ------------------------------------------------------------------ */
  /* frame                                                               */
  /* ------------------------------------------------------------------ */

  update(dtRaw: number) {
    const vp = this.stageObj.viewport
    // On a real device frames are short and the clamp only guards against a
    // hitch. Under a software rasteriser frames are ~200ms, and clamping to 1/24
    // would put the whole game into slow motion, so the test profile takes larger
    // logical steps (the candy sim raises its substep budget to match).
    const dt = Math.min(dtRaw, MAX_DT)
    this.input.beginFrame(dt, vp.width, vp.height)
    this.t += dt
    if (this.input.active || this.input.pressed) this.idle = 0
    else this.idle += dt

    this.runStage(dt)

    this.candy.update(
      dt,
      this.props.bowl.matrixWorld,
      this.pouring ? 1 : this.stage === 'pour' ? 0.35 : 0,
    )
    this.crumbs.update(dt, DIM.boardTop)
    this.playImpacts(dt)

    this.rig.update(dt, vp)
    this.input.endFrame()
  }

  render() {
    this.stageObj.render()
  }

  private playImpacts(dt: number) {
    this.tickBudget = Math.min(6, this.tickBudget + dt * 26)
    for (const im of this.candy.impacts) {
      if (this.tickBudget < 1) break
      if (im.strength < 0.06) continue
      this.tickBudget -= 1
      this.audio.tick(im.strength, im.onCake ? 1 : 0.72)
    }
  }

  /* ------------------------------------------------------------------ */
  /* stage plumbing                                                      */
  /* ------------------------------------------------------------------ */

  private go(next: StageId) {
    this.stage = next
    this.t = 0
    this.idle = 0
    this.dragging = false
    this.returning = false
    this.creamProgress = 0
    this.hud.setHint(HINTS[next])
    this.rig.set(SHOT_FOR[next], this.stageObj.viewport)
    this.hud.setRing(null)
    this.hud.setFill(next === 'pour' ? 0 : null)
    this.audio.stopLoops()
    this.enter(next)
  }

  private enter(s: StageId) {
    const layer = PLACE_TARGET[s]
    if (layer) {
      const l = this.cake.layer(layer)
      l.holder.visible = true
      l.holder.position.copy(this.layerStage)
      l.holder.scale.set(1, 1, 1)
    }
    if (CREAM_TARGET[s]) {
      this.props.spatula.visible = true
    } else if (s !== 'coat') {
      this.props.spatula.visible = false
    }
    if (s === 'pour') {
      this.pourAccum = 0
      this.pourIdle = 0
      this.bowlTilt = 0
    }
    if (s === 'secret') {
      this.candy.setGhostVisible(true)
      this.cake.cavityGhost.visible = true
    }
    if (s === 'coat') {
      this.props.spatula.visible = true
      this.coatProgress = 0
      this.spinVel = 0
    }
    if (s === 'cut') {
      this.cutProgress = 0
      this.cutPhase = 0
      this.cutTimer = 0
      this.props.knife.visible = true
    }
    if (s === 'reveal') {
      this.revealT = 0
      this.opened = false
    }
    if (s === 'done') {
      this.audio.chime()
      this.hud.showReplay(true)
    }
  }

  private runStage(dt: number) {
    switch (this.stage) {
      case 'intro':
        if (this.t > 0.7) this.go('placeBase')
        break
      case 'placeBase':
      case 'placeRing1':
      case 'placeRing2':
      case 'placeLid':
        this.stagePlace(dt, PLACE_TARGET[this.stage]!)
        break
      case 'cream1':
      case 'cream2':
      case 'cream3':
        this.stageCream(CREAM_TARGET[this.stage]!)
        break
      case 'pour':
        this.stagePour(dt)
        break
      case 'secret':
        this.stageSecret(dt)
        break
      case 'coat':
        this.stageCoat(dt)
        break
      case 'cut':
        this.stageCut(dt)
        break
      case 'reveal':
        this.stageReveal(dt)
        break
      case 'done':
        break
    }
    this.animateSettle(dt)
  }

  /* ------------------------------------------------------------------ */
  /* 1 & 2 & 4: stack the layers                                         */
  /* ------------------------------------------------------------------ */

  private stagePlace(dt: number, key: LayerKey) {
    const l = this.cake.layer(key)
    const vp = this.stageObj.viewport
    const hoverY = l.y0 + 2.6

    // a soft shadow where the layer belongs; it darkens as the layer comes over
    // it, which is the whole instruction for this scene
    const spot = this.props.dropTarget
    spot.visible = true
    spot.position.y = l.y0 + 0.04
    const away = Math.hypot(l.holder.position.x, l.holder.position.z)
    const near = 1 - clamp(away / 16, 0, 1)
    const pulse = 0.82 + Math.sin(this.t * 3.4) * 0.18
    const mat = spot.material as THREE.MeshBasicMaterial
    mat.opacity = (0.3 + near * 0.4) * (this.dragging ? 1 : pulse)
    // on the board it may spill past the cake; on a stack it must stay on top
    const spread = (key === 'base' ? 1 : 0.83) * (0.88 + near * 0.12)
    spot.scale.set(spread, spread, 1)

    if (this.input.pressed && !this.returning) {
      this.dragging = true
      this.audio.unlock()
    }

    if (this.dragging) {
      // the layer rides above the finger so small hands never cover the target
      this.input.ndcLifted(vp.portrait ? 96 : 74, vp.width, vp.height, tmpNdc)
      const hit = this.input.planePoint(this.stageObj.camera, hoverY, tmpNdc, tmpV)
      if (hit) {
        let x = clamp(hit.x, -24, 24)
        let z = clamp(hit.z, -16, 24)
        const d = Math.hypot(x, z)
        // gentle magnetism: close enough counts as centred
        if (d < 7.5) {
          const pull = 1 - d / 7.5
          x -= x * pull * 0.55
          z -= z * pull * 0.55
        }
        const k = damp(dt, 0.06)
        l.holder.position.x += (x - l.holder.position.x) * k
        l.holder.position.z += (z - l.holder.position.z) * k
        l.holder.position.y += (hoverY - l.holder.position.y) * damp(dt, 0.08)
      }
      if (this.input.released) {
        this.dragging = false
        const d = Math.hypot(l.holder.position.x, l.holder.position.z)
        if (d < 11) this.placeLayer(key)
        else this.returning = true
      }
    } else if (this.returning) {
      const k = damp(dt, 0.12)
      l.holder.position.lerp(this.layerStage, k)
      if (l.holder.position.distanceTo(this.layerStage) < 0.4) this.returning = false
    } else if (!l.placed) {
      // idle bob, so the pending layer always looks like the live object
      l.holder.position.y = this.layerStage.y + Math.sin(this.t * 2.1) * 0.22
      if (this.idle > 3) {
        const s = 1 + Math.sin(this.t * 9) * 0.02
        l.holder.scale.set(s, s, s)
        this.showRing(l.holder.position, 1.15)
      } else {
        l.holder.scale.set(1, 1, 1)
        this.hud.setRing(null)
      }
    }
  }

  private placeLayer(key: LayerKey) {
    const l = this.cake.layer(key)
    l.placed = true
    this.props.dropTarget.visible = false
    // the cake presses harder into the board with every layer
    let stacked = 0
    for (const other of this.cake.layers.values()) if (other.placed) stacked++
    const shadow = this.props.cakeShadow
    shadow.visible = true
    ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.3 + stacked * 0.1
    const sp = 0.78 + stacked * 0.055
    shadow.scale.set(sp, sp, 1)
    l.holder.position.set(0, l.y0, 0)
    l.holder.scale.set(1, 1, 1)
    this.settleKey = key
    this.settleT = 0
    this.audio.thud(key === 'base' ? 1.15 : 0.95)
    this.hud.setRing(null)
    this.syncCavity()

    if (key === 'lid') {
      this.candy.cfg.ceilY = Y.cavityCeil
      this.candy.cfg.funnel = false
      this.candy.tuckStrays()
      this.go('secret')
    } else if (key === 'base') this.go('cream1')
    else if (key === 'ring1') this.go('cream2')
    else if (key === 'ring2') this.go('pour')
  }

  /** Weight: the layer dips into the buttercream before it settles. */
  private animateSettle(dt: number) {
    if (this.settleT < 0 || !this.settleKey) return
    this.settleT += dt
    const l = this.cake.layer(this.settleKey)
    const k = Math.min(1, this.settleT / 0.55)
    const e = Math.exp(-4.2 * k)
    const squash = 1 - 0.17 * Math.sin(k * Math.PI * 2.2) * e
    l.holder.scale.set(1 + (1 - squash) * 0.55, squash, 1 + (1 - squash) * 0.55)
    l.holder.position.y = l.y0 - 0.26 * Math.sin(k * Math.PI) * e
    if (k >= 1) {
      l.holder.scale.set(1, 1, 1)
      l.holder.position.y = l.y0
      this.settleT = -1
      this.settleKey = null
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2b: buttercream between the layers                                  */
  /* ------------------------------------------------------------------ */

  private stageCream(key: CreamKey) {
    const vp = this.stageObj.viewport
    const denom = Math.max(240, vp.width * 1.05)
    let moving = false
    if (this.input.active && (Math.abs(this.input.dx) > 0.3 || Math.abs(this.input.dy) > 0.3)) {
      this.creamProgress += Math.hypot(this.input.dx, this.input.dy) / denom
      moving = true
    }
    this.creamProgress = clamp(this.creamProgress, 0, 1)
    this.cake.setCreamProgress(key, this.creamProgress)
    this.audio.spread(moving)

    // the spatula rides the leading edge of the spread
    const c = this.cake.cream(key)
    const a = WEDGE_START + this.creamProgress * TAU
    const r = DIM.cakeRadius - 1.2
    const y = c.main.position.y + 0.4
    // the blade straddles the leading edge instead of lying across the whole cake
    const tx = -Math.sin(a)
    const tz = Math.cos(a)
    this.props.spatula.visible = true
    this.props.spatula.position.set(
      Math.cos(a) * r - tx * 4.2,
      y + 0.9,
      Math.sin(a) * r - tz * 4.2,
    )
    this.props.spatula.rotation.set(0, -a - Math.PI * 0.5, -0.12)

    if (this.idle > 3 && this.creamProgress < 0.02) {
      this.showRing(tmpV.set(Math.cos(a) * r, y + 1.5, Math.sin(a) * r), 1.25)
    } else {
      this.hud.setRing(null)
    }

    if (this.creamProgress >= 1) {
      this.audio.spread(false)
      this.props.spatula.visible = false
      this.audio.pop()
      if (key === 'cream1') this.go('placeRing1')
      else if (key === 'cream2') this.go('placeRing2')
      else this.go('placeLid')
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3: pour the candy into the cavity                                   */
  /* ------------------------------------------------------------------ */

  private stagePour(dt: number) {
    const vp = this.stageObj.viewport
    const bowl = this.props.bowl
    const wantPour = this.input.active
    const lifted = wantPour || this.pourAccum > 0

    let targetX = this.bowlHome.x
    let targetZ = this.bowlHome.z
    let targetY = this.bowlHome.y

    if (lifted) {
      targetY = 13.5
      this.input.ndcLifted(vp.portrait ? 118 : 92, vp.width, vp.height, tmpNdc)
      const hit = this.input.planePoint(this.stageObj.camera, targetY, tmpNdc, tmpV)
      if (hit && wantPour) {
        const d = Math.hypot(hit.x, hit.z)
        // keep the bowl off the axis so the lip always points into the hole
        const clamped = clamp(d, 4.2, 12)
        const s = d > 0.01 ? clamped / d : 1
        targetX = hit.x * s
        targetZ = hit.z * s
      } else {
        targetX = bowl.position.x
        targetZ = bowl.position.z
      }
    }

    const k = damp(dt, 0.11)
    bowl.position.x += (targetX - bowl.position.x) * k
    bowl.position.z += (targetZ - bowl.position.z) * k
    bowl.position.y += (targetY - bowl.position.y) * damp(dt, 0.13)

    // aim the lip at the cavity, then tip while the finger is down
    const dx = CENTER.x - bowl.position.x
    const dz = CENTER.z - bowl.position.z
    const len = Math.hypot(dx, dz) || 1
    const yaw = Math.atan2(dx / len, dz / len)
    const tiltTarget = wantPour && bowl.position.y > 9 ? 0.95 : 0
    this.bowlTilt += (tiltTarget - this.bowlTilt) * damp(dt, 0.13)
    bowl.quaternion.setFromEuler(new THREE.Euler(this.bowlTilt, yaw, 0, 'YXZ'))
    bowl.updateMatrixWorld(true)

    this.pouring = this.bowlTilt > 0.42 && this.candy.inBowl > 0
    this.audio.rattle(this.pouring)

    if (this.pouring) {
      this.pourAccum += dt * (10 + this.bowlTilt * 9)
      while (this.pourAccum >= 1) {
        this.pourAccum -= 1
        this.props.bowlLip.getWorldPosition(tmpV)
        tmpV2.set((dx / len) * 15, -20, (dz / len) * 15)
        if (!this.candy.pourOne(tmpV, tmpV2)) break
      }
      this.pourIdle = 0
    } else {
      this.pourIdle += dt
    }

    const total = this.candy.count
    this.hud.setFill(this.candy.poured / total)

    if (this.idle > 3 && this.candy.poured === 0) {
      this.showRing(tmpV.set(bowl.position.x, bowl.position.y + 5, bowl.position.z), 1.3)
    } else {
      this.hud.setRing(null)
    }

    // done when the bowl runs dry, or when the child stops after a real fill
    const enough = this.candy.poured >= Math.min(14, total)
    if (this.candy.inBowl === 0 || (enough && this.pourIdle > 2.2 && !this.input.active)) {
      this.audio.rattle(false)
      this.pouring = false
      this.bowlTilt = 0
      bowl.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))
      this.go('cream3')
    }
  }

  /* ------------------------------------------------------------------ */
  /* 4b: the secret beat                                                 */
  /* ------------------------------------------------------------------ */

  private stageSecret(dt: number) {
    // the bowl retreats to the back of the bench so it stops crowding the cake
    this.props.bowl.position.lerp(this.bowlRest, damp(dt, 0.2))
    this.props.bowl.quaternion.slerp(IDENTITY, damp(dt, 0.25))
    if (this.t > 1.9) this.go('coat')
  }

  /* ------------------------------------------------------------------ */
  /* 5: cover the outside                                                */
  /* ------------------------------------------------------------------ */

  private stageCoat(dt: number) {
    const vp = this.stageObj.viewport
    // once the coat has closed, further swipes stop driving the turntable: a
    // child who keeps swiping should still see the cake settle and the beat end
    if (this.coatProgress < 1 && this.input.active && Math.abs(this.input.dx) > 0.2) {
      this.spinVel += (this.input.dx / Math.max(220, vp.width)) * 26
    }
    this.spinVel *= Math.pow(0.12, dt)
    const dTheta = this.spinVel * dt
    this.props.turntable.rotation.y += dTheta
    if (this.coatProgress < 1) {
      this.coatProgress = clamp(this.coatProgress + Math.abs(dTheta) / (TAU * 1.35), 0, 1)
      this.cake.setCoatProgress(this.coatProgress)
    }
    this.audio.spread(Math.abs(this.spinVel) > 0.4 && this.coatProgress < 1)

    // the spatula is held still against the flank; the cake turns into it
    const holdA = -0.35
    const r = DIM.cakeRadius + DIM.coatThickness + 0.35
    this.props.spatula.visible = this.coatProgress < 1
    // blade points straight down against the flank, handle up out of the way
    this.props.spatula.position.set(Math.cos(holdA) * r, Y.top + 1.6, Math.sin(holdA) * r)
    this.props.spatula.rotation.set(0, -holdA, -Math.PI / 2)

    // the x-ray fades out exactly as the coat closes: the secret is now kept
    const ghostFade = 1 - this.coatProgress
    this.candy.setGhostVisible(ghostFade > 0.02)
    this.cake.cavityGhost.visible = ghostFade > 0.02
    for (const m of this.candy.ghostRoot.children) {
      const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 * ghostFade
    }
    ;(this.cake.cavityGhost.material as THREE.MeshBasicMaterial).opacity = 0.16 * ghostFade

    if (this.idle > 3 && this.coatProgress < 0.05) {
      this.showRing(tmpV.set(0, Y.top * 0.55, DIM.cakeRadius + 2), 1.4)
    } else {
      this.hud.setRing(null)
    }

    if (this.coatProgress >= 1) {
      // settle the turntable back so the slice faces the camera for the cut
      const target = Math.round(this.props.turntable.rotation.y / TAU) * TAU
      this.props.turntable.rotation.y +=
        (target - this.props.turntable.rotation.y) * damp(dt, 0.22)
      if (Math.abs(target - this.props.turntable.rotation.y) < 0.02 && this.t > 1.2) {
        this.props.turntable.rotation.y = target
        this.candy.cfg.cakeOuterR = DIM.cakeRadius + DIM.coatThickness
        this.audio.spread(false)
        this.props.spatula.visible = false
        this.candy.setGhostVisible(false)
        this.cake.cavityGhost.visible = false
        this.go('cut')
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 6: cut                                                              */
  /* ------------------------------------------------------------------ */

  private knifeTo(angle: number, y: number) {
    this.props.knife.position.set(0, y, 0)
    this.props.knife.rotation.set(0, -angle, 0)
  }

  private stageCut(dt: number) {
    const vp = this.stageObj.viewport
    const topY = Y.top + 4.5
    const botY = DIM.boardTop - 0.35
    const k = this.props.knife

    if (this.cutPhase === 0) {
      // knife flies from the bench into position over the first cut plane.
      // A swipe started during the approach still counts: on a slow device the
      // approach can outlast a child's patience, and losing that first gesture
      // reads as the game ignoring them.
      if (this.input.active && this.input.dy > 0)
        this.cutProgress = clamp(this.cutProgress + this.input.dy / (vp.height * 0.4), 0, 1)
      this.cutTimer += dt
      const u = smoothstep(0, 1, Math.min(1, this.cutTimer / 0.45))
      k.position.lerpVectors(this.knifeHome, tmpV.set(0, topY, 0), u)
      this.cutY = topY
      k.rotation.set(
        this.knifeHomeRot.x * (1 - u),
        this.knifeHomeRot.y * (1 - u) + -WEDGE_START * u,
        this.knifeHomeRot.z * (1 - u),
      )
      if (u >= 1) {
        this.cutPhase = 1
        this.cutTimer = 0
      }
      return
    }

    if (this.cutPhase === 1) {
      // the child pulls the blade down
      if (this.input.active && this.input.dy > 0) {
        this.cutProgress += this.input.dy / (vp.height * 0.4)
      }
      this.cutProgress = clamp(this.cutProgress, 0, 1)
      // the blade follows the swipe through a spring rather than snapping to it:
      // that is where the weight of steel entering sponge comes from, and it also
      // means a swipe banked during the approach plays out instead of teleporting
      const want = topY + (botY - topY) * this.cutProgress
      const inCake = this.cutY < Y.top + 0.5
      this.cutY += (want - this.cutY) * damp(dt, inCake ? 0.16 : 0.07)
      const y = this.cutY
      this.knifeTo(WEDGE_START, y)
      if (this.cutProgress > 0.12 && this.cutProgress < 0.95) {
        if (Math.random() < dt * 9) {
          const a = WEDGE_START
          this.crumbs.burst(
            Math.cos(a) * 6.5,
            Math.max(y, DIM.boardTop + 0.3),
            Math.sin(a) * 6.5,
            2,
            Math.floor(this.cutProgress * 999) + 1,
          )
        }
      }
      if (this.cutProgress > 0.05 && !this.knifeSounded) {
        this.knifeSounded = true
        this.audio.knife()
      }
      if (this.idle > 3 && this.cutProgress < 0.05) {
        this.showRing(tmpV.set(0, Y.top + 1, 0), 1.5)
      } else {
        this.hud.setRing(null)
      }
      if (this.cutProgress >= 1 && this.cutY < botY + 0.35) {
        this.cutPhase = 2
        this.cutTimer = 0
        this.hud.setRing(null)
      }
      return
    }

    // second cut runs itself: precision is never asked of the player
    this.cutTimer += dt
    if (this.cutPhase === 2) {
      const u = Math.min(1, this.cutTimer / 0.45)
      this.knifeTo(WEDGE_START, this.cutY + (topY - this.cutY) * smoothstep(0, 1, u))
      if (u >= 1) {
        this.cutPhase = 3
        this.cutTimer = 0
        this.knifeSounded = false
      }
    } else if (this.cutPhase === 3) {
      const u = Math.min(1, this.cutTimer / 0.4)
      const a = WEDGE_START + (WEDGE_END - WEDGE_START) * smoothstep(0, 1, u)
      this.knifeTo(a, topY)
      if (u >= 1) {
        this.cutPhase = 4
        this.cutTimer = 0
      }
    } else if (this.cutPhase === 4) {
      const u = Math.min(1, this.cutTimer / 0.6)
      if (!this.knifeSounded) {
        this.knifeSounded = true
        this.audio.knife()
      }
      this.knifeTo(WEDGE_END, topY + (botY - topY) * smoothstep(0, 1, u))
      if (u > 0.5 && this.crumbs)
        if (Math.random() < dt * 7)
          this.crumbs.burst(
            Math.cos(WEDGE_END) * 6.5,
            DIM.boardTop + 1.5,
            Math.sin(WEDGE_END) * 6.5,
            2,
            7,
          )
      if (u >= 1) {
        this.cutPhase = 5
        this.cutTimer = 0
        this.cake.split()
      }
    } else if (this.cutPhase === 5) {
      const u = Math.min(1, this.cutTimer / 0.55)
      this.knifeTo(WEDGE_END, botY + (topY + 6 - botY) * smoothstep(0, 1, u))
      k.position.x = Math.cos(WEDGE_END) * 6 * u
      k.position.z = Math.sin(WEDGE_END) * 6 * u
      if (u >= 1) {
        k.visible = false
        this.go('reveal')
      }
    }
  }

  private knifeSounded = false

  /* ------------------------------------------------------------------ */
  /* 7: the slice comes out and the secret spills                        */
  /* ------------------------------------------------------------------ */

  private stageReveal(dt: number) {
    this.revealT += dt
    const dur = 1.6
    const u = smoothstep(0, 1, Math.min(1, this.revealT / dur))
    // the slice travels out along the far edge of the notch, clearing the lane
    // the candy is about to use
    const dist = 12.6 * u
    const exit = WEDGE_END - 0.04
    const w = this.cake.wedgeGroup
    w.position.set(Math.cos(exit) * dist, -0.55 * u, Math.sin(exit) * dist)
    const axis = tmpV.set(-Math.sin(exit), 0, Math.cos(exit))
    w.quaternion.setFromAxisAngle(axis, -0.11 * u)
    // a little turn, so the slice shows its own layered face rather than its back
    w.rotateY(0.34 * u)

    if (this.revealT < 0.05) this.rig.follow(w, 1.1)

    // the slice takes its own contact shadow with it
    const ss = this.props.sliceShadow
    ss.visible = u > 0.05
    const ssR = dist + 3.4
    // slides off the board rim onto the bench, without the shadow snapping down
    const drop = smoothstep(10, 13.5, ssR)
    ss.position.set(
      Math.cos(exit) * ssR,
      DIM.boardTop + 0.06 + (DIM.tableTop - DIM.boardTop) * drop,
      Math.sin(exit) * ssR,
    )
    ;(ss.material as THREE.MeshBasicMaterial).opacity = 0.55 * u

    if (!this.opened && u > 0.16) {
      this.opened = true
      this.openedAt = this.revealT
      this.candy.cfg.open = true
      this.candy.cfg.openA0 = WEDGE_START
      this.candy.cfg.openA1 = WEDGE_END
      this.candy.cfg.drainAngle = WEDGE_START + 0.16
      this.candy.wakeAll()
      this.audio.thud(0.5)
    }

    if (this.opened) {
      // ramp in, then let it die away so the flow tapers instead of emptying
      const since = this.revealT - this.openedAt
      this.candy.cfg.drain =
        Math.min(1, since / 0.5) * Math.exp(-Math.max(0, since - 1.6) / 1.8)
    }

    const settled = this.candy.busy <= 1
    if (this.revealT > 2.8 && (settled || this.revealT > 8)) {
      this.candy.cfg.drain = 0
      this.go('done')
    }
  }

  /* ------------------------------------------------------------------ */

  private syncCavity() {
    const c = this.candy.cfg
    let top: number = DIM.boardTop
    for (const key of ['base', 'ring1', 'ring2', 'lid'] as LayerKey[]) {
      const l = this.cake.layer(key)
      if (l.placed) top = Math.max(top, l.y1)
    }
    c.cakeTopY = top
    c.cavityFloorY = Y.cavityFloor
    c.holeR = DIM.holeRadius
    c.cakeOuterR = DIM.cakeRadius
    c.boardY = DIM.boardTop
    c.boardR = DIM.boardRadius
    c.tableY = DIM.tableTop
  }

  private showRing(world: THREE.Vector3, scale = 1) {
    tmpV2.copy(world).project(this.stageObj.camera)
    const vp = this.stageObj.viewport
    if (tmpV2.z > 1) {
      this.hud.setRing(null)
      return
    }
    this.hud.setRing(
      ((tmpV2.x + 1) / 2) * vp.width,
      ((1 - tmpV2.y) / 2) * vp.height,
      scale,
    )
  }

  /* ------------------------------------------------------------------ */

  restart() {
    this.hud.showReplay(false)
    this.hud.setRing(null)
    this.hud.setFill(null)
    this.audio.stopLoops()
    this.cake.reset()
    this.candy.reset(this.newSeed())
    this.crumbs.reset()
    this.candy.setGhostVisible(false)
    this.props.turntable.rotation.y = 0
    this.applyLayout(true)
    this.props.bowl.position.copy(this.bowlHome)
    this.props.bowl.quaternion.identity()
    this.props.knife.visible = true
    this.props.knife.position.copy(this.knifeHome)
    this.props.knife.rotation.copy(this.knifeHomeRot)
    this.props.spatula.visible = false
    this.props.spatula.position.copy(this.spatulaHome)
    this.props.dropTarget.visible = false
    this.props.cakeShadow.visible = false
    this.props.sliceShadow.visible = false
    this.pouring = false
    this.bowlTilt = 0
    this.knifeSounded = false
    this.settleT = -1
    this.settleKey = null
    this.coatProgress = 0
    this.cutProgress = 0
    this.candy.cfg.open = false
    this.candy.cfg.ceilY = Infinity
    this.candy.cfg.funnel = true
    this.candy.cfg.drain = 0
    this.syncCavity()
    this.rig.set('stack', this.stageObj.viewport, true)
    this.go('placeBase')
  }

  onResize() {
    this.stageObj.resize()
    this.applyLayout(false)
    this.rig.recompute(this.stageObj.viewport)
  }

  onHidden() {
    this.audio.stopLoops()
    this.audio.suspend()
  }

  onVisible() {
    this.audio.resume()
  }

  bootDone() {
    this.hud.hideBoot()
    this.hud.setHint(HINTS.placeBase)
  }

  /** World -> css pixel, so the smoke test can aim real gestures at real objects. */
  project(x: number, y: number, z: number) {
    tmpV2.set(x, y, z).project(this.stageObj.camera)
    const vp = this.stageObj.viewport
    return {
      x: ((tmpV2.x + 1) / 2) * vp.width,
      y: ((1 - tmpV2.y) / 2) * vp.height,
    }
  }

  /** Positions of every live candy, for diagnosing the spill in a headless run. */
  get candyDump() {
    return this.candy.dump()
  }

  /** Small surface used by the smoke test and by ?debug=1. */
  get debugState() {
    return {
      stage: this.stage,
      poured: this.candy.poured,
      inBowl: this.candy.inBowl,
      spilled: this.candy.spilled,
      inCavity: this.candy.inCavity,
      moving: this.candy.moving,
      busy: this.candy.busy,
      coat: this.coatProgress,
      cut: this.cutProgress,
      cutPhase: this.cutPhase,
      cutY: Math.round(this.cutY * 10) / 10,
      split: this.cake.isSplit,
      fast: FAST,
    }
  }
}
