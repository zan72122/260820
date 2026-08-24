/**
 * Chromium スモークE2E：開始→誘い→静止→ピクッ→クイッ→ウィーン→取り込み→再プレイ。
 * iPhone/iPad相当の縦横4画面で実際のジェスチャを流し、状態遷移とコンソールエラーを検証する。
 *
 * 使い方: node scripts/e2e-smoke.mjs [--url http://localhost:5173] [--shots dir] [--quick]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const URL_BASE = getArg('--url', 'http://localhost:5173');
const SHOTS = getArg('--shots', '/tmp/shots');
const QUICK = args.includes('--quick');
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = QUICK
  ? [{ name: 'iphone-portrait', width: 390, height: 844 }]
  : [
      { name: 'iphone-portrait', width: 390, height: 844 },
      { name: 'iphone-landscape', width: 844, height: 390 },
      { name: 'ipad-portrait', width: 820, height: 1180 },
      { name: 'ipad-landscape', width: 1180, height: 820 }
    ];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function state(page) {
  return page.evaluate(() => window.__game?.state());
}

async function waitState(page, want, timeoutMs = 15000) {
  const t0 = Date.now();
  for (;;) {
    const s = await state(page);
    if (Array.isArray(want) ? want.includes(s) : s === want) return s;
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`timeout waiting for state ${want}, current=${s}`);
    }
    await sleep(120);
  }
}

async function swipe(page, x, y0, y1, steps = 8, ms = 90) {
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, y0 + ((y1 - y0) * i) / steps);
    await sleep(ms / steps);
  }
  await page.mouse.up();
}

async function jigAndRelease(page, W, H) {
  // トン、トン（下上下上）→ 離す
  const x = W / 2;
  const y = H * 0.62;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const amp = Math.min(H * 0.07, 70);
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 6; i++) {
      await page.mouse.move(x + (Math.random() - 0.5) * 6, y + amp * Math.sin((i / 6) * Math.PI * 2));
      await sleep(14);
    }
  }
  await page.mouse.up();
}

async function waitCatches(page, want, timeoutMs = 25000) {
  const t0 = Date.now();
  for (;;) {
    const c = await page.evaluate(() => window.__game.catches());
    if (c >= want) return c;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for catches>=${want}, got ${c}`);
    await sleep(200);
  }
}

async function fullLoop(page, W, H, name, opts = {}) {
  const { screenshotEach = true, expectCatches = 1 } = opts;
  const shot = async (label) => {
    if (screenshotEach) await page.screenshot({ path: `${SHOTS}/${name}-${label}.png` });
  };

  // 誘い
  await waitState(page, ['IDLE', 'STILL']);
  await shot('1-idle');
  await jigAndRelease(page, W, H);
  const s = await state(page);
  if (s !== 'STILL') throw new Error(`expected STILL after jig+release, got ${s}`);
  await shot('2-still');

  // ピクッを待つ（e2e=1 なら1.3s）
  await waitState(page, 'BITE', 9000);
  await shot('3-bite');

  // クイッ
  await swipe(page, W / 2, H * 0.6, H * 0.38, 5, 70);
  await waitState(page, ['HOOKSET', 'REELING'], 3000);
  await shot('4-hookset');
  await waitState(page, 'REELING', 3000);

  // ウィーン（押し続ける。途中で一度離して再開もテスト）
  await page.mouse.move(W / 2, H * 0.7);
  await page.mouse.down();
  await sleep(1800);
  await page.mouse.up(); // 途中で離す → 巻き上げ停止
  await sleep(500);
  const midDepth = await page.evaluate(() => window.__game.baitDepth());
  await sleep(400);
  const midDepth2 = await page.evaluate(() => window.__game.baitDepth());
  if (Math.abs(midDepth - midDepth2) > 0.02) throw new Error('reeling did not pause on release');
  await shot('5-reeling');
  await page.mouse.down();
  // 巻き切るまで押し続ける
  await waitState(page, 'REVEAL', 20000);
  await shot('6-reveal');
  await waitState(page, 'CAUGHT', 20000);
  await page.mouse.up();
  // 取り込みアニメ完了（釣果が増える）まで待つ
  await waitCatches(page, expectCatches);
  await page.waitForSelector('#replay.shown', { timeout: 10000 });
  await shot('7-caught');

  // 再プレイ（大きな絵ボタン1タップ）
  await page.click('#replay');
  await waitState(page, ['RESET', 'IDLE'], 5000);
  await waitState(page, 'IDLE', 6000);
  await shot('8-replay-idle');
}

let failures = 0;

for (const vp of VIEWPORTS) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: true
  });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  try {
    await page.goto(`${URL_BASE}/?e2e=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__game, { timeout: 15000 });
    const s0 = await state(page);
    if (s0 !== 'TITLE') throw new Error(`initial state ${s0}`);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-0-title.png` });

    // タップで開始
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await waitState(page, ['ENTER', 'IDLE'], 4000);
    await waitState(page, 'IDLE', 9000);

    // 一周目（カットアウェイあり）
    await fullLoop(page, vp.width, vp.height, `${vp.name}-r1`, { expectCatches: 1 });
    const c1 = await page.evaluate(() => window.__game.catches());
    if (c1 !== 1) throw new Error(`expected 1 catch, got ${c1}`);

    if (!QUICK && vp.name === 'iphone-portrait') {
      // 二周目（カットアウェイ半分）＋乱暴な入力への耐性
      // 連打
      for (let i = 0; i < 6; i++) await page.mouse.click(vp.width / 2, vp.height / 2, { delay: 20 });
      // 逆方向スワイプ
      await swipe(page, vp.width / 2, vp.height * 0.3, vp.height * 0.7, 6, 100);
      await sleep(600);
      await fullLoop(page, vp.width, vp.height, `${vp.name}-r2`, { expectCatches: 2 });
      const c2 = await page.evaluate(() => window.__game.catches());
      if (c2 !== 2) throw new Error(`expected 2 catches, got ${c2}`);

      // 三周目（水中なし）：画面回転もはさむ
      await page.setViewportSize({ width: vp.height, height: vp.width });
      await sleep(700);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await sleep(700);
      await fullLoop(page, vp.width, vp.height, `${vp.name}-r3`, { expectCatches: 3 });
      const c3 = await page.evaluate(() => window.__game.catches());
      if (c3 !== 3) throw new Error(`expected 3 catches, got ${c3}`);
    }

    const realErrors = errors.filter(
      (e) => !e.includes('WebGL warning') && !e.includes('GroupMarkerNotSet') && !e.includes('404')
    );
    if (realErrors.length) throw new Error(`console errors: ${realErrors.join(' | ')}`);
    console.log(`PASS ${vp.name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${vp.name}: ${err.message}`);
    if (errors.length) console.error(`  console: ${errors.slice(0, 6).join('\n  ')}`);
    try {
      await page.screenshot({ path: `${SHOTS}/${vp.name}-FAIL.png` });
    } catch {}
  } finally {
    await browser.close();
  }
}

process.exit(failures ? 1 : 0);
