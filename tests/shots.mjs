// Screenshot driver for visual review (not part of the e2e suite).
// Usage: node tests/shots.mjs [outdir]
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'shots';
const fs = await import('fs');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4173/?e2e=1');
await page.waitForFunction(() => !!window.__game && !!window.__tick, undefined, { timeout: 30000 });

const tick = (n) => page.evaluate((k) => window.__tick(k), n);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

await tick(90);
await shot('01-intro');

await page.waitForFunction(() => window.__game.state() === 'DISCOVER');
await tick(120);
await shot('02-discover');

await page.evaluate(() => window.__game.hookFirst());
await tick(90);
await shot('03-hooked');

await page.evaluate(() => window.__game.wind(1, 1.0));
await tick(60);
await shot('04-first-turn');

await page.evaluate(() => window.__game.collectAll());
await tick(90);
await shot('05-collected');

await page.evaluate(() => window.__game.forceAnchor());
await tick(120);
await shot('06-anchored');

for (let line = 0; line < 4; line++) {
  for (let i = 0; i < 10; i++) {
    const locked = await page.evaluate(() => window.__game.pay(0.12));
    await tick(4);
    if (locked) break;
  }
  if (line === 0) await shot('07-first-line');
}
await tick(60);
await shot('08-four-lines');

for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__game.weave(0.2)); await tick(4); }
await tick(30);
await shot('09-woven');

for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__game.close(0.2)); await tick(4); }
await tick(30);
await shot('10-deck');

await page.evaluate(() => window.__game.test());
await tick(160);
await shot('11-hoof-test');
await tick(200);

await page.waitForFunction(() => window.__game.state() === 'CROSSREADY', undefined, { timeout: 30000 });
await page.evaluate(() => window.__game.cross());
await tick(300);
await shot('12-crossing');
for (let i = 0; i < 40; i++) {
  await tick(60);
  const st = await page.evaluate(() => window.__game.state());
  if (st === 'AFTER') break;
}
await tick(120);
await shot('13-after');

// landscape check
await page.setViewportSize({ width: 700, height: 390 });
await tick(120);
await shot('14-after-landscape');

console.log('STATE', await page.evaluate(() => window.__game.state()));
console.log('ERRORS', JSON.stringify(errors));
console.log('GAME_ERRORS', JSON.stringify(await page.evaluate(() => window.__game.errors)));
await browser.close();
