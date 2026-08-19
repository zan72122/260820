// Iteration helper: drives the built game and dumps frames for eyeballing.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'shots';
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const ORIENT = process.env.ORIENT ?? 'landscape';
const size = ORIENT === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME__?.ready === true, null, { timeout: 60000 });
console.log('ready');

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const d = await page.evaluate(() => window.__GAME__.debug());
  console.log(name.padEnd(18), JSON.stringify(d));
};

const wait = (ms) => page.waitForTimeout(ms);

await wait(600);
await shot('01-establish');
await page.evaluate(() => window.__GAME__.tap());
await wait(1200);
await shot('02-head-down');
await wait(2500);
await shot('03-work');
for (let i = 0; i < 14; i++) {
  await wait(900);
  await shot(`04-run-${String(i).padStart(2, '0')}`);
}
await wait(6000);
await shot('05-late');
await wait(9000);
await shot('06-rowend');
await wait(5000);
await shot('07-next');
await browser.close();
