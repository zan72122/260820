/**
 * 4つの画面サイズで主要場面のスクリーンショットを撮る。
 * 使い方: node scripts/screenshots.mjs [出力ディレクトリ]
 * 事前に `npm run preview -- --port 4173` を起動しておくこと。
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'screenshots';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1180x820', width: 1180, height: 820 },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const api = (page, fn, ...args) =>
  page.evaluate(({ fn, args }) => window.__game[fn](...args), { fn, args });

const stepUntilPhase = async (page, phase, maxS = 180) => {
  for (let t = 0; t < maxS; t += 2) {
    if ((await api(page, 'phase')) === phase) return true;
    await api(page, 'step', 2);
  }
  return false;
};

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto('http://127.0.0.1:4173/?e2e=1');
  await page.waitForFunction(() => !!window.__game);
  const shot = (name) => page.screenshot({ path: `${OUT}/${vp.name}-${name}.png` });

  await shot('title');
  await page.click('#title-start');
  await api(page, 'step', 3);

  // 誤開扉の瞬間
  for (let t = 0; t < 30; t += 1) {
    await api(page, 'step', 1);
    if (await api(page, 'openedOnce')) break;
  }
  await api(page, 'step', 1);
  await shot('intro-mystery');

  // 診断モード
  await stepUntilPhase(page, 'lensPrompt', 60);
  await api(page, 'step', 2);
  await shot('lens-prompt');
  await api(page, 'openLens');
  await api(page, 'step', 4);
  await shot('diagnostic');

  // 診断中の横切り(セル点灯)
  for (let t = 0; t < 30; t += 1) {
    await api(page, 'step', 1);
    if ((await api(page, 'hotCellCount')) > 0) break;
  }
  await shot('diagnostic-hot');

  // 調律
  await stepUntilPhase(page, 'calibrate', 60);
  await api(page, 'step', 1);
  await shot('calibrate-before');
  await api(page, 'setDepth', 1.9);
  await api(page, 'step', 1);
  await shot('calibrate-after');
  await api(page, 'closeLens');

  // カーテン学習の保持場面
  await stepUntilPhase(page, 'curtainLesson', 180);
  for (let t = 0; t < 60; t += 1) {
    await api(page, 'step', 1);
    if (await api(page, 'curtainOccupied')) break;
  }
  await api(page, 'openLens');
  await api(page, 'step', 2);
  await shot('curtain');
  await api(page, 'closeLens');

  // 試験2: 経路描画と予想
  await stepUntilPhase(page, 'trialDraw', 120);
  await api(page, 'step', 2);
  await shot('trial-draw');
  await api(page, 'submitPath', 0, [
    { x: 0.2, z: 5 },
    { x: 0.1, z: 2.5 },
    { x: 0, z: -1.6 },
  ]);
  await api(page, 'step', 1);
  await shot('trial-predict');
  await api(page, 'placeMarker', 'open');
  await api(page, 'step', 1);
  await shot('trial-ready');
  await api(page, 'pullLever');
  await api(page, 'step', 6);
  await shot('trial-run');

  await page.close();
  console.log(`done: ${vp.name}`);
}

await browser.close();
