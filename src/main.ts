import * as THREE from 'three'
import { buildMaterials } from './materials'
import { buildWorld, buildSky } from './world'
import { buildBogie, Bogie } from './bogie'
import { buildCarBody, CarBody } from './carbody'
import { buildCrane, Crane } from './crane'
import { buildRig, Rig } from './rigging'
import { buildWorker, buildRemote, Worker } from './workers'
import { buildTrailer, buildMover } from './props'
import { Sim, Phase } from './sim'
import { CameraRig } from './cameras'
import { GameAudio } from './audio'
import { L } from './layout'
import { clamp, lerp, damp, smoothstep } from './util'

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search)
const E2E = params.has('e2e') || (import.meta.env && import.meta.env.MODE === 'e2e')
const SEED = Number(params.get('seed') || 1)

const app = document.getElementById('app')!
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.0
const baseDPR = E2E ? 1 : Math.min(window.devicePixelRatio || 1, 2)
renderer.setPixelRatio(baseDPR)
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const skyTex = buildSky()
scene.background = skyTex
scene.fog = new THREE.Fog(0xa9c2cf, 55, 220)

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromEquirectangular(skyTex).texture
scene.environmentIntensity = 0.8

// lights
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(E2E ? 1024 : 2048, E2E ? 1024 : 2048)
sun.shadow.camera.left = -24
sun.shadow.camera.right = 24
sun.shadow.camera.top = 26
sun.shadow.camera.bottom = -14
sun.shadow.camera.near = 4
sun.shadow.camera.far = 90
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xbdd4e4, 0x8b8574, 0.75)
scene.add(hemi)

// ---------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------
const mats = buildMaterials()
scene.add(buildWorld(mats))

const sim = new Sim({
  onContact: i => audio.contact(i),
  onLiftoff: () => audio.liftoff(),
  onSeated: () => { /* handled by contact + sequence */ },
  onDetach: () => audio.detach(),
  onCouple: () => audio.couple(),
  onPhase: p => onPhaseChange(p)
}, SEED)

const bogies: Bogie[] = L.bogieCenters.map(x => {
  const b = buildBogie(mats)
  b.group.position.set(x, L.beamTopY, 0)
  scene.add(b.group)
  return b
})

let car: CarBody = buildCarBody(mats, sim.variation.stripe1, sim.variation.stripe2)
scene.add(car.group)

const cranes: Crane[] = [
  buildCrane(mats, -L.craneBaseX, L.craneBaseZ),
  buildCrane(mats, L.craneBaseX, L.craneBaseZ)
]
cranes.forEach(c => scene.add(c.group))

const rigs: Rig[] = [buildRig(mats), buildRig(mats)]
rigs.forEach(r => scene.add(r.group))

const trailer = buildTrailer(mats)
trailer.group.position.set(0, 0, L.carStartZ + sim.variation.startZOff)
scene.add(trailer.group)

const mover = buildMover(mats)
mover.group.position.set(sim.moverX, L.beamTopY, 0)
mover.group.visible = false
scene.add(mover.group)

// ---- workers ----
interface Actor {
  w: Worker
  home: THREE.Vector3
  target: THREE.Vector3
  pos: THREE.Vector3
  face: number
  walkPhase: number
}
function actor(x: number, z: number, face: number): Actor {
  const w = buildWorker(mats)
  w.group.position.set(x, 0, z)
  w.group.rotation.y = face
  scene.add(w.group)
  const p = new THREE.Vector3(x, 0, z)
  return { w, home: p.clone(), target: p.clone(), pos: p.clone(), face, walkPhase: 0 }
}

// foreground lift supervisor with the radio remote — the player's presence
const operator = actor(4.3, 12.4, Math.PI + 0.35)
const remote = buildRemote(mats)
remote.group.position.set(0, 1.02, 0.28)
remote.group.rotation.x = -0.35
operator.w.group.add(remote.group)
operator.w.leftArm.rotation.x = -0.85
operator.w.rightArm.rotation.x = -0.85
operator.w.leftArm.rotation.z = 0.25
operator.w.rightArm.rotation.z = -0.25

const signaller = actor(-3.6, 10.9, Math.PI - 0.3)
const observer1 = actor(8.6, 12.3, Math.PI + 0.15)
const observer2 = actor(9.7, 12.6, Math.PI)
// two riggers: at reveal they step back from the slung body to the safety line
const rigger1 = actor(-2.2, sim.carZ + 1.9, Math.PI)
const rigger2 = actor(2.6, sim.carZ + 1.9, Math.PI)
rigger1.target.set(-1.6, 0, 11.2)
rigger2.target.set(1.9, 0, 11.4)
const riggers = [rigger1, rigger2]

