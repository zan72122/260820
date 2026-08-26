// Drive the game in Chromium and write screenshots. This is the試遊 harness:
// it plays, waits for real game states, and captures what a child would see.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  'iphone-portrait':  { width: 393, height: 852, dpr: 3 },
  'iphone-landscape': { width: 852, height: 393, dpr: 3 },
  'ipad-portrait':    { width: 820, height: 1180, dpr: 2 },
  'ipad-landscape':   { width: 1180, height: 820, dpr: 2 }
};

const only = process.argv[2];

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

const errors = [];
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  if (only && !name.includes(only)) continue;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });

  await page.goto(`${BASE}/?fast=1&q=high&seed=4242`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__toami, null, { timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 });
  await page.waitForTimeout(400);

  const shot = async (tag) => {
    await page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), timeout: 90000 });
  };

  // Step until the game reaches a phase, so screenshots land on the beat they
  // are named after rather than on whatever the clock happened to hit.
  const until = (phase, cap = 6) => page.evaluate(([ph, c]) => {
    const T = window.__toami;
    let t = 0;
    while (t < c) { const s = T.advance(1 / 30); t += 1 / 30; if (s.netPhase === ph) return s; }
    return T.state;
  }, [phase, cap]);

  // 1) opening: what the player meets before touching anything
  await page.evaluate(() => window.__toami.advance(2.0));
  await shot('01-open');

  // 2) mid-flight bloom
  await page.evaluate(() => window.__toami.cast({ distance: 8.5, azimuth: 0.18, sharpness: 0.7, smoothness: 0.85, wobble: 0.2 }));
  await page.evaluate(() => window.__toami.advance(0.55));
  await shot('02-bloom');

  // 3) the circle touching the water — caught on the frame it lands
  await until('splash');
  await page.evaluate(() => window.__toami.advance(0.14));
  await shot('03-splash');

  // 4) sunk: the cone under the surface
  await page.evaluate(() => window.__toami.advance(1.8));
  await shot('04-sunk');

  // 5) hauling, dripping — a beat after the bag clears the surface
  await page.evaluate(() => window.__toami.haul());
  await page.evaluate(() => window.__toami.advance(1.25));
  await shot('05-haul');

  // 6) back at rest, net now wet
  await page.evaluate(() => window.__toami.advance(2.5));
  await shot('06-rest');

  // 7) a long, soft cast into the deeper blue
  await page.evaluate(() => window.__toami.cast({ distance: 11.5, azimuth: -0.3, sharpness: 0.95, smoothness: 0.6, wobble: 0.7 }));
  await page.evaluate(() => window.__toami.advance(1.05));
  await shot('07-far');
  await page.evaluate(() => window.__toami.advance(2.0));
  await shot('08-far-sunk');

  // 9) a gentle short cast into the shallow
  await page.evaluate(() => window.__toami.haul());
  await page.evaluate(() => window.__toami.advance(9.0));
  await page.evaluate(() => window.__toami.cast({ distance: 4.2, azimuth: 0.05, sharpness: 0.15, smoothness: 0.95, wobble: 0.05 }));
  await page.evaluate(() => window.__toami.advance(3.2));
  await shot('09-shallow');

  // 10) a fish in the pail, being looked at
  await page.evaluate(() => window.__toami.haul());
  await page.evaluate(() => window.__toami.advance(2.6));
  await page.evaluate(() => {
    const g = window.__toami.game;
    if (g.state !== 'observe') {
      g.fishes.putInTank(g.tank.center, 'school', 0.14);
      g.state = 'observe'; g.stateT = 0;
    }
    window.__toami.advance(1.2);
  });
  await shot('10-observe');

  // 11) the finger's own stroke, mid-swipe
  await page.evaluate(() => window.__toami.advance(9.0));
  await page.mouse.move(vp.width * 0.22, vp.height * 0.84);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    const t = i / 20;
    await page.mouse.move(vp.width * (0.22 + 0.56 * t) + Math.sin(t * Math.PI) * 30,
      vp.height * (0.84 - 0.52 * t));
    await page.waitForTimeout(14);
  }
  await shot('11-stroke');
  await page.mouse.up();

  // 12) fish held inside the sunk net, milling under the mesh
  await page.evaluate(() => window.__toami.advance(9.0));
  const held = await page.evaluate(() => {
    const T = window.__toami, g = T.game;
    let s = null;
    for (let i = 0; i < 400 && !s; i++) {
      s = g.fishes.shoals.find((x) => -x.pos.z > 3 && -x.pos.z < 9 && Math.abs(x.pos.x) < 5);
      if (!s) T.advance(0.1);
    }
    if (!s) return 0;
    T.cast({
      distance: Math.min(11.5, Math.hypot(s.pos.x, s.pos.z)),
      azimuth: Math.atan2(s.pos.x, -s.pos.z),
      sharpness: 0.55, smoothness: 0.9, wobble: 0.15
    });
    T.advance(3.0);
    return g.trapped || 0;
  });
  await shot('12-held');

  const st = await page.evaluate(() => window.__toami.state);
  st.trappedAtShot = held;
  console.log(name, JSON.stringify(st));
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('\nERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nscreenshots ->', OUT);
