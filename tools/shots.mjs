import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = process.env.OUT || '/tmp/claude-0/-home-user-260820/c97bd2e6-1e3f-5498-8a4e-db9eb702a758/scratchpad/shots'
fs.mkdirSync(OUT, { recursive: true })

const URL_BASE = process.env.URL || 'http://localhost:5173/'
const SIZE = (process.env.SIZE || '900x420').split('x').map(Number)
const PLAN = JSON.parse(process.env.PLAN || '[]')

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-lcd-text',
  ],
})
const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(URL_BASE + '?fixed=1&quality=2', { waitUntil: 'load' })
await page.waitForTimeout(4000)

async function frames(n) {
  await page.evaluate(
    (n) =>
      new Promise((res) => {
        let i = 0
        const tick = () => (++i >= n ? res() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    n,
  )
}

for (const step of PLAN) {
  if (step.eval) await page.evaluate(step.eval)
  if (step.mouse) {
    const [x, y, action] = step.mouse
    if (action === 'down') await page.mouse.move(x, y), await page.mouse.down()
    else if (action === 'move') await page.mouse.move(x, y)
    else await page.mouse.up()
  }
  if (step.frames) await frames(step.frames)
  if (step.shot) {
    await page.screenshot({ path: `${OUT}/${step.shot}.png` })
    const info = await page.evaluate(() => window.__somen?.info())
    console.log(step.shot, JSON.stringify(info))
  }
}

console.log('--- console ---')
console.log(logs.slice(-40).join('\n'))
await browser.close()
