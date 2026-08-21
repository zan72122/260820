import { expect, test } from '@playwright/test';

/**
 * Chromiumスモーク（E2E_FASTプロファイル）:
 * ?fast=1 で低解像度・影オフ・自動シミュレーション停止。
 * テストが window.__game で決定論投球を注入し、論理時間を直接進める。
 */

test('起動→決定論投球→ピンフォール→スコア反映', async ({ page }) => {
  await page.goto('/?fast=1&seed=42');
  await page.waitForFunction(() => window.__game?.ready === true);

  expect(await page.evaluate(() => window.__game!.standingCount())).toBe(10);
  expect(await page.evaluate(() => window.__game!.state)).toBe('aim');

  // ポケットショット（右投げ: 板10付近からフックでポケットへ）
  const afterFirst = await page.evaluate(() => {
    const g = window.__game!;
    g.debugThrow({ x: -0.2, speed: 8.5, angleDeg: 0, revRate: 24, axisDeg: 35 });
    g.advance(9);
    return { state: g.state, rolls: g.rolls(), standing: g.standingCount() };
  });
  expect(afterFirst.rolls).toHaveLength(1);
  expect(afterFirst.rolls[0]!).toBeGreaterThanOrEqual(6);
  expect(afterFirst.state).toBe('aim');

  // スコアカードのフレーム1に投球結果が表示される
  const firstFrame = page.locator('#scorecard .frame').first();
  await expect(firstFrame.locator('.rolls span').first()).toContainText(/[X0-9]/);
});

test('ガター投球は0ピンで記帳される', async ({ page }) => {
  await page.goto('/?fast=1&seed=42');
  await page.waitForFunction(() => window.__game?.ready === true);

  const result = await page.evaluate(() => {
    const g = window.__game!;
    g.debugThrow({ x: -0.45, speed: 7, angleDeg: -3, revRate: 4, axisDeg: 0 });
    g.advance(9);
    return { rolls: g.rolls(), standing: g.standingCount() };
  });
  expect(result.rolls).toEqual([0]);
  expect(result.standing).toBe(10);
});

test('実ポインタのドラッグスイングで投球できる', async ({ page }) => {
  await page.goto('/?fast=1&seed=42');
  await page.waitForFunction(() => window.__game?.ready === true);

  // 引いてから振り抜く（真っ直ぐ・速め）
  await page.mouse.move(480, 380);
  await page.mouse.down();
  for (let i = 0; i <= 4; i++) {
    await page.mouse.move(480, 380 + i * 20, { steps: 1 });
    await page.waitForTimeout(14);
  }
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(480, 460 - i * 40, { steps: 1 });
    await page.waitForTimeout(10);
  }
  await page.mouse.up();

  expect(await page.evaluate(() => window.__game!.state)).toBe('rolling');
  const rolls = await page.evaluate(() => {
    window.__game!.advance(9);
    return window.__game!.rolls();
  });
  expect(rolls).toHaveLength(1);
});

test('同一シード・同一投球で同一ピンフォール（決定論）', async ({ page }) => {
  const run = async (): Promise<number[]> => {
    await page.goto('/?fast=1&seed=42');
    await page.waitForFunction(() => window.__game?.ready === true);
    return page.evaluate(() => {
      const g = window.__game!;
      g.debugThrow({ x: -0.24, speed: 7.8, angleDeg: 0.6, revRate: 20, axisDeg: 30 });
      g.advance(9);
      return g.rolls();
    });
  };
  const a = await run();
  const b = await run();
  expect(a).toEqual(b);
});
