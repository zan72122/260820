import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 600, height: 300 } })
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0,400)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://127.0.0.1:5173/?fixed=1&quality=2', { waitUntil: 'load' })
await page.waitForTimeout(6000)
await page.evaluate(() => { window.__somen.skipTo('playing'); window.__somen.spawn(2, -0.6) })
await page.evaluate(() => new Promise(r => { let i=0; const t=()=>(++i>=4?r():requestAnimationFrame(t)); requestAnimationFrame(t) }))
const out = await page.evaluate(() => window.__somen.noodleDebug ? window.__somen.noodleDebug() : 'no hook')
console.log(JSON.stringify(out, null, 1))
await browser.close()
