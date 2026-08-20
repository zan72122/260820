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
await page.evaluate(() => window.__mango.attach(0, 7))
let g = 0
while ((await st()).ripeness < 1 && g++ < 60) await page.evaluate(() => window.__mango.scrub(0.2))
await step(9)
let s = await st()
console.log('stage', s.stage, 'fruitY', s.fruit.y.toFixed(4))
const net = await page.evaluate(() => window.__mango.netScreen())
console.log('netScreen', net, 'viewport 390x844')
await page.mouse.move(net.x, net.y + 10)
await page.mouse.down()
await step(1 / 60)
console.log('after down: drag =', (await st()).drag)
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(net.x + i * 2, net.y + 10 - i * 7)
  await step(1 / 60)
}
s = await st()
console.log('after push: fruitY', s.fruit.y.toFixed(4), 'phase', s.fruit.phase, 'drag', s.drag)
await page.mouse.up()
await step(1)
console.log('later fruitY', (await st()).fruit.y.toFixed(4))
await browser.close()
