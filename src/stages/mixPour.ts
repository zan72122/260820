import * as THREE from 'three'
import { POSES } from '../scene/poses'
import { PathGesture } from '../core/gestures'
import { arcPoints, linePoints, type Ctx, type Stage } from './types'
import { clamp, damp, easeInOutCubic, smoothstep } from '../core/math'
import { LAYOUT } from '../world'

/** Short establishing beat: kitchen, bench, bowl. */
export function introStage(ctx: Ctx): Stage {
  return {
    id: 'intro',
    enter() {
      ctx.hud.hideGuide()
      ctx.hud.setVerb(null)
      ctx.rig.snapTo(POSES.intro)
      ctx.rig.goTo(POSES.mix, 1.8)
      ctx.world.lighting.lookAt(-0.1, 0.06, 0.05)
      ctx.world.pan.root.position.copy(LAYOUT.panRest)
      ctx.world.pan.root.rotation.set(0, 0, 0)
      ctx.world.pan.flipPivot.rotation.set(0, 0, 0)
    },
    update(_dt, elapsed) {
      if (elapsed > 1.5) ctx.next()
    },
  }
}

/**
 * Fold, don't beat. Three big scooping arcs; the meringue streaks even out and
 * the bubbles survive. There is no way to fail this.
 */
export function mixStage(ctx: Ctx): Stage {
  const STROKES = 3
  let strokes = 0
  let gesture: PathGesture
  let strokeP = 0
  let shown = 0
  let closeUp = -1
  const guide = arcPoints(0, 0.02, 0.62, -95, -285, 42)
  const tip = new THREE.Vector3()
  const bladeLocal = new THREE.Vector3()

  const newGesture = () => {
    gesture = new PathGesture(guide, 0.5, 0.3)
    gesture.onProgress = (p) => {
      strokeP = p
      ctx.hud.setProgress(p)
      if (p > shown + 0.12) {
        shown = p
        ctx.audio.fold(0.6 + gesture.speed * 8)
      }
    }
    gesture.onComplete = () => {
      strokes++
      shown = 0
      strokeP = 0
      ctx.audio.fold(1)
      if (strokes < STROKES) {
        newGesture()
        ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
      } else {
        ctx.input.set(null)
        ctx.hud.hideGuide()
        closeUp = 0
      }
    }
    ctx.input.set(gesture)
  }

  return {
    id: 'mix',
    enter() {
      ctx.rig.goTo(POSES.mix, 1.2)
      ctx.hud.setVerb('fold', 'そっと まぜる')
      ctx.world.lighting.lookAt(LAYOUT.bowl.x, 0.05, LAYOUT.bowl.z)
      ctx.world.spatula.visible = true
      ctx.world.bowlBatter.setBubbleVisibility(0)
      newGesture()
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
    },
    update(dt, _elapsed) {
      const foldTotal = (strokes + strokeP) / STROKES

      // Spatula: down the side, under the batter, then up and over.
      const base = (strokes * 2.1) % (Math.PI * 2)
      const a = base + Math.PI * 0.55 + strokeP * 2.5
      const rr = 0.062 * (1 - 0.35 * Math.sin(Math.PI * strokeP))
      const dip = Math.sin(Math.PI * clamp(strokeP * 1.15)) 
      tip.set(
        LAYOUT.bowl.x + Math.cos(a) * rr,
        LAYOUT.bowl.y + 0.058 - dip * 0.042 + smoothstep((strokeP - 0.7) / 0.3) * 0.075,
        LAYOUT.bowl.z + Math.sin(a) * rr,
      )
      const sp = ctx.world.spatula
      // `tip` is where the blade should be; the handle rides above it.
      sp.position.lerp(tip.clone().add(new THREE.Vector3(0, 0.082, 0)), 1 - Math.exp(-14 * dt))
      sp.rotation.z = damp(sp.rotation.z, Math.cos(a) * 0.42 - strokeP * 0.5, 8, dt)
      sp.rotation.x = damp(sp.rotation.x, -0.32 + dip * 0.42, 8, dt)
      sp.rotation.y = damp(sp.rotation.y, -a + Math.PI * 0.5, 8, dt)

      bladeLocal.set(tip.x - LAYOUT.bowl.x, 0, tip.z - LAYOUT.bowl.z)
      ctx.world.bowlBatter.setScoop(bladeLocal, dip * (gesture.down ? 1 : 0.25))
      ctx.world.bowlBatter.update(dt, foldTotal, 0.045)

      if (closeUp >= 0) {
        closeUp += dt
        if (closeUp < 0.05) {
          ctx.rig.goTo(POSES.mixClose, 1.0)
          ctx.hud.setVerb('fold', 'あわが いきてる')
        }
        ctx.world.bowlBatter.setBubbleVisibility(smoothstep((closeUp - 0.6) / 0.7))
        if (closeUp > 2.6) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.bowlBatter.setBubbleVisibility(0)
    },
  }
}

/** Tip the bowl; a thick ribbon lands in the pan. Overflow is simply not possible. */
export function pourStage(ctx: Ctx): Stage {
  let tilt = 0
  let fill = 0
  let done = -1
  let lastSound = 0
  const guide = linePoints(-0.5, 0.5, 0.42, -0.42, 0.22, 26)
  const bowlStart = LAYOUT.bowl.clone()
  const bowlPour = new THREE.Vector3(-0.115, 0.175, 0.075)
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()

  const g = new PathGesture(guide, 0.55, 0.26)

  return {
    id: 'pour',
    enter() {
      ctx.rig.goTo(POSES.pour, 1.3)
      ctx.hud.setVerb('pour', 'そそぐ')
      ctx.world.lighting.lookAt(0, 0.06, 0.06)
      ctx.world.spatula.visible = false
      ctx.world.pan.root.position.copy(LAYOUT.panRest)
      ctx.world.chiffon.setFill(0)
      ctx.world.chiffon.setRise(0)
      ctx.world.chiffon.setBake(0)
      g.onProgress = (p) => ctx.hud.setProgress(p)
      g.onComplete = () => {
        ctx.input.set(null)
        ctx.hud.hideGuide()
        done = 0
      }
      ctx.input.set(g)
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
    },
    update(dt, elapsed) {
      const lift = smoothstep(elapsed / 1.1)
      const target = g.progress
      tilt = damp(tilt, target, 7, dt)
      // The bowl can never tip far enough to miss the pan.
      const bp = bowlStart.clone().lerp(bowlPour, lift)
      ctx.world.bowl.position.copy(bp)
      ctx.world.bowl.rotation.z = -tilt * 1.15 * lift
      ctx.world.bowl.rotation.x = tilt * 0.12

      const flowing = tilt > 0.16 && lift > 0.85
      fill = clamp(fill + (flowing ? dt * 0.55 * (0.4 + tilt) : 0), 0, easeInOutCubic(g.progress) * 1.02)
      ctx.world.chiffon.setFill(fill)
      ctx.world.bowlBatter.update(dt, 1, 0.045 - fill * 0.03)

      ctx.world.ribbon.visible = flowing && fill < 0.995
      if (ctx.world.ribbon.visible) {
        ctx.world.bowl.updateWorldMatrix(true, false)
        from.set(0.108, 0.086, 0).applyMatrix4(ctx.world.bowl.matrixWorld)
        to.set(LAYOUT.panRest.x + 0.03, 0.012 + fill * 0.026, LAYOUT.panRest.z + 0.012)
        ctx.world.ribbon.update(from, to, 0.0085 + tilt * 0.004, elapsed)
        if (elapsed - lastSound > 0.42) {
          lastSound = elapsed
          ctx.audio.pour(fill)
        }
      }

      if (done >= 0) {
        done += dt
        fill = Math.min(1, fill + dt * 1.4)
        ctx.world.chiffon.setFill(fill)
        ctx.world.bowl.rotation.z = damp(ctx.world.bowl.rotation.z, 0, 4, dt)
        ctx.world.bowl.position.lerp(bowlStart, 1 - Math.exp(-3 * dt))
        if (done > 1.2) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.world.ribbon.visible = false
      ctx.hud.hideGuide()
      ctx.world.bowl.position.copy(bowlStart)
      ctx.world.bowl.rotation.set(0, 0, 0)
    },
  }
}

/** Push the pan into the oven. */
export function toOvenStage(ctx: Ctx): Stage {
  let slide = 0
  let done = -1
  const guide = linePoints(0.2, -0.5, -0.16, 0.46, 0.12, 20)
  const g = new PathGesture(guide, 0.6, 0.4)
  const start = LAYOUT.panRest.clone()
  const mid = new THREE.Vector3(-0.32, 0.15, -0.26)
  const end = LAYOUT.panOven.clone()

  return {
    id: 'toOven',
    enter() {
      ctx.rig.goTo(POSES.toOven, 1.2)
      ctx.hud.setVerb('oven', 'オーブンへ')
      ctx.world.lighting.lookAt(-0.2, 0.1, -0.15)
      ctx.world.kitchen.oven.open = 1
      ctx.audio.ovenDoor()
      g.onProgress = (p) => ctx.hud.setProgress(p)
      g.onComplete = () => {
        ctx.input.set(null)
        ctx.hud.hideGuide()
        done = 0
        ctx.world.kitchen.oven.open = 0
        ctx.audio.ovenDoor()
      }
      ctx.input.set(g)
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
    },
    update(dt, _elapsed) {
      slide = damp(slide, g.progress, 6, dt)
      const p = ctx.world.pan.root.position
      if (slide < 0.5) p.copy(start).lerp(mid, smoothstep(slide / 0.5))
      else p.copy(mid).lerp(end, smoothstep((slide - 0.5) / 0.5))
      if (done >= 0) {
        done += dt
        if (done > 0.9) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.pan.root.position.copy(end)
    },
  }
}
