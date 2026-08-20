import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT = process.env.OUT || new URL('../.shots/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const W = Number(process.env.W || 880), H = Number(process.env.H || 400)
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,300)}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto(`http://127.0.0.1:5173/?fixed=0.05&quality=2`, { waitUntil: 'load' })
await page.waitForTimeout(5000)
const frames = n => page.evaluate(n => new Promise(r => { let i=0; const t=()=>(++i>=n?r():requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const info = () => page.evaluate(() => window.__somen.info())
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(n, JSON.stringify(await info())) }

await page.evaluate(() => { window.__somen.skipTo('invite') })
await frames(20)
await page.evaluate(() => window.__somen.spawn(1, -2.6))
await frames(10)
// finger just below the bundle on screen, offset down because the game lifts
// the chopstick tip above the fingertip
let bs = await page.evaluate(() => window.__somen.bundleScreen())
console.log('bundle screen', bs)
await page.mouse.move(bs[0], bs[1] + Math.round(H * 0.085))
await page.mouse.down()
await frames(4); await shot('p-touch')
for (let i = 0; i < 8; i++) {
  bs = await page.evaluate(() => window.__somen.bundleScreen())
  if (bs) await page.mouse.move(bs[0], bs[1] + Math.round(H * 0.085))
  await frames(3)
  const st = await info()
  if (st.hold !== 'none') { console.log('caught at step', i, JSON.stringify(st)); break }
}
await shot('p-catch')
await frames(12); await shot('p-lift')
await frames(14); await shot('p-bowl')
await frames(16); await shot('p-after')
await page.mouse.up()
await frames(20); await shot('p-idle')
console.log('--- console ---'); console.log(logs.slice(-25).join('\n'))
await browser.close()
