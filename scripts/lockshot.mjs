import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-260820/2a456d8a-3191-5c08-990b-d449fa588187/scratchpad';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5183/?e2e=1&fast=3', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const cx=195, cy=420;
await page.mouse.move(cx,cy); await page.mouse.down();
for (let i=1;i<=12;i++){ await page.mouse.move(cx-(i/12)*170, cy, {steps:1}); await page.waitForTimeout(25);}
await page.mouse.up();
await page.waitForFunction(() => window.__mono.phase === 'locking', null, {timeout: 60000});
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/lockshot.png` });
console.log(JSON.stringify(await page.evaluate(() => ({phase: window.__mono.phase, lock: window.__mono.lockExt}))));
await browser.close();
