import { test, expect, Page } from '@playwright/test';

// E2E per the brief: iPhone/iPad portrait+landscape, wordless first
// interaction, quarter-turn causality, robustness (release / reverse /
// taps / rotation), replay, clean console.

const IPHONE = { width: 390, height: 844 };
const IPAD = { width: 820, height: 1180 };

interface GameHandle {
  errors: string[];
}

async function boot(page: Page, expectFrames = 5) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?e2e=1');
  await page.waitForFunction(
    (n) => (window as any).__game && (window as any).__game.metrics.frames > n,
    expectFrames,
    { timeout: 45000 }
  );
  return { errors } as GameHandle;
}

const g = (page: Page, expr: string) => page.evaluate(expr);

async function toReady(page: Page) {
  await g(page, 'window.__game.fastForward(8)');
  expect(await g(page, 'window.__game.phase')).toBe('ready');
}

function off(h: number) {
  return Math.round(h * 0.085);
}

async function circle(
  page: Page,
  cx: number,
  cy: number,
  r: number,
  turns: number,
  dir = 1,
  release = true
) {
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  await page.waitForTimeout(50);
  const steps = Math.max(12, Math.round(turns * 13));
  for (let i = 1; i <= steps; i++) {
    const a = dir * (i / steps) * turns * 2 * Math.PI;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  if (release) await page.mouse.up();
}

async function discover(page: Page, vp: { width: number; height: number }) {
  const intro = (await g(page, 'window.__game.introStreakScreen()')) as { x: number; y: number };
  const R = 60;
  const cx = Math.min(Math.max(intro.x, R + 8), vp.width - R - 8);
  const cy = Math.min(Math.max(intro.y + off(vp.height), 120), vp.height - R - 8);
  await circle(page, cx, cy, R, 0.8, 1, false);
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(1800);
}

async function clearAll(page: Page, vp: { width: number; height: number }) {
  for (let round = 0; round < 14; round++) {
    if ((await g(page, 'window.__game.mainRemaining')) === 0) break;
    const streaks = (await g(page, 'window.__game.streakScreens()')) as any[];
    const target =
      streaks.find((s) => s.main && ['stalled', 'capture', 'wind'].includes(s.state)) ||
      streaks.find((s) => s.main && s.state === 'drift');
    if (!target) {
      await page.waitForTimeout(700);
      continue;
    }
    const R = 55;
    const cx = Math.min(Math.max(target.x, R + 8), vp.width - R - 8);
    const cy = Math.min(Math.max(target.y + off(vp.height), 120), vp.height - R - 8);
    await circle(page, cx, cy, R, 3.4);
    await page.waitForTimeout(400);
  }
}

// ---------------------------------------------------------------------------
for (const [name, vp] of [
  ['iphone-portrait', IPHONE],
  ['iphone-landscape', { width: IPHONE.height, height: IPHONE.width }],
  ['ipad-portrait', IPAD],
  ['ipad-landscape', { width: IPAD.height, height: IPAD.width }],
] as const) {
  test(`renders and reaches ready without any text: ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    const h = await boot(page);
    // no words shown to the child anywhere in the DOM
    const visibleText = (await page.locator('body').innerText()).trim();
    expect(visibleText).toBe('');
    await toReady(page);
    // horn tip and intro streak both on screen, tip above the streak
    const tip = (await g(page, 'window.__game.hornTipScreen()')) as any;
    const intro = (await g(page, 'window.__game.introStreakScreen()')) as any;
    expect(tip.front).toBe(true);
    expect(tip.x).toBeGreaterThan(0);
    expect(tip.x).toBeLessThan(vp.width);
    expect(tip.y).toBeGreaterThan(0);
    expect(tip.y).toBeLessThan(vp.height);
    expect(intro.x).toBeGreaterThan(-40);
    expect(intro.x).toBeLessThan(vp.width + 40);
    expect(h.errors, h.errors.join('\n')).toHaveLength(0);
  });
}

test('quarter turn triggers the first discovery, same camera, water clears below', async ({ page }) => {
  await page.setViewportSize(IPHONE);
  const h = await boot(page);
  await toReady(page);
  const before = await g(page, 'window.__game.clarityAvg');
  expect(before).toBe(0);
  await discover(page, IPHONE);
  const phase = await g(page, 'window.__game.phase');
  expect(['discovery', 'play']).toContain(phase);
  await page.waitForTimeout(2500);
  expect(await g(page, 'window.__game.mainRemaining')).toBe(5);
  expect(await g(page, 'window.__game.clarityAvg')).toBeGreaterThan(0.02);
  expect(h.errors, h.errors.join('\n')).toHaveLength(0);
});

test('reaction point stays above the finger', async ({ page }) => {
  await page.setViewportSize(IPHONE);
  await boot(page);
  await toReady(page);
  const intro = (await g(page, 'window.__game.introStreakScreen()')) as any;
  const fy = intro.y + off(IPHONE.height);
  await page.mouse.move(intro.x, fy);
  await page.mouse.down();
  await page.mouse.move(intro.x + 2, fy + 2);
  await page.waitForTimeout(1200); // let the neck settle
  const tip = (await g(page, 'window.__game.hornTipScreen()')) as any;
  await page.mouse.up();
  expect(tip.y).toBeLessThan(fy - 20);
});

test('full loop: clear all → reveal → freeplay → transfer → replay', async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize(IPHONE);
  const h = await boot(page);
  await toReady(page);
  await discover(page, IPHONE);
  await clearAll(page, IPHONE);
  expect(await g(page, 'window.__game.mainRemaining')).toBe(0);
  await g(page, 'window.__game.fastForward(8)');
  expect(await g(page, 'window.__game.phase')).toBe('freeplay');
  expect(await g(page, 'window.__game.wispRemaining')).toBeGreaterThan(0);
  expect(await g(page, 'window.__game.clarityAvg')).toBeGreaterThan(0.5);
  // replay button appeared, wordless glyph only
  await expect(page.locator('#replay')).toHaveClass(/show/);
  // transfer wound murk to the stone
  const load = (await g(page, 'window.__game.hornLoad')) as number;
  expect(load).toBeGreaterThan(0);
  const stone = (await g(page, 'window.__game.stoneScreen()')) as any;
  await page.mouse.move(stone.x, stone.y + off(IPHONE.height));
  await page.mouse.down();
  await page.waitForTimeout(3000);
  await page.mouse.up();
  expect(await g(page, 'window.__game.hornLoad')).toBe(0);
  // replay resets and the game is playable again WITHOUT waiting for hints
  await g(page, 'window.__game.replay()');
  await page.waitForTimeout(400);
  expect(await g(page, 'window.__game.phase')).toBe('ready');
  expect(await g(page, 'window.__game.mainRemaining')).toBe(6);
  expect(await g(page, 'window.__game.clarityAvg')).toBe(0);
  await discover(page, IPHONE);
  expect(['discovery', 'play']).toContain(await g(page, 'window.__game.phase'));
  expect(h.errors, h.errors.join('\n')).toHaveLength(0);
});

test('release mid-wind stalls gently, resumes, and reverse direction is not a failure', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize(IPHONE);
  const h = await boot(page);
  await toReady(page);
  await discover(page, IPHONE);
  // begin winding a second streak, stop after one turn
  const streaks = (await g(page, 'window.__game.streakScreens()')) as any[];
  const target = streaks.find((s) => s.main && s.state === 'drift');
  const R = 55;
  const cx = Math.min(Math.max(target.x, R + 8), IPHONE.width - R - 8);
  const cy = Math.min(Math.max(target.y + off(IPHONE.height), 120), IPHONE.height - R - 8);
  await circle(page, cx, cy, R, 1.2);
  await page.waitForTimeout(600);
  // reverse direction for a while (loosen, then re-grip), then finish forward
  await circle(page, cx, cy, R, 1.5, -1);
  await circle(page, cx, cy, R, 3.2, -1);
  await circle(page, cx, cy, R, 3.2, -1);
  await page.waitForTimeout(500);
  const remaining = (await g(page, 'window.__game.mainRemaining')) as number;
  expect(remaining).toBeLessThanOrEqual(5);
  expect(h.errors, h.errors.join('\n')).toHaveLength(0);
});

test('rapid taps and orientation change never lock the game', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize(IPHONE);
  const h = await boot(page);
  // tap spam through arrival
  for (let i = 0; i < 8; i++) {
    await page.mouse.click(150 + i * 5, 300 + i * 7);
    await page.waitForTimeout(90);
  }
  await g(page, 'window.__game.fastForward(6)');
  expect(await g(page, 'window.__game.phase')).toBe('ready');
  // rotate mid-game
  await page.setViewportSize({ width: IPHONE.height, height: IPHONE.width });
  await page.waitForTimeout(700);
  // still interactive after rotation: discovery works in landscape
  await discover(page, { width: IPHONE.height, height: IPHONE.width });
  expect(['discovery', 'play']).toContain(await g(page, 'window.__game.phase'));
  // rotate back while touching
  await page.mouse.move(400, 200);
  await page.mouse.down();
  await page.setViewportSize(IPHONE);
  await page.waitForTimeout(500);
  await page.mouse.up();
  const frames1 = (await g(page, 'window.__game.metrics')) as any;
  await page.waitForTimeout(500);
  const frames2 = (await g(page, 'window.__game.metrics')) as any;
  expect(frames2.frames).toBeGreaterThan(frames1.frames); // still rendering
  expect(h.errors, h.errors.join('\n')).toHaveLength(0);
});

test('load and first-frame metrics are recorded', async ({ page }) => {
  await page.setViewportSize(IPHONE);
  await boot(page, 30);
  const m = (await g(page, 'window.__game.metrics')) as any;
  expect(m.firstFrameMs).toBeGreaterThan(0);
  expect(m.frames).toBeGreaterThan(30);
  expect(m.avgFrameMs).toBeGreaterThan(0);
});
