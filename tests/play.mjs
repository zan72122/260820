// Drives the game in Chromium: one full round per viewport, capturing console
// output, frame timing and screenshots. Rendering here is SwiftShader, so the
// frame numbers are only useful as a relative signal, never as an FPS verdict.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL || 'http://localhost:4173/'
const OUT = process.env.OUT || 'test-results'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
]

const only = process.argv[2]
const list = only ? VIEWPORTS.filter((v) => v.name === only) : VIEWPORTS

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
})

const problems = []

for (const vp of list) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  const logs = []
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => {
    logs.push(`[pageerror] ${e.message}`)
    problems.push(`${vp.name}: ${e.message}`)
  })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  // SwiftShader renders a handful of frames per second; compensate so the
  // simulation still advances at wall-clock speed during the drive.
  await page.evaluate(() => window.__renkon.setTimeScale(3))

  const shot = async (tag) => page.screenshot({ path: `${OUT}/${vp.name}-${tag}.png` })

  await shot('00-start')
  // first tap starts the morning
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(400)

  // let the wordless hints run
  await page.waitForTimeout(4200)
  await shot('01-hint')

  // find the marked petiole on screen and touch it (the probe)
  const petiole = await page.evaluate(() => {
    const g = window.__renkon.game
    const p = g.__probeTarget()
    return p
  })
  if (petiole) {
    await page.mouse.move(petiole.x, petiole.y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(2300)
  }
  await shot('02-probe')

  // dig: sweep the hose over the buried rhizome
  const path = await page.evaluate(() => window.__renkon.game.__digPath())
  const state1 = await page.evaluate(() => window.__renkon.game.__state())
  await page.mouse.move(path[0].x, path[0].y)
  await page.mouse.down()
  for (let pass = 0; pass < 6; pass++) {
    const seq = pass % 2 === 0 ? path : [...path].reverse()
    for (const p of seq) {
      await page.mouse.move(p.x, p.y, { steps: 6 })
      await page.waitForTimeout(70)
    }
    if (pass === 0) await shot('03-first-water')
  }
  await page.mouse.up()
  await page.waitForTimeout(700)
  await shot('04-exposed')

  const state2 = await page.evaluate(() => window.__renkon.game.__state())

  // measure frame pacing over a second of spraying
  const perf = await page.evaluate(async () => {
    const t = []
    let last = performance.now()
    await new Promise((res) => {
      let n = 0
      const step = (now) => {
        t.push(now - last)
        last = now
        if (++n < 90) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
    t.sort((a, b) => a - b)
    return { median: t[Math.floor(t.length / 2)], p90: t[Math.floor(t.length * 0.9)] }
  })

  // lift: grab the exposed root and drag it up
  const grab = await page.evaluate(() => window.__renkon.game.__grabPoint())
  if (!grab) problems.push(`${vp.name}: nothing exposed enough to grab after digging`)
  if (grab) {
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    for (let i = 0; i < 14; i++) {
      await page.mouse.move(grab.x + i * 2, grab.y - i * 14, { steps: 3 })
      await page.waitForTimeout(45)
    }
    await page.waitForTimeout(1200)
    await shot('05-lift')
    // wash: sluice it side to side just above the water
    for (let i = 0; i < 16; i++) {
      await page.mouse.move(grab.x + Math.sin(i) * 90, grab.y - 150, { steps: 2 })
      await page.waitForTimeout(55)
    }
    await shot('06-wash')
    // carry to the boat
    const boat = await page.evaluate(() => window.__renkon.game.__boatPoint())
    if (boat) {
      await page.mouse.move(boat.x, boat.y, { steps: 22 })
      await page.waitForTimeout(400)
      await page.mouse.up()
    } else {
      await page.mouse.up()
    }
    await page.waitForTimeout(2200)
  }
  await shot('07-stored')

  const state3 = await page.evaluate(() => window.__renkon.game.__state())

  // second root should be startable with no menu in between
  const path2 = await page.evaluate(() => window.__renkon.game.__digPath())
  if (!path2.length) {
    problems.push(`${vp.name}: second plot has no reachable dig path`)
    path2.push({ x: vp.width / 2, y: vp.height * 0.6 })
  }
  await page.mouse.move(path2[0].x, path2[0].y)
  await page.mouse.down()
  for (const p of path2) {
    await page.mouse.move(p.x, p.y, { steps: 5 })
    await page.waitForTimeout(70)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
  await shot('08-second')
  const state4 = await page.evaluate(() => window.__renkon.game.__state())

  // orientation flip must keep the dug mask and the harvest
  await page.setViewportSize({ width: vp.height, height: vp.width })
  await page.waitForTimeout(1200)
  await shot('09-rotated')
  const state5 = await page.evaluate(() => window.__renkon.game.__state())
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.waitForTimeout(900)

  // cutaway replay
  await page.evaluate(() => window.__renkon.game.startReplay())
  await page.waitForTimeout(2400)
  await shot('10-cutaway')
  await page.evaluate(() => window.__renkon.game.stopReplay())

  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
  console.log(`\n=== ${vp.name} ===`)
  console.log('before dig  :', JSON.stringify(state1))
  console.log('after dig   :', JSON.stringify(state2))
  console.log('after store :', JSON.stringify(state3))
  console.log('second root :', JSON.stringify(state4))
  console.log('rotated     :', JSON.stringify(state5))
  console.log('frame ms    :', JSON.stringify(perf))
  console.log('console errs:', errs.length ? errs.slice(0, 6) : 'none')
  const warns = logs.filter((l) => l.startsWith('[warning]'))
  if (warns.length) console.log('warnings    :', warns.slice(0, 4))
  await ctx.close()
}

await browser.close()
if (problems.length) {
  console.error('\nPROBLEMS:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('\nall viewports done')
