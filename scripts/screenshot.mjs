// Dev visual-audit script: captures the key moments as PNGs.
// Usage: node scripts/screenshot.mjs [outdir] [orientation]
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'shots';
const orientation = process.argv[3] ?? 'portrait';
const size = orientation === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1, hasTouch: true });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4173/?e2e=1');
await page.waitForFunction(() => window.__pinForest?.ready === true);
const pf = (expr) => page.evaluate(expr);

const snap = async (name) => {
  await page.evaluate(() => window.__pinForest.advance(0.4));
  await page.screenshot({ path: `${out}/${orientation}-${name}.png` });
  console.log('shot:', name, await pf('window.__pinForest.state()'));
};

// 1. half-inserted mystery
await pf('window.__pinForest.advance(1.5)');
await snap('1-half-inserted');

// 2. mid-wave
await pf('window.__pinForest.setDepth(0.7)');
await pf('window.__pinForest.advance(0.6)');
await snap('2-pin-wave');

// 3. all boundaries aligned
await pf('window.__pinForest.setDepth(1.0)');
await pf('window.__pinForest.advance(0.8)');
await snap('3-aligned');

// 4. rotation chain: cam & bolt close-up, then the wide hand-off
await pf('window.__pinForest.rotateTo(1.6)');
await pf('window.__pinForest.advance(2.6)');
await snap('4a-cam-bolt');
await pf('window.__pinForest.skipCinematic()');
await pf('window.__pinForest.advance(1.0)');
await snap('4-bolt');

// 5. reveal
await pf('window.__pinForest.pullDoor()');
await pf('window.__pinForest.advance(3.0)');
await pf('window.__pinForest.skipCinematic()');
await pf('window.__pinForest.advance(1.0)');
await snap('5-reveal');

console.log('final state:', await pf('window.__pinForest.state()'));
await browser.close();
