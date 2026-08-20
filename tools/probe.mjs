import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const vp = { width: 390, height: 844 };
const page = await browser.newPage({ viewport: vp, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5198/?debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab, null, { timeout: 90000 });
const mode = process.argv[2] ?? 'tray';
if (mode === 'yard') {
  await page.evaluate(() => window.__lab.unlock('chain'));
} else {
  await page.evaluate(() => window.__lab.unlock('height'));
}
await page.waitForTimeout(mode === 'yard' ? 22000 : 12000);
console.log('== ' + mode + ' ==');

const at = (n) => page.evaluate((k) => window.__lab.screenOf(k), n);
const pick = (x, y) => page.evaluate(([a, b]) => window.__lab.pickAt(a, b), [x, y]);

for (const n of ['ring', 'tray', 'brush', 'handle', 'ball0', 'ball2', 'ball4', 'ball5', 'tile0', 'tile3', 'pad0', 'pad1', 'pad2']) {
  const p = await at(n);
  if (!p) { console.log(n, 'no position'); continue; }
  const inside = p.x > 0 && p.x < vp.width && p.y > 0 && p.y < vp.height;
  const hit = inside ? await pick(p.x, p.y) : null;
  console.log(
    `${n.padEnd(7)} ${inside ? 'in ' : 'OUT'} ${Math.round(p.x)},${Math.round(p.y)}  -> ${hit ? hit.pick + (hit.index !== null ? '#' + hit.index : '') : 'MISS'}`
  );
}
console.log('snapshot', await page.evaluate(() => window.__lab.snapshot()));
await browser.close();
await server.close();
