import * as THREE from 'three'
import { POSES } from '../scene/poses'
import { PathGesture } from '../core/gestures'
import { arcPoints, linePoints, type Ctx, type Stage } from './types'
import { clamp, damp, easeOutBack, smootherstep, smoothstep, Spring } from '../core/math'
import { LAYOUT } from '../world'

/**
 * Behind the oven glass the flat batter climbs the central tube. Time is
 * compressed to a handful of seconds, with one short cut-away that shows the
 * bubbles growing and the walls setting.
 */
export function bakeStage(ctx: Ctx): Stage {
  const RISE_START = 0.7
  const RISE_END = 6.0
  const TOTAL = 7.4
  const SECT_IN = 2.5
  const SECT_OUT = 4.3
  let sectioned = false

  return {
    id: 'bake',
    enter() {
      ctx.rig.goTo(POSES.bake, 1.2)
      ctx.hud.setVerb('wait', 'ふくらむ')
      ctx.hud.hideGuide()
      ctx.input.set(null)
      ctx.world.lighting.lookAt(-0.34, 0.13, -0.36)
      ctx.world.lighting.setWarmth(1)
      ctx.world.pan.root.position.copy(LAYOUT.panOven)
      // The pan always enters the oven full, whatever route got us here.
      ctx.world.chiffon.setFill(1)
      ctx.audio.startBakeAmbient()
    },
    update(dt, elapsed) {
      const raw = clamp((elapsed - RISE_START) / (RISE_END - RISE_START))
      // slow start, a confident climb, then it holds
      const rise = smootherstep(Math.pow(raw, 0.82))
      ctx.world.chiffon.setRise(rise)
      ctx.world.chiffon.setBake(clamp((raw - 0.18) / 0.7))

      const glow = ctx.world.kitchen.oven.glow
      glow.intensity = 1.15 + Math.sin(elapsed * 2.1) * 0.16
      ctx.world.steam.amount = damp(ctx.world.steam.amount, 0.12 * rise, 2, dt)
      ctx.world.pan.heat = Math.min(1, 0.25 + rise * 0.85)

      if (!sectioned && elapsed > SECT_IN) {
        sectioned = true
        ctx.rig.goTo(POSES.bakeSection, 0.9)
        ctx.world.kitchen.oven.glassFade = 0.05
        ctx.world.setCutaway(true)
      }
      if (sectioned && elapsed > SECT_OUT && ctx.world.chiffon.cut.visible) {
        ctx.world.setCutaway(false)
        ctx.world.kitchen.oven.glassFade = 1
        ctx.rig.goTo(POSES.bake, 0.9)
      }
      if (ctx.world.chiffon.cut.visible) ctx.world.aimCutaway(ctx.rig.camera)

      if (elapsed > TOTAL) ctx.next()
    },
    exit() {
      ctx.world.setCutaway(false)
      ctx.world.kitchen.oven.glassFade = 1
      ctx.audio.stopBakeAmbient()
      ctx.world.chiffon.setRise(1)
      ctx.world.chiffon.setBake(1)
    },
  }
}

/** Mitted adult hands bring the hot pan out. The child never touches it. */
export function takeoutStage(ctx: Ctx): Stage {
  const p0 = LAYOUT.panOven.clone()
  const p1 = new THREE.Vector3(-0.4, 0.22, -0.28)
  const p2 = LAYOUT.panHold.clone()
  const TOTAL = 3.1

  return {
    id: 'takeout',
    enter() {
      ctx.rig.goTo(POSES.takeout, 1.3)
      ctx.hud.setVerb('oven', 'あつい！ とりだす')
      ctx.hud.hideGuide()
      ctx.input.set(null)
      ctx.world.kitchen.oven.open = 1
      ctx.audio.ovenDoor()
      ctx.world.mitts.root.visible = true
      ctx.world.mitts.grip = 0
      ctx.world.haze.mesh.visible = true
      ctx.world.pan.heat = 1
    },
    update(dt, elapsed) {
      const t = clamp(elapsed / TOTAL)
      const grip = smoothstep((elapsed - 0.45) / 0.5)
      ctx.world.mitts.grip = grip
      if (elapsed > 0.45 && elapsed < 0.55) ctx.audio.grip()

      const move = smootherstep(clamp((elapsed - 1.0) / (TOTAL - 1.3)))
      const p = ctx.world.pan.root.position
      if (move < 0.55) p.copy(p0).lerp(p1, smootherstep(move / 0.55))
      else p.copy(p1).lerp(p2, smootherstep((move - 0.55) / 0.45))

      ctx.world.lighting.lookAt(p.x, p.y, p.z)
      ctx.world.lighting.setWarmth(1 - move * 0.55)
      ctx.world.steam.amount = damp(ctx.world.steam.amount, 0.55 * grip, 2.4, dt)
      ctx.world.kitchen.oven.open = move > 0.5 ? 0 : 1
      ctx.world.kitchen.oven.glow.intensity = 1.1 * (1 - move * 0.7)
      if (t >= 1) ctx.next()
    },
  }
}

