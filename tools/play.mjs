// End-to-end play-through: three runs, three circuits, using only the gestures
// the game actually exposes. Fails loudly if the chain of phases breaks.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL ?? 'http://localhost:5173/?e2e=1'
const OUT = process.env.OUT ?? 'shots/play'
mkdirSync(OUT, { recursive: true })

const DEVICES = {
  iphone: { width: 390, height: 844, dpr: 1 },
  iphoneL: { width: 844, height: 390, dpr: 1 },
  ipad: { width: 820, height: 1180, dpr: 1 },
  ipadL: { width: 1180, height: 820, dpr: 1 },
}
const name = process.env.DEVICE ?? 'iphone'
const device = DEVICES[name]

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({
  viewport: { width: device.width, height: device.height },
  deviceScaleFactor: device.dpr,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on', { timeout: 60000 })
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 60000 })
if (process.env.TRACE) {
  page.on('console', (m) => { if (m.text().startsWith('shot:')) console.log('  [trace]', m.text()) })
  await page.evaluate(() => {
    const d = window.__game.director
    const orig = d.play.bind(d)
    d.play = (n, dur) => { console.log('shot:play ' + n + ' ' + dur); return orig(n, dur) }
    const origR = d.reveal.bind(d)
    d.reveal = (z, dur) => { console.log('shot:reveal ' + z); return origR(z, dur) }
  })
}

const W = device.width
const H = device.height
const stats = () => page.evaluate(() => window.__game.stats)
const log = async (label) => {
  const s = await stats()
  console.log(label.padEnd(22), JSON.stringify(s))
  return s
}
const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` })

async function swipeUp(times = 4) {
  for (let i = 0; i < times; i++) {
    await page.mouse.move(W * 0.5, H * 0.78)
    await page.mouse.down()
    for (let k = 1; k <= 8; k++) await page.mouse.move(W * 0.5, H * (0.78 - 0.06 * k))
    await page.mouse.up()
    await page.waitForTimeout(120)
  }
}

async function waitPhase(target, timeout = 60000) {
  const t0 = Date.now()
  for (;;) {
    const s = await stats()
    if (s.phase === target) return s
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for phase ${target}; now ${s.phase}`)
    await page.waitForTimeout(350)
  }
}

async function climbAndSlide(label) {
  const t0 = Date.now()
  let sawRide = false
  for (;;) {
    const s = await stats()
    if (s.phase === 'arrive') break
    if (s.phase === 'ride') {
      if (!sawRide) {
        sawRide = true
        await page.waitForTimeout(1500)
        await shot(label ? `${label}-ride` : 'ride')
      }
      await page.waitForTimeout(400)
      continue
    }
    if (s.phase === 'seat') {
      await page.waitForTimeout(1200)
      await page.mouse.move(W * 0.5, H * 0.6)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
      await page.waitForTimeout(600)
      continue
    }
    if (s.phase === 'climb' || s.phase === 'intro') {
      await swipeUp(2)
      await page.waitForTimeout(150)
      continue
    }
    if (Date.now() - t0 > 180000) throw new Error('stuck at ' + s.phase)
    await page.waitForTimeout(400)
  }
}

async function crank(seconds) {
  const t0 = Date.now()
  const y = H * 0.62
  while (Date.now() - t0 < seconds * 1000) {
    await page.mouse.move(W * 0.22, y)
    await page.mouse.down()
    for (let k = 1; k <= 10; k++) await page.mouse.move(W * (0.22 + 0.045 * k), y)
    await page.mouse.up()
    await page.waitForTimeout(40)
  }
}

async function throwLever(circuit) {
  const spots = await page.evaluate(() => {
    const g = window.__game
    return g.leverScreenPositions().map((p, i) => ({ p, id: ['path', 'pavilion', 'tree'][i] }))
  })
  const found = spots.find((s) => s.id === circuit && s.p)
  if (!found) throw new Error(`lever ${circuit} not on screen: ${JSON.stringify(spots)}`)
  const x = found.p.x * W
  const y = found.p.y * H
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let k = 1; k <= 16; k++) await page.mouse.move(x, y + (H * 0.22 * k) / 16)
  await page.mouse.up()
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => ({
    dragging: window.__game.draggingLever ? window.__game.draggingLever.id : null,
    armed: window.__game.armedPending,
    active: window.__game.circuits.active,
    phase: window.__game.phase,
  }))
  console.log('  lever', circuit, 'at', found.p, '->', JSON.stringify(after))
}

/* ---- run 1: nothing is explained --------------------------------------- */
await page.waitForTimeout(4200)
await shot('01-overview')
await log('intro')
await climbAndSlide('run1')
await page.waitForTimeout(2600)
await shot('02-first-light')
const afterRun1 = await log('after run 1')

await waitPhase('discover', 90000)
await page.waitForTimeout(2600)
await shot('03-discovery')
await crank(6)
await page.waitForTimeout(1500)
await shot('04-crank')
await log('after crank')
await page.waitForTimeout(1500)
await crank(4)

/* ---- run 2: choose a circuit ------------------------------------------- */
await waitPhase('select', 60000)
await page.waitForTimeout(6000)
await shot('05-selector')
await throwLever('pavilion')
await log('lever thrown')
await climbAndSlide('run2')
await page.waitForTimeout(4000)
await shot('06-reveal')
await log('after run 2')

/* ---- run 3: choose another --------------------------------------------- */
await waitPhase('select', 60000)
await page.waitForTimeout(6000)
await throwLever('tree')
await climbAndSlide('run3')
await page.waitForTimeout(4000)
await shot('07-reveal-2')
const afterRun3 = await log('after run 3')

const finale = await waitPhase('finale', 60000).catch(() => null)
await page.waitForTimeout(3600)
await shot('08-finale')
await log('finale')

const lit = await page.evaluate(() => {
  const g = window.__game
  const out = {}
  for (const id of ['path', 'pavilion', 'tree']) out[id] = g.circuits.latchedCount(id)
  return out
})
console.log('latched fixtures per circuit:', JSON.stringify(lit))
console.log('reached finale:', Boolean(finale))
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'))
await browser.close()
