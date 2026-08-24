// Dev helper: capture phase screenshots at device viewports.
// Usage: node scripts/shot.mjs [outdir]
import { chromium } from '@playwright/test';

const out = process.argv[2] || 'shots';
const base = 'http://127.0.0.1:5173/?e2e=1';

const viewports = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});

for (const [name, vp] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5, null, { timeout: 30000 });

  // arrive
  await page.screenshot({ path: `${out}/${name}-1-arrive.png` });
  // ready (kneeling closeup)
  await page.evaluate(() => window.__game.fastForward(8));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-2-ready.png` });
  // guidance ripple moment
  await page.evaluate(() => window.__game.fastForward(9));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}-3-hint.png` });
  if (errs.length) console.log(`[${name}] console errors:`, errs.slice(0, 5));
  console.log(`[${name}] phase=${await page.evaluate(() => window.__game.phase)} tip=${JSON.stringify(await page.evaluate(() => window.__game.hornTipScreen()))} intro=${JSON.stringify(await page.evaluate(() => window.__game.introStreakScreen()))}`);
  await ctx.close();
}
await browser.close();
