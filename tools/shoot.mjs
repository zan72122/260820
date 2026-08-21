// Development harness: drives the game through its camera chain and captures
// stills, so lighting and framing can be judged without a device in hand.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL ?? 'http://localhost:5173/?debug=0'
const OUT = process.env.OUT ?? 'shots'
mkdirSync(OUT, { recursive: true })

const DEVICES = {
  iphone: { width: 390, height: 844, dpr: 3 },
  iphoneL: { width: 844, height: 390, dpr: 3 },
  ipad: { width: 820, height: 1180, dpr: 2 },
  ipadL: { width: 1180, height: 820, dpr: 2 },
}

const device = DEVICES[process.env.DEVICE ?? 'iphone']
const shots = (process.env.SHOTS ?? 'overview,climb,top,ride,firstLight,discovery,selector,finale').split(',')

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
})
const ctx = await browser.newContext({
  viewport: { width: device.width, height: device.height },
  deviceScaleFactor: device.dpr,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('#boot .start.on', { timeout: 60000 })
await page.click('#boot .start')
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 60000 })
await page.waitForTimeout(1500)

if (process.env.FILL) {
  await page.evaluate((v) => window.__game.fillCircuits(Number(v)), process.env.FILL)
  await page.waitForTimeout(2500)
}

for (const shot of shots) {
  await page.evaluate((s) => window.__game.jumpToShot(s), shot)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `${OUT}/${process.env.DEVICE ?? 'iphone'}-${shot}.png` })
  console.log('captured', shot)
}

await browser.close()
