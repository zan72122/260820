import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/?e2e=1&nohint=1&seed=1', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__game !== undefined)
const probe = async (label, v, h, sec) => {
  const r = await page.evaluate(([a,b,c]) => {
    window.__game.input(a,b); window.__game.advance(c)
    return window.__game.info()
  }, [v,h,sec])
  console.log(label, JSON.stringify(r))
}
await probe('start', 0, 0, 1)
await probe('lift', 1, 0, 14)
await probe('traverse', 0, 1, 13)
await probe('descend', -1, 0, 16)
await probe('seated+seq', 0, 0, 20)
await probe('tow', 0, 0, 26)
await probe('round1-start', 0, 0, 2)
await probe('round1-lift', 1, 0, 14)
await browser.close()
