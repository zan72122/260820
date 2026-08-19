import * as THREE from 'three'
import { POSES } from '../scene/poses'
import { CircleGesture, PathGesture, TapGesture, type UnitPt } from '../core/gestures'
import { linePoints, type Ctx, type Stage } from './types'
import { clamp, damp, easeOutElastic, smoothstep } from '../core/math'
import { LAYOUT } from '../world'
import { PAN } from '../core/dims'

/** Decaying wobble — the whole soft-body budget of this game, in ten lines. */
class Wobble {
  value = 0
  private amp = 0
  private phase = 0
  impulse(a: number) {
    this.amp = Math.max(this.amp, a)
    this.phase = 0
  }
  update(dt: number, freq = 9.5, decay = 3.4) {
    if (this.amp < 0.0005) {
      this.value = damp(this.value, 0, 8, dt)
      return this.value
    }
    this.phase += dt
    this.amp *= Math.exp(-decay * dt)
    this.value = Math.sin(this.phase * freq) * this.amp
    return this.value
  }
}

function projectToUnit(v: THREE.Vector3, ctx: Ctx): UnitPt {
  const p = v.clone().project(ctx.rig.camera)
  const vp = ctx.input.vp
  return { x: (p.x * vp.w) / 2 / vp.scale, y: (p.y * vp.h) / 2 / vp.scale }
}

/**
 * Run a thin palette knife around the wall, then around the tube. A dark
 * separation line follows the finger exactly where it has already been.
 */