/**
 * The headline move. One long arc of the finger and the pan, the cake, the
 * hands and the shot all turn through 180 degrees. Letting go early never
 * drops it — it springs to the nearer safe pose or completes gently.
 */
export function flipStage(ctx: Ctx): Stage {
  const guide = arcPoints(0, -0.12, 0.72, 0, 180, 48)
  const spring = new Spring(0, 46, 13)
  let target = 0
  let autoTo = -1
  let settled = -1
  let whooshed = false
  const g = new PathGesture(guide, 0.62, 0.22)

  return {
    id: 'flip',
    enter() {
      ctx.rig.goTo(POSES.flip, 1.2)
      ctx.hud.setVerb('flip', 'ひっくり かえす')
      ctx.world.lighting.lookAt(LAYOUT.panHold.x, LAYOUT.panHold.y, LAYOUT.panHold.z)
      ctx.world.pan.root.position.copy(LAYOUT.panHold)
      ctx.world.mitts.root.visible = true
      ctx.world.mitts.grip = 1
      spring.set(ctx.world.pan.flipPivot.rotation.z)

      g.onProgress = (p) => {
        target = p
        ctx.hud.setProgress(p)
        if (!whooshed && p > 0.06) {
          whooshed = true
          ctx.audio.flipWhoosh()
        }
      }
      g.onComplete = () => {
        target = 1
        autoTo = 1
      }
      // Interrupted mid-turn: never a drop, always a safe pose.
      g.onRelease = (p) => {
        autoTo = p > 0.38 ? 1 : 0
        if (autoTo === 0) whooshed = false
      }
      ctx.input.set(g)
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0, width: 22 })
    },
    update(dt, _elapsed) {
      if (autoTo >= 0) target = damp(target, autoTo, 4.2, dt)
      const ang = spring.step(target * Math.PI, dt)
      ctx.world.pan.flipPivot.rotation.z = ang

      // A real chef lifts a little through the turn.
      const s = Math.sin(clamp(target) * Math.PI)
      ctx.world.pan.root.position.set(
        LAYOUT.panHold.x,
        LAYOUT.panHold.y + s * 0.035,
        LAYOUT.panHold.z + s * 0.012,
      )
      ctx.rig.followTarget.set(0, s * 0.02, 0)
      ctx.world.steam.amount = damp(ctx.world.steam.amount, 0.38, 1.5, dt)
      ctx.world.pan.heat = damp(ctx.world.pan.heat, 0.82, 0.35, dt)
      ctx.hud.setProgress(Math.max(g.progress, ang / Math.PI))

      if (autoTo === 1 && ang > Math.PI * 0.985 && settled < 0) {
        settled = 0
        ctx.audio.flipSettle()
        ctx.rig.bump(0.5)
        ctx.hud.hideGuide()
        ctx.input.set(null)
      }
      if (settled >= 0) {
        settled += dt
        if (settled > 0.9) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.rig.followTarget.set(0, 0, 0)
      ctx.world.pan.flipPivot.rotation.z = Math.PI
    },
  }
}

