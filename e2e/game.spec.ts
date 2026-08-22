import { test, expect, type Page } from '@playwright/test';

/**
 * Test protocol from the spec, driven through the deterministic hook
 * surface plus real synthetic touch gestures. Runs against the production
 * preview build with E2E profile (?e2e=1: DPR 1, intro skipped).
 */

declare global {
  interface Window {
    __pinForest: {
      state(): string;
      depth(): number;
      setDepth(d: number): void;
      boundaries(): number[];
      aligned(): boolean;
      plugAngle(): number;
      boltProgress(): number;
      doorAngle(): number;
      keyIndex(): number;
      playCount(): number;
      selectKey(i: number): void;
      rotateTo(rad: number): void;
      pullDoor(): void;
      advance(seconds: number): void;
      skipCinematic(): void;
      freePlay(): void;
      returnKey(): void;
      ready: boolean;
    };
  }
}

async function boot(page: Page, url = '/?e2e=1'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__pinForest?.ready === true);
  await page.evaluate(() => window.__pinForest.advance(0.5));
}

const pf = <T>(page: Page, expr: string): Promise<T> =>
  page.evaluate(`window.__pinForest.${expr}`) as Promise<T>;

async function completeFirstPlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const h = window.__pinForest;
    h.setDepth(1);
    h.advance(0.5);
    h.rotateTo(1.6);
    h.advance(2.2);
    h.skipCinematic();
    h.advance(0.4);
    h.pullDoor();
    h.advance(2.4);
    h.skipCinematic();
    h.advance(0.4);
  });
}

test('half-inserted key does not turn (elastic only)', async ({ page }) => {
  await boot(page);
  expect(await pf(page, 'state()')).toBe('KEY_PARTIAL');
  expect(await pf(page, 'depth()')).toBeLessThan(0.5);
  // several boundaries still cross the shear line
  expect(await pf(page, 'aligned()')).toBe(false);
  // try to turn: only a few degrees of elastic give, then springback
  await page.evaluate(() => {
    window.__pinForest.rotateTo(1.5);
    window.__pinForest.advance(0.12);
  });
  const during = await pf(page, 'plugAngle()');
  expect(during).toBeLessThan(0.08); // ≤ ~4.5°
  await page.evaluate(() => window.__pinForest.advance(1.2));
  expect(await pf(page, 'plugAngle()')).toBeLessThan(0.01);
  expect(await pf(page, 'state()')).toBe('KEY_PARTIAL');
});

test('full insertion aligns every boundary at the shear line', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__pinForest.setDepth(1);
    window.__pinForest.advance(0.5);
  });
  const bounds = await pf(page, 'boundaries()');
  expect(bounds).toHaveLength(5);
  for (const b of bounds) expect(Math.abs(b)).toBeLessThan(0.0006);
  expect(await pf(page, 'aligned()')).toBe(true);
  expect(await pf(page, 'state()')).toBe('PINS_ALIGNED');
});

test('key can stop anywhere mid-travel and hold that pin pattern', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__pinForest.setDepth(0.63);
    window.__pinForest.advance(1.0);
  });
  const a = await pf(page, 'boundaries()');
  await page.evaluate(() => window.__pinForest.advance(1.0));
  const b = await pf(page, 'boundaries()');
  expect(b).toEqual(a); // deterministic, held in place
  expect(await pf(page, 'depth()')).toBeCloseTo(0.63, 5);
});

test('pulling back replays the wave in reverse (depth-symmetric model)', async ({ page }) => {
  await boot(page);
  const at = async (d: number) => {
    await page.evaluate(
      (depth) => {
        window.__pinForest.setDepth(depth);
        window.__pinForest.advance(0.3);
      },
      d
    );
    return pf(page, 'boundaries()');
  };
  const fwd = await at(0.7);
  await at(1.0);
  const back = await at(0.7); // pulled back to the same depth
  expect(back).toEqual(fwd);
  // and pins actually move between depths
  const shallow = await at(0.45);
  expect(shallow).not.toEqual(fwd);
});

test('real swipe gesture inserts the key (touchscreen)', async ({ page }) => {
  await boot(page);
  const before = await pf(page, 'depth()');
  // swipe along the insertion axis (screen-projected; diagonal is fine)
  const vp = page.viewportSize()!;
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  await page.mouse.move(cx + 120, cy + 60);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(cx + 120 - i * 24, cy + 60 - i * 8);
    await page.evaluate(() => window.__pinForest.advance(0.03));
  }
  await page.mouse.up();
  await page.evaluate(() => window.__pinForest.advance(0.3));
  const after = await pf(page, 'depth()');
  expect(Math.abs(after - before)).toBeGreaterThan(0.05);
});

