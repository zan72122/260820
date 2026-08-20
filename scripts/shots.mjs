// 開発用スクリーンショット採取（決定的モードで章を進めながら撮る）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT || '/tmp/shots';
const BASE = process.env.BASE || 'http://localhost:5173';
const Q = process.env.Q || 'high';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: 'p', w: 390, h: 844 },
  { name: 'l', w: 844, h: 390 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', v.name, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', v.name, m.text()); });
  await page.goto(`${BASE}/?fast=1&q=${Q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__nagaoka);

  const shot = async (tag) => {
    await page.screenshot({ path: `${OUT}/${v.name}-${tag}.png` });
    return page.evaluate(() => window.__nagaoka.state());
  };
  const step = (ms) => page.evaluate((m) => window.__nagaoka.step(m), ms);

  await step(200);
  console.log(v.name, 'title', await shot('00-title'));

  await page.evaluate(() => window.__nagaoka.begin());
  await step(1400);
  console.log(v.name, 'establish', await shot('01-establish'));
  await step(1600);
  console.log(v.name, 'wait', await shot('02-wait'));

  await page.evaluate(() => window.__nagaoka.niagara());
  await step(1100);
  console.log(v.name, 'niagara1', await shot('03-niagara-a'));
  await step(1600);
  console.log(v.name, 'niagara2', await shot('04-niagara-b'));
  await step(1200);
  console.log(v.name, 'cue', await shot('05-cue'));
  await step(1200);
  console.log(v.name, 'cue2', await shot('06-cue2'));

  await page.evaluate(() => window.__nagaoka.shell());
  await step(1800);
  console.log(v.name, 'rise', await shot('07-rise'));
  await step(1800);
  console.log(v.name, 'burst', await shot('08-burst'));
  await step(900);
  console.log(v.name, 'burst2', await shot('09-burst2'));
  await step(1800);
  console.log(v.name, 'wide', await shot('10-wide'));
  await step(1600);
  console.log(v.name, 'wide2', await shot('11-wide2'));
  await step(3000);
  console.log(v.name, 'after', await shot('12-after'));
  await step(6000);
  console.log(v.name, 'result', await shot('13-result'));
  await page.close();
}
await browser.close();
console.log('done ->', OUT);
