import { test, expect, Page } from '@playwright/test';

/**
 * Chromium smoke E2E for「ユニコーンと虹糸の橋」.
 * Uses ?e2e=1: fixed seed, fixed 1/60 step, audio off, plus the __game driver
 * API (each driver call is gesture-equivalent, no hidden shortcuts).
 */

declare global {
  interface Window {
    __game: any;
    __tick: (frames: number) => void;
  }
}

async function boot(page: Page): Promise<void> {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  (page as any)._consoleErrors = consoleErrors;
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => !!window.__game && !!window.__tick, undefined, { timeout: 20_000 });
  await page.evaluate(() => window.__tick(30));
}

function errsOf(page: Page): string[] {
  return (page as any)._consoleErrors as string[];
}

test('boots without console errors and reaches DISCOVER', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__tick(60));
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
  const gameErrors = await page.evaluate(() => window.__game.errors);
  expect(gameErrors).toEqual([]);
  expect(errsOf(page)).toEqual([]);
});

test('first quarter-turn moves thread from droplet to horn', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
  const before = await page.evaluate(() => window.__game.droplets());
  const hooked = await page.evaluate(() => window.__game.hookFirst());
  expect(hooked).toBe(true);
  await page.evaluate(() => { window.__tick(30); });
  expect(await page.evaluate(() => window.__game.state())).toBe('FIRSTWIND');
  // quarter of a finger circle = one wrap
  await page.evaluate(() => { window.__game.wind(1, 1.0); window.__tick(10); });
  const coils = await page.evaluate(() => window.__game.coils());
  expect(coils.length).toBe(1);
  expect(coils[0].turns).toBeGreaterThan(0.9);
  const after = await page.evaluate(() => window.__game.droplets());
  const sumBefore = before.reduce((s: number, d: any) => s + d.left, 0);
  const sumAfter = after.reduce((s: number, d: any) => s + d.left, 0);
  expect(sumAfter).toBeLessThan(sumBefore); // the raindrop really lost thread
  expect(await page.evaluate(() => window.__game.state())).toBe('COLLECT');
});

test('reverse unwinds and returns thread to the droplet; state never breaks', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
  await page.evaluate(() => { window.__game.hookFirst(); window.__game.wind(2, 1.0); window.__tick(5); });
  const t1 = await page.evaluate(() => window.__game.totalTurns());
  await page.evaluate(() => { window.__game.reverse(1); window.__tick(5); });
  const t2 = await page.evaluate(() => window.__game.totalTurns());
  expect(t2).toBeLessThan(t1);
  // hammer it: over-reverse, over-wind, reverse at zero
  await page.evaluate(() => {
    window.__game.reverse(99);
    window.__game.reverse(99);
    window.__game.wind(99, 9);
    window.__tick(30);
  });
  const gameErrors = await page.evaluate(() => window.__game.errors);
  expect(gameErrors).toEqual([]);
});

test('winding speed is recorded in the lay of the coils', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
  await page.evaluate(() => { window.__game.hookFirst(); window.__game.wind(2.5, 0.8); window.__tick(5); });
  await page.evaluate(() => { window.__game.hookFirst(); window.__game.wind(2.5, 4.5); window.__tick(5); });
  const coils = await page.evaluate(() => window.__game.coils());
  expect(coils.length).toBeGreaterThanOrEqual(2);
  expect(coils[0].wav).toBeLessThan(0.15);        // slow → tidy
  expect(coils[coils.length - 1].wav).toBeGreaterThan(0.5); // fast → wavy
});

test('full causal chain: collect → anchor → span (stepwise) → weave → close → test → cross', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');

  const turns = await page.evaluate(() => window.__game.collectAll());
  expect(turns).toBeGreaterThanOrEqual(10);

  await page.evaluate(() => { window.__game.forceAnchor(); window.__tick(10); });
  expect(await page.evaluate(() => window.__game.state())).toBe('SPAN');

  // bridge building is stepwise, not a single cutscene trigger:
  // each line needs repeated pay() increments before it locks
  for (let line = 0; line < 4; line++) {
    let locked = false;
    for (let i = 0; i < 12 && !locked; i++) {
      locked = await page.evaluate(() => window.__game.pay(0.12));
      await page.evaluate(() => window.__tick(3));
    }
    expect(locked).toBe(true);
  }
  expect(await page.evaluate(() => window.__game.state())).toBe('WEAVE');
  const br1 = await page.evaluate(() => window.__game.bridge());
  expect(br1.lines.length).toBe(4);
  expect(br1.lines.every((l: any) => l.locked)).toBe(true);

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { window.__game.weave(0.2); window.__tick(3); });
  }
  expect(await page.evaluate(() => window.__game.state())).toBe('CLOSE');
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { window.__game.close(0.2); window.__tick(3); });
  }
  expect(await page.evaluate(() => window.__game.state())).toBe('TEST');
  const br2 = await page.evaluate(() => window.__game.bridge());
  expect(br2.deck).toBeGreaterThanOrEqual(1);

  // hoof test: deck must respond to load
  // (drive time purely via __tick — real RAF is starved under SwiftShader)
  const restY = await page.evaluate(() => window.__game.deckYAt(0.5));
  await page.evaluate(() => { window.__game.test(); });
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__tick(30));
    if (await page.evaluate(() => window.__game.state()) === 'CROSSREADY') break;
  }
  expect(await page.evaluate(() => window.__game.state())).toBe('CROSSREADY');

  await page.evaluate(() => { window.__game.cross(); });
  // deck should dip under her weight at some point during crossing
  let dipped = false;
  for (let i = 0; i < 200; i++) {
    await page.evaluate(() => window.__tick(10));
    const dy = await page.evaluate(() => window.__game.deckYAt(0.5));
    if (restY - dy > 0.004) dipped = true;
    if (await page.evaluate(() => window.__game.state()) === 'AFTER') break;
  }
  expect(await page.evaluate(() => window.__game.state())).toBe('AFTER');
  expect(dipped).toBe(true);

  const pos = await page.evaluate(() => window.__game.unicornPos());
  expect(pos.z).toBeLessThan(-7); // she is on the far side, across the real bridge

  const gameErrors = await page.evaluate(() => window.__game.errors);
  expect(gameErrors).toEqual([]);
  expect(errsOf(page)).toEqual([]);
});

test('pointer circle gesture winds after hooking (touch path, portrait)', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
  await page.evaluate(() => { window.__game.hookFirst(); window.__tick(120); });
  // draw circles on screen
  const cx = 195, cy = 350, r = 70;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let k = 0; k < 3 * 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    if (k % 6 === 0) await page.evaluate(() => window.__tick(2));
  }
  await page.mouse.up();
  await page.evaluate(() => window.__tick(10));
  const total = await page.evaluate(() => window.__game.totalTurns());
  expect(total).toBeGreaterThan(0.5);   // circles really wind thread
});