test('only the correct key lets the plug rotate; bolt retracts into the door', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__pinForest.setDepth(1);
    window.__pinForest.advance(0.4);
    window.__pinForest.rotateTo(1.6);
    window.__pinForest.advance(2.2);
  });
  expect(await pf(page, 'plugAngle()')).toBeGreaterThan(1.4);
  expect(await pf(page, 'boltProgress()')).toBeGreaterThan(0.98);
  const st = await pf(page, 'state()');
  expect(['PLUG_ROTATING', 'BOLT_RETRACTING']).toContain(st);
  // door pops slightly and opens after a pull
  await page.evaluate(() => {
    window.__pinForest.skipCinematic();
    window.__pinForest.advance(0.4);
    window.__pinForest.pullDoor();
    window.__pinForest.advance(2.4);
  });
  expect(await pf(page, 'state()')).toBe('DOOR_OPEN');
  expect(await pf(page, 'doorAngle()')).toBeGreaterThan(0.45);
});

test('a second key produces a different pin picture and does not open', async ({ page }) => {
  await boot(page);
  await completeFirstPlay(page);
  expect(await pf(page, 'playCount()')).toBe(1);
  await page.evaluate(() => {
    window.__pinForest.returnKey();
    window.__pinForest.advance(1.2);
    window.__pinForest.selectKey(1);
    window.__pinForest.advance(1.0);
    window.__pinForest.skipCinematic();
    window.__pinForest.setDepth(1);
    window.__pinForest.advance(0.5);
  });
  const bounds = await pf(page, 'boundaries()');
  // front stack clearly below the line, the rest seated
  expect(bounds[0]!).toBeLessThan(-0.002);
  for (let i = 1; i < 5; i++) expect(Math.abs(bounds[i]!)).toBeLessThan(0.0006);
  expect(await pf(page, 'aligned()')).toBe(false);
  // and it does not turn
  await page.evaluate(() => {
    window.__pinForest.rotateTo(1.6);
    window.__pinForest.advance(1.5);
  });
  expect(await pf(page, 'plugAngle()')).toBeLessThan(0.08);
});

test('orientation change preserves insertion depth and pin state', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__pinForest.setDepth(0.58);
    window.__pinForest.advance(0.5);
  });
  const before = await pf(page, 'boundaries()');
  await page.setViewportSize({ width: 844, height: 390 }); // rotate to landscape
  await page.evaluate(() => window.__pinForest.advance(0.5));
  expect(await pf(page, 'depth()')).toBeCloseTo(0.58, 5);
  expect(await pf(page, 'boundaries()')).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 }); // and back
  await page.evaluate(() => window.__pinForest.advance(0.5));
  expect(await pf(page, 'depth()')).toBeCloseTo(0.58, 5);
});

test('state survives leaving and reopening the app', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__pinForest.setDepth(0.66);
    window.__pinForest.advance(1.0);
  });
  // fire the visibility persistence path, then reload (same origin storage)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.reload();
  await page.waitForFunction(() => window.__pinForest?.ready === true);
  await page.evaluate(() => window.__pinForest.advance(0.5));
  expect(await pf(page, 'depth()')).toBeCloseTo(0.66, 2);
  expect(await pf(page, 'state()')).toBe('KEY_PARTIAL');
});

test('free play is reachable within two taps and allows endless back-and-forth', async ({ page }) => {
  await boot(page);
  await completeFirstPlay(page);
  // tap 1: the free-play button
  await page.locator('#pf-free').tap();
  await page.evaluate(() => window.__pinForest.advance(1.0));
  // tap 2: pick a key from the tray
  await page.locator('.pf-card').nth(2).tap();
  await page.evaluate(() => {
    window.__pinForest.advance(1.5);
    window.__pinForest.skipCinematic();
  });
  expect(await pf(page, 'keyIndex()')).toBe(2);
  // endless back-and-forth
  for (const d of [0.9, 0.3, 1.0, 0.5, 1.0]) {
    await page.evaluate(
      (depth) => {
        window.__pinForest.setDepth(depth);
        window.__pinForest.advance(0.2);
      },
      d
    );
  }
  const st = await pf(page, 'state()');
  expect(['KEY_PARTIAL', 'KEY_FULL', 'KEY_INSERTING']).toContain(st);
});
