import { test, expect, type Page } from '@playwright/test';

interface Debug {
  phase: string;
  shot: string;
  collected: number;
  row: number;
  rowGrabs: number;
  machine: { x: number; z: number };
  crate: number;
  parked: number;
  frames: number;
  states: string[];
  standing: number[];
  timeScale: number;
  windowAmount: number;
}

declare global {
  interface Window {
    __GAME__?: {
      ready: boolean;
      error?: string;
      debug: () => Debug;
      tap: () => void;
      steer: (m: number) => void;
      simulate: (seconds: number) => void;
    };
  }
}

const errors: string[] = [];

async function boot(page: Page) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?noadapt', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME__?.ready === true, null, { timeout: 60_000 });
}

const debug = (page: Page) => page.evaluate(() => window.__GAME__!.debug());
const sim = (page: Page, s: number) => page.evaluate((v) => window.__GAME__!.simulate(v), s);
const tap = (page: Page) => page.evaluate(() => window.__GAME__!.tap());

/** Advance logical time until `pred` holds, or give up after `limit` seconds. */
async function until(page: Page, pred: (d: Debug) => boolean, limit = 90) {
  let t = 0;
  let d = await debug(page);
  while (t < limit && !pred(d)) {
    await sim(page, 0.25);
    d = await debug(page);
    t += 0.25;
  }
  return d;
}

test('boots, renders and waits for the player to lower the head', async ({ page }) => {
  await boot(page);
  const d = await debug(page);
  expect(d.phase).toBe('ready');
  expect(d.shot).toBe('establish');
  expect(d.standing.reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
  // the canvas is actually painting, not a blank page
  await page.waitForFunction(() => (window.__GAME__!.debug() as { frames: number }).frames > 2);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('one tap runs the whole chain: grab, pull, cut, crate', async ({ page }) => {
  await boot(page);
  await tap(page);

  const grabbed = await until(page, (d) => d.rowGrabs > 0, 30);
  expect(grabbed.rowGrabs).toBeGreaterThan(0);

  // every stage of the chain shows up while the row is being worked
  const seen = new Set<string>();
  for (let i = 0; i < 220; i++) {
    await sim(page, 0.1);
    const d = await debug(page);
    d.states.forEach((s) => seen.add(s));
    if (d.collected >= 3) break;
  }
  for (const stage of ['grab', 'strain', 'pop', 'ride', 'convey']) {
    expect(seen, `missing stage ${stage} (saw ${[...seen].join(',')})`).toContain(stage);
  }

  const d = await debug(page);
  expect(d.collected).toBeGreaterThanOrEqual(3);
  expect(d.crate).toBeGreaterThanOrEqual(3);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the camera cuts to the close-up, the conveyor and the crate', async ({ page }) => {
  await boot(page);
  await tap(page);
  const shots = new Set<string>();
  let sawSlowMotion = false;
  let sawSoilWindow = false;
  for (let i = 0; i < 500; i++) {
    await sim(page, 0.08);
    const d = await debug(page);
    shots.add(d.shot);
    if (d.timeScale < 0.6) sawSlowMotion = true;
    if (d.windowAmount > 0.5) sawSoilWindow = true;
    if (shots.has('heroPull') && shots.has('conveyor') && shots.has('crateDrop')) break;
  }
  expect([...shots]).toEqual(expect.arrayContaining(['work', 'heroPull', 'conveyor', 'crateDrop']));
  expect(sawSlowMotion).toBe(true);
  expect(sawSoilWindow).toBe(true);
});

test('a row finishes, the crate is parked and the next row starts', async ({ page }) => {
  await boot(page);
  await tap(page);

  const end = await until(page, (d) => d.phase === 'rowend', 140);
  expect(end.phase).toBe('rowend');
  expect(end.shot).toBe('rowEnd');
  expect(end.standing[end.row]).toBe(0);
  expect(end.crate).toBeGreaterThan(10);

  const next = await until(page, (d) => d.phase === 'ready' && d.rowGrabs === 0, 30);
  expect(next.phase).toBe('ready');
  expect(next.parked).toBe(1);
  expect(next.crate).toBe(0);
  expect(next.machine.z).toBeLessThan(0);

  // and it is immediately playable again
  await tap(page);
  const again = await until(page, (d) => d.collected > end.collected, 60);
  expect(again.collected).toBeGreaterThan(end.collected);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('steering moves between ridges and still harvests', async ({ page }) => {
  await boot(page);
  await tap(page);
  await until(page, (d) => d.rowGrabs > 1, 30);
  const before = await debug(page);

  await page.evaluate(() => window.__GAME__!.steer(1.5));
  await sim(page, 2.5);
  const after = await debug(page);
  expect(Math.abs(after.machine.x - before.machine.x)).toBeGreaterThan(1.0);

  // the machine settles onto a ridge centre and keeps pulling roots
  const harvesting = await until(page, (d) => d.collected > before.collected + 1, 40);
  expect(harvesting.collected).toBeGreaterThan(before.collected + 1);
  const nearestRidge = Math.round(harvesting.machine.x / 1.5) * 1.5;
  expect(Math.abs(harvesting.machine.x - nearestRidge)).toBeLessThan(0.2);
});

test('survives a rotation mid-run', async ({ page }, testInfo) => {
  await boot(page);
  await tap(page);
  await until(page, (d) => d.collected > 0, 60);

  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.height, height: size.width });
  await page.waitForTimeout(400);
  await sim(page, 3);
  const d = await debug(page);
  expect(d.phase === 'running' || d.phase === 'rowend').toBe(true);

  await page.setViewportSize(size);
  await page.waitForTimeout(400);
  await sim(page, 3);
  const back = await debug(page);
  expect(back.collected).toBeGreaterThanOrEqual(d.collected);
  expect(errors, errors.join('\n')).toEqual([]);
  await testInfo.attach('after-rotation', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('never dead-ends: no input at all still starts and keeps going', async ({ page }) => {
  await boot(page);
  // never tap; the head must lower by itself
  const started = await until(page, (d) => d.phase === 'running', 30);
  expect(started.phase).toBe('running');
  const picked = await until(page, (d) => d.collected > 2, 60);
  expect(picked.collected).toBeGreaterThan(2);
});
