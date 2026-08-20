// Fast visual iteration: one viewport, fewer frames, screenshots at each beat.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL || 'http://localhost:4173/'
const OUT = process.env.OUT || 'shots'
mkdirSync(OUT, { recursive: true })
const W = Number(process.env.W || 390)
const H = Number(process.env.H || 844)
const TAG = process.env.TAG || 'p'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(2000)
await page.evaluate(() => window.__renkon.setTimeScale(6))
const shot = (t) => page.screenshot({ path: `${OUT}/${TAG}-${t}.png` })

await page.mouse.move(W / 2, H / 2)
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(2500)
await shot('a-idle')

const petiole = await page.evaluate(() => window.__renkon.game.__probeTarget())
if (petiole) {
  await page.mouse.move(petiole.x, petiole.y)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(1200)
}
await shot('b-probe')

const path = await page.evaluate(() => window.__renkon.game.__digPath())
await page.mouse.move(path[0].x, path[0].y)
await page.mouse.down()
for (const p of path.slice(0, 4)) {
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.waitForTimeout(120)
}
await shot('c-jet')
for (let pass = 0; pass < 3; pass++) {
  const seq = pass % 2 === 0 ? path : [...path].reverse()
  for (const p of seq) {
    await page.mouse.move(p.x, p.y, { steps: 4 })
    await page.waitForTimeout(90)
  }
}
await page.mouse.up()
await page.waitForTimeout(600)
await shot('d-exposed')
console.log('state after dig:', JSON.stringify(await page.evaluate(() => window.__renkon.game.__state())))

const grab = await page.evaluate(() => window.__renkon.game.__grabPoint())
console.log('grab point:', JSON.stringify(grab))
if (grab) {
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(grab.x, grab.y - i * 14, { steps: 2 })
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(900)
  await shot('e-lift')
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(grab.x + Math.sin(i) * 80, grab.y - 160, { steps: 2 })
    await page.waitForTimeout(55)
  }
  await shot('f-wash')
  const boat = await page.evaluate(() => window.__renkon.game.__boatPoint())
  if (boat) {
    await page.mouse.move(boat.x, boat.y, { steps: 18 })
    await page.waitForTimeout(900)
    const boat2 = await page.evaluate(() => window.__renkon.game.__boatPoint())
    if (boat2) await page.mouse.move(boat2.x, boat2.y, { steps: 8 })
  }
  await page.waitForTimeout(600)
  await page.mouse.up()
  await page.waitForTimeout(1600)
  await shot('g-stored')
}
console.log('state final:', JSON.stringify(await page.evaluate(() => window.__renkon.game.__state())))
const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()
