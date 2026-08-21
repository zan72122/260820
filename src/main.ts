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

const flags = readFlags(window.location.search)
const canvas = document.getElementById('game') as HTMLCanvasElement
const app = new App(canvas, flags)

let state = createInitialState(flags.seed)
const world: SimWorld = { colliders: COLLIDERS, bounds: WALKABLE }
const queuedActions: Action[] = []
const input = new KeyboardInput(window)

const handles = buildGardenScene(app.scene, flags)

// Provisional camera until FollowCamera lands (M6): stand in the garden
// looking north toward the house.
app.camera.position.set(1.2, 1.7, 4.5)
app.camera.lookAt(0, 0.9, -3)

function update(): void {
  const actions = queuedActions.splice(0)
  const move = input.moveDir(0)
  if (move) actions.push({ type: 'move', ...move })
  if (input.takeInteract()) actions.push({ type: 'interact' })
  state = simulate(state, actions, world)
}

function render(): void {
  handles.playerRoot.position.set(state.player.x, 0.65, state.player.z)
  handles.playerRoot.rotation.y = state.player.heading
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
    usedFallbackTextures: () => [],
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
