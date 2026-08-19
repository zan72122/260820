/** Single-shot framing check: node tools/frame.mjs --peek=0.6 --device=iphone --name=x */
import { chromium } from 'playwright';
import fs from 'node:fs';
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};
const DEVICES = {
  iphone: { width: 390, height: 844 },
  iphoneland: { width: 844, height: 390 },
  ipad: { width: 1024, height: 768 },
  small: { width: 320, height: 568 },
};
const dev = DEVICES[arg('device', 'iphone')];
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: dev, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() !== 'log') logs.push(m.type() + ': ' + m.text()); });
await page.goto(arg('url', 'http://127.0.0.1:4173/?fast=1&quality=high&seed=7'), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__butai, null, { timeout: 90000 });
await page.mouse.click(dev.width / 2, dev.height / 2);
await page.waitForTimeout(1200);
const peekV = Number(arg('peek', '0'));
const pre = Number(arg('pre', '1.2'));
await page.evaluate((v) => window.__butai.tick(v), pre);
if (peekV > 0) {
  await page.evaluate((v) => window.__butai.peek(v), peekV);
  await page.evaluate((v) => window.__butai.tick(v), 2.0);
}
const jump = arg('jump', '');
if (jump) {
  await page.evaluate(() => window.__butai.advance());
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate((v) => window.__butai.tick(v), 0.6);
    if (s.phase === jump) break;
    if (s.phase === 'cue' && jump !== 'cue') await page.evaluate(() => window.__butai.advance());
  }
  await page.evaluate((v) => window.__butai.tick(v), Number(arg('after', '1.5')));
}
await page.waitForTimeout(200);
await page.screenshot({ path: `shots/${arg('name', 'frame')}.png` });
console.log(JSON.stringify(await page.evaluate(() => window.__butai.state())));
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
