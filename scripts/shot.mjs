// Quick screenshot helper for visual iteration.
// usage: node shot.mjs [name] [w] [h] [script]
import { chromium } from '@playwright/test';

const name = process.argv[2] || 'shot';
const w = Number(process.argv[3] || 390);
const h = Number(process.argv[4] || 844);
const act = process.argv[5] || '';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5183/?e2e=1' + (process.env.EXTRA || ''), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

async function drag(dir) {
  const cx = w / 2, cy = h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx + dir * (i / 10) * w * 0.4, cy, { steps: 1 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
}

if (act === 'toStraight') {
  await drag(-1);
} else if (act.startsWith('wait')) {
  // nothing
}
const extraWait = Number(process.argv[6] || 0);
if (extraWait) await page.waitForTimeout(extraWait);

const state = await page.evaluate(() => {
  const m = window.__mono;
  return m ? { phase: m.phase, t: m.t, lock: m.lockExt, lever: m.lever, metrics: m.metrics } : null;
});
console.log('state:', JSON.stringify(state));
await page.screenshot({ path: `/tmp/claude-0/-home-user-260820/2a456d8a-3191-5c08-990b-d449fa588187/scratchpad/${name}.png` });
await browser.close();