// ---------------------------------------------------------------------------
// Round variation: lighting + car colors
// ---------------------------------------------------------------------------
function applyVariation() {
  const v = sim.variation
  const r = 40
  sun.position.set(Math.sin(v.sunAzim) * r * Math.cos(v.sunElev), Math.sin(v.sunElev) * r, Math.cos(v.sunAzim) * r * Math.cos(v.sunElev))
  sun.intensity = v.sunIntensity
  hemi.intensity = v.ambient
  const tintColors = [0xfff4e0, 0xfff8ec, 0xffe4c0, 0xf2f4f6]
  sun.color.setHex(tintColors[v.skyTint % 4])
  car.setStripe(v.stripe1, v.stripe2)
  car.setLightsOn(false)
  trailer.group.position.z = L.carStartZ + v.startZOff
}
applyVariation()

// ---------------------------------------------------------------------------
// Input: one finger, drag from touch point; dominant axis wins
// ---------------------------------------------------------------------------
const audio = new GameAudio()
let pointerId: number | null = null
let startPX = 0, startPY = 0
let dragV = 0, dragH = 0
let axisLock: 'v' | 'h' | null = null
let lastInputTime = 0
let anyInputYet = false

function screenZSign(): number {
  // which screen-x direction moves the car toward the beam (world -Z)?
  const a = new THREE.Vector3(sim.carX, sim.carY + 1.5, sim.carZ).project(camRig.camera)
  const b = new THREE.Vector3(sim.carX, sim.carY + 1.5, sim.carZ - 1).project(camRig.camera)
  return (b.x - a.x) >= 0 ? 1 : -1
}

function onDown(e: PointerEvent) {
  if (pointerId !== null) return
  pointerId = e.pointerId
  try { renderer.domElement.setPointerCapture(e.pointerId) } catch { /* not critical */ }
  startPX = e.clientX; startPY = e.clientY
  dragV = dragH = 0
  axisLock = null
  audio.start()
  lastInputTime = clock.elapsed
  anyInputYet = true
  hideHint()
}
function onMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  const span = Math.min(window.innerWidth, window.innerHeight) * 0.30
  const dx = (e.clientX - startPX) / span
  const dy = (e.clientY - startPY) / span
  // dominant axis with hysteresis: diagonal input snaps to the meaningful axis
  if (axisLock === null) {
    if (Math.abs(dx) > 0.06 || Math.abs(dy) > 0.06) {
      axisLock = Math.abs(dy) >= Math.abs(dx) * 0.85 ? 'v' : 'h'
    }
  } else if (axisLock === 'v' && Math.abs(dx) > Math.abs(dy) * 2.2 && Math.abs(dx) > 0.2) {
    axisLock = 'h'; startPY = e.clientY
  } else if (axisLock === 'h' && Math.abs(dy) > Math.abs(dx) * 2.2 && Math.abs(dy) > 0.2) {
    axisLock = 'v'; startPX = e.clientX
  }
  if (axisLock === 'v') { dragV = clamp(-dy, -1, 1); dragH = 0 }
  else if (axisLock === 'h') { dragH = clamp(dx, -1, 1); dragV = 0 }
  lastInputTime = clock.elapsed
}
function onUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  dragV = dragH = 0
  axisLock = null
}
renderer.domElement.addEventListener('pointerdown', onDown)
window.addEventListener('pointermove', onMove)
window.addEventListener('pointerup', onUp)
window.addEventListener('pointercancel', onUp)

// ---------------------------------------------------------------------------
// Gesture hint (no text): appears when the child pauses
// ---------------------------------------------------------------------------
const hintEl = document.getElementById('hint')!
let hintVisible = false
function showHint(kind: 'up' | 'side' | 'down', flip: boolean) {
  hintEl.classList.toggle('side', kind === 'side')
  hintEl.classList.toggle('down', kind === 'down')
  hintEl.style.transform = `translateX(-50%) scaleX(${kind === 'side' && flip ? -1 : 1})`
  if (!hintVisible) { hintEl.classList.add('show'); hintVisible = true }
}
function hideHint() {
  if (hintVisible) { hintEl.classList.remove('show'); hintVisible = false }
}

function updateHint() {
  const interactive = sim.phase === Phase.LIFT || sim.phase === Phase.TRANSPORT || sim.phase === Phase.DESCEND
  if (E2E || !interactive || pointerId !== null) { hideHint(); return }
  const idle = clock.elapsed - lastInputTime
  const threshold = anyInputYet ? 7 : 3.2
  if (idle < threshold) { hideHint(); return }
  if (sim.phase === Phase.LIFT) showHint('up', false)
  else if (sim.phase === Phase.TRANSPORT) {
    if (Math.abs(sim.carZ) > 0.5) showHint('side', screenZSign() < 0)
    else showHint('down', false)
  } else showHint('down', false)
}

