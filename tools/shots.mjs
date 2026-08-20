/**
 * 各場面のスクリーンショットを ./shots に書き出す確認用スクリプト。
 *   node tools/shots.mjs [--url http://127.0.0.1:4173]
 *
 * `?dbg=<場面>` の仕組みを使って、待たずに各場面へ飛ぶ。
 * ヘッドレスはソフトウェア GL なので、色や速度の最終判断は実機で行うこと。
 */
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'

const urlArg = process.argv.indexOf('--url')
const BASE = urlArg > 0 ? process.argv[urlArg + 1] : 'http://127.0.0.1:4173'
const OUT = 'shots'

const SCENES = ['title', 'intro', 'gate', 'gateopen', 'lights', 'litpath', 'lever', 'night', 'finale']
const PROFILES = [
  ['iPhone 14 Pro', 'iphone'],
  ['iPhone 14 Pro landscape', 'iphone-land'],
  ['iPad (gen 7)', 'ipad'],
]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})

for (const [profile, tag] of PROFILES) {
  const ctx = await browser.newContext({ ...devices[profile], deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('ERROR', tag, e.message))
  for (const scene of SCENES) {
    await page.goto(scene === 'title' ? BASE : `${BASE}/?dbg=${scene}`, { waitUntil: 'load' })
    await page.waitForTimeout(7000)
    await page.screenshot({ path: `${OUT}/${tag}-${scene}.png` })
    console.log(`${OUT}/${tag}-${scene}.png`)
  }
  await ctx.close()
}
await browser.close()
