// Dev visual-audit script #2: intro chain, tray, wrong keys.
// Usage: node scripts/flowshots.mjs [outdir]
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'shots';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

// intro (fresh storage, intro enabled)
await page.goto('http://localhost:4173/?e2e=1&intro=1');
await page.waitForFunction(() => window.__pinForest?.ready === true);
await page.evaluate(() => window.__pinForest.advance(0.8));
await page.screenshot({ path: `${out}/f1-intro-room.png` });
await page.evaluate(() => window.__pinForest.advance(3.4));
await page.screenshot({ path: `${out}/f2-intro-cabinet.png` });
await page.evaluate(() => window.__pinForest.advance(3.2));
await page.screenshot({ path: `${out}/f3-intro-keyclose.png` });
await page.evaluate(() => window.__pinForest.advance(3.0));
await page.screenshot({ path: `${out}/f4-intro-oblique.png` });
await page.evaluate(() => window.__pinForest.advance(4.5));
await page.screenshot({ path: `${out}/f5-intro-macro.png` });

// finish play 1 quickly, then tray
await page.evaluate(() => {
  const pf = window.__pinForest;
  pf.skipCinematic();
  pf.setDepth(1);
  pf.advance(0.5);
  pf.rotateTo(1.6);
  pf.advance(2.0);
  pf.skipCinematic();
  pf.advance(0.5);
  pf.pullDoor();
  pf.advance(2.5);
  pf.skipCinematic();
  pf.advance(0.5);
});
console.log('after play1:', await page.evaluate(() => window.__pinForest.state()), 'plays:', await page.evaluate(() => window.__pinForest.playCount()));
await page.evaluate(() => window.__pinForest.returnKey());
await page.evaluate(() => window.__pinForest.advance(1.5));
await page.screenshot({ path: `${out}/f6-tray.png` });

// wrong key B fully inserted: front boundary low
await page.evaluate(() => window.__pinForest.selectKey(1));
await page.evaluate(() => window.__pinForest.advance(1.2));
await page.evaluate(() => window.__pinForest.skipCinematic());
await page.evaluate(() => window.__pinForest.setDepth(1));
await page.evaluate(() => window.__pinForest.advance(1.0));
console.log('keyB aligned?', await page.evaluate(() => window.__pinForest.aligned()), await page.evaluate(() => window.__pinForest.boundaries().map((b) => Math.round(b * 10000) / 10)));
await page.screenshot({ path: `${out}/f7-wrongkey-b.png` });

// elastic rotation attempt with wrong key
await page.evaluate(() => window.__pinForest.rotateTo(1.6));
await page.evaluate(() => window.__pinForest.advance(0.8));
console.log('plug angle (elastic):', await page.evaluate(() => window.__pinForest.plugAngle()));
await page.screenshot({ path: `${out}/f8-wrongkey-elastic.png` });

// wrong key C: rear boundary high
await page.evaluate(() => window.__pinForest.returnKey());
await page.evaluate(() => window.__pinForest.advance(1.2));
await page.evaluate(() => window.__pinForest.selectKey(2));
await page.evaluate(() => window.__pinForest.advance(3.0));
await page.evaluate(() => window.__pinForest.skipCinematic());
await page.evaluate(() => window.__pinForest.setDepth(1));
await page.evaluate(() => window.__pinForest.advance(1.0));
console.log('keyC aligned?', await page.evaluate(() => window.__pinForest.aligned()), await page.evaluate(() => window.__pinForest.boundaries().map((b) => Math.round(b * 10000) / 10)));
await page.screenshot({ path: `${out}/f9-wrongkey-c.png` });

await browser.close();