/** Line the central tube up with the bottle neck. It snaps like a magnet. */
export function mountStage(ctx: Ctx): Stage {
  const guide = linePoints(0.5, 0.58, -0.02, -0.34, 0.2, 26)
  const g = new PathGesture(guide, 0.6, 0.26)
  const start = LAYOUT.panHold.clone()
  const seat = new THREE.Vector3(LAYOUT.bottle.x, LAYOUT.mountY, LAYOUT.bottle.z)
  let value = 0
  let snapped = false
  let done = -1

  return {
    id: 'mount',
    enter() {
      ctx.rig.goTo(POSES.mount, 1.3)
      ctx.hud.setVerb('mount', 'びんに のせる')
      ctx.world.bottle.visible = true
      ctx.world.lighting.lookAt(0, 0.14, 0.02)
      ctx.world.pan.flipPivot.rotation.z = Math.PI
      ctx.world.pan.root.position.copy(start)
      g.onProgress = (p) => ctx.hud.setProgress(p)
      g.onComplete = () => {
        ctx.input.set(null)
        ctx.hud.hideGuide()
      }
      ctx.input.set(g)
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
    },
    update(dt, _elapsed) {
      value = damp(value, g.progress, 6.5, dt)
      // Magnetic assist: past 78% the tube pulls itself onto the neck.
      const k = value < 0.78 ? smoothstep(value / 0.78) * 0.88 : 0.88 + easeOutBack((value - 0.78) / 0.22) * 0.12
      const p = ctx.world.pan.root.position
      p.copy(start).lerp(seat, clamp(k))
      p.x += Math.sin(value * 4.1) * 0.004 * (1 - value)

      ctx.world.steam.amount = damp(ctx.world.steam.amount, 0.34, 1.2, dt)
      if (!snapped && value > 0.94) {
        snapped = true
        ctx.audio.clink()
        ctx.rig.bump(0.35)
        done = 0
      }
      if (done >= 0) {
        done += dt
        p.copy(seat)
        if (done > 0.8) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.pan.root.position.copy(seat)
    },
  }
}

/**
 * Hanging upside-down while it cools. Gravity is visible — the cake is drawn
 * a millimetre or two downward — but it never falls.
 */
export function coolStage(ctx: Ctx): Stage {
  const TOTAL = 8.4
  const SECT_IN = 2.6
  const SECT_OUT = 4.4
  const RIGHT_START = 5.2
  let sectioned = false
  const seat = new THREE.Vector3(LAYOUT.bottle.x, LAYOUT.mountY, LAYOUT.bottle.z)
  const rest = LAYOUT.panRest.clone()
  const cond = ctx.world.condensation.material as THREE.PointsMaterial

  return {
    id: 'cool',
    enter() {
      ctx.rig.goTo(POSES.cool, 1.4)
      ctx.hud.setVerb('cool', 'さます')
      ctx.hud.hideGuide()
      ctx.input.set(null)
      ctx.world.lighting.lookAt(0, 0.14, 0.02)
      ctx.world.mitts.grip = 0
    },
    update(dt, elapsed) {
      const t = clamp(elapsed / RIGHT_START)
      ctx.world.pan.heat = damp(ctx.world.pan.heat, 0, 0.55, dt)
      ctx.world.steam.amount = damp(ctx.world.steam.amount, 0.02, 0.5, dt)
      ctx.world.lighting.setWarmth(Math.max(0, 0.45 - t * 0.45))
      cond.opacity = Math.sin(clamp(elapsed / 4.2) * Math.PI) * 0.85

      // Mitts let go and withdraw once the pan is safely seated.
      const letGo = clamp((elapsed - 0.4) / 1.1)
      ctx.world.mitts.root.position.y = -letGo * 0.16
      if (letGo >= 1) ctx.world.mitts.root.visible = false

      // The cake is pulled gently downward — held, not dropped.
      const sag = Math.sin(clamp(elapsed / 1.6) * Math.PI * 0.5) * 0.0022
      ctx.world.chiffon.group.position.y = -sag * (1 - clamp((elapsed - RIGHT_START) / 1.2))

      if (!sectioned && elapsed > SECT_IN) {
        sectioned = true
        ctx.world.setCutaway(true)
      }
      if (sectioned && elapsed > SECT_OUT && ctx.world.chiffon.cut.visible) ctx.world.setCutaway(false)
      if (ctx.world.chiffon.cut.visible) ctx.world.aimCutaway(ctx.rig.camera)

      // Bring it back upright for unmoulding.
      if (elapsed > RIGHT_START) {
        const k = smootherstep(clamp((elapsed - RIGHT_START) / 2.6))
        ctx.world.pan.flipPivot.rotation.z = Math.PI * (1 - k)
        const lift = Math.sin(k * Math.PI) * 0.07
        ctx.world.pan.root.position.set(
          seat.x + (rest.x - seat.x) * k,
          seat.y + (rest.y - seat.y) * k + lift,
          seat.z + (rest.z - seat.z) * k,
        )
        if (elapsed > RIGHT_START + 0.4) ctx.rig.goTo(POSES.release, 1.5)
        ctx.world.lighting.lookAt(rest.x, 0.06, rest.z)
      }
      if (elapsed > TOTAL) ctx.next()
    },
    exit() {
      ctx.world.setCutaway(false)
      ctx.world.chiffon.group.position.y = 0
      ctx.world.pan.flipPivot.rotation.z = 0
      ctx.world.pan.root.position.copy(rest)
      ctx.world.bottle.visible = true
      cond.opacity = 0
      ctx.world.pan.heat = 0
      // Nudge the bottle aside so it never crowds the reveal.
      // Park the bottle out of the reveal's sightline.
      ctx.world.bottle.position.set(LAYOUT.bottle.x + 0.3, 0, LAYOUT.bottle.z - 0.24)
    },
  }
}
