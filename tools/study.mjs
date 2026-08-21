import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('shots-study', { recursive: true });
const b = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { if (m.type()==='error') console.log('[err]', m.text()); });
await p.goto('http://127.0.0.1:4173/?seed=7&tier=high', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__rainbow);
await p.evaluate(() => { window.__rainbow.advance(4); });
for (const [tag, hh, ty] of [['rider', 0.95, 0.75], ['rig', 1.9, 1.5], ['arch', 1.4, 1.2]]) {
  await p.evaluate(([h, t]) => { window.__rainbow.study(h, t); window.__rainbow.advance(3); window.__rainbow.render(); }, [hh, ty]);
  await p.screenshot({ path: `shots-study/${tag}.png` });
}
await p.evaluate(() => { window.__rainbow.study(null); for (let i=0;i<14;i++){window.__rainbow.pump(0.95); window.__rainbow.advance(1.5);} window.__rainbow.render(); });
await p.screenshot({ path: 'shots-study/wide.png' });
await b.close();
