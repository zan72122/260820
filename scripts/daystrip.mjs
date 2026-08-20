/** Capture the same shot at four points in the day, to check that the sun,
 *  colour temperature, floor patch, fog and leaf angle all move together. */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
await page.goto('http://127.0.0.1:4173/?e2e=1&q=high&seed=305419896')
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
await page.evaluate(() => window.__mango.pause(true))
await page.evaluate(() => window.__mango.attach(1, 5))
await page.evaluate(() => window.__mango.step(1.5, 1 / 120))
for (const [i, target] of [0.08, 0.35, 0.62, 0.92].entries()) {
  await page.evaluate((t) => {
    const cur = window.__mango.state().timeOfDay
    window.__mango.scrub(t - (cur % 1))
  }, target)
  await page.evaluate(() => window.__mango.step(2.5, 1 / 120))
  await page.evaluate(() => window.__mango.render())
  await page.screenshot({ path: `shots/day-${i}.png` })
  const s = await page.evaluate(() => window.__mango.state())
  console.log(i, 'timeOfDay', s.timeOfDay.toFixed(3), 'ripeness', s.ripeness.toFixed(2))
}
await browser.close()
