import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-260820/e983abe5-15b6-5c9a-9b2a-d2a8570f6e25/scratchpad/shots';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const TAG = process.env.TAG || 'p';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.goto('http://127.0.0.1:5173/?e2e=1&fast=1&turbo=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sd && window.__sd.ready(), null, { timeout: 90000 });

const st = () => page.evaluate(() => window.__sd.state());
const shot = (n) => page.screenshot({ path: `${OUT}/${TAG}-${n}.png` });
const log = async (n) => console.log(n, JSON.stringify(await st()));

async function until(pred, label, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await st();
    if (pred(s)) return s;
    await page.waitForTimeout(300);
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(await st())}`);
}

async function swipe(x0, y0, x1, y1, steps = 14, hold = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(hold);
  }
  await page.mouse.up();
}

await page.click('.boot__go', { force: true });
await until((s) => s.phase === 'drive', 'drive');
await shot('10-drive'); await log('drive');

// push the crawler in
for (let i = 0; i < 60; i++) {
  const s = await st();
  if (s.phase !== 'drive') break;
  const d = s.driveDir;
  const cx = W * 0.5, cy = H * 0.55, L = Math.min(W, H) * 0.34;
  await swipe(cx - d.x * L * 0.5, cy - d.y * L * 0.5, cx + d.x * L * 0.5, cy + d.y * L * 0.5, 10, 8);
  await page.waitForTimeout(120);
}
await until((s) => s.phase === 'lightSearch', 'lightSearch');
await shot('11-lightsearch'); await log('lightSearch');

// sweep the lamp knob until the fault is revealed
const knob = await page.$('.knob');
const kb = await knob.boundingBox();
outer: for (let ring = 0; ring < 5; ring++) {
  for (let a = 0; a < 12; a++) {
    const r = (kb.width * 0.34 * (ring + 1)) / 5;
    const ang = (a / 12) * Math.PI * 2;
    await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
    await page.mouse.down();
    await page.mouse.move(kb.x + kb.width / 2 + Math.cos(ang) * r, kb.y + kb.height / 2 + Math.sin(ang) * r, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(320);
    const s = await st();
    if (s.phase !== 'lightSearch') break outer;
  }
}
await log('after-knob');
await until((s) => s.phase === 'treat' || s.phase === 'discover' || s.phase === 'toolPick', 'discover');
await shot('12-discover');

const gestures = {
  peel: async (c, lift) => { for (let i = 0; i < 26; i++) await swipe(c.x - 20, c.y + lift - 30, c.x + 30, c.y + lift + H * 0.24, 10, 8); },
  brush: async (c, lift) => { for (let i = 0; i < 30; i++) await swipe(c.x - W * 0.3, c.y + lift + (i % 3 - 1) * 18, c.x + W * 0.3, c.y + lift + (i % 3 - 1) * 18, 10, 8); },
  fill: async (c, lift) => { for (let i = 0; i < 14; i++) await swipe(c.x - W * 0.34, c.y + lift, c.x + W * 0.34, c.y + lift, 20, 14); },
  smooth: async (c, lift) => { for (let i = 0; i < 14; i++) await swipe(c.x - W * 0.36, c.y + lift, c.x + W * 0.36, c.y + lift, 18, 10); },
  polish: async (c, lift) => {
    for (let i = 0; i < 26; i++) {
      const R = Math.min(W, H) * 0.13;
      await page.mouse.move(c.x + R, c.y + lift);
      await page.mouse.down();
      for (let k = 1; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2 * 2;
        await page.mouse.move(c.x + Math.cos(a) * R, c.y + lift + Math.sin(a) * R * 0.6);
        await page.waitForTimeout(6);
      }
      await page.mouse.up();
    }
  },
};

for (let guard = 0; guard < 12; guard++) {
  const s = await st();
  if (s.phase === 'dropTest') break;
  if (s.phase === 'toolPick') {
    const want = s.steps[s.stepIndex];
    await page.click(`.tray__btn[data-tool="${want}"]`, { force: true });
    await page.waitForTimeout(400);
    continue;
  }
  if (s.phase !== 'treat') { await page.waitForTimeout(500); continue; }
  const id = s.stepId;
  await shot(`20-${id}-before`);
  await gestures[id](s.workScreen, s.liftPx);
  await page.waitForTimeout(600);
  const after = await st();
  console.log('step', id, 'progress', after.stepProgress, '->', after.phase, after.stepId);
  await shot(`21-${id}-after`);
}

await until((s) => s.phase === 'dropTest', 'dropTest');
await shot('30-droptest'); await log('dropTest');
const lev = await (await page.$('.lever')).boundingBox();
await swipe(lev.x + lev.width / 2, lev.y + lev.height * 0.2, lev.x + lev.width / 2, lev.y + lev.height * 0.9, 10, 20);
await until((s) => s.phase === 'raftTest', 'raftTest', 120000);
await page.waitForTimeout(4000);
await shot('31-raft'); await log('raft');
await until((s) => s.phase === 'roundEnd', 'roundEnd', 120000);
await page.waitForTimeout(2000);
await shot('32-roundend'); await log('roundEnd');

await page.click('.endbar__btn--water', { force: true });
await until((s) => s.phase === 'dropTest', 'replay dropTest');
console.log('replay water OK');
await page.click('.endbar__btn--next', { force: true }).catch(()=>{});
await page.waitForTimeout(500);
const s2 = await st();
console.log('after next attempt', JSON.stringify(s2));
await browser.close();
