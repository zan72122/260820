import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
});

async function run(name, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('[pageerror]', name, e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('[err]', name, m.text()); });
  await p.goto('http://127.0.0.1:4173/?seed=7&tier=mid', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__rainbow);
  const shot = async (tag) => {
    await p.evaluate(() => window.__rainbow.render());
    await p.screenshot({ path: `${OUT}/${name}-${tag}.png` });
  };
  const adv = (s) => p.evaluate((x) => { window.__rainbow.advance(x); }, s);

  await adv(1.0); await shot('a-rest');
  await adv(5.0); await shot('b-first-arc');
  await adv(4.0); await shot('c-guide');
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__rainbow.pump(0.95)); await adv(1.5); }
  await shot('d-big-arc');
  for (let i = 0; i < 10; i++) { await p.evaluate((st) => window.__rainbow.pump(st), i % 3 === 0 ? 0.4 : 1.0); await adv(1.5); }
  await shot('e-weave');
  for (let i = 0; i < 22; i++) { await p.evaluate(() => window.__rainbow.pump(0.9)); await adv(1.5); }
  await shot('f-more');
  await p.evaluate(() => { for (let i=0;i<40;i++){ window.__rainbow.pump(0.9); window.__rainbow.advance(1.5);} });
  await shot('g-reveal');
  console.log(name, JSON.stringify(await p.evaluate(() => window.__rainbow.state())));
  await p.close();
}

await run('portrait', 390, 844);
await run('landscape', 844, 390);
await run('ipad', 810, 1080);
await b.close();
