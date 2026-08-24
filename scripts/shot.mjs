// Screenshot helper: loads the game deterministically, advances sim time,
// captures portrait/landscape shots at key moments.
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const outDir = process.argv[2] || 'shots'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

async function capture(name, w, h, script) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
  page.on('pageerror', e => console.log('PAGE EXCEPTION:', e.message))
  await page.goto('http://127.0.0.1:5173/?e2e=1&nohint=1&seed=1', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__game !== undefined, { timeout: 15000 })
  await page.evaluate(script)
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  const state = await page.evaluate(() => window.__game.state())
  console.log(name, JSON.stringify(state))
  await page.close()
}

const g = () => window.__game

// 1. Opening reveal (portrait + landscape)
await capture('01-reveal-portrait', 390, 844, () => { window.__game.advance(2) })
await capture('01-reveal-landscape', 844, 390, () => { window.__game.advance(2) })

// 2. Tension building (first upward input)
await capture('02-tension-portrait', 390, 844, () => {
  const g = window.__game
  g.advance(2); g.input(1, 0); g.advance(1.6)
})

// 3. Liftoff: gap under the body
await capture('03-liftoff-portrait', 390, 844, () => {
  const g = window.__game
  g.advance(2); g.input(1, 0); g.advance(4.5)
})
await capture('03-liftoff-landscape', 844, 390, () => {
  const g = window.__game
  g.advance(2); g.input(1, 0); g.advance(4.5)
})

// 4. High lift / start of traverse
await capture('04-transport-portrait', 390, 844, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 0); g.advance(1)
})

// 5. Mid-traverse
await capture('05-traverse-landscape', 844, 390, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(6); g.input(0, 0); g.advance(2)
})

// 6. Over the bogies, aligned
await capture('06-align-portrait', 390, 844, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(3)
})

// 7. Final descent close-up
await capture('07-seating-portrait', 390, 844, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(2)
  g.input(-1, 0); g.advance(7)
})
await capture('07-seating-landscape', 844, 390, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(2)
  g.input(-1, 0); g.advance(7)
})

// 8. Seated / load transferred
await capture('08-seated-portrait', 390, 844, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(2)
  g.input(-1, 0); g.advance(14); g.input(0, 0); g.advance(2)
})

// 9. Lights on
await capture('09-lights-portrait', 390, 844, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(2)
  g.input(-1, 0); g.advance(14); g.input(0, 0); g.advance(10)
})

// 10. Tow to inspection
await capture('10-tow-landscape', 844, 390, () => {
  const g = window.__game
  g.input(1, 0); g.advance(14); g.input(0, 1); g.advance(12); g.input(0, 0); g.advance(2)
  g.input(-1, 0); g.advance(14); g.input(0, 0); g.advance(22)
})

await browser.close()
console.log('done')
