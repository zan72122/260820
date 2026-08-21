import { expect, test, type Page } from '@playwright/test'

/**
 * 完成条件の確認：
 *  - 一回の建設を通して、試験ボールと最初の滑走まで到達できる
 *  - 画面回転で建設状態が巻き戻らない
 *  - 二回目は最終区間を選べて、滑り方（速度）が変わる
 *  - 実際のタッチ操作でクレーンを動かし、柱を据え付けられる
 */

interface SlideState {
  round: number
  stepId: string
  stepIndex: number
  stepCount: number
  mode: string
  variant: string
  cranePhase: string
  u: number
  installed: string[]
  quality: string
  portrait: boolean
}

declare global {
  interface Window {
    __slide: {
      state(): SlideState
      start(): void
      advance(seconds: number): void
      completeStep(): void
      nextRound(): void
      riderSpeed(): { ball: number; child: number }
    }
  }
}

const APP = '/?fast=1&q=low'

async function boot(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  await page.goto(APP)
  await page.waitForFunction(() => !!window.__slide, undefined, { timeout: 60_000 })
  await page.evaluate(() => window.__slide.start())
  return errors
}

const state = (page: Page) => page.evaluate(() => window.__slide.state())

/** 工程を 1 つ進める（gesture 相当の入力をテスト API で代行） */
async function completeStep(page: Page) {
  await page.evaluate(() => window.__slide.completeStep())
  await page.evaluate(() => window.__slide.advance(2.5))
}

async function runUntil(page: Page, predicate: (s: SlideState) => boolean, limit = 40) {
  for (let i = 0; i < limit; i++) {
    const s = await state(page)
    if (predicate(s)) return s
    await completeStep(page)
  }
  return state(page)
}

test('一回の建設を通して、試験ボールと最初の滑走まで到達する', async ({ page }) => {
  const errors = await boot(page)
  expect((await state(page)).stepId).toBe('r1-site')

  const atBall = await runUntil(page, (s) => s.stepId === 'r1-ball')
  expect(atBall.stepId).toBe('r1-ball')
  // 建設が終わった時点で、すべての部材が取り付いている
  expect(atBall.installed.sort()).toEqual(
    ['chute', 'columnA', 'columnB', 'handrailL', 'handrailR', 'platform', 'stair'].sort(),
  )

  // 試験ボールが実際に流れる
  await page.evaluate(() => window.__slide.completeStep())
  await page.evaluate(() => window.__slide.advance(0.8))
  expect((await page.evaluate(() => window.__slide.riderSpeed())).ball).toBeGreaterThan(0.5)

  const atRide = await runUntil(page, (s) => s.stepId === 'r1-ride', 20)
  expect(atRide.stepId).toBe('r1-ride')

  // キャラクターが最初の滑走をする
  await page.evaluate(() => window.__slide.advance(4))
  await page.evaluate(() => window.__slide.completeStep())
  await page.evaluate(() => window.__slide.advance(0.8))
  expect((await page.evaluate(() => window.__slide.riderSpeed())).child).toBeGreaterThan(0.3)

  expect(errors).toEqual([])
})

test('画面回転で建設状態が巻き戻らない', async ({ page }) => {
  await boot(page)
  await runUntil(page, (s) => s.installed.length >= 3)
  const before = await state(page)
  expect(before.portrait).toBe(true)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(600)
  const landscape = await state(page)
  expect(landscape.portrait).toBe(false)
  expect(landscape.stepIndex).toBe(before.stepIndex)
  expect(landscape.installed).toEqual(before.installed)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(600)
  const back = await state(page)
  expect(back.portrait).toBe(true)
  expect(back.stepIndex).toBe(before.stepIndex)
  expect(back.installed).toEqual(before.installed)
})

test('二回目は最終区間を選べて、滑り方が変わる', async ({ page }) => {
  await boot(page)

  const speeds: Record<string, number> = {}
  for (const [id, label] of [
    ['straight', 'まっすぐ'],
    ['roller', 'ローラー'],
  ] as Array<[string, string]>) {
    await page.evaluate(() => window.__slide.nextRound())
    await expect(page.locator('.choice')).toHaveCount(3)
    await page.locator('.choice', { hasText: label }).click()
    await page.getByRole('button', { name: 'これで　つくる' }).click()
    await page.waitForTimeout(300)

    const atBall = await runUntil(page, (s) => s.stepId.endsWith('-ball'), 25)
    expect(atBall.round).toBe(2)
    expect(atBall.variant).toBe(id)

    await page.evaluate(() => window.__slide.completeStep())
    let peak = 0
    for (let i = 0; i < 16; i++) {
      await page.evaluate(() => window.__slide.advance(0.22))
      peak = Math.max(peak, (await page.evaluate(() => window.__slide.riderSpeed())).ball)
    }
    speeds[id] = peak
    await runUntil(page, (s) => s.mode === 'rideSeq', 20)
    await page.evaluate(() => window.__slide.advance(3))
    await page.evaluate(() => window.__slide.completeStep())
    await page.evaluate(() => window.__slide.advance(9))
  }

  // ローラー区間のほうが速く流れる＝滑り方の違いが体験できている
  expect(speeds.roller).toBeGreaterThan(speeds.straight)
})

test('タッチ操作でクレーンを動かし、一本目の柱を据え付けられる', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__slide.completeStep())
  await expect.poll(async () => (await state(page)).stepId).toBe('r1-colA')

  const track = page.locator('.pendant .track')
  const box = (await track.boundingBox())!
  const cx = box.x + box.width / 2

  // 大きな上下レバーを上へ：吊荷が上がる
  await page.mouse.move(cx, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(cx, box.y + 12, { steps: 5 })
  await expect
    .poll(async () => (await state(page)).cranePhase, { timeout: 40_000 })
    .toBe('manual')
  await page.waitForTimeout(9000)
  await page.mouse.up()

  // 画面内を横へスワイプ：ジブが安全な範囲で横移動する
  for (let i = 0; i < 6; i++) {
    if ((await state(page)).u > 0.95) break
    await page.mouse.move(330, 300)
    await page.mouse.down()
    await page.mouse.move(70, 300, { steps: 10 })
    await page.waitForTimeout(2600)
    await page.mouse.up()
    await page.waitForTimeout(200)
  }
  expect((await state(page)).u).toBeGreaterThan(0.9)

  // 吊荷に近い回転ハンドルをゆっくり円運動：向きを微調整する
  const rotary = page.locator('.rotary')
  const rb = (await rotary.boundingBox())!
  const rcx = rb.x + rb.width / 2
  const rcy = rb.y + rb.height / 2
  for (let turn = 0; turn < 3; turn++) {
    await page.mouse.move(rcx, rcy - 50)
    await page.mouse.down()
    for (let a = 0; a <= 360; a += 30) {
      const t = ((a - 90) * Math.PI) / 180
      await page.mouse.move(rcx + Math.cos(t) * 50, rcy + Math.sin(t) * 50)
    }
    await page.mouse.up()
    await page.waitForTimeout(400)
  }

  // レバーを下げる：多少ずれていてもタグラインで整えて着座する
  const box2 = (await track.boundingBox())!
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
  await page.mouse.down()
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height - 12, { steps: 5 })
  await expect
    .poll(async () => (await state(page)).installed.includes('columnA'), { timeout: 60_000 })
    .toBe(true)
  await page.mouse.up()

  expect((await state(page)).stepId).toBe('r1-colB')
})
