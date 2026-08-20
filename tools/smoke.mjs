import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 300 } })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,300)}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForTimeout(6000)
console.log('t+6s ', JSON.stringify(await page.evaluate(() => window.__somen.info())))
await page.mouse.move(320, 180); await page.mouse.down()
await page.waitForTimeout(8000)
await page.mouse.move(280, 150)
await page.waitForTimeout(8000)
await page.mouse.up()
console.log('t+22s', JSON.stringify(await page.evaluate(() => window.__somen.info())))
// portrait
await page.setViewportSize({ width: 380, height: 760 })
await page.waitForTimeout(6000)
console.log('portrait', JSON.stringify(await page.evaluate(() => window.__somen.info())))
const mem = await page.evaluate(() => ({ mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : null }))
console.log('heap MB', JSON.stringify(mem))
console.log('--- console ---')
console.log(logs.slice(-25).join('\n') || '(clean)')
await browser.close()
