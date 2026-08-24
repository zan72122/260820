import { test, expect, Page } from '@playwright/test';

// Chromium smoke E2E (E2E_FAST profile): deterministic state via ?e2e=1,
// logical time advanced through window.__game.tick. Never judges FPS or
// visual quality under SwiftShader — only game logic and causality.

declare global {
  interface Window {
    __game: {
      phase: string;
      loops: { progress: number; open: boolean }[];
      rainActive: number;
      rainLanded: number;
      flowersAwake: number;
      sunUp: number;
      wetSpots: number;
      frameMs: number;
      skipIntro(): void;
      unwind(i: number, amount: number): void;
      loopScreen(i: number): { x: number; y: number };
      tick(seconds: number): void;
    };
  }
}

async function circle(page: Page, cx: number, cy: number, r: number, revs: number, cw: boolean) {
  const perRev = 20;
  const steps = Math.round(perRev * revs);
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const a = (i / perRev) * Math.PI * 2 * (cw ? 1 : -1);
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    if (i % 2 === 0) await page.waitForTimeout(5);
  }
  await page.mouse.up();
}

test('boots without console errors and renders a canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e=1', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('intro chain advances to interactive closeup', async ({ page }) => {
  await page.goto('/?e2e=1', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.tick(16));
  const phase = await page.evaluate(() => window.__game.phase);
  expect(['closeup', 'play']).toContain(phase);
});

test('wrong-direction circles never unwind; correct direction opens one loop and drops fall', async ({ page }) => {
  await page.goto('/?e2e=1&skip=1', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.tick(3));
  const c = await page.evaluate(() => window.__game.loopScreen(0));

  await circle(page, c.x, c.y, 90, 1.5, true); // clockwise = tightening direction
  let loops = await page.evaluate(() => window.__game.loops);
  expect(loops[0].progress).toBeLessThan(0.05);
  expect(loops[0].open).toBe(false);

  for (let k = 0; k < 5; k++) {
    loops = await page.evaluate(() => window.__game.loops);
    if (loops[0].open) break;
    await circle(page, c.x, c.y, 90, 2, false);
    await page.evaluate(() => window.__game.tick(0.3));
  }
  loops = await page.evaluate(() => window.__game.loops);
  expect(loops[0].open).toBe(true);

  // the first release: a few drops, local wetting, flowers answer
  await page.evaluate(() => window.__game.tick(5));
  const state = await page.evaluate(() => ({
    landed: window.__game.rainLanded,
    flowers: window.__game.flowersAwake,
  }));
  expect(state.landed).toBeGreaterThan(0);
  expect(state.flowers).toBeGreaterThan(0);
});

test('opening all loops reaches free play and steering rains elsewhere', async ({ page }) => {
  await page.goto('/?e2e=1&skip=1', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__game.tick(3);
    window.__game.unwind(0, 1);
    window.__game.tick(4);
    window.__game.unwind(1, 1);
    window.__game.unwind(2, 1);
    window.__game.tick(3);
  });
  const phase = await page.evaluate(() => window.__game.phase);
  expect(['free', 'afterglow']).toContain(phase);

  const before = await page.evaluate(() => window.__game.wetSpots);
  // carry the cloud across the whole valley, then hold at the far side
  await page.mouse.move(600, 300);
  await page.mouse.down();
  for (let i = 0; i < 28; i++) {
    await page.mouse.move(600 - i * 20, 300 + Math.sin(i * 0.6) * 24);
    await page.waitForTimeout(12);
  }
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(45 + (i % 2) * 10, 300);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.evaluate(() => window.__game.tick(6));
  const after = await page.evaluate(() => window.__game.wetSpots);
  expect(after).toBeGreaterThan(before);
});

test('rapid taps and viewport rotation do not break state', async ({ page }) => {
  await page.goto('/?e2e=1&skip=1', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.tick(2));
  for (let i = 0; i < 10; i++) await page.mouse.click(150 + i * 40, 220, { delay: 5 });
  await page.setViewportSize({ width: 450, height: 800 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__game.tick(2));
  const phase = await page.evaluate(() => window.__game.phase);
  expect(phase).toBeTruthy();
  const errors = await page.evaluate(() => (window as any).__lastError ?? null);
  expect(errors).toBeNull();
});
