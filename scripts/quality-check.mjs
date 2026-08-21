/**
 * Loads the production build at full quality (no reduced-motion profile) and
 * plays a short run, to prove the higher tier - shadows, second water layer,
 * caustics - initialises and runs clean. Software GL: behaviour only.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4182;
const SHOTS = new URL('../shots/full/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break;
  } catch {
    /* not up */
  }
  await sleep(400);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__wb), null, { timeout: 60000 });
await sleep(1500);
const ev = (f, a) => page.evaluate(f, a);
console.log('quality tier settings:', JSON.stringify(await ev(() => window.__wb.quality())));
await ev((s) => window.__wb.step(s), 4);
await ev(() => window.__wb.swipe());
for (let i = 0; i < 40; i++) {
  const s = await ev(() => window.__wb.state());
  if (s === 'RAFT_RESTS_BEFORE_HILL' || s === 'DISCOVER_NOZZLES') break;
  await ev((x) => window.__wb.step(x), 0.5);
}
await ev(() => window.__wb.press(true));
await ev((s) => window.__wb.step(s), 1.4);
await sleep(1200);
await page.screenshot({ path: `${SHOTS}q-contact.png` });
await ev((s) => window.__wb.step(s), 3.5);
await sleep(1200);
await page.screenshot({ path: `${SHOTS}q-climb.png` });
console.log('state', await ev(() => window.__wb.state()), 'crested', await ev(() => window.__wb.crested()));
console.log('console errors:', errors.length, errors.slice(0, 3).join(' | '));
await browser.close();
server.kill('SIGTERM');
process.exit(errors.length ? 1 : 0);
