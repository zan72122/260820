/**
 * Full-quality capture: same build, but without the reduced-motion test
 * profile, so shadows, the second water layer and caustics are all on.
 * Slow under software GL - this is for looking at, not for timing.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4179;
const SHOTS = new URL('../shots/full/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return;
    } catch {
      /* not up */
    }
    await sleep(400);
  }
  throw new Error('preview did not start');
}

const size = process.argv.includes('--portrait')
  ? { width: 390, height: 844 }
  : { width: 844, height: 390 };
const suffix = process.argv.includes('--portrait') ? '-portrait' : '';

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__wb), null, { timeout: 60000 });
  await sleep(2500);
  const ev = (fn, a) => page.evaluate(fn, a);
  const step = (s) => ev((x) => window.__wb.step(x), s);
  const shot = async (name) => {
    await sleep(900);
    await page.screenshot({ path: `${SHOTS}${name}${suffix}.png` });
    console.log('captured', name + suffix, await ev(() => window.__wb.shot()));
  };
  console.log('quality', JSON.stringify(await ev(() => window.__wb.quality())));

  await step(1.5);
  await shot('a-overview');
  await step(4);
  await shot('b-staging');
  await ev(() => window.__wb.swipe());
  await step(2.4);
  await shot('c-coasting');
  for (let i = 0; i < 60; i++) {
    const s = await ev(() => window.__wb.state());
    if (s === 'RAFT_RESTS_BEFORE_HILL' || s === 'DISCOVER_NOZZLES') break;
    await step(0.5);
  }
  await step(1.2);
  await shot('d-waiting-dimple');
  await ev(() => window.__wb.press(true));
  await step(1.1);
  await shot('e-contact');
  await step(2.2);
  await shot('f-climbing');
  for (let i = 0; i < 40; i++) {
    if (await ev(() => window.__wb.crested())) break;
    await step(0.4);
  }
  await step(0.6);
  await shot('g-crest');
  await ev(() => window.__wb.press(false));
  for (let i = 0; i < 40; i++) {
    if (await ev(() => window.__wb.splashed())) break;
    await step(0.4);
  }
  await step(0.5);
  await shot('h-splash');
  await step(3.2);
  await shot('i-review');
} catch (e) {
  console.error(e);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
