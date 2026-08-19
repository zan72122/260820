import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173/?fast=1&quality=low&seed=7', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__butai, null, { timeout: 90000 });
await page.mouse.click(195, 400);
await page.waitForTimeout(800);
await page.evaluate(() => window.__butai.tick(1.0));
await page.evaluate(() => window.__butai.peek(1));
await page.evaluate(() => window.__butai.tick(2.0));
for (const [nx, ny] of [[0,0.35],[0,0.1],[0,-0.1],[0,-0.35],[0.05,0.2],[-0.05,0.2]]) {
  console.log(nx, ny, JSON.stringify(await page.evaluate(([a,b]) => window.__butai.probe(a,b), [nx,ny])));
}
console.log('cam', JSON.stringify(await page.evaluate(() => window.__butai.camera())));
await browser.close();