// ---------------------------------------------------------------------------
// Frame update: sync scene from sim
// ---------------------------------------------------------------------------
const camRig = new CameraRig(window.innerWidth / window.innerHeight)
const hookVecs = [new THREE.Vector3(), new THREE.Vector3()]
const bracketVecs = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
const freeBracket = [new THREE.Vector3(), new THREE.Vector3()]
let prevTension = 0
let introTimer = 0
// test hook: direct sim-space commands (v: + = raise, h: + = toward the beam)
let testInput: { v: number, h: number } | null = null

function onPhaseChange(p: Phase) {
  if (p === Phase.LIFT && sim.round > 0) {
    applyVariation()
    // fresh trailer rolls in visually (already positioned) — car meshes reset
    car.group.visible = true
    mover.group.visible = false
  }
  if (p === Phase.MOVER_IN) mover.group.visible = true
}

function moveActor(a: Actor, dt: number) {
  const d = a.target.clone().sub(a.pos)
  d.y = 0
  const dist = d.length()
  if (dist > 0.03) {
    const step = Math.min(dist, 1.25 * dt)
    a.pos.addScaledVector(d.normalize(), step)
    a.walkPhase += dt * 9
    a.face = Math.atan2(d.x, d.z)
    a.w.group.position.set(a.pos.x, Math.abs(Math.sin(a.walkPhase)) * 0.035, a.pos.z)
    a.w.group.rotation.y = damp(a.w.group.rotation.y, a.face, 8, dt)
    a.w.leftArm.rotation.x = Math.sin(a.walkPhase) * 0.5
    a.w.rightArm.rotation.x = -Math.sin(a.walkPhase) * 0.5
  } else {
    a.w.group.position.set(a.pos.x, 0, a.pos.z)
    a.w.leftArm.rotation.x = damp(a.w.leftArm.rotation.x, 0, 6, dt)
    a.w.rightArm.rotation.x = damp(a.w.rightArm.rotation.x, 0, 6, dt)
  }
}

function syncScene(dt: number) {
  // car pose
  car.group.position.set(sim.carX, sim.carY, sim.carZ)
  car.group.rotation.z = sim.pitch
  car.group.rotation.x = sim.roll
  car.setLightsOn(sim.lightsOn)

  // bogies follow during tow; springs compress with load transfer
  for (const [i, b] of bogies.entries()) {
    b.group.position.x = L.bogieCenters[i] + sim.carX
    b.setCompression(sim.springComp)
    b.setWheelRoll(sim.towDist)
  }
  mover.group.position.x = sim.moverX
  mover.setRoll(sim.towDist)

  trailer.setUnloaded(sim.trailerUnload)

  // cranes + rigging
  for (let i = 0; i < 2; i++) {
    const hp = sim.hookPos(i)
    hookVecs[i].set(hp.x, hp.y, hp.z)
    cranes[i].setHook(hookVecs[i], sim.tension)
    cranes[i].setBeacon(dt, Math.abs(sim.winchVel) > 0.02 || Math.abs(sim.carrierVel) > 0.02)
  }
  for (let i = 0; i < 4; i++) car.liftBrackets[i].getWorldPosition(bracketVecs[i])
  for (let i = 0; i < 2; i++) {
    if (sim.rigAttached) {
      const a = bracketVecs[i * 2], b = bracketVecs[i * 2 + 1]
      rigs[i].update(hookVecs[i], a, b, sim.tension, true)
    } else {
      // slings hang straight from the spreader ends
      const hy = hookVecs[i].y - L.spreaderDrop
      freeBracket[0].set(hookVecs[i].x, hy - L.slingLen, hookVecs[i].z - L.spreaderLen / 2 + 0.12)
      freeBracket[1].set(hookVecs[i].x, hy - L.slingLen, hookVecs[i].z + L.spreaderLen / 2 - 0.12)
      rigs[i].update(hookVecs[i], freeBracket[1], freeBracket[0], 0, true)
    }
  }

  // operator's remote sticks mirror the input (cause before effect)
  remote.stickV.rotation.x = damp(remote.stickV.rotation.x, -dragV * 0.5, 10, dt)
  remote.stickH.rotation.z = damp(remote.stickH.rotation.z, -dragH * 0.5, 10, dt)

  // signaller raises an arm while the load moves
  const moving = Math.abs(sim.winchVel) > 0.03 || Math.abs(sim.carrierVel) > 0.03
  const armTarget = moving ? -2.6 : (sim.airborne ? -1.2 : 0)
  signaller.w.rightArm.rotation.x = damp(signaller.w.rightArm.rotation.x, armTarget, 3, dt)

  // riggers: reveal retreat, then approach to unhook after seating
  introTimer += dt
  if (sim.phase === Phase.SEATED || sim.phase === Phase.UNHOOK) {
    const t = sim.workersApproach
    rigger1.target.set(3.2, 0, lerp(11.2, 2.2, t))
    rigger2.target.set(6.0, 0, lerp(11.4, 2.2, t))
  } else if (sim.phase === Phase.LIGHTS || sim.phase === Phase.MOVER_IN || sim.phase === Phase.TOW) {
    rigger1.target.set(-1.6, 0, 11.2)
    rigger2.target.set(1.9, 0, 11.4)
  } else if (sim.round > 0) {
    rigger1.target.set(-1.6, 0, 11.2)
    rigger2.target.set(1.9, 0, 11.4)
  }
  for (const a of riggers) moveActor(a, dt)
  moveActor(operator, dt)
  moveActor(signaller, dt)
  void observer1; void observer2

  // audio continuous layer
  const motorLevel = clamp(Math.abs(sim.winchVel) / 0.55 + Math.abs(sim.carrierVel) / 0.85, 0, 1)
  const tensionRate = (sim.tension - prevTension) / Math.max(dt, 1e-4)
  prevTension = sim.tension
  audio.update(dt, motorLevel, moving, sim.tension, tensionRate)
}

