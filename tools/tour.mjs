/** Drop on a chosen set of floors and capture the moment of contact. */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const vp = { width: 390, height: 844 };
const wanted = (process.argv[2] ?? 'water,clay,metal').split(',');

const server = await createServer({ server: { port: 5196 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: vp, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5196/?debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab, null, { timeout: 90000 });
await page.addStyleTag({ content: '#debug{display:none!important}' });
await page.evaluate(() => window.__lab.unlock('height'));
await page.waitForTimeout(4000);

const snap = () => page.evaluate(() => window.__lab.snapshot());
const at = (n) => page.evaluate((k) => window.__lab.screenOf(k), n);
const impact = () => page.evaluate(() => window.__lab.impact());

async function drag(pt, dx, dy, steps = 14) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(pt.x + (dx * i) / steps, pt.y + (dy * i) / steps);
  await page.mouse.up();
}
async function pull() {
  const ring = await at('ring');
  await drag(ring, 0, vp.height * 0.24);
}
async function until(pred, timeout = 90000) {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < timeout) {
    s = await snap();
    if (pred(s)) return s;
    await page.waitForTimeout(150);
  }
  console.log('TIMEOUT', JSON.stringify(s));
  return s;
}
const ready = (s) => s.simPhase === 'held' && s.phase === 'free';
await until(ready);

for (const target of wanted) {
  await page.evaluate((t) => window.__lab.setFloor(t), target);
  await page.waitForTimeout(1500);
  const before = (await snap()).drops;
  await pull();
  // Catch the frame where the ball is deepest into the surface.
  let best = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const s = await snap();
    if (s.simPhase === 'contact' || (best === null && s.ballY < 0.6)) {
      await page.screenshot({ path: `${DIR}/mat-${target}-contact.png` });
      best = s;
      break;
    }
    if (s.drops > before && s.simPhase === 'settled') break;
    await page.waitForTimeout(40);
  }
  await until((s) => s.simPhase === 'settled' || ready(s));
  await page.screenshot({ path: `${DIR}/mat-${target}-rest.png` });
  console.log(target, 'done', JSON.stringify(await snap()));
  await until(ready);
}
await browser.close();
await server.close();
