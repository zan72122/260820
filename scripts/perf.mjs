/**
 * Measure the CPU cost of one simulation+scene update, at two quality tiers.
 *
 * This is the only performance number worth taking from this environment: it
 * is pure JavaScript and does not touch the GPU. Frame rate, animation
 * smoothness and visual quality must be judged on hardware-accelerated
 * devices, never on a software rasteriser.
 */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const q of ['low', 'high']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
  await page.goto(`http://127.0.0.1:4173/?e2e=1&q=${q}&seed=305419896`)
  await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
  await page.evaluate(() => window.__mango.pause(true))
  await page.evaluate(() => window.__mango.attach(1, 5))
  let g = 0
  while ((await page.evaluate(() => window.__mango.state().ripeness)) < 1 && g++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }
  const res = await page.evaluate(() => {
    const m = window.__mango
    m.step(2, 1 / 60)
    const t0 = performance.now()
    for (let i = 0; i < 600; i++) m.step(1 / 60, 1 / 60)
    return (performance.now() - t0) / 600
  })
  console.log(`${q}: CPU update ${res.toFixed(3)} ms/frame`)
  await page.close()
}
await browser.close()
