import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots';
const QS = process.argv[3] ?? '';
const WAIT = Number(process.argv[4] ?? 6000);
const ORIENT = process.env.ORIENT ?? 'landscape';
const size = ORIENT === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });
await page.goto('http://127.0.0.1:4173/' + QS, { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME__?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__GAME__.tap());
await page.waitForTimeout(WAIT);
await page.screenshot({ path: `${OUT}/q.png` });
console.log(JSON.stringify(await page.evaluate(() => window.__GAME__.debug())));
await browser.close();
