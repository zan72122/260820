// Real pointer-gesture test: drives the game through the actual touch input
// path (pointerdown/move/up on the canvas), not the __game.input hook.
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/?e2e=1&seed=1', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__game !== undefined)

const state = () => page.evaluate(() => window.__game.state())

// drag up and HOLD: winch raise command
async function dragHold(fromX, fromY, dx, dy, holdMs) {
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + dx * i / steps, fromY + dy * i / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(holdMs)
  await page.mouse.up()
}

let s0 = await state()
console.log('start carY', s0.carY.toFixed(2), 'slack', s0.slack.toFixed(3))

// upward drag: slack take-up then tension
await dragHold(195, 600, 0, -160, 3500)
let s = await state()
console.log('after up-drag: carY', s.carY.toFixed(2), 'tension', s.tension.toFixed(2), 'airborne', s.airborne)
if (!(s.tension > 0.5 || s.airborne)) { console.log('FAIL: upward drag did not tension/lift'); process.exit(1) }

// keep raising to clearance
for (let i = 0; i < 4; i++) await dragHold(195, 640, 0, -200, 2600)
s = await state()
console.log('after raises: carY', s.carY.toFixed(2), 'phase', s.phase)
if (s.phase !== 'TRANSPORT') { console.log('FAIL: did not reach TRANSPORT') ; process.exit(1) }

// horizontal drag: figure out which side moves toward the beam by probing
const z0 = (await state()).carZ
await dragHold(195, 500, 140, 0, 1800)
const z1 = (await state()).carZ
const dir = (z1 < z0) ? 140 : -140
console.log('probe: carZ', z0.toFixed(2), '->', z1.toFixed(2), 'using dx', dir)
for (let i = 0; i < 5; i++) {
  await dragHold(195, 500, dir, 0, 2200)
  const zz = (await state()).carZ
  console.log('traverse carZ', zz.toFixed(2))
  if (Math.abs(zz) < 0.5) break
}
s = await state()
if (Math.abs(s.carZ) > 1.0) { console.log('FAIL: traverse did not reach beam, carZ', s.carZ); process.exit(1) }

// diagonal sloppy drag downward (child-like): should map to descend
for (let i = 0; i < 8; i++) {
  await dragHold(195, 420, 40, 190, 2500)
  s = await state()
  console.log('descend carY', s.carY.toFixed(2), 'phase', s.phase, 'tension', s.tension.toFixed(2))
  if (s.phase === 'SEATED' || s.phase === 'UNHOOK' || s.phase === 'LIGHTS') break
}
if (!['SEATED', 'UNHOOK', 'LIGHTS', 'MOVER_IN', 'TOW'].includes(s.phase)) {
  console.log('FAIL: did not seat via real gestures, phase', s.phase); process.exit(1)
}
console.log('REAL-GESTURE PASS: seated via touch path, carZ', s.carZ.toFixed(3))
await browser.close()
