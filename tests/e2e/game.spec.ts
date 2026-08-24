import { test, expect } from '@playwright/test';
import { api, boot, fastForwardToTrial2, step, stepUntilPhase } from './helpers';

test.describe('一周スモーク + 受け入れ試験(ブラウザ)', () => {
  test('導入の謎 → 診断 → 調律 → 再試験 → カーテン学習 → 試験2 が一周する', async ({
    page,
  }) => {
    await boot(page);
    await api(page, 'startGame');

    // 第一場: 横切るだけで扉が誤って開く(謎の提示)
    await stepUntilPhase(page, 'intro', 10);
    let opened = false;
    for (let t = 0; t < 30 && !opened; t += 2) {
      await step(page, 2);
      opened = await api<boolean>(page, 'openedOnce');
    }
    expect(opened).toBe(true); // 調整前の誤開扉

    // 点検レンズ → 診断モード
    await stepUntilPhase(page, 'lensPrompt', 60);
    expect(await api<boolean>(page, 'diagnosticsShown')).toBe(false);
    await api(page, 'openLens');
    await stepUntilPhase(page, 'diagnostic', 10);
    await step(page, 1);
    expect(await api<boolean>(page, 'diagnosticsShown')).toBe(true);
    expect(await api<number>(page, 'activationCellCount')).toBeGreaterThan(50);

    // 診断中の再横切りで検知セルが光る
    let hot = 0;
    for (let t = 0; t < 30 && hot === 0; t += 2) {
      await step(page, 2);
      hot = await api<number>(page, 'hotCellCount');
    }
    expect(hot).toBeGreaterThan(0);

    // 調律: 奥行きを狭める(角度リング相当)
    await stepUntilPhase(page, 'calibrate', 60);
    const before = await api<number>(page, 'depth');
    expect(before).toBeGreaterThan(3);
    await api(page, 'setDepth', 1.9);
    expect(await api<number>(page, 'depth')).toBeLessThan(2.2);
    await step(page, 0.5);
    await api(page, 'closeLens');

    // 再試験1: 同じ横切り経路で開かない
    await stepUntilPhase(page, 'retestCross', 30);
    await stepUntilPhase(page, 'retestEnter', 90);
    // retestCross の間に openedOnce が立っていないことは
    // retestEnter への遷移メッセージで検証済み(開いたら台本が変わる)

    // 再試験2: 入口へ曲がると開く
    let entered = false;
    for (let t = 0; t < 40 && !entered; t += 2) {
      await step(page, 2);
      entered = await api<boolean>(page, 'openedOnce');
    }
    expect(entered).toBe(true);

    // カーテン学習
    await stepUntilPhase(page, 'curtainLesson', 60);
    let occupied = false;
    for (let t = 0; t < 60 && !occupied; t += 2) {
      await step(page, 2);
      occupied = await api<boolean>(page, 'curtainOccupied');
    }
    expect(occupied).toBe(true);

    // 試験2: 経路を描いて予想して走らせる
    await stepUntilPhase(page, 'trialDraw', 120);
    expect(await api<number>(page, 'trialIndex')).toBe(2);
    const ok = await api<boolean>(page, 'submitPath', 0, [
      { x: 0.2, z: 5 },
      { x: 0.1, z: 2.5 },
      { x: 0, z: -1.6 },
    ]);
    expect(ok).toBe(true);
    await step(page, 0.5);
    await stepUntilPhase(page, 'trialPredict', 10);
    await api(page, 'placeMarker', 'open');
    await stepUntilPhase(page, 'trialReady', 10);
    await api(page, 'pullLever');
    await stepUntilPhase(page, 'trialRun', 10);
    await stepUntilPhase(page, 'trialResult', 90);
    const result = await api<{ opened: boolean; correct: boolean }>(page, 'lastResult');
    expect(result.opened).toBe(true);
    expect(result.correct).toBe(true);
  });

  test('7. 画面回転中に扉とセンサー状態を失わない', async ({ page }) => {
    await boot(page);
    await fastForwardToTrial2(page);
    const depthBefore = await api<number>(page, 'depth');
    const stateBefore = await api<string>(page, 'doorState');
    const phaseBefore = await api<string>(page, 'phase');
    await page.setViewportSize({ width: 844, height: 390 }); // 回転
    await step(page, 0.5);
    await page.setViewportSize({ width: 390, height: 844 }); // 戻す
    await step(page, 0.5);
    expect(await api<number>(page, 'depth')).toBeCloseTo(depthBefore, 5);
    expect(await api<string>(page, 'doorState')).toBe(stateBefore);
    expect(await api<string>(page, 'phase')).toBe(phaseBefore);
  });

  test('8. 経路の途中で指を離しても壊れない', async ({ page }) => {
    await boot(page);
    await fastForwardToTrial2(page);
    // 実ポインタで短すぎる線を描いて途中で離す
    const vp = page.viewportSize()!;
    await page.mouse.move(vp.width * 0.5, vp.height * 0.62);
    await page.mouse.down();
    await page.mouse.move(vp.width * 0.52, vp.height * 0.63, { steps: 3 });
    await page.mouse.up();
    await step(page, 0.5);
    // 壊れず、まだ描画フェーズのまま
    expect(await api<string>(page, 'phase')).toBe('trialDraw');
    // そのあと正しい経路を与えれば先へ進める
    expect(
      await api<boolean>(page, 'submitPath', 0, [
        { x: 0.2, z: 5 },
        { x: 0, z: -1.6 },
      ]),
    ).toBe(true);
    await step(page, 0.5);
    expect(await api<string>(page, 'phase')).toBe('trialPredict');
  });

  test('9. レバー連打でも二重発車しない', async ({ page }) => {
    await boot(page);
    await fastForwardToTrial2(page);
    await api(page, 'submitPath', 0, [
      { x: 0.2, z: 5 },
      { x: 0, z: -1.6 },
    ]);
    await step(page, 0.5);
    await api(page, 'placeMarker', 'open');
    await stepUntilPhase(page, 'trialReady', 10);
    await api(page, 'pullLever');
    await api(page, 'pullLever');
    await stepUntilPhase(page, 'trialRun', 10);
    await step(page, 4);
    const pos1 = await api<{ z: number }[]>(page, 'actorPositions');
    await api(page, 'pullLever'); // 走行中の連打
    await step(page, 1);
    const pos2 = await api<{ z: number }[]>(page, 'actorPositions');
    // 発車位置へ戻っていない(再スタートしていない)
    expect(pos2[0].z).toBeLessThan(pos1[0].z + 0.01);
  });

  test('10. 再プレイで前回の軌跡が残らない', async ({ page }) => {
    await boot(page);
    await fastForwardToTrial2(page);
    await api(page, 'submitPath', 0, [
      { x: 0.2, z: 5 },
      { x: 0, z: -1.6 },
    ]);
    await step(page, 0.5);
    await api(page, 'placeMarker', 'open');
    await stepUntilPhase(page, 'trialReady', 10);
    await api(page, 'pullLever');
    await stepUntilPhase(page, 'trialResult', 90);
    await api(page, 'clickRetry');
    await stepUntilPhase(page, 'trialDraw', 20);
    expect(await api<number>(page, 'trailCount')).toBe(0);
    expect(await api<boolean>(page, 'pathVisible', 0)).toBe(false);
    expect(await api<string>(page, 'doorState')).toBe('CLOSED');
  });

  test('6b. 診断表示の有無で判定が変わらない(ブラウザ実機)', async ({ page }) => {
    await boot(page);
    await fastForwardToTrial2(page);
    await api(page, 'openLens'); // 診断表示を点けたまま走らせる
    await api(page, 'submitPath', 0, [
      { x: 0.2, z: 5 },
      { x: 0, z: -1.6 },
    ]);
    await step(page, 0.5);
    await api(page, 'placeMarker', 'open');
    await stepUntilPhase(page, 'trialReady', 10);
    await api(page, 'pullLever');
    await stepUntilPhase(page, 'trialResult', 90);
    const r = await api<{ opened: boolean }>(page, 'lastResult');
    expect(r.opened).toBe(true); // 表示の有無に関わらず開く
  });
});
