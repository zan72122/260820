import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });
const url = process.env.URL || 'http://127.0.0.1:4173/';
const land = process.argv.includes('--landscape');
const tag = land ? 'L' : 'P';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: land ? { width: 874, height: 402 } : { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url);
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const shot = async (name) => {
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  console.log('shot', name, JSON.stringify(await page.evaluate(() => window.__game.debugState())));
};
const step = (s) => page.evaluate((x) => window.__game.advance(x), s);
const st = () => page.evaluate(() => window.__game.debugState());
const until = async (fn, max = 200) => {
  for (let i = 0; i < max; i++) { if (fn(await st())) return true; await step(0.25); }
  return false;
};

await shot('00-title');
await page.locator('#start').dispatchEvent('pointerdown');
await page.evaluate(() => window.__game.testHold(true));
await step(2.5); await shot('01-drive-start');
await until((s) => s.fill > 0.16); await shot('02-harvest');
await until((s) => s.fill > 0.36); await step(0.6); await shot('03-peek-inside');
await until((s) => s.fill > 0.72); await shot('04-roll-bigger');
await until((s) => s.state === 'full'); await step(1.0); await shot('05-full-chamber');
await until((s) => s.state === 'wrap'); await step(1.6); await shot('06-wrapping');
await until((s) => s.wrap > 0.92); await shot('07-wrapped');
await until((s) => s.state === 'gate'); await step(0.6); await shot('08-gate-prompt');
await until((s) => s.state === 'eject'); await step(0.75); await shot('09-gate-open');
await until((s) => s.fieldBales >= 1); await step(0.35); await shot('10-bale-out');
await step(0.8); await shot('11-bale-rolling');
await until((s) => s.state === 'admire'); await step(1.0); await shot('12-admire');
await page.evaluate(() => window.__game.testHold(true));
await until((s) => s.state === 'drive'); await step(3); await shot('13-back-to-work');
await until((s) => s.state === 'uturn', 400); await step(1.2); await shot('14-uturn');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
