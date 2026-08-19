import { test, expect } from '@playwright/test';
import {
  waitReady, state, advance, siteScreen, siteRadiusPx, siteInfo,
  waitState, tapAt, brushOver, circleDrag, swipeH, swipeUp, focusScreen,
} from './helpers.js';

/** 1本掘りきるまでの一連。指の動きは実際のポインタイベントで再現する。 */
async function digOneTakenoko(page, siteIndex = 0) {
  // さがす
  await waitState(page, 'survey');
  const p = await siteScreen(page, siteIndex);
  await tapAt(page, p.x, p.y);
  await waitState(page, 'brush');

  // はっぱを はらう
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = await siteScreen(page, siteIndex);
    const r = await siteRadiusPx(page, siteIndex);
    await brushOver(page, c.x, c.y, r * 1.5);
    const s = await state(page);
    if (s.state !== 'brush') break;
    await advance(page, 0.2);
  }
  await waitState(page, 'dig');

  // まわりを ぐるぐる ほる (途中で断面が入るので、そのつど待つ)
  for (let attempt = 0; attempt < 12; attempt++) {
    const s0 = await state(page);
    if (s0.state === 'cut') break;
    if (s0.state !== 'dig' || s0.locked) {
      await advance(page, 0.4);
      continue;
    }
    const c = await siteScreen(page, siteIndex);
    const r = await siteRadiusPx(page, siteIndex);
    await circleDrag(page, c.x, c.y, r, 2);
    await advance(page, 0.3);
  }
  // ぐるぐる掘る動きの流れで、そのまま切る動作に入ることもある
  await waitState(page, ['cut', 'pull'], 20);

  // ねもとを きる
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = await state(page);
    if (s.state !== 'cut') break;
    if (s.locked) { await advance(page, 0.3); continue; }
    const c = await focusScreen(page);
    await swipeH(page, c.x, c.y, page.viewportSize().width * 0.6);
    await advance(page, 0.2);
  }
  await waitState(page, 'pull', 20);

  // ひっぱる
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = await state(page);
    if (s.state !== 'pull') break;
    if (s.locked) { await advance(page, 0.3); continue; }
    const c = await focusScreen(page);
    await swipeUp(page, c.x, c.y, Math.min(page.viewportSize().height * 0.4, 280));
    await advance(page, 0.2);
  }
}

test.describe('たけのこほり', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => { throw new Error('ページ内エラー: ' + e.message); });
  });

  test('起動して WebGL の竹林が立ち上がる', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/?fast=1');
    await waitReady(page);

    const info = await page.evaluate(() => window.__TAKENOKO__.info());
    expect(info.triangles).toBeGreaterThan(3000); // 実ジオメトリが描かれている
    expect(info.size[0]).toBeGreaterThan(100);
    expect(errors, '起動時のコンソールエラー').toEqual([]);

    const s = await state(page);
    expect(['intro', 'survey']).toContain(s.state);
  });

  test('導入ショットから探索へ進む', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    const s = await waitState(page, 'survey');
    expect(s.remaining).toBe(5);
    expect(s.collected).toBe(0);
  });

  test('はずれの場所を触っても止まらず、ヒントが出る', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    await waitState(page, 'survey');
    const d = await page.evaluate(() => window.__TAKENOKO__.decoyScreen(0));
    await tapAt(page, d.x, d.y);
    let s = await state(page);
    expect(s.state).toBe('survey');
    expect(s.misses).toBeGreaterThan(0);
    // 2回はずすと光の輪でそっと教える
    await tapAt(page, d.x, d.y);
    await advance(page, 0.6);
    const near = await siteInfo(page, 0);
    expect(near.ringVisible).toBe(true);
  });

  test('たけのこを1本 掘って かごに入れられる (縦画面)', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    await digOneTakenoko(page, 0);
    await advance(page, 4);
    const s = await state(page);
    expect(s.collected).toBe(1);
    expect(s.crossShown, '掘る途中で断面が出る').toBe(true);
    const info = await siteInfo(page, 0);
    expect(info.taken).toBe(true);
    expect(info.dig).toBeGreaterThan(0.85);
    expect(info.leaves, '落ち葉は払いきられている').toBe(0);
  });

  test('あそんでいる途中で画面を回しても続けられる', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    await waitState(page, 'survey');
    const p = await siteScreen(page, 0);
    await tapAt(page, p.x, p.y);
    await waitState(page, 'brush');

    // ここで横画面へ
    await page.setViewportSize({ width: 740, height: 390 });
    await page.waitForFunction(() => window.__TAKENOKO__.state().aspect > 1);
    await advance(page, 1.2);
    const s = await state(page);
    expect(s.state).toBe('brush');
    expect(s.aspect).toBeGreaterThan(1);
    // 掘る場所が画面の中に収まっていること
    const c = await siteScreen(page, 0);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(740);
    expect(c.y).toBeGreaterThan(0);
    expect(c.y).toBeLessThan(390);

    // そのまま最後まで掘れる
    for (let attempt = 0; attempt < 8; attempt++) {
      const cc = await siteScreen(page, 0);
      const r = await siteRadiusPx(page, 0);
      await brushOver(page, cc.x, cc.y, r * 1.5);
      if ((await state(page)).state !== 'brush') break;
      await advance(page, 0.2);
    }
    await waitState(page, 'dig');
  });

  test('5本ぜんぶ掘りきると、もういちど はじめられる', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    await waitState(page, 'survey');

    // 1本目は本物の指の動きで、残りはゲーム内部の手順をそのまま呼んで進める
    await digOneTakenoko(page, 0);
    await advance(page, 4);
    expect((await state(page)).collected).toBe(1);

    for (let n = 0; n < 4; n++) {
      await page.evaluate(() => {
        const T = window.__TAKENOKO__;
        const g = T.game;
        const site = g.sites.find((s) => !s.taken);
        g.approach(site);
        T.advance(4);
        site.brushAll();
        g._brushDone();
        T.advance(4);
        for (let i = 0; i < 400; i++) site.dig(i * 0.11, 0.11);
        g._digDone();
        T.advance(6);
        g._enterPull();
        T.advance(4);
        g._pop();
        T.advance(8);
      });
      await advance(page, 3);
    }

    const done = await state(page);
    expect(done.collected).toBe(5);
    expect(done.remaining).toBe(0);
    expect(done.state).toBe('done');

    // 画面を触ると、新しい竹林でやりなおせる
    await advance(page, 3);
    await tapAt(page, 200, 300);
    await advance(page, 2);
    const again = await state(page);
    expect(again.collected).toBe(0);
    expect(again.remaining).toBe(5);
    expect(['survey', 'approach']).toContain(again.state);
  });

  test('ヒントは奥の場所ほど控えめになる', async ({ page }) => {
    await page.goto('/?fast=1');
    await waitReady(page);
    await waitState(page, 'survey');
    const infos = [];
    for (let i = 0; i < 5; i++) infos.push(await siteInfo(page, i));
    // 先端の出かたが、手前から奥へ向かって単調に小さくなる
    for (let i = 1; i < infos.length; i++) {
      expect(infos[i].exposure).toBeLessThan(infos[i - 1].exposure);
      expect(infos[i].hintLevel).toBe(i);
    }
    expect(infos[0].exposure).toBeGreaterThan(0.05);
  });

  test('横画面でも一周できる', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 390 });
    await page.goto('/?fast=1');
    await waitReady(page);
    const s0 = await state(page);
    expect(s0.aspect).toBeGreaterThan(1);
    await digOneTakenoko(page, 0);
    await advance(page, 4);
    const s = await state(page);
    expect(s.collected).toBe(1);
  });
});
