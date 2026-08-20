import { chromium } from 'playwright';
import { createServer } from 'vite';

const VIEWPORTS = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};
const DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const only = process.argv[2];

const server = await createServer({ server: { port: 5197 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  if (only && name !== only) continue;
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
  await page.goto('http://localhost:5197/?debug=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lab, null, { timeout: 90000 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${DIR}/clean-${name}-ready.png` });

  // Pull the ring and catch the ball mid-flight and at rest.
  const ring = await page.evaluate(() => window.__lab.screenOf('ring'));
  await page.mouse.move(ring.x, ring.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(ring.x, ring.y + (vp.height * 0.24 * i) / 14);
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${DIR}/clean-${name}-fall.png` });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/clean-${name}-bounce.png` });
  await page.waitForTimeout(16000);
  await page.screenshot({ path: `${DIR}/clean-${name}-rest.png` });

  // Open everything and look at the yard.
  await page.evaluate(() => window.__lab.unlock('chain'));
  await page.waitForTimeout(26000);
  await page.screenshot({ path: `${DIR}/clean-${name}-yard.png` });
  await page.close();
}
await browser.close();
await server.close();
console.log('done');
