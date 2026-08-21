import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
page.on('console', (m) => console.log('[page]', m.text()))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))
await page.evaluate(() => {
  const g = window.__game
  const d = g.director
  const orig = d.play.bind(d)
  d.play = (n, dur) => { console.log('play(' + n + ',' + dur + ')'); return orig(n, dur) }
  const origR = d.reveal.bind(d)
  d.reveal = (z, dur) => { console.log('reveal(' + z + ')'); return origR(z, dur) }
  g.phase = 'discover'
  g.phaseTime = 50
  g.runCount = 1
})
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(1000)
  const s = await page.evaluate(() => {
    const g = window.__game
    const p = g.director.camera.position
    return { phase: g.phase, t: +g.phaseTime.toFixed(1), cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], fov: +g.director.camera.fov.toFixed(1) }
  })
  console.log(JSON.stringify(s))
}
await browser.close()
