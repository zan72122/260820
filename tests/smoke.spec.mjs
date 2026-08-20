import { test, expect } from '@playwright/test';

const URL = '/?fast=1';

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__phoenix);
  return errors;
}

test('タイトルから開始でき、最初はごく小さい画角である', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('#title h1')).toHaveText('フェニックス');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play');
  const start = await page.evaluate(() => {
    window.__phoenix.advance(600);
    return { hw: window.__phoenix.halfWidth, growth: window.__phoenix.growth, lit: window.__phoenix.lit };
  });
  expect(start.lit).toBe(0);
  expect(start.growth).toBeLessThan(0.05);
  expect(errors).toEqual([]);
  // この時点の見えている幅を後段と比べる
  test.info().annotations.push({ type: 'halfWidth(start)', description: String(Math.round(start.hw)) });
});

test('となりへ、となりへ、と横に広がりカメラが引く', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play');

  const result = await page.evaluate(async () => {
    const P = window.__phoenix;
    P.advance(400);
    const before = { hw: P.halfWidth, dist: P.camDist, lit: P.lit };

    // 中央から順に、armed になったところを押していく（＝プレイヤーの操作そのもの）
    const seen = [];
    for (let step = 0; step < 60 && P.lit < P.total; step++) {
      const armed = P.armedIndexes();
      if (!armed.length) { P.advance(200); continue; }
      P.tap(armed[0]);
      seen.push(armed[0]);
      P.advance(320);
    }
    P.advance(1500);
    const mid = { hw: P.halfWidth, dist: P.camDist, lit: P.lit, total: P.total, state: P.state };
    return { before, mid, seen };
  });

  expect(result.mid.lit).toBe(result.mid.total);
  // 「最初の小ささ」と「最後の横方向の大きさ」に明確な差があること
  expect(result.mid.hw).toBeGreaterThan(result.before.hw * 3);
  expect(result.mid.dist).toBeGreaterThan(result.before.dist * 1.5);
  expect(errors).toEqual([]);
});

test('全部つながるとフェニックスが一斉に広がり、やり直せる', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play');

  const res = await page.evaluate(() => {
    const P = window.__phoenix;
    P.igniteAll();
    P.advance(1000);            // フィナーレは自動で始まる（手で呼ばない）
    const auto = P.state;
    let peak = 0;
    for (let i = 0; i < 60; i++) { P.advance(200); peak = Math.max(peak, P.particles); }
    return { peak, auto, state: P.state, hw: P.halfWidth, growth: P.growth };
  });

  expect(res.auto).toBe('finale');         // つながりきったら勝手に始まる
  expect(res.peak).toBeGreaterThan(120);   // 一斉に開いている
  expect(res.growth).toBeGreaterThan(0.9); // 引ききっている
  await expect(page.locator('#end')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'もういちど' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play' && window.__phoenix.lit === 0);
  expect(errors).toEqual([]);
});

test('縦画面でも遊べて、最後に大きく引く', async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-portrait', '縦画面プロジェクト専用');
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__phoenix.landscape)).toBe(false);
  await page.getByRole('button', { name: 'はじめる' }).click();
  const res = await page.evaluate(() => {
    const P = window.__phoenix;
    P.advance(400);
    const before = P.halfWidth;
    P.igniteAll(); P.advance(200); P.finale();
    for (let i = 0; i < 40; i++) P.advance(200);
    return { before, after: P.halfWidth };
  });
  expect(res.after).toBeGreaterThan(res.before * 3);
  expect(errors).toEqual([]);
});

test('実際に画面を指でなぞって点けられる（当たり判定が十分大きい）', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play');
  await page.evaluate(() => window.__phoenix.advance(500));

  // 中央の armed 地点の画面座標を取り、本物のポインタで触る
  const pos = await page.evaluate(() => {
    const P = window.__phoenix;
    const i = P.armedIndexes()[0];
    return { i, ...P.screenPos(i) };
  });
  expect(pos.x).toBeGreaterThan(0);
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.evaluate(() => window.__phoenix.advance(900));
  expect(await page.evaluate(() => window.__phoenix.lit)).toBe(1);

  // 点いた地点の「となり」だけが次に触れるようになる＝操作が横の広がりに直結する
  const armed = await page.evaluate(() => window.__phoenix.armedIndexes());
  expect(armed.sort((a, b) => a - b)).toEqual([pos.i - 1, pos.i + 1]);
  expect(errors).toEqual([]);
});

test('フィナーレ中は案内が消え、川面が花火を映す', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.waitForFunction(() => window.__phoenix.state === 'play');
  await page.evaluate(() => {
    const P = window.__phoenix;
    P.igniteAll(); P.advance(400); P.finale();
    for (let i = 0; i < 20; i++) P.advance(200);
  });
  await expect(page.locator('#coach')).toHaveClass(/hidden/);

  // 水面側（画面下半分）に花火由来の明るい画素があること
  const bright = await page.evaluate(() => {
    const c = document.getElementById('stage'), g = c.getContext('2d');
    const y0 = Math.floor(c.height * 0.52), h = Math.floor(c.height * 0.22);
    const d = g.getImageData(0, y0, c.width, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 90) n++;
    return n;
  });
  expect(bright).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});
