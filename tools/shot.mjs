import { chromium } from '@playwright/test'
const url = process.argv[2] || 'http://127.0.0.1:4173/?fast=1'
const out = process.argv[3] || '/tmp/shot.png'
const w = +(process.argv[4] || 390), h = +(process.argv[5] || 844)
const waitMs = +(process.argv[6] || 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(waitMs)
const st = await page.evaluate(() => window.__chiffon ? window.__chiffon.state() : null)
await page.screenshot({ path: out })
console.log(JSON.stringify(st))
console.log(logs.slice(0, 40).join('\n'))
await browser.close()
