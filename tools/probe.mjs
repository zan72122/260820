import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('err:', m.text()) })
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))

// Force the run without gestures, sampling the machine every 200 ms.
await page.evaluate(() => {
  const g = window.__game
  g.__len = 0

  window.__sample = () => {
    const c = g.circuits.circuits[g.circuits.active]
    return { phase: g.stats.phase, shaft: g.stats.shaft, charge: c.charge, live: c.live, d: g.rideDistance, v: g.rideSpeed, len: g.__len }
  }
})
const seq = []
// swipe up to climb
const W = 390, H = 844
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => window.__game.stats.phase)
  if (s !== 'intro' && s !== 'climb') break
  await page.mouse.move(W * 0.5, H * 0.8); await page.mouse.down()
  for (let k = 1; k <= 8; k++) await page.mouse.move(W * 0.5, H * (0.8 - 0.07 * k))
  await page.mouse.up(); await page.waitForTimeout(140)
}
await page.waitForTimeout(1500)
await page.mouse.move(W * 0.5, H * 0.6); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up()
for (let i = 0; i < 60; i++) {
  seq.push(await page.evaluate(() => window.__sample()))
  await page.waitForTimeout(400)
}
console.log(seq.map((s) => `${s.phase} d=${(s.d??0).toFixed(2)} v=${(s.v??0).toFixed(2)} shaft=${s.shaft} charge=${s.charge.toFixed(3)}`).join('\n'))
await browser.close()
