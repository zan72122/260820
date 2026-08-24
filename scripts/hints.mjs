// Capture the three staged idle hints.
import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-260820/2a456d8a-3191-5c08-990b-d449fa588187/scratchpad';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5183/?e2e=1&fast=3', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const st = () => page.evaluate(() => ({ hint: window.__mono.hint, phase: window.__mono.phase }));
for (const [stage, timeout] of [[1, 20000], [2, 30000], [3, 30000]]) {
  await page.waitForFunction((s) => window.__mono.hint === s, stage, { timeout });
  await page.waitForTimeout(stage === 2 ? 700 : 150);
  await page.screenshot({ path: `${OUT}/hint-${stage}.png` });
  console.log('hint', stage, JSON.stringify(await st()));
}
await browser.close();
