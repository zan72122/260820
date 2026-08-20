import { test, expect } from '@playwright/test';

const URL = '/?fast=1&q=mid';

/** 決定的モードで章を最初から最後まで動かす */
async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__nagaoka);
  return errors;
}
const step = (page, ms) => page.evaluate((m) => window.__nagaoka.step(m), ms);
const state = (page) => page.evaluate(() => window.__nagaoka.state());

test('起動して、橋の見えるタイトル画面が出る', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#btnStart')).toBeVisible();
  const s = await state(page);
  expect(s.phase).toBe('title');
  // カメラが橋を捉えている（水平線が画面内に収まっている）
  expect(s.cam.horizon).toBeGreaterThan(0.2);
  expect(s.cam.horizon).toBeLessThan(0.95);
  expect(errors).toEqual([]);
});

test('二段階の操作で、下向きのナイアガラと上向きの正三尺玉が両方起きる', async ({ page }) => {
  const errors = await boot(page);

  // 1) はじめる
  await page.locator('#btnStart').click();
  await step(page, 3000);
  expect((await state(page)).phase).toBe('wait_niagara');

  // 2) 橋に火をつける（下向きの現象）
  const b1 = page.locator('#btnNiagara');
  await expect(b1).toBeVisible();
  await b1.click();
  await step(page, 2600);
  let s = await state(page);
  expect(s.niagaraStarted).toBe(true);
  expect(s.niagara).toBeGreaterThan(0.6);       // 橋の端から端まで火が回った
  expect(s.particles).toBeGreaterThan(100);     // 火の粉が落ちている

  // 3) 予告のあと、玉を上げる（上向きの現象）
  await step(page, 1200);
  const b2 = page.locator('#btnShell');
  await expect(b2).toBeVisible();
  await b2.click();
  s = await state(page);
  expect(s.shellState).toBe(1);                 // 昇り中

  await step(page, 2000);
  s = await state(page);
  expect(s.shellY).toBeGreaterThan(150);        // 実際に上へ動いている
  expect(s.niagara).toBeGreaterThan(0.6);       // その間も滝は落ち続けている

  await step(page, 2200);
  s = await state(page);
  expect(s.burst).toBe(true);                   // 開発した
  expect(s.grade.stars).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('引きの絵で、橋と花火と水面が一枚に収まる', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const n = window.__nagaoka; n.begin(); n.step(3000); n.niagara(); n.step(4200); n.shell(); });
  await step(page, 4000);   // 開発
  await step(page, 2600);   // 引きの絵へ

  const fit = await page.evaluate(() => {
    const { chapter } = window.__nagaoka;
    const cam = chapter.cam;
    const W = cam.W, H = cam.H;
    const P = { x: 0, y: 0, s: 0, ok: false };
    const inFrame = (x, y, z, pad = 0) => {
      cam.project(x, y, z, P);
      return P.ok && P.x > -pad && P.x < W + pad && P.y > -pad && P.y < H + pad;
    };
    const w = chapter;
    // 橋の両端（頂点）と、花火の上下左右
    const { BRIDGE } = window.__nagaokaWorld;
    const bp = (t, y) => {
      const dx = BRIDGE.bx - BRIDGE.ax, dz = BRIDGE.bz - BRIDGE.az;
      return [BRIDGE.ax + dx * t, y, BRIDGE.az + dz * t];
    };
    const s = w.shell;
    const r = s.radiusNow(w.time) * 0.9;
    return {
      phase: w.phase,
      bridgeNear: inFrame(...bp(0, BRIDGE.deckY + BRIDGE.trussH), 8),
      bridgeFar: inFrame(...bp(1, BRIDGE.deckY + BRIDGE.trussH), 8),
      bridgeWaterNear: inFrame(...bp(0, 0), 8),
      burstTop: inFrame(s.x, s.y + r, s.z, 8),
      burstBottom: inFrame(s.x, s.y - r, s.z, 8),
      burstLeft: inFrame(s.x - r, s.y, s.z, 8),
      burstRight: inFrame(s.x + r, s.y, s.z, 8),
      // 水面（映り込みが載る領域）が画面に見えている
      waterVisible: cam.horizonY() < H - 40,
      stars: w.parts.count,
      niagara: w.niagara.intensity,
    };
  });

  expect(fit.phase).toBe('wide');
  expect(fit.bridgeNear).toBe(true);
  expect(fit.bridgeFar).toBe(true);
  expect(fit.bridgeWaterNear).toBe(true);
  expect(fit.burstTop).toBe(true);
  expect(fit.burstBottom).toBe(true);
  expect(fit.burstLeft).toBe(true);
  expect(fit.burstRight).toBe(true);
  expect(fit.waterVisible).toBe(true);
  expect(fit.stars).toBeGreaterThan(200);       // 花火がまだ光っている
  expect(fit.niagara).toBeGreaterThan(0.6);     // 滝もまだ落ちている
});

test('余韻のあと結果が出て、もう一度あそべる', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const n = window.__nagaoka; n.begin(); n.step(3000); n.niagara(); n.step(4200); n.shell(); n.step(4000); });
  await step(page, 14000);
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#resultStars')).toContainText('★');

  await page.locator('#btnReplay').click();
  await step(page, 500);
  const s = await state(page);
  expect(s.burst).toBe(false);
  expect(s.niagaraStarted).toBe(false);
  expect(errors).toEqual([]);
});

test('画面のどこを触っても進む（4歳児向けの保険）', async ({ page }) => {
  await boot(page);
  // タイトルは（ボタン以外の）どこでも開始になる
  await page.locator('#title').tap({ position: { x: 20, y: 40 } });
  await step(page, 3000);
  expect((await state(page)).phase).toBe('wait_niagara');
  // 以降はキャンバスのどこを触っても進む
  await page.locator('#scene').tap({ position: { x: 30, y: 60 } });
  await step(page, 500);
  expect((await state(page)).niagaraStarted).toBe(true);
});
