import { expect, test } from '@playwright/test'
import { BEDS, CAN_HOME, CAN_OUT, TSUKUBAI } from '../../src/scene/layout'

/** 水やり→片付けのチェーンを実UI（テストシーム経由）で検証。 */
test('watering chain updates state, soil uniform and HUD', async ({ page }) => {
  await page.goto('/?e2efast=1&seed=42')
  await page.waitForFunction(() => window.__game?.isReady === true, undefined, {
    timeout: 30_000,
  })

  const tp = async (x: number, z: number) => {
    await page.evaluate(
      ([px, pz]) => {
        window.__game!.dispatch({ type: 'teleport', x: px!, z: pz! })
        window.__game!.step(2)
      },
      [x, z],
    )
  }
  const interact = async () => {
    await page.evaluate(() => {
      window.__game!.dispatch({ type: 'interact' })
      window.__game!.step(2)
    })
  }

  // 如雨露のそばに立つと HUD がプロンプトを出す
  await tp(CAN_OUT.x, CAN_OUT.z)
  await expect(page.locator('#prompt')).toContainText('如雨露を取る')

  await interact()
  let state = await page.evaluate(() => window.__game!.getState())
  expect(state.player.held).toBe('wateringCan')

  // 汲む → 注ぐ
  await tp(TSUKUBAI.x, TSUKUBAI.z + 0.4)
  await interact()
  state = await page.evaluate(() => window.__game!.getState())
  expect(state.canFill).toBe(1)

  const bedA = BEDS[0]!
  await tp(bedA.x + 0.7, bedA.z)
  await interact()
  const m0 = (await page.evaluate(() => window.__game!.getState())).beds['bedA']!.moisture
  await page.evaluate(() => window.__game!.step(120))
  state = await page.evaluate(() => window.__game!.getState())
  expect(state.beds['bedA']!.moisture).toBeGreaterThan(m0 + 0.4)

  // 片付け
  await tp(CAN_HOME.x, CAN_HOME.z)
  await interact()
  state = await page.evaluate(() => window.__game!.getState())
  expect(state.tools.wateringCan).toBe('rack')
  expect(state.chores.toolsTidy).toBe(true)

  // 収穫チェックリストの表示
  await expect(page.locator('#chores')).toContainText('道具を片付ける')
})
