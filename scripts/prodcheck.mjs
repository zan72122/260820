import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', e => { console.log('PAGEERR:', e.message); process.exitCode = 1 })
await page.goto('http://127.0.0.1:5199/?e2e=1&nohint=1&seed=1', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__game !== undefined, { timeout: 15000 })
const s = await page.evaluate(() => {
  const g = window.__game
  g.input(1, 0); g.advance(14)
  g.input(0, 1); g.advance(13)
  g.input(-1, 0); g.advance(16)
  g.input(0, 0); g.advance(46)
  return g.state()
})
console.log('prod round:', s.round, 'phase:', s.phase)
if (s.round !== 1) { console.log('PROD FAIL'); process.exit(1) }
console.log('PROD BUILD PASS')
await browser.close()
