import './ui/style.css'
import { App } from './core/App'
import { GameLoop } from './core/GameLoop'
import { readFlags } from './core/flags'
import { installTestSeam } from './core/testSeam'
import { KeyboardInput } from './game/input'
import type { Action } from './sim/actions'
import { createInitialState } from './sim/GameState'
import { DT, simulate, type SimWorld } from './sim/simulate'
import { buildGardenScene } from './scene/GardenScene'
import { COLLIDERS, WALKABLE } from './scene/layout'
import { tobiishiTopAt } from './builders/garden/tobiishi'
import { applyIdlePose, applyWalkPose, CYCLE_LEN } from './character/walkCycle'
import { FollowCamera } from './camera/FollowCamera'

const flags = readFlags(window.location.search)
const canvas = document.getElementById('game') as HTMLCanvasElement
const app = new App(canvas, flags)

let state = createInitialState(flags.seed)
const world: SimWorld = { colliders: COLLIDERS, bounds: WALKABLE }
const queuedActions: Action[] = []
const input = new KeyboardInput(window)

const handles = buildGardenScene(app.scene, flags)

// ?cam=x,y,z&look=x,y,z が指定されたら固定カメラ（レイアウト検分用）。
const debugQ = new URLSearchParams(window.location.search)
const staticCam = debugQ.has('cam')
if (staticCam) {
  const cam = (debugQ.get('cam') ?? '').split(',').map(Number)
  const look = (debugQ.get('look') ?? '0,1,0').split(',').map(Number)
  app.camera.position.set(cam[0] ?? 2.4, cam[1] ?? 1.6, cam[2] ?? 3.8)
  app.camera.lookAt(look[0] ?? 0, look[1] ?? 1, look[2] ?? 0)
}
const followCam = new FollowCamera(app.camera, canvas)
followCam.yaw = state.player.heading

// 描画側の状態（シムには入れない）
let walkPhase = 0
let visualY = 0
let idleTime = 0
let lastFrame: number | null = null

function update(): void {
  const actions = queuedActions.splice(0)
  const move = input.moveDir(followCam.yaw)
  if (move) actions.push({ type: 'move', ...move })
  if (input.takeInteract()) actions.push({ type: 'interact' })
  state = simulate(state, actions, world)
  walkPhase += (state.player.speed / CYCLE_LEN) * Math.PI * 2 * DT
  idleTime += DT
}

function render(): void {
  const now = performance.now()
  const dt = flags.e2eFast
    ? 1 / 60
    : Math.min(0.1, lastFrame === null ? 1 / 60 : (now - lastFrame) / 1000)
  lastFrame = now

  const p = state.player
  const stoneTop = tobiishiTopAt(handles.ground, p.x, p.z)
  const groundY = Math.max(
    handles.ground.heightAt(p.x, p.z),
    stoneTop ?? -Infinity,
  )
  visualY += (groundY - visualY) * Math.min(1, dt * 12)

  const rig = handles.player
  rig.root.position.set(p.x, visualY, p.z)
  rig.root.rotation.y = p.heading
  if (p.speed > 0.05) {
    applyWalkPose(rig, walkPhase, p.speed)
  } else {
    applyIdlePose(rig, idleTime)
  }

  if (!staticCam) {
    followCam.update(dt, { x: p.x, y: visualY, z: p.z, heading: p.heading })
  }
  app.render()
}

const loop = new GameLoop({
  update,
  render,
  autoTick: !flags.e2eFast,
  tickSeconds: DT,
})

if (flags.test) {
  installTestSeam({
    isReady: false,
    seed: flags.seed,
    flags,
    getState: () => state,
    dispatch: (action) => queuedActions.push(action),
    step: (n) => loop.step(n),
    usedFallbackTextures: () => handles.registry.usedFallbackTextures(),
    getCameraPos: () => ({
      x: app.camera.position.x,
      y: app.camera.position.y,
      z: app.camera.position.z,
    }),
  })
}

loop.start()
// First frame has been scheduled; render once synchronously so tests can
// consider the app ready as soon as the flag flips.
render()
if (window.__game) window.__game.isReady = true