// ---------------------------------------------------------------------------
// Main loop with fixed sim substeps
// ---------------------------------------------------------------------------
const clock = { elapsed: 0, last: performance.now() }

function step(dt: number) {
  if (testInput) sim.setInput(testInput.v, testInput.h)
  else sim.setInput(dragV, dragH * screenZSign())
  const sub = Math.max(1, Math.ceil(dt / (1 / 60)))
  const h = dt / sub
  for (let i = 0; i < sub; i++) sim.update(h)
  syncScene(dt)
  camRig.update(sim, dt, window.innerWidth / window.innerHeight)
  updateHint()
}

let raf = 0
function frame() {
  raf = requestAnimationFrame(frame)
  const now = performance.now()
  let dt = (now - clock.last) / 1000
  clock.last = now
  dt = clamp(dt, 0.0005, 0.1)
  if (E2E) dt = 1 / 60
  clock.elapsed += dt
  step(dt)
  renderer.render(scene, camRig.camera)
}
frame()

// pause the loop when hidden (battery); state is preserved
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf) }
  else { clock.last = performance.now(); frame() }
})

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camRig.camera.aspect = window.innerWidth / window.innerHeight
  camRig.camera.updateProjectionMatrix()
}
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', () => setTimeout(onResize, 60))

// ---------------------------------------------------------------------------
// Deterministic test hooks
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __game: {
      sim: Sim
      state(): Record<string, unknown>
      input(v: number, h: number): void
      advance(seconds: number): void
      advanceSim(seconds: number): void
      render(): void
      info(): { calls: number, triangles: number, geometries: number, textures: number }
    }
  }
}
window.__game = {
  sim,
  state: () => ({
    phase: sim.phase,
    carX: sim.carX, carY: sim.carY, carZ: sim.carZ,
    hookY: sim.hookY, carrierZ: sim.carrierZ,
    tension: sim.tension, slack: sim.slack,
    airborne: sim.airborne, springComp: sim.springComp,
    lightsOn: sim.lightsOn, round: sim.round,
    pitch: sim.pitch, roll: sim.roll,
    moverX: sim.moverX, towDist: sim.towDist
  }),
  input: (v: number, h: number) => {
    testInput = (v === 0 && h === 0) ? null : { v: clamp(v, -1, 1), h: clamp(h, -1, 1) }
    lastInputTime = clock.elapsed; anyInputYet = true
  },
  advance: (seconds: number) => {
    const n = Math.round(seconds * 60)
    for (let i = 0; i < n; i++) {
      clock.elapsed += 1 / 60
      step(1 / 60)
    }
    renderer.render(scene, camRig.camera)
  },
  // sim-only stepping (no scene sync, no render): for dense per-tick assertions
  advanceSim: (seconds: number) => {
    const n = Math.round(seconds * 60)
    if (testInput) sim.setInput(testInput.v, testInput.h)
    for (let i = 0; i < n; i++) sim.update(1 / 60)
  },
  render: () => renderer.render(scene, camRig.camera),
  info: () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures
  })
}
