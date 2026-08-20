import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const q of ['low', 'mid']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => console.log('PAGEERROR', q, String(e)))
  const extra = q === 'fast' ? '&fast=1' : ''
  await page.goto(`http://127.0.0.1:4173/?e2e=1&q=${q}${extra}&seed=305419896`)
  await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
  await page.evaluate(() => window.__mango.pause(true))
  await page.evaluate(() => window.__mango.attach(1, 5))
  let g = 0
  while ((await page.evaluate(() => window.__mango.state().ripeness)) < 1 && g++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }
  await page.evaluate(() => window.__mango.step(6, 1 / 120))
  await page.evaluate(() => window.__mango.render())
  await page.screenshot({ path: `shots/tier-${q}.png` })
  console.log(q, JSON.stringify(await page.evaluate(() => window.__mango.state())).slice(0, 110))
  await page.close()
}
await browser.close()
