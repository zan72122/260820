// Checks that a mid-session rotation re-frames rather than stretching: the
// renderer's aspect must follow the viewport, and the camera with it.
import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(process.env.URL ?? 'http://localhost:4173/?e2e=1', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))
const read = () => page.evaluate(() => {
  const g = window.__game
  return {
    viewport: [g.render.viewport.width, g.render.viewport.height],
    aspect: +g.render.viewport.aspect.toFixed(3),
    cameraAspect: +g.director.camera.aspect.toFixed(3),
    tall: +g.director.ctx.tall.toFixed(2),
    drawing: [g.render.renderer.domElement.width, g.render.renderer.domElement.height],
  }
})
await page.waitForTimeout(2500)
console.log('portrait ', JSON.stringify(await read()))
await page.setViewportSize({ width: 844, height: 390 })
await page.waitForTimeout(2500)
console.log('landscape', JSON.stringify(await read()))
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(2500)
console.log('portrait ', JSON.stringify(await read()))
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors')
await browser.close()
