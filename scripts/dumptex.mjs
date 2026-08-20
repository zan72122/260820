import { chromium } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
await mkdir('shots', { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
await page.goto('http://127.0.0.1:4173/?e2e=1&q=high&seed=305419896')
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
for (const name of process.argv.slice(2)) {
  const url = await page.evaluate((n) => window.__mango.dumpTexture(n), name)
  if (!url) { console.log('missing', name); continue }
  await writeFile(`shots/tex-${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
  console.log('wrote', name)
}
await browser.close()
