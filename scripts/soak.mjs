import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/?e2e=1&nohint=1&seed=1', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__game !== undefined)
for (let i = 0; i < 20; i++) {
  const r = await page.evaluate(() => {
    const g = window.__game
    g.input(1, 0); g.advance(14)
    g.input(0, 1); g.advance(13)
    g.input(-1, 0); g.advance(16)
    g.input(0, 0); g.advance(46)
    return { round: g.state().round, phase: g.state().phase, info: g.info() }
  })
  if (i % 4 === 3 || i === 0) console.log('cycle', i + 1, JSON.stringify(r))
  if (r.round !== i + 1) { console.log('SOAK FAIL: round mismatch at cycle', i + 1, r); process.exit(1) }
}
console.log('SOAK PASS: 20 cycles')
await browser.close()
