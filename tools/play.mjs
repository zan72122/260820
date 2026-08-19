import { chromium } from '@playwright/test'
import fs from 'node:fs'

const url = process.argv[2] || 'http://127.0.0.1:4173/?fast=1'
const outDir = process.argv[3] || '/tmp/play'
const W = +(process.argv[4] || 390)
const H = +(process.argv[5] || 844)
const tag = process.argv[6] || `${W}x${H}`

fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon, null, { timeout: 20000 })

const step = (s) => page.evaluate((v) => window.__chiffon.step(v), s)
const state = () => page.evaluate(() => window.__chiffon.state())
const guide = () => page.evaluate(() => window.__chiffon.guidePx())
const kind = () => page.evaluate(() => window.__chiffon.gestureKind())
const shoot = async (name) => {
  await page.evaluate(() => window.__chiffon.render())
  await page.screenshot({ path: `${outDir}/${tag}-${name}.png` })
}

async function trace(pts, k) {
  // Dispatched in-page so a whole stroke costs one round trip; the events land
  // on the real canvas listeners, so the actual gesture pipeline is exercised.
  await page.evaluate(
    ({ pts, k }) => {
      const el = document.getElementById('stage')
      const fire = (type, x, y) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        )
      if (k === 'tap') {
        const m = pts[Math.floor(pts.length / 2)]
        fire('pointerdown', m.x, m.y)
        fire('pointerup', m.x, m.y)
        return
      }
      fire('pointerdown', pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        for (let s = 1; s <= 3; s++) fire('pointermove', a.x + (b.x - a.x) * (s / 3), a.y + (b.y - a.y) * (s / 3))
      }
      fire('pointerup', pts[pts.length - 1].x, pts[pts.length - 1].y)
    },
    { pts, k },
  )
}

const seen = new Set()
const log = []
let guard = 0
const t0 = Date.now()
let last = ''
while (guard++ < 400 && Date.now() - t0 < 300000) {
  const st = await state()
  if (st.stage !== last) {
    last = st.stage
    log.push(`-> ${st.stage} ${JSON.stringify(st)}`)
    console.error(`[stage] ${st.stage}`)
  }
  if (!seen.has(st.stage)) {
    seen.add(st.stage)
    await step(0.5)
    await shoot(st.stage)
  }
  if (st.stage === 'done' && st.finishVisible) break
  const pts = await guide()
  if (pts && pts.length) {
    await trace(pts, await kind())
    await step(0.4)
  } else {
    await step(0.5)
  }
}

const final = await state()
await shoot('final')
// second play-through: pick another flavour and confirm the loop restarts
await page.click('#flavors button:nth-child(3)').catch(() => {})
await page.click('#btn-again').catch(() => {})
await step(0.6)
const replay = await state()
await shoot('replay')

console.log(JSON.stringify({ tag, final, replay, stages: [...seen], errors: errors.slice(0, 12) }, null, 1))
console.log(log.join('\n'))
await browser.close()
