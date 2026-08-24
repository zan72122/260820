import { test, expect, Page } from '@playwright/test';
import { api, boot, step, stepUntilPhase } from './helpers';

/**
 * 実ジェスチャで一周: スワイプでレンズ開閉、リングの円運動、
 * 床への一筆描き、対象のドラッグ、模型ドラッグ、レバー。
 * 子どもが実際に触る経路をそのまま通す。
 */
test('実ジェスチャで調律から試験2まで遊べる', async ({ page }) => {
  await boot(page, '?e2e=1&fast=1');
  await page.click('#title-start'); // 実クリックでタイトルカードを閉じる
  await stepUntilPhase(page, 'lensPrompt', 90);
  await step(page, 2); // カメラ遷移を進める

  // --- 下スワイプで点検レンズを開く ---
  const lens = await api<{ x: number; y: number }>(page, 'lensScreen');
  await page.mouse.move(lens.x, lens.y - 20);
  await page.mouse.down();
  await page.mouse.move(lens.x, lens.y + 110, { steps: 8 });
  await page.mouse.up();
  expect(await api<boolean>(page, 'lensOpen')).toBe(true);

  // --- 調律フェーズまで進める ---
  await stepUntilPhase(page, 'calibrate', 90);
  await step(page, 2.5); // カメラが調律ショットへ落ち着くまで

  // --- リング中心のまわりで円運動(不完全な円でも可) ---
  const depth0 = await api<number>(page, 'depth');
  expect(depth0).toBeGreaterThan(3);
  const turnRing = async (revolutions: number): Promise<void> => {
    const c = await api<{ x: number; y: number }>(page, 'screenOfRing');
    const r = 110;
    const stepsPerRev = 20;
    const n = Math.round(revolutions * stepsPerRev);
    await page.mouse.move(c.x + r, c.y);
    await page.mouse.down();
    for (let i = 1; i <= n; i++) {
      const a = (i / stepsPerRev) * Math.PI * 2; // 時計回り(画面座標)
      await page.mouse.move(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
    await page.mouse.up();
  };
  await turnRing(1.5);
  const depth1 = await api<number>(page, 'depth');
  expect(depth1).toBeLessThan(depth0); // リングで領域が狭くなる
  if (depth1 > 2.15) await turnRing(2);
  expect(await api<number>(page, 'depth')).toBeLessThanOrEqual(2.15);
  await step(page, 0.5);

  // --- 上スワイプでレンズを閉じる ---
  expect(await api<string>(page, 'phase')).toBe('lensClose');
  const lens2 = await api<{ x: number; y: number }>(page, 'lensScreen');
  await page.mouse.move(lens2.x, lens2.y + 80);
  await page.mouse.down();
  await page.mouse.move(lens2.x, lens2.y - 60, { steps: 8 });
  await page.mouse.up();
  expect(await api<boolean>(page, 'lensOpen')).toBe(false);

  // --- 試験2: 床へ一筆描き ---
  await stepUntilPhase(page, 'trialDraw', 240);
  await step(page, 2.5); // 描画カメラへ

  const drag = async (
    pts: { x: number; y: number }[],
  ): Promise<void> => {
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.up();
  };

  const vp = page.viewportSize()!;
  const clamp = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.min(vp.width - 8, Math.max(8, p.x)),
    y: Math.min(vp.height - 8, Math.max(8, p.y)),
  });
  const floorPt = async (x: number, z: number): Promise<{ x: number; y: number }> =>
    clamp(await api(page, 'screenOfFloor', x, z));

  // (0.25,4.0) → (0,-0.8) へ向かう線を床座標から合成(全点が画面内)
  const stroke: { x: number; y: number }[] = [];
  for (let i = 0; i <= 8; i++) {
    const z = 4.0 - (4.8 * i) / 8;
    stroke.push(await floorPt(0.25 - 0.03 * i, z));
  }
  await drag(stroke);
  await step(page, 0.3);
  expect(await api<string>(page, 'phase')).toBe('actorPlace');

  // --- 対象を発車位置へ大きくドラッグ ---
  const actors = await api<{ x: number; z: number }[]>(page, 'actorPositions');
  const from = await floorPt(actors[0].x, actors[0].z);
  const to = await floorPt(0.25, 4.0);
  await drag([from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to]);
  await step(page, 0.3);
  expect(await api<string>(page, 'phase')).toBe('trialPredict');

  // --- 模型(あく)をドラッグして予想 ---
  const card = page.locator('.marker-card[data-kind="open"]');
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 });
  await page.mouse.up();
  await step(page, 0.3);
  expect(await api<string>(page, 'phase')).toBe('trialReady');

  // --- レバーを下へ倒す ---
  const track = page.locator('#lever-track');
  const tb = (await track.boundingBox())!;
  await page.mouse.move(tb.x + tb.width / 2, tb.y + 12);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height - 6, { steps: 8 });
  await page.mouse.up();
  await step(page, 0.5);
  expect(await api<string>(page, 'phase')).toBe('trialRun');

  // --- 結果: 入口へ向かう車椅子台なので開く ---
  await stepUntilPhase(page, 'trialResult', 120);
  const result = await api<{ opened: boolean; correct: boolean }>(page, 'lastResult');
  expect(result.opened).toBe(true);
  expect(result.correct).toBe(true);
});
