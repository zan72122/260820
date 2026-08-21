import { expect, test } from '@playwright/test'

/** Boot smoke under the E2E_FAST profile: logic/state assertions only —
 * never visual quality (SwiftShader). */
test('boots, steps deterministic time, and reacts to real input', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/?e2efast=1&seed=42')
  await page.waitForFunction(() => window.__game?.isReady === true, undefined, {
    timeout: 30_000,
  })

  const seed = await page.evaluate(() => window.__game!.seed)
  expect(seed).toBe(42)

  // Logical time only advances through step() under E2E_FAST.
  const t0 = await page.evaluate(() => window.__game!.getState().tick)
  await page.evaluate(() => window.__game!.step(60))
  const t1 = await page.evaluate(() => window.__game!.getState().tick)
  expect(t1 - t0).toBe(60)

  // Real keyboard input path: W walks north (-z) once ticks advance.
  const z0 = await page.evaluate(() => window.__game!.getState().player.z)
  await page.keyboard.down('KeyW')
  await page.evaluate(() => window.__game!.step(30))
  await page.keyboard.up('KeyW')
  const z1 = await page.evaluate(() => window.__game!.getState().player.z)
  expect(z1).toBeLessThan(z0)

  // 描画バジェット（SwiftShaderでも快適な上限。実測 ~149calls/131k tris）
  const info = await page.evaluate(() => window.__game!.getRenderInfo())
  expect(info.calls).toBeLessThan(170)
  expect(info.triangles).toBeLessThan(220_000)

  // 手続きテクスチャのフォールバックが全ファミリーで機能している
  // （E2E_FASTはネットワーク非依存＝全てフォールバックのはず、重複なし）
  const fallbacks = await page.evaluate(() => window.__game!.usedFallbackTextures())
  expect(fallbacks.length).toBeGreaterThan(5)
  expect(new Set(fallbacks).size).toBe(fallbacks.length)

  expect(errors).toEqual([])
})
