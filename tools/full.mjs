import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT = process.env.OUT || new URL('../.shots/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const W = Number(process.env.W || 960), H = Number(process.env.H || 440)
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,300)}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://127.0.0.1:5173/?fixed=0.05&quality=2', { waitUntil: 'load' })
await page.waitForTimeout(5000)
const frames = n => page.evaluate(n => new Promise(r => { let i=0; const t=()=>(++i>=n?r():requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const info = () => page.evaluate(() => window.__somen.info())
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(n, JSON.stringify(await info())) }

// Play it the way a child would: wait, watch, then reach for a bundle.
let st = await info()
let guard = 0
while (st.phase !== 'invite' && guard++ < 60) { await frames(10); st = await info() }
await shot('h1-invite')
// wait for a bundle to come into reach, then follow it with the finger
let caught = false
for (let round = 0; round < 40 && !caught; round++) {
  const bs = await page.evaluate(() => {
    const g = window.__somen
    const inf = g.info()
    const b = inf.bundles.find(x => x.s === 'flowing' && x.at[2] > -2.2 && x.at[2] < -0.4)
    return b ? g.bundleScreen() : null
  })
  if (!bs) { await frames(6); continue }
  await page.mouse.move(bs[0], bs[1] + Math.round(H * 0.085))
  await page.mouse.down()
  for (let i = 0; i < 10; i++) {
    await frames(3)
    st = await info()
    if (st.hold !== 'none') { caught = true; break }
    const nb = await page.evaluate(() => window.__somen.bundleScreen())
    if (nb) await page.mouse.move(nb[0], nb[1] + Math.round(H * 0.085))
  }
  if (!caught) await page.mouse.up()
}
console.log('caught?', caught)
await shot('h2-catch')
await frames(8); await shot('h3-lift')
await frames(12); await shot('h4-carry')
await frames(14); await shot('h5-bowl')
await frames(10); await shot('h6-soak')
await page.mouse.up()
await frames(24); await shot('h7-back')
console.log('--- console ---'); console.log(logs.slice(-20).join('\n'))
await browser.close()
