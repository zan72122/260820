import { chromium } from '@playwright/test';
import fs from 'node:fs';
fs.mkdirSync('shots', { recursive: true });
const land = process.argv.includes('--landscape');
const tag = (land ? 'L' : 'P') + (process.argv.includes('--fast') ? 'f' : '');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({
  viewport: land ? { width: 874, height: 402 } : { width: 390, height: 844 },
  deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const fast = process.argv.includes('--fast');
await page.goto('http://127.0.0.1:4173/' + (fast ? '?fast=1' : ''));
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1200);
const step = s => page.evaluate(x => window.__game.advance(x), s);
const st = () => page.evaluate(() => window.__game.debugState());
const until = async (fn, max = 300) => { for (let i=0;i<max;i++){ if (fn(await st())) return true; await step(0.25);} return false; };
const shot = async n => { await page.waitForTimeout(140); await page.screenshot({path:`shots/${tag}-${n}.png`, timeout: 120000}); };
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
await shot('00-title');
await page.locator('#start').dispatchEvent('pointerdown');
await page.evaluate(() => window.__game.testHold(true));
await step(3); await shot('01-drive');
  if (!only) { await until(s => s.fill > 0.16); await shot('02-eat'); }
if (!only) {
  await until(s => s.fill > 0.42); await step(0.5); await shot('03-peek');
  await until(s => s.state === 'full'); await step(1.2); await shot('05-chamber');
  await until(s => s.state === 'wrap'); await step(2.0); await shot('06-wrap');
  await until(s => s.state === 'gate'); await step(0.8); await shot('08-gate');
  await until(s => s.state === 'eject'); await step(1.1); await shot('09-open');
  await until(s => s.fieldBales >= 1); await step(0.45); await shot('10-out');
  await page.evaluate(() => window.__game.testHold(false));
  await step(0.9); await shot('11-roll');
  await until(s => s.state === 'admire'); await step(1.2); await shot('12-admire');
  await page.evaluate(() => window.__game.testHold(true));
  await until(s => s.state === 'drive'); await step(4); await shot('13-again');
  await until(s => s.state === 'uturn', 500); await step(1.3); await shot('14-uturn');
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'clean', JSON.stringify(await st()));
await browser.close();
