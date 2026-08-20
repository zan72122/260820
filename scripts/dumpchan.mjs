import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
await page.goto('http://127.0.0.1:4173/?e2e=1&q=high&seed=305419896')
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
for (const [i, name] of ['mottle', 'order', 'pore', 'speck'].entries()) {
  const url = await page.evaluate((c) => window.__mango.dumpMangoChannel(c), i)
  await writeFile(`shots/chan-${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
}
console.log('channels written')
await browser.close()
