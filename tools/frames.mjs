// Deterministic capture: drive logical time, screenshot at named beats.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'shots';
const ORIENT = process.env.ORIENT ?? 'landscape';
const size = ORIENT === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });
await page.goto('http://127.0.0.1:4173/?noadapt', { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME__?.ready === true, null, { timeout: 60000 });

const sim = (s) => page.evaluate((v) => window.__GAME__.simulate(v), s);
const shot = async (name) => {
  await page.waitForTimeout(160);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(16), JSON.stringify(await page.evaluate(() => window.__GAME__.debug())));
};

await sim(0.4);
await shot('a-establish');
await page.evaluate(() => window.__GAME__.tap());
await sim(1.6);
await shot('b-headdown');
// walk forward until the first hero close-up appears, then step through it
let guard = 0;
while (guard++ < 400) {
  await sim(0.12);
  const d = await page.evaluate(() => window.__GAME__.debug());
  if (d.shot === 'heroPull') break;
}
await shot('c-hero-grab');
await sim(0.35);
await shot('d-hero-strain');
await sim(0.35);
await shot('e-hero-pop');
await sim(0.6);
await shot('f-hero-out');
await sim(2.0);
await shot('g-work');
guard = 0;
while (guard++ < 400) {
  await sim(0.12);
  const d = await page.evaluate(() => window.__GAME__.debug());
  if (d.shot === 'conveyor') break;
}
await shot('h-conveyor');
guard = 0;
while (guard++ < 200) {
  await sim(0.12);
  const d = await page.evaluate(() => window.__GAME__.debug());
  if (d.shot === 'crateDrop' && d.crate > 2) break;
  if (d.phase !== 'running') { await sim(6); }
}
await shot('i-cratedrop');
await sim(6);
await shot('j-midrow');
guard = 0;
while (guard++ < 900) {
  await sim(0.25);
  const d = await page.evaluate(() => window.__GAME__.debug());
  if (d.phase === 'rowend') break;
}
await shot('k-rowend');
await sim(2.0);
await shot('l-rowend2');
await sim(4.0);
await shot('m-nextrow');
await browser.close();
