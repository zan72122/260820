import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror:', e.message))
page.on('console', (m) => { if (m.text().startsWith('shot:')) console.log('[trace]', m.text()) })
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))
await page.evaluate(() => {
  const d = window.__game.director
  const orig = d.play.bind(d)
  d.play = (n, dur) => { console.log('shot:play ' + n); return orig(n, dur) }
  const g = window.__game
  g.phase = 'arrive'; g.phaseTime = 4.7; g.runCount = 1; g.pulledBack = true; g.walkedBack = true
})
const W = 390, H = 844
await page.waitForTimeout(4000)
console.log('phase after arrive:', await page.evaluate(() => window.__game.phase))
// crank like the play script does
const t0 = Date.now()
while (Date.now() - t0 < 7000) {
  await page.mouse.move(W * 0.22, H * 0.62); await page.mouse.down()
  for (let k = 1; k <= 10; k++) await page.mouse.move(W * (0.22 + 0.045 * k), H * 0.62)
  await page.mouse.up(); await page.waitForTimeout(40)
}
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1200)
  console.log(JSON.stringify(await page.evaluate(() => {
    const g = window.__game, p = g.director.camera.position
    return { phase: g.phase, t: +g.phaseTime.toFixed(1), cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], tall: +g.director.ctx.tall.toFixed(2), lev: g.leverScreenPositions()[1] }
  })))
}
await browser.close()
