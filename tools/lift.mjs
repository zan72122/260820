import { chromium } from 'playwright'
const OUT = process.env.OUT || new URL('../.shots/', import.meta.url).pathname
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,300)}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://127.0.0.1:5173/?fixed=0.05&quality=2', { waitUntil: 'load' })
await page.waitForTimeout(5000)
const frames = n => page.evaluate(n => new Promise(r => { let i=0; const t=()=>(++i>=n?r():requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(n, JSON.stringify(await page.evaluate(() => window.__somen.info()))) }

await page.evaluate(() => { window.__somen.skipTo('invite'); window.__somen.cut('play') })
await frames(20)
await page.evaluate(() => window.__somen.spawn(2, -1.2))
await frames(6)
let bs = await page.evaluate(() => window.__somen.bundleScreen())
await page.mouse.move(bs[0], bs[1] + 42)
await page.mouse.down()
for (let i = 0; i < 10; i++) {
  await frames(2)
  const st = await page.evaluate(() => window.__somen.info())
  if (st.hold !== 'none') break
  const nb = await page.evaluate(() => window.__somen.bundleScreen())
  if (nb) await page.mouse.move(nb[0], nb[1] + 42)
}
// close-up on the chopstick tips
await frames(3)
await page.evaluate(() => {
  const t = window.__somen.tipAt()
  window.__somen.look([t[0] + 0.16, t[1] + 0.075, t[2] + 0.20], [t[0], t[1] - 0.055, t[2]], 30)
})
await page.evaluate(() => window.__somen.drops(40))
await frames(2); await shot('L1')
await frames(4); await shot('L2')
await frames(6); await shot('L3')
console.log(logs.slice(-15).join('\n'))
await browser.close()
