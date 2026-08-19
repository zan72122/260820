import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });
await page.goto('http://127.0.0.1:4173/?noadapt', { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME__?.ready === true, null, { timeout: 60000 });
const sim = (s) => page.evaluate((v) => window.__GAME__.simulate(v), s);
const dbg = () => page.evaluate(() => window.__GAME__.debug());
const shot = async (n) => { await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(n.padEnd(14), JSON.stringify(await dbg())); };
await sim(0.4); await shot('p1-establish');
await page.evaluate(() => window.__GAME__.tap());
await sim(1.4); await shot('p2-work');
let g = 0;
while (g++ < 400) { await sim(0.1); const d = await dbg(); if (d.shot === 'heroPull') break; }
await sim(0.5); await shot('p3-hero');
g = 0;
while (g++ < 400) { await sim(0.1); const d = await dbg(); if (d.shot === 'conveyor') break; }
await shot('p4-conveyor');
g = 0;
while (g++ < 400) { await sim(0.1); const d = await dbg(); if (d.shot === 'crateDrop' && d.crate > 2) break; }
await shot('p5-crate');
g = 0;
while (g++ < 900) { await sim(0.25); const d = await dbg(); if (d.phase === 'rowend') break; }
await sim(1.6); await shot('p6-rowend');
await sim(4.5); await shot('p7-next');
await browser.close();
