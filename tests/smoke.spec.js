import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const SHOTS = 'test-results/shots';

async function boot(page, query = '') {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e=1' + query);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90_000 });
  return errors;
}

const state = (page) => page.evaluate(() => window.__suika.state());
const advance = (page, s) => page.evaluate((n) => window.__suika.advance(n), s);

test('the three screens: seeing, blindfolded, and the reveal', async ({ page }, testInfo) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const errors = await boot(page);

  await page.evaluate(() => window.__suika.begin());

  /* 1 — the melon is visible and the player is given time to memorise it */
  await advance(page, 1.2);
  let s = await state(page);
  expect(s.phase).toBe('show');
  expect(s.blindfold).toBe(0);
  await page.screenshot({ path: `${SHOTS}/01-see-the-melon.png` });

  /* 2 — the cloth comes down; sight is gone but the frame is not black */
  await advance(page, 3.2);
  s = await state(page);
  expect(['tie', 'search']).toContain(s.phase);
  await advance(page, 1.4);
  s = await state(page);
  expect(s.phase).toBe('search');
  expect(s.blindfold).toBeGreaterThan(0.98);
  await page.screenshot({ path: `${SHOTS}/02-blindfolded.png` });

  // the blindfolded frame must still carry readable light and shade
  const stats = await page.evaluate(() => {
    const c = document.getElementById('view');
    const o = document.createElement('canvas');
    o.width = 64; o.height = 64;
    const g = o.getContext('2d');
    g.drawImage(c, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data;
    let min = 255, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      min = Math.min(min, l); max = Math.max(max, l); sum += l;
    }
    return { min, max, mean: sum / (d.length / 4) };
  });
  // not a black screen, not a readable one either
  expect(stats.mean).toBeGreaterThan(6);
  expect(stats.mean).toBeLessThan(150);
  expect(stats.max - stats.min).toBeGreaterThan(18);

  /* 3 — turn towards the voices, walk in, and strike */
  const start = await state(page);
  expect(start.distance).toBeGreaterThan(3.5);

  for (let i = 0; i < 24; i++) {
    const cur = await state(page);
    if (cur.distance < 1.2) break;
    await page.evaluate((b) => window.__suika.turn(b * 0.55), Math.sign(cur.bearing) || 1);
    await page.evaluate(() => window.__suika.step(1));
    await advance(page, 1.1);
  }
  const near = await state(page);
  expect(near.distance).toBeLessThan(1.25);
  await advance(page, 1.2);
  expect((await state(page)).phase).toBe('aim');

  await page.evaluate(() => window.__suika.strike());
  await advance(page, 2.0);
  const after = await state(page);
  expect(['reveal', 'wide']).toContain(after.phase);
  expect(after.blindfold).toBe(0);
  await page.screenshot({ path: `${SHOTS}/03-broken-open.png` });

  await advance(page, 4.0);
  await page.screenshot({ path: `${SHOTS}/04-wide.png` });
  expect(['wide', 'again']).toContain((await state(page)).phase);

  await testInfo.attach('console-errors', { body: errors.join('\n') || '(none)' });
  expect(errors.filter((e) => !/WebGL|SwiftShader|deprecat/i.test(e))).toEqual([]);
});

test('another round moves the melon and keeps the loop short', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__suika.begin());
  await advance(page, 5.0);
  const first = await state(page);
  await page.evaluate(() => window.__suika.game.replay());
  await advance(page, 0.5);
  const second = await state(page);
  expect(second.round).toBe(first.round + 1);
  expect(second.phase).toBe('show');
  expect(second.blindfold).toBe(0);
});
