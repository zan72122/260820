import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });
const URL_BASE = process.env.URL || 'http://localhost:4173/';
const Q = process.env.Q || '';

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const shot = (page, name, tag) => page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
const state = (page) => page.evaluate(() => window.__probe?.state());

async function waitFor(page, fn, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await state(page);
    if (s && fn(s)) return s;
    await page.waitForTimeout(500);
  }
  return null;
}

async function dragPath(page, pts, stepMs = 40) {
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

async function run(page, name) {
  await page.waitForFunction(() => document.querySelector('#start-btn')?.classList.contains('ready'), null, {
    timeout: 90000,
  });
  await shot(page, name, '00-start');
  await page.locator('#start-btn').dispatchEvent('click');
  await page.waitForTimeout(1500);
  await shot(page, name, '01-establish');
  await page.waitForTimeout(5000);
  await shot(page, name, '02-gate-mid');

  // open the sluice by dragging its handle upward
  const h = await page.evaluate(() => window.__probe.handleScreen());
  const pts = [{ x: h.x, y: h.y }];
  for (let i = 1; i <= 16; i++) pts.push({ x: h.x, y: h.y - i * 10 });
  await dragPath(page, pts, 35);
  await shot(page, name, '03-gate-open');

  const opened = await waitFor(page, (s) => s.gateOpen > 0.3, 5000);
  await page.waitForTimeout(3000);
  await shot(page, name, '04-flow');

  // wait until free play unlocks the digging tool
  await waitFor(page, (s) => s.toolsShown, 40000);
  await shot(page, name, '05-tools');

  // carve a channel from the first hollow down to the pond
  const info = await state(page);
  const path = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = info.hollowU + (info.pondU - info.hollowU) * t + Math.sin(t * 3.1) * 0.07;
    const v = info.hollowV + (info.pondV - 0.03 - info.hollowV) * t;
    path.push(await page.evaluate(([a, b]) => window.__probe.project(a, b), [u, v]));
  }
  await dragPath(page, path, 55);
  await page.waitForTimeout(1500);
  await shot(page, name, '06-dug');
  // a second, slower pass to deepen the groove
  await dragPath(page, path, 45);
  await page.waitForTimeout(6000);
  await shot(page, name, '07-flowing');

  const arrived = await waitFor(page, (s) => s.arrived, 60000);
  await page.waitForTimeout(2500);
  await shot(page, name, '08-pond');

  // rotate the device mid-play: terrain, water and repairs must survive
  const before = await state(page);
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(2500);
  await shot(page, name, '09-rotated');
  const after = await state(page);
  await page.setViewportSize(vp);
  await page.waitForTimeout(1500);

  // picture menu: two taps back to the same gate and channel
  await page.click('#btn-menu');
  await page.waitForTimeout(700);
  await shot(page, name, '10-menu');
  await page.click('.card');
  await page.waitForTimeout(1800);
  await shot(page, name, '11-again');

  const final = await state(page);
  final.rotate = { before, after };
  fs.writeFileSync(
    `${OUT}/${name}-probe.json`,
    JSON.stringify({ opened, arrived: !!arrived, final }, null, 2),
  );
  return final;
}

async function session(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(URL_BASE + Q, { waitUntil: 'load' });
  let final = null;
  try {
    final = await run(page, name);
  } catch (e) {
    errs.push('run: ' + e.message);
  }
  await page.close();
  await ctx.close();
  return { errs, final };
}

const only = process.env.ONLY;
const cases = [
  ['iphone', { width: 390, height: 844 }],
  ['iphone-land', { width: 844, height: 390 }],
  ['ipad', { width: 834, height: 1112 }],
].filter(([n]) => !only || n === only);

const out = {};
for (const [name, vp] of cases) out[name] = await session(name, vp);
await browser.close();
console.log(JSON.stringify(out, null, 2));
