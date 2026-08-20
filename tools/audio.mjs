import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 500, height: 260 } })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,300)}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://127.0.0.1:5173/?fixed=0.05', { waitUntil: 'load' })
await page.waitForTimeout(5000)
await page.mouse.move(250, 150)
await page.mouse.down()
await page.waitForTimeout(600)
await page.mouse.up()
// force every one-shot to fire
await page.evaluate(() => {
  const g = window.__somen
  g.skipTo('playing')
})
await page.waitForTimeout(1500)
const st = await page.evaluate(() => {
  const out = {}
  for (const n of ['nodePass','chopstickTick','lift','drip','chapun']) {
    try { out[n] = window.__somen.sfx(n) } catch (e) { out[n] = 'ERR ' + e.message }
  }
  try { window.__somen.sfx('maybeChime') } catch (e) { out.chime = 'ERR ' + e.message }
  return out
})
console.log('state', JSON.stringify(st))
console.log(logs.slice(-30).join('\n') || '(no console output)')
await browser.close()
