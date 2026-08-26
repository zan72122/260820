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
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });

  await page.goto(`${BASE}/?fast=1&seed=4242`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__toami, null, { timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 });
  await page.waitForTimeout(400);

  const shot = async (tag) => {
    await page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
  };

  // 1) opening: what the player meets before touching anything
  await page.evaluate(() => window.__toami.advance(2.0));
  await shot('01-open');

  // 2) mid-flight bloom
  await page.evaluate(() => window.__toami.cast({ distance: 8.5, azimuth: 0.18, sharpness: 0.7, smoothness: 0.85, wobble: 0.2 }));
  await page.evaluate(() => window.__toami.advance(0.55));
  await shot('02-bloom');

  // 3) the circle touching the water
  await page.evaluate(() => window.__toami.advance(0.55));
  await shot('03-splash');

  // 4) sunk: the cone under the surface
  await page.evaluate(() => window.__toami.advance(1.8));
  await shot('04-sunk');

  // 5) hauling, dripping
  await page.evaluate(() => window.__toami.haul());
  await page.evaluate(() => window.__toami.advance(0.9));
  await shot('05-haul');

  // 6) back at rest, net now wet
  await page.evaluate(() => window.__toami.advance(2.5));
  await shot('06-rest');

  // 7) a long, soft cast into the deeper blue
  await page.evaluate(() => window.__toami.cast({ distance: 14.5, azimuth: -0.3, sharpness: 0.95, smoothness: 0.6, wobble: 0.7 }));
  await page.evaluate(() => window.__toami.advance(1.5));
  await shot('07-far');
  await page.evaluate(() => window.__toami.advance(2.0));
  await shot('08-far-sunk');

  const st = await page.evaluate(() => window.__toami.state);
  console.log(name, JSON.stringify(st));
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('\nERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nscreenshots ->', OUT);
