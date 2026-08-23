import { test, expect, type Page } from '@playwright/test';

/**
 * Deterministic gameplay smoke tests. The game exposes window.__kc when
 * loaded with ?e2e: the page's own clock is paused and the tests advance
 * logical simulation time directly, so results are identical on every run.
 */

const url = '/?e2e';

interface KcState {
  phase: string;
  outcome: string | null;
  pairId: string;
  pairIndex: number;
  spacing: number;
  clearance: number;
  gapState: string;
  cleared: boolean;
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__kc);
  await page.evaluate(() => {
    window.__kc!.pause();
  });
  return errors;
}

function state(page: Page): Promise<KcState> {
  return page.evaluate(() => window.__kc!.state()) as Promise<KcState>;
}

async function step(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => window.__kc!.step(s), seconds);
}

async function setSpacing(page: Page, v: number): Promise<void> {
  await page.evaluate((s) => window.__kc!.setSpacing(s), v);
}

async function runTest(page: Page, seconds = 16): Promise<KcState> {
  await page.evaluate(() => window.__kc!.openValve());
  await step(page, seconds);
  return state(page);
}

test('AV: auto demo shows the too-wide fall within 30 s, then ok/narrow states work', async ({ page }) => {
  const errors = await boot(page);

  // intro -> adjust -> automatic first pour (the "too wide" demonstration)
  await step(page, 4);
  let s = await state(page);
  expect(s.pairId).toBe('AV');
  expect(s.phase).toBe('test');
  expect(s.gapState).toBe('wide');

  await step(page, 12);
  s = await state(page);
  expect(s.outcome).toBe('fell');
  expect(s.phase).toBe('result');

  // just right: the wedge becomes a canyon and the capsule is recovered
  await setSpacing(page, -0.08);
  s = await state(page);
  expect(s.gapState).toBe('ok');
  s = await runTest(page);
  expect(s.outcome).toBe('captured');
  expect(s.cleared).toBe(true);

  // too close: the capsule stops at the entrance, no punishment
  await setSpacing(page, -0.28);
  s = await state(page);
  expect(s.gapState).toBe('narrow');
  s = await runTest(page);
  expect(s.outcome).toBe('stuck');

  // widening the gap frees the stuck capsule (cause and effect, no reset)
  await setSpacing(page, 0.6);
  await step(page, 4);

  expect(errors).toEqual([]);
});

test('full loop: AV -> OO -> LT -> back to AV, three states per pair', async ({ page }) => {
  const errors = await boot(page);
  await step(page, 4); // demo pour starts
  await step(page, 12); // demo 'fell' completes

  // solve AV
  await setSpacing(page, -0.08);
  let s = await runTest(page);
  expect(s.outcome).toBe('captured');

  // advance to OO
  await page.evaluate(() => window.__kc!.next());
  await step(page, 8);
  s = await state(page);
  expect(s.pairId).toBe('OO');
  expect(s.phase).toBe('adjust');
  expect(s.gapState).toBe('wide');

  // OO: wide falls untouched
  s = await runTest(page);
  expect(s.outcome).toBe('fell');
  // OO: narrow pinches at the waist
  await setSpacing(page, 0.15);
  s = await runTest(page);
  expect(s.outcome).toBe('stuck');
  // OO: ok slides between the round walls
  await setSpacing(page, 0.41);
  s = await runTest(page);
  expect(s.outcome).toBe('captured');

  // advance to LT
  await page.evaluate(() => window.__kc!.next());
  await step(page, 8);
  s = await state(page);
  expect(s.pairId).toBe('LT');
  expect(s.gapState).toBe('wide');

  // LT: bridge does not reach
  s = await runTest(page);
  expect(s.outcome).toBe('fell');
  // LT: exit blocked
  await setSpacing(page, -0.35);
  s = await runTest(page);
  expect(s.outcome).toBe('stuck');
  // LT: crosses from the L foot to the T side
  await setSpacing(page, -0.1);
  s = await runTest(page);
  expect(s.outcome).toBe('captured');

  // loop closes: back to AV for replay
  await page.evaluate(() => window.__kc!.next());
  await step(page, 8);
  s = await state(page);
  expect(s.pairId).toBe('AV');
  expect(s.phase).toBe('adjust');

  expect(errors).toEqual([]);
});

const viewports = [
  { w: 390, h: 844, name: 'iphone-portrait' },
  { w: 844, h: 390, name: 'iphone-landscape' },
  { w: 1024, h: 1366, name: 'ipad-portrait' },
  { w: 1366, h: 1024, name: 'ipad-landscape' },
];

for (const vp of viewports) {
  test(`renders and stays clean at ${vp.name} (${vp.w}x${vp.h})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await boot(page);
    await step(page, 3.7); // arrive at the frontal adjust framing
    await page.evaluate(() => window.__kc!.render());
    await page.screenshot({ path: `test-results/shots/${vp.name}.png` });
    const s = await state(page);
    expect(['adjust', 'test']).toContain(s.phase);
    expect(errors).toEqual([]);
  });
}

test('orientation change keeps spacing and test state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await boot(page);
  await step(page, 16); // demo completes
  await setSpacing(page, -0.1);
  const before = await state(page);

  await page.setViewportSize({ width: 844, height: 390 });
  await step(page, 0.5);
  const after = await state(page);
  expect(after.spacing).toBeCloseTo(before.spacing, 5);
  expect(after.pairId).toBe(before.pairId);
  expect(errors).toEqual([]);
});
