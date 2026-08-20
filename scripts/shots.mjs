/**
 * Capture the five moments the design has to be judged on, at both a phone and
 * a tablet size, in both orientations. The simulation is paused and advanced by
 * hand so every frame is the exact one intended, not whatever the clock landed
 * on.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.URL ?? 'http://127.0.0.1:4173'
const OUT = 'shots'
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 1024, height: 1366 },
  { name: 'tablet-landscape', width: 1366, height: 1024 },
]
const only = process.argv[2]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const size of SIZES) {
  if (only && size.name !== only) continue
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } })
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
  await page.goto(`${BASE}/?e2e=1&q=high&seed=305419896`)
  await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })

  const st = () => page.evaluate(() => window.__mango.state())
  const step = (s) => page.evaluate((x) => window.__mango.step(x, 1 / 120), s)
  const pause = (on) => page.evaluate((x) => window.__mango.pause(x), on)
  const shot = async (name) => {
    await page.evaluate(() => window.__mango.render())
    await page.screenshot({ path: `${OUT}/${size.name}-${name}.png` })
    console.log(size.name, name, JSON.stringify(await st()).slice(0, 150))
  }

  await pause(true)
  // 1. Before anything is touched: fruit above, net loose on the bench.
  await step(1.2)
  await shot('1-before')

  // 2. Both cord ends on their hooks; the net is a shallow cradle.
  await page.evaluate(() => window.__mango.attach(1, 5))
  await step(1.5)
  await shot('2-hung')

  // Ripen the fruit the way a child would, a swipe at a time.
  let guard = 0
  while ((await st()).ripeness < 1 && guard++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.22))
    await step(0.12)
  }
  await shot('3-ripe')

  // 3. Mid air.
  guard = 0
  while ((await st()).stage !== 'falling' && guard++ < 900) await step(1 / 120)
  await step(0.09)
  await shot('4-falling')

  // 4. The deepest point of the cradle.
  guard = 0
  let deepest = -1
  while (guard++ < 900) {
    await step(1 / 120)
    const s = await st()
    if (s.fruit.phase === 'cradling') {
      if (s.fruit.sink >= deepest) deepest = s.fruit.sink
      else break
    }
  }
  await shot('5-deepest')

  // 5. Free play, after the camera has moved in and back out.
  await step(6.5)
  await page.evaluate(() => window.__mango.poke(0.008))
  await step(0.55)
  await shot('6-play')

  await page.close()
}

await browser.close()
console.log('done')
