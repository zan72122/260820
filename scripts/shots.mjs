/**
 * Visual check helper: drives the game through its whole arc and writes the
 * key frames to test-results/shots/. Not a test — it makes no assertions.
 * Run: node scripts/shots.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
// not under test-results/: Playwright wipes that directory on every run
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

async function run(label, { width, height, query }) {
  const page = await browser.newPage({
    viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  });
  page.on('pageerror', (e) => console.log(`[${label}] pageerror`, String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}] console`, m.text()); });
  await page.goto(`${BASE}/?e2e=1${query}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120_000 });
  await page.evaluate(() => window.__suika.begin());
  const adv = (s) => page.evaluate((n) => window.__suika.advance(n), s);
  const st = () => page.evaluate(() => window.__suika.state());

  await adv(1.4);
  await page.screenshot({ path: `${OUT}/${label}-01-see.png` });

  await adv(4.2);
  await page.screenshot({ path: `${OUT}/${label}-02-blind.png` });

  for (let i = 0; i < 22; i++) {
    const cur = await st();
    if (cur.distance < 1.2) break;
    await page.evaluate((b) => window.__suika.turn(b * 0.5), Math.sign(cur.bearing) || 1);
    await page.evaluate(() => window.__suika.step(1));
    await adv(1.1);
  }
  await adv(1.3);
  await page.screenshot({ path: `${OUT}/${label}-03-aim.png` });

  await page.evaluate(() => window.__suika.strike());
  await adv(0.62);
  await page.screenshot({ path: `${OUT}/${label}-04-impact.png` });
  await adv(0.16);
  await page.screenshot({ path: `${OUT}/${label}-04b-juice.png` });
  await adv(1.4);
  await page.screenshot({ path: `${OUT}/${label}-05-hero.png` });
  await adv(4.0);
  await page.screenshot({ path: `${OUT}/${label}-06-wide.png` });
  await adv(2.6);
  await page.screenshot({ path: `${OUT}/${label}-07-again.png` });

  console.log(label, JSON.stringify(await st()));
  await page.close();
}

await run('p', { width: 390, height: 780, query: '&shadows=1&particles=1' });
await run('l', { width: 812, height: 390, query: '&shadows=1&particles=1' });
await browser.close();
console.log('shots written to', OUT);
