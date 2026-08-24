import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5184/?e2e=1&fast=4', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__mono);
const cx=195, cy=420;
await page.mouse.move(cx,cy); await page.mouse.down();
for (let i=1;i<=12;i++){ await page.mouse.move(cx-(i/12)*170, cy, {steps:1}); await page.waitForTimeout(20);}
await page.mouse.up();
await page.waitForFunction(() => window.__mono.phase === 'train', null, {timeout: 90000});
await page.waitForFunction(() => window.__mono.phase === 'idle', null, {timeout: 90000});
console.log('production bundle: full first play OK, runCount =', await page.evaluate(() => window.__mono.runCount));
await browser.close();
