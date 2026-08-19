import { chromium } from '@playwright/test'
import fs from 'node:fs'
const SP = process.argv[2]
const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844)
const tag = process.argv[5] || 'x'
fs.mkdirSync(SP, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon)
// bake mid-way
await page.evaluate(() => {
  window.__chiffon.goto('bake')
  window.__chiffon.step(4.0)
})
await page.evaluate(() => window.__chiffon.render())
await page.screenshot({ path: `${SP}/${tag}-bake-mid.png` })
await page.evaluate(() => window.__chiffon.step(2.2))
await page.evaluate(() => window.__chiffon.render())
await page.screenshot({ path: `${SP}/${tag}-bake-late.png` })
await browser.close()
