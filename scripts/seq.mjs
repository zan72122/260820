// Run the full first-play sequence and capture stills + state at key beats.
import { chromium } from '@playwright/test';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user-260820/2a456d8a-3191-5c08-990b-d449fa588187/scratchpad';
const w = Number(process.argv[2] || 390);
const h = Number(process.argv[3] || 844);
const tag = process.argv[4] || 'seq';
const fast = process.env.FAST || '1';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:5183/?e2e=1&fast=${fast}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => {
  const m = window.__mono;
  return { phase: m.phase, t: Math.round(m.t * 1000) / 1000, lock: Math.round(m.lockExt * 100) / 100, lever: Math.round(m.lever * 100) / 100, occupied: m.occupied, runs: m.runCount };
});
const snap = async (name) => {
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  console.log(name, JSON.stringify(await state()));
};

await snap('0-open');

// one-finger slide to the left (straight side)
const cx = w / 2, cy = h / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(cx - (i / 12) * w * 0.42, cy + (i / 12) * 30, { steps: 1 });
  await page.waitForTimeout(28);
}
await page.mouse.up();
await snap('1-command');

const waitPhase = async (phase, timeout = 40000) => {
  await page.waitForFunction((p) => window.__mono.phase === p, phase, { timeout });
};

await waitPhase('traverse');
await page.waitForTimeout(2600 / Number(fast));
await snap('2-traverse-early');
await page.waitForTimeout(2800 / Number(fast));
await snap('3-traverse-mid');
await waitPhase('locking');
await page.waitForTimeout(1100 / Number(fast));
await snap('4-locking');
await waitPhase('signal');
await snap('5-signal');
await waitPhase('train', 60000);
await page.waitForTimeout(3500 / Number(fast));
await snap('6-train-far');
await page.waitForTimeout(5500 / Number(fast));
await snap('7-train-near');
await waitPhase('idle', 90000);
await snap('8-after');

// second play: slide back to the curve, no explanations needed
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(cx + (i / 12) * w * 0.45, cy - (i / 12) * 24, { steps: 1 });
  await page.waitForTimeout(28);
}
await page.mouse.up();
await snap('9-command2');
await waitPhase('traverse');
await page.waitForTimeout(3600 / Number(fast));
await snap('10-traverse2');
await waitPhase('locking');
await page.waitForTimeout(1150 / Number(fast));
await snap('11-locking2');
await waitPhase('train', 60000);
await page.waitForTimeout(6000 / Number(fast));
await snap('12-curve-train');
await page.waitForTimeout(4000 / Number(fast));
await snap('13-curve-train-near');
await waitPhase('idle', 90000);
await snap('14-after2');
await browser.close();