export function releaseStage(ctx: Ctx): Stage {
  type Phase = 'wait' | 'wall' | 'tube' | 'done'
  let phase: Phase = 'wait'
  let g: CircleGesture | null = null
  let seamStart = 0
  let knifeAngle = 0
  let lastSound = 0
  let doneAt = -1
  const center = new THREE.Vector3()

  const makeCircle = (worldR: number, worldY: number, turns: number, scale: number) => {
    center.set(LAYOUT.panRest.x, worldY, LAYOUT.panRest.z)
    const c = projectToUnit(center, ctx)
    const edge = projectToUnit(center.clone().add(new THREE.Vector3(worldR, 0, 0)), ctx)
    const r = Math.max(0.28, Math.hypot(edge.x - c.x, edge.y - c.y) * scale)
    const gest = new CircleGesture(c, r, turns)
    gest.onProgress = (p) => {
      ctx.hud.setProgress(p)
      if (p - lastSound > 0.045) {
        lastSound = p
        ctx.audio.knife(clamp(gest.speed * 6))
      }
    }
    return gest
  }

  const startWall = () => {
    phase = 'wall'
    lastSound = 0
    ctx.hud.setVerb('loosen', 'ぐるっと はずす')
    ctx.world.knife.visible = true
    g = makeCircle(PAN.rTop, 0.055, 1, 1.75)
    g.onComplete = () => {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.wallSeam.set(seamStart, Math.PI * 2)
      ctx.rig.goTo(POSES.releaseTube, 1.0)
      phase = 'tube'
      setTimeout(startTube, 700)
    }
    ctx.input.set(g)
    ctx.hud.showGuide(g.guide(), { faint: ctx.plays > 0, width: 20 })
  }

  const startTube = () => {
    lastSound = 0
    ctx.hud.setVerb('loosen', 'まんなかも ぐるっと')
    g = makeCircle(PAN.tubeOuterBot, 0.075, 0.8, 3.6)
    g.onComplete = () => {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.tubeSeam.set(seamStart, Math.PI * 2)
      ctx.audio.release()
      phase = 'done'
      doneAt = 0
    }
    ctx.input.set(g)
    ctx.hud.showGuide(g.guide(), { faint: ctx.plays > 0, width: 16 })
  }

  return {
    id: 'release',
    enter() {
      ctx.rig.goTo(POSES.release, 1.2)
      ctx.hud.setVerb('loosen', 'ぐるっと はずす')
      ctx.hud.hideGuide()
      ctx.input.set(null)
      ctx.world.lighting.lookAt(LAYOUT.panRest.x, 0.06, LAYOUT.panRest.z)
      ctx.world.wallSeam.reset()
      ctx.world.tubeSeam.reset()
      ctx.world.pan.root.position.copy(LAYOUT.panRest)
      ctx.world.pan.flipPivot.rotation.z = 0
      ctx.world.knife.visible = false
    },
    update(dt, elapsed) {
      if (phase === 'wait' && elapsed > 1.4) startWall()

      if (g && (phase === 'wall' || phase === 'tube')) {
        const dir = g.direction || 1
        const span = g.progress * Math.PI * 2 * (phase === 'tube' ? 0.8 : 1)
        seamStart = g.start + Math.PI / 2
        const from = dir > 0 ? seamStart : seamStart - span
        const az = dir > 0 ? from + span : from
        knifeAngle = damp(knifeAngle, az, 18, dt)
        if (phase === 'wall') ctx.world.wallSeam.set(from, span)
        else ctx.world.tubeSeam.set(from, span)

        const wallR = phase === 'wall' ? PAN.rTop + 0.0035 : PAN.tubeOuterBot + 0.004
        const k = ctx.world.knife
        k.position.set(
          LAYOUT.panRest.x + Math.sin(knifeAngle) * wallR,
          0.118,
          LAYOUT.panRest.z + Math.cos(knifeAngle) * wallR,
        )
        k.rotation.set(Math.PI, -knifeAngle + (phase === 'wall' ? 0 : Math.PI), 0)
        k.rotateOnAxis(new THREE.Vector3(1, 0, 0), phase === 'wall' ? 0.16 : -0.16)
      }

      if (doneAt >= 0) {
        doneAt += dt
        ctx.world.knife.position.y = 0.118 + doneAt * 0.16
        if (doneAt > 0.85) {
          ctx.world.knife.visible = false
          ctx.next()
        }
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.knife.visible = false
    },
  }
}

/** Lift the pan straight up. The tall chiffon stays on the bench. */
export function liftStage(ctx: Ctx): Stage {
  const guide = linePoints(0.0, -0.5, 0.06, 0.52, 0.06, 20)
  const g = new PathGesture(guide, 0.6, 0.34)
  const wobble = new Wobble()
  let value = 0
  let done = -1
  let popped = false

  return {
    id: 'lift',
    enter() {
      ctx.rig.goTo(POSES.reveal, 1.2)
      ctx.hud.setVerb('lift', 'うえへ ぬく')
      ctx.world.detachCake()
      ctx.world.lighting.lookAt(LAYOUT.panRest.x, 0.06, LAYOUT.panRest.z)
      g.onProgress = (p) => ctx.hud.setProgress(p)
      g.onComplete = () => {
        ctx.input.set(null)
        ctx.hud.hideGuide()
        done = 0
      }
      ctx.input.set(g)
      ctx.hud.showGuide(guide, { faint: ctx.plays > 0 })
    },
    update(dt, _elapsed) {
      value = damp(value, g.progress, 7, dt)
      const h = value * 0.28
      ctx.world.pan.root.position.set(LAYOUT.panRest.x, h, LAYOUT.panRest.z)
      ctx.world.wallSeam.mesh.visible = value < 0.12
      ctx.world.tubeSeam.mesh.visible = value < 0.12

      if (!popped && value > 0.42) {
        popped = true
        ctx.audio.release()
        wobble.impulse(0.13)
      }
      ctx.world.chiffon.setPress(wobble.update(dt, 7.5, 2.6))

      if (done >= 0) {
        done += dt
        // The pan is set aside, out of the reveal.
        const k = smoothstep(done / 1.2)
        ctx.world.pan.root.position.set(
          LAYOUT.panRest.x + k * 0.3,
          0.28 * (1 - k) + 0.001,
          LAYOUT.panRest.z - k * 0.16,
        )
        if (done > 1.3) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
      ctx.world.wallSeam.reset()
      ctx.world.tubeSeam.reset()
    },
  }
}

/** One tap. The top sinks a few millimetres and springs straight back. */
export function pressStage(ctx: Ctx): Stage {
  const wobble = new Wobble()
  let pressT = -1
  let taps = 0
  let finishAt = -1
  let tap: TapGesture

  const arm = () => {
    tap = new TapGesture(0.5)
    tap.onComplete = () => {
      taps++
      pressT = 0
      ctx.audio.press()
      ctx.rig.bump(0.22)
      if (taps === 1) finishAt = 0
      arm()
    }
    ctx.input.set(tap)
  }

  return {
    id: 'press',
    enter() {
      ctx.rig.goTo(POSES.press, 1.2)
      ctx.hud.setVerb('press', 'おすと もどる')
      const c = projectToUnit(new THREE.Vector3(LAYOUT.panRest.x, 0.11, LAYOUT.panRest.z), ctx)
      ctx.hud.showGuide(
        [
          { x: c.x - 0.14, y: c.y },
          { x: c.x + 0.14, y: c.y },
        ],
        { tap: true, faint: ctx.plays > 0, width: 5 },
      )
      ctx.hud.setProgress(0.5)
      arm()
    },
    update(dt, _elapsed) {
      if (pressT >= 0) {
        pressT += dt
        const down = pressT < 0.12 ? pressT / 0.12 : 0
        const back = pressT >= 0.12 ? easeOutElastic((pressT - 0.12) / 0.9) : 0
        const v = pressT < 0.12 ? down : 1 - back
        ctx.world.chiffon.setPress(clamp(v, -0.4, 1) * 0.95)
        if (pressT > 1.2) {
          pressT = -1
          wobble.impulse(0.04)
        }
      } else {
        ctx.world.chiffon.setPress(wobble.update(dt, 8, 3.2))
      }

      if (finishAt >= 0) {
        finishAt += dt
        if (finishAt > 1.5 && finishAt - dt <= 1.5) {
          ctx.rig.goTo(POSES.final, 1.8)
          ctx.hud.hideGuide()
          ctx.hud.setVerb('press', 'できあがり！')
          ctx.audio.chime()
        }
        if (finishAt > 3.0) ctx.next()
      }
    },
    exit() {
      ctx.input.set(null)
      ctx.hud.hideGuide()
    },
  }
}
