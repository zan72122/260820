import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
await page.goto('http://127.0.0.1:4173/?e2e=1&q=low')
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 60000 })
const st = () => page.evaluate(() => window.__mango.state())
const step = (s) => page.evaluate((x) => window.__mango.step(x), s)
await page.evaluate(() => window.__mango.pause(true))
await step(1)

async function drag(side, hook) {
  const from = await page.evaluate((s) => window.__mango.handleScreen(s), side)
  const to = await page.evaluate((h) => window.__mango.hookScreen(h), hook)
  const off = await page.evaluate(() => window.__mango.fingerOffset)
  console.log(side, 'from', from, 'to', to)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 22; i++) {
    const t = i / 22
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y + off - from.y) * t)
    await step(1 / 30)
  }
  const now = await page.evaluate((s) => window.__mango.handleScreen(s), side)
  console.log(side, 'handle at release', now, 'target', to)
  await page.mouse.up()
  await step(0.4)
  console.log(side, 'attach', JSON.stringify((await st()).attach))
}
await drag('left', 1)
await step(1.5)
await drag('right', 5)
await browser.close()
