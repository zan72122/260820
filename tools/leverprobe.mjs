import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))
// Jump straight to the selector state for the probe.
await page.evaluate(() => {
  const g = window.__game
  g.setPhase ? g.setPhase('select') : (g.phase = 'select')
  g.phase = 'select'
  g.phaseTime = 0
  g.jumpToShot('selector')
})
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const g = window.__game
  return {
    phase: g.phase,
    spots: g.leverScreenPositions(),
    grabVisible: g.machinery.levers.map((l) => l.grab.visible),
    vw: g.render.viewport.width,
    vh: g.render.viewport.height,
    canvas: (() => { const r = document.getElementById('scene').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top } })(),
  }
})
console.log(JSON.stringify(info, null, 1))
const s = info.spots[1]
if (s) {
  const x = s.x * 390, y = s.y * 844
  await page.mouse.move(x, y)
  await page.mouse.down()
  console.log('after down:', JSON.stringify(await page.evaluate(() => ({
    dragging: window.__game.draggingLever ? window.__game.draggingLever.id : null,
    startY: window.__game.leverStartY,
    inputY: window.__game.input.y,
    ndc: [window.__game.input.startNdc.x, window.__game.input.startNdc.y],
  }))))
  for (let k = 1; k <= 12; k++) { await page.mouse.move(x, y + (844 * 0.22 * k) / 12) }
  console.log('mid drag:', JSON.stringify(await page.evaluate(() => ({
    dragging: window.__game.draggingLever ? window.__game.draggingLever.id : null,
    armed: window.__game.armedPending,
    active: window.__game.circuits.active,
  }))))
  await page.mouse.up()
  await page.waitForTimeout(400)
  console.log('after up:', JSON.stringify(await page.evaluate(() => ({
    phase: window.__game.phase, active: window.__game.circuits.active, armed: window.__game.armedPending,
  }))))
}
await browser.close()
