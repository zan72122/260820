import { test, expect } from '@playwright/test';

const FAST = process.env.E2E_FAST === '1';
const URL = FAST ? '/?fast=1' : '/?q=mid';

/** Traces a real circle over the handle, the way a finger does. */
async function crank(page, turns, msPerStep = 22, steps = 16) {
  const c = await page.evaluate(() => {
    const cam = window.__game.camera;
    const V3 = cam.position.constructor;
    const cen = { x: 0.072911, y: 0.4460 + 0.03, z: -0.028 };
    const pr = (p) => {
      const o = new V3(p.x, p.y, p.z); o.project(cam);
      return { x: (o.x * 0.5 + 0.5) * window.innerWidth, y: (-o.y * 0.5 + 0.5) * window.innerHeight };
    };
    const c0 = pr(cen);
    const cx = pr({ ...cen, x: cen.x + 0.095 });
    const cz = pr({ ...cen, z: cen.z + 0.095 });
    return { c0, ax: { x: cx.x - c0.x, y: cx.y - c0.y }, az: { x: cz.x - c0.x, y: cz.y - c0.y } };
  });
  const at = (t) => ({
    x: c.c0.x + c.ax.x * Math.cos(t) + c.az.x * Math.sin(t),
    y: c.c0.y + c.ax.y * Math.cos(t) + c.az.y * Math.sin(t),
  });
  const phase0 = crank._phase || 0;
  let p = at(phase0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const total = Math.round(turns * steps);
  for (let i = 1; i <= total; i++) {
    const t = phase0 + (i / steps) * Math.PI * 2;
    p = at(t);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(msPerStep);
  }
  crank._phase = phase0 + (total / steps) * Math.PI * 2;
  await page.mouse.up();
}

const state = (page) => page.evaluate(() => ({
  state: window.__game.state,
  fill: window.__game.mound.fill,
  peak: window.__game.mound.peak,
  locked: window.__game.iceLocked,
  first: window.__game.firstFlakeDone,
  worn: window.__game.ice.wornFraction,
  poured: window.__game.poured,
}));

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  page.__errors = errors;
});

test('boots, and the machine is a question before it is a tool', async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await expect(page.locator('#err')).toBeHidden();
  await page.$eval('#startbtn', (el) => el.click());
  await page.waitForTimeout(600);
  const s = await state(page);
  expect(s.state).toBe('idle');
  expect(s.fill).toBe(0);
  // nothing on screen tells the player what to do
  const body = await page.evaluate(() => document.body.innerText);
  expect(body).not.toMatch(/回して|まわして|タップ|ドラッグ/);
  expect(page.__errors).toEqual([]);
});

test('handle -> ice turns -> one flake -> a pile grows', async ({ page }) => {
  test.setTimeout(300000);
  await page.goto(URL);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await page.$eval('#startbtn', (el) => el.click());
  await page.waitForTimeout(400);

  // a quarter turn: the mechanism takes up its slack, the ice has not caught yet
  await crank(page, 0.25);
  let s = await state(page);
  expect(s.state).toBe('engaging');
  expect(s.locked).toBe(false);
  expect(s.fill).toBe(0);

  // keep going: the claws bite, the block turns, and one flake comes off
  await crank(page, 0.9);
  await page.waitForTimeout(300);
  s = await state(page);
  expect(s.locked).toBe(true);
  expect(s.first).toBe(true);

  // free shaving from here; the pile has to actually grow
  const before = (await state(page)).fill;
  await crank(page, 3.0);
  s = await state(page);
  expect(s.fill).toBeGreaterThan(before);
  expect(s.peak).toBeGreaterThan(0.004);
  expect(s.worn).toBeGreaterThan(0);
  expect(page.__errors).toEqual([]);
});

test('a full bowl moves the camera to the syrup, and pouring colours the ice', async ({ page }) => {
  test.setTimeout(420000);
  await page.goto(URL);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await page.$eval('#startbtn', (el) => el.click());
  await page.waitForTimeout(400);

  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s.state === 'to_syrup' || s.state === 'syrup') break;
    await crank(page, 2.0, 14);
    await page.waitForTimeout(250);   // a hand does pause between turns
  }
  await page.waitForTimeout(2500);
  let s = await state(page);
  expect(['to_syrup', 'syrup']).toContain(s.state);
  expect(s.fill).toBeGreaterThan(0.7);

  // pick up a bottle and drag it over the pile. The pour point sits above the
  // finger on screen so a hand never covers it, so the finger must aim low.
  const screenOf = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__game;
    const V3 = g.camera.position.constructor;
    const p = new V3(x, y, z); p.project(g.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
  }, [x, y, z]);

  const bottle = await page.evaluate(() => {
    const b = window.__game.syrup.bottles[0];
    return [b.group.position.x, b.group.position.y + 0.05, b.group.position.z];
  });
  const grab = await screenOf(...bottle);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => !!window.__game.input.heldBottle)).toBe(true);

  const peak = await page.evaluate(() => [0, window.__game.mound.baseY + window.__game.mound.peak + 0.055, window.__game.mound.cz]);
  const aim = await screenOf(...peak);
  const lift = 0.10 * page.viewportSize().height;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const grow = 0.35 + i / 42;
    await page.mouse.move(aim.x + Math.cos(a) * 30 * grow, aim.y + lift + Math.sin(a) * 15 * grow);
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
  s = await state(page);
  expect(s.poured).toBeGreaterThan(0);

  // the colour has to be on the ice, not just in a variable
  const painted = await page.evaluate(() => {
    const g = window.__game, N = g.sim.size;
    const arr = g.sim.type === 1016 ? new Uint16Array(4 * N * N) : new Uint8Array(4 * N * N);
    g.renderer.readRenderTargetPixels(g.sim.soak[g.sim.cur], 0, 0, N, N, arr);
    let n = 0;
    for (let i = 3; i < arr.length; i += 4) if (arr[i] !== 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(0);
  expect(page.__errors).toEqual([]);
});

test('portrait keeps the whole machine readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await page.$eval('#startbtn', (el) => el.click());
  await page.waitForTimeout(700);
  const box = await page.evaluate(() => {
    const g = window.__game;
    const V3 = g.camera.position.constructor;
    const pts = [
      [0.072911 + 0.095, 0.478, -0.028],   // the grip at its outermost
      [0.072911 - 0.095, 0.478, -0.028],
      [0, 0.3425, 0.004],                   // top of the block
      [0, 0.0, 0.05],                       // the bowl on the counter
    ];
    return pts.map(([x, y, z]) => {
      const p = new V3(x, y, z); p.project(g.camera);
      return [p.x, p.y];
    });
  });
  for (const [x, y] of box) {
    expect(Math.abs(x)).toBeLessThan(1.0);
    expect(Math.abs(y)).toBeLessThan(1.0);
  }
  expect(page.__errors).toEqual([]);
});
