import { expect, test } from '@playwright/test'
import {
  ENGAWA_FRONT_Z,
  FENCE_EAST_X,
  FENCE_SOUTH_Z,
  FENCE_WEST_X,
} from '../../src/scene/layout'

/** 追従カメラは庭の空気の体積から決して出ない（塀・屋根を突き抜けない）。 */
test('follow camera stays inside the garden volume while walking around', async ({ page }) => {
  await page.goto('/?e2efast=1&seed=42')
  await page.waitForFunction(() => window.__game?.isReady === true, undefined, {
    timeout: 30_000,
  })

  const route: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, -1],
  ]
  let prev: { x: number; z: number } | null = null
  for (const [dx, dz] of route) {
    // カメラとプレイヤーは step と同じ evaluate 内で読む（rAFの介在を防ぐ）
    const r = await page.evaluate(
      ([mx, mz]) => {
        for (let i = 0; i < 90; i++) {
          window.__game!.dispatch({ type: 'move', dirX: mx!, dirZ: mz! })
          window.__game!.step(1)
        }
        return {
          cam: window.__game!.getCameraPos(),
          player: window.__game!.getState().player,
        }
      },
      [dx, dz],
    )
    const { cam, player } = r
    expect(cam.x).toBeGreaterThan(FENCE_WEST_X)
    expect(cam.x).toBeLessThan(FENCE_EAST_X)
    expect(cam.z).toBeGreaterThan(ENGAWA_FRONT_Z)
    expect(cam.z).toBeLessThan(FENCE_SOUTH_Z)
    expect(cam.y).toBeGreaterThan(0.3)
    expect(cam.y).toBeLessThan(2.2)
    // クランプの言い換えでない性質: カメラは追従距離内に居て、実際に動く
    const dist = Math.hypot(cam.x - player.x, cam.z - player.z)
    expect(dist).toBeLessThan(4.6)
    if (prev) {
      expect(Math.hypot(cam.x - prev.x, cam.z - prev.z)).toBeGreaterThan(0.05)
    }
    prev = { x: cam.x, z: cam.z }
  }
})
