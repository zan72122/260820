/**
 * 構図確認用：各状態でカメラが到着してから撮影する。
 * node scripts/debug-shots.mjs [--vp 390x844] [--shots dir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const [W, H] = getArg('--vp', '390x844').split('x').map(Number);
const SHOTS = getArg('--shots', '/tmp/shots-debug');
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true });
page.on('pageerror', (e) => console.error('PAGEERROR', e));

const state = () => page.evaluate(() => window.__game.state());
const waitState = async (want, ms = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await state();
    if (s === want) return;
    if (Date.now() - t0 > ms) throw new Error(`timeout ${want} (now ${s})`);
    await sleep(150);
  }
};
const waitSettled = async () => {
  await page.waitForFunction(() => window.__game.settled(), { timeout: 20000 });
  await sleep(300);
};
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });

await page.goto(`http://localhost:5173/?e2e=1`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, { timeout: 15000 });
await sleep(1200);
await shot('01-title');

await page.mouse.click(W / 2, H / 2);
await waitState('IDLE');
await waitSettled();
await shot('02-play-idle');

// 誘い
const x = W / 2;
const y = H * 0.62;
await page.mouse.move(x, y);
await page.mouse.down();
const amp = Math.min(H * 0.07, 70);
for (let k = 0; k < 2; k++) {
  for (let i = 0; i <= 6; i++) {
    await page.mouse.move(x, y + amp * Math.sin((i / 6) * Math.PI * 2));
    await sleep(16);
  }
}
await shot('03-jigging');
await page.mouse.up();
await waitState('STILL');
await waitSettled();
await shot('04-cutaway-settled');
await waitState('BITE', 20000);
await shot('05-bite');
await sleep(600);
await shot('05b-bite2');

// クイッ
await page.mouse.move(W / 2, H * 0.6);
await page.mouse.down();
for (let i = 1; i <= 5; i++) {
  await page.mouse.move(W / 2, H * 0.6 - (H * 0.22 * i) / 5);
  await sleep(14);
}
await page.mouse.up();
await waitState('REELING');
await waitSettled();
await shot('06-reeling-idlehand');

await page.mouse.move(W / 2, H * 0.7);
await page.mouse.down();
await sleep(2500);
await shot('07-reeling-hold');
await waitState('REVEAL', 30000);
await waitSettled();
await shot('08-reveal');
await waitState('CAUGHT', 30000);
await page.mouse.up();
await waitSettled();
await page.waitForSelector('#replay.shown', { timeout: 20000 });
await sleep(400);
await shot('09-caught-bucket');

await page.click('#replay');
await waitState('IDLE', 15000);
await waitSettled();
await shot('10-replay-idle');

console.log('debug shots done');
await browser.close();
