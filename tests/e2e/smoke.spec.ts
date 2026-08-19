import { expect, test } from '@playwright/test'
import {
  advance,
  boot,
  camera,
  holdFinger,
  playUntil,
  pressAction,
  releaseFinger,
  state,
  stats,
  stepUntil,
} from './helpers'

test.describe('稲コンバイン', () => {
  test('boots into the establishing shot with one thing to press', async ({ page }) => {
    const errors = await boot(page)
    await advance(page, 1)

    const s = await state(page)
    expect(s.state).toBe('intro')
    expect(s.standing).toBe(s.total)
    expect(s.standing).toBeGreaterThan(1000)

    // exactly one action, and it is the header
    await expect(page.locator('#actions .act')).toHaveCount(1)
    await expect(page.locator('#actions .act .cap')).toHaveText('ヘッダを さげる')
    await expect(page.locator('#boot')).toHaveCount(0)
    expect((await camera(page)).shot).toBe('establish')
    expect(errors).toEqual([])
  })

  test('lowering the header starts cutting rice', async ({ page }) => {
    await boot(page)
    await advance(page, 1)
    expect(await pressAction(page)).toBe(true)

    await advance(page, 6)
    const s = await state(page)
    expect(s.state).toBe('harvest')
    expect(s.standing).toBeLessThan(s.total)
    expect(s.progress).toBeGreaterThan(0.01)
    // no button during harvesting: steering is the whole job
    await expect(page.locator('#actions .act')).toHaveCount(0)
  })

  test('one finger steers the machine and the assist recentres it', async ({ page }) => {
    await boot(page)
    await advance(page, 1)
    await pressAction(page)
    await advance(page, 4)

    const before = (await state(page)).x
    await holdFinger(page, 0.9)
    await advance(page, 1.5)
    const steered = (await state(page)).x
    expect(steered).toBeGreaterThan(before + 0.2)

    await releaseFinger(page)
    await advance(page, 4)
    const settled = (await state(page)).x
    // the lane assist pulls it back towards the row it is working
    expect(Math.abs(settled - steered)).toBeGreaterThan(0.05)
    expect(Math.abs(settled)).toBeLessThan(9)
  })

  test('grain reaches the tank, the auger swings out and the load pours', async ({ page }) => {
    await boot(page)
    await advance(page, 1)
    await pressAction(page)

    // harvest until the tank is full and the receiver has pulled alongside;
    // do not touch the controls, this test drives them by hand below
    const full = await stepUntil(page, (s) => s.state === 'trucking')
    expect(full.state).toBe('trucking')
    expect(full.tank).toBeGreaterThan(0.99)

    // the receiver rolls in; the auger button appears once it is close
    await stepUntil(page, () => false, 6)
    await expect(page.locator('#actions .act .cap')).toHaveText('パイプを のばす')
    await pressAction(page)
    await advance(page, 2.2)
    await expect(page.locator('#actions .act .cap')).toHaveText('おこめを だす！')
    await pressAction(page)

    await advance(page, 1.5)
    const pouring = await state(page)
    expect(pouring.state).toBe('unloading')
    expect(pouring.tank).toBeLessThan(0.99)
    expect(pouring.truckFill).toBeGreaterThan(0)

    const done = await playUntil(page, (s) => s.loads >= 1, 40)
    expect(done.loads).toBe(1)
    expect(done.grains).toBeGreaterThan(100_000)
  })

  test('plays a whole paddy through to the finish, then replays', async ({ page }) => {
    const errors = await boot(page)
    await advance(page, 1)

    const end = await playUntil(page, (s) => s.state === 'finished')
    expect(end.state).toBe('finished')
    expect(end.standing).toBe(0)
    expect(end.progress).toBeGreaterThan(0.99)
    expect(end.loads).toBeGreaterThanOrEqual(3)

    await advance(page, 1)
    await expect(page.locator('#finish')).toHaveClass(/show/)
    await expect(page.locator('#finish h2')).toHaveText('ぜんぶ かれた！')
    await expect(page.locator('#finish .rice-row span')).toHaveCount(end.loads)

    await page.locator('#finish .again .act').click({ force: true })
    await advance(page, 1)
    const fresh = await state(page)
    expect(fresh.state).toBe('intro')
    expect(fresh.standing).toBe(fresh.total)
    expect(fresh.loads).toBe(0)
    expect(errors).toEqual([])
  })

  test('survives rotation mid-run and keeps playing', async ({ page }) => {
    await boot(page)
    await advance(page, 1)
    await pressAction(page)
    await advance(page, 5)

    const size = page.viewportSize()!
    await page.setViewportSize({ width: size.height, height: size.width })
    // portrait frames taller, landscape frames wider; the resize is async
    await expect
      .poll(async () => (await camera(page)).fov, { timeout: 10_000 })
      .toBe(size.height > size.width ? 48 : 63)
    await advance(page, 3)

    const s = await state(page)
    expect(['harvest', 'cutaway', 'turning']).toContain(s.state)

    const canvas = await page.evaluate(() => {
      const c = document.getElementById('scene') as HTMLCanvasElement
      return { w: c.clientWidth, h: c.clientHeight }
    })
    expect(canvas.w).toBe(size.height)
    expect(canvas.h).toBe(size.width)

    // and it still finishes from here
    const end = await playUntil(page, (t) => t.state === 'finished')
    expect(end.state).toBe('finished')
  })

  test('stays inside a sane draw budget', async ({ page }) => {
    await boot(page, '')
    await advance(page, 1)
    await pressAction(page)
    await advance(page, 12)

    const st = await stats(page)
    expect(st.calls).toBeLessThan(120)
    expect(st.triangles).toBeLessThan(700_000)
  })
})
