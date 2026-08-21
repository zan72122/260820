import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots/reveal', { recursive: true })
const DEV = { iphone: [390, 844], ipadL: [1180, 820] }
const name = process.env.DEVICE ?? 'iphone'
const [w, h] = DEV[name]
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: w, height: h } })
await page.goto(process.env.URL ?? 'http://localhost:4173/?e2e=1', { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on')
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game))
await page.evaluate(() => window.__game.fillCircuits(0.9))
await page.waitForTimeout(4000)
for (const zone of ['path', 'pavilion', 'tree']) {
  await page.evaluate((z) => window.__game.director.reveal(z, 1), zone)
  await page.waitForTimeout(9000)
  await page.screenshot({ path: `shots/reveal/${name}-${zone}.png` })
  console.log('captured', zone)
}
await browser.close()
