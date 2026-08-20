import { chromium } from '@playwright/test'

const url = process.env.URL ?? 'http://127.0.0.1:4173/?e2e=1&q=low'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 60000 })

const st = () => page.evaluate(() => window.__mango.state())
const step = (s) => page.evaluate((x) => window.__mango.step(x), s)

console.log('boot', JSON.stringify(await st()))
await page.evaluate(() => window.__mango.attach(1, 5))
console.log('attached', JSON.stringify(await st()))
let guard = 0
while ((await st()).ripeness < 1 && guard++ < 40) await page.evaluate(() => window.__mango.scrub(0.25))
console.log('ripe', JSON.stringify(await st()))
for (let i = 0; i < 24; i++) {
  await step(0.2)
  const s = await st()
  console.log(i, s.stage, s.fruit.phase, 'y=' + s.fruit.y.toFixed(4), 'sink=' + s.fruit.sink.toFixed(4), 'netLowY=' + s.netLow.y.toFixed(4), 'grip=' + s.gripCount)
}
await browser.close()
