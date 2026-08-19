/** Single-shot framing check: node tools/frame.mjs --peek=0.6 --device=iphone --name=x */
import fs from 'node:fs';
import { arg, launch } from './browser.mjs';

const device = arg('device', 'iphone');
const { browser, page, dev, errors: logs } = await launch(device, {
  url: arg('url', 'http://127.0.0.1:4173/?fast=1&quality=high&seed=7'),
});
fs.mkdirSync('shots', { recursive: true });
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
