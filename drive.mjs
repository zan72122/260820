import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-260820/e983abe5-15b6-5c9a-9b2a-d2a8570f6e25/scratchpad/shots';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const TAG = process.env.TAG || 'p';
const ROUNDS = Number(process.env.ROUNDS || 1);

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

async function until(pred, label, ms = 120000) {
  const t0 = Date.now();
  for (;;) {
    const s = await st();
    if (pred(s)) return s;
    if (Date.now() - t0 > ms) throw new Error(`timeout ${label}: ${JSON.stringify(s)}`);
    await page.waitForTimeout(250);
  }
}
async function swipe(x0, y0, x1, y1, steps = 14, hold = 12) {
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + ((x1-x0)*i)/steps, y0 + ((y1-y0)*i)/steps); await page.waitForTimeout(hold); }
  await page.mouse.up();
}

await shot('00-title');
await page.click('.boot__go', { force: true });
await page.waitForTimeout(2500);
await shot('01-establish');
await until((s) => s.phase === 'introSnag' || s.phase === 'drive', 'snag');
await shot('02-snag'); await log('snag');

const gestures = {
  peel: async (c, lift) => { for (let i = 0; i < 8; i++) await swipe(c.x - 20, c.y + lift - 30, c.x + 30, c.y + lift + H * 0.24, 10, 8); },
  brush: async (c, lift) => { for (let i = 0; i < 12; i++) await swipe(c.x - W*0.3, c.y + lift + (i%3-1)*16, c.x + W*0.3, c.y + lift + (i%3-1)*16, 10, 8); },
  fill: async (c, lift) => { for (let i = 0; i < 5; i++) await swipe(c.x - W*0.34, c.y + lift, c.x + W*0.34, c.y + lift, 20, 14); },
  smooth: async (c, lift) => { for (let i = 0; i < 5; i++) await swipe(c.x - W*0.36, c.y + lift, c.x + W*0.36, c.y + lift, 18, 10); },
  polish: async (c, lift) => {
    for (let i = 0; i < 8; i++) {
      const R = Math.min(W, H) * 0.16;
      await page.mouse.move(c.x + R, c.y + lift); await page.mouse.down();
      for (let k = 1; k <= 26; k++) { const a = (k/26)*Math.PI*4; await page.mouse.move(c.x + Math.cos(a)*R, c.y + lift + Math.sin(a)*R*0.6); await page.waitForTimeout(6); }
      await page.mouse.up();
    }
  },
};

for (let round = 0; round < ROUNDS; round++) {
  const R = `r${round}`;
  await until((s) => s.phase === 'drive', 'drive');
  await page.waitForTimeout(2200);
  await shot(`${R}-10-drive`); await log(`${R} drive`);
  for (let i = 0; i < 80; i++) {
    const s = await st();
    if (s.phase !== 'drive') break;
    const d = s.driveDir, cx = W*0.5, cy = H*0.55, L = Math.min(W,H)*0.34;
    await swipe(cx - d.x*L*0.5, cy - d.y*L*0.5, cx + d.x*L*0.5, cy + d.y*L*0.5, 10, 8);
    await page.waitForTimeout(100);
  }
  await until((s) => s.phase === 'lightSearch', 'lightSearch');
  await page.waitForTimeout(1800);
  await shot(`${R}-11-lightsearch`);

  const kb = await (await page.$('.knob')).boundingBox();
  outer: for (let ring = 1; ring <= 6; ring++) for (let a = 0; a < 12; a++) {
    const r = (kb.width*0.34*ring)/6, ang = (a/12)*Math.PI*2;
    await page.mouse.move(kb.x + kb.width/2, kb.y + kb.height/2); await page.mouse.down();
    await page.mouse.move(kb.x + kb.width/2 + Math.cos(ang)*r, kb.y + kb.height/2 + Math.sin(ang)*r, { steps: 3 });
    await page.mouse.up(); await page.waitForTimeout(280);
    const s = await st();
    if (s.phase !== 'lightSearch') break outer;
  }
  await until((s) => s.phase !== 'lightSearch', 'left lightSearch');
  await log(`${R} discovered`);

  for (let guard = 0; guard < 40; guard++) {
    const s = await st();
    if (s.phase === 'dropTest') break;
    if (s.phase === 'toolPick') {
      const want = s.steps[s.stepIndex];
      await shot(`${R}-15-toolpick`);
      await page.click(`.tray__btn[data-tool="${want}"]`, { force: true });
      await page.waitForTimeout(400);
      continue;
    }
    if (s.phase !== 'treat') { await page.waitForTimeout(400); continue; }
    const id = s.stepId;
    await gestures[id](s.workScreen, s.liftPx);
    await page.waitForTimeout(500);
    const after = await st();
    if (after.stepId !== id || after.phase !== 'treat') {
      await shot(`${R}-2${['peel','brush','fill','smooth','polish'].indexOf(id)}-${id}-done`);
      console.log(`${R} step ${id} complete -> ${after.phase} ${after.stepId}`);
    }
  }

  await until((s) => s.phase === 'dropTest', 'dropTest');
  await page.waitForTimeout(1200);
  await shot(`${R}-30-droptest`); await log(`${R} dropTest`);
  const lev = await (await page.$('.lever')).boundingBox();
  await swipe(lev.x + lev.width/2, lev.y + lev.height*0.2, lev.x + lev.width/2, lev.y + lev.height*0.9, 10, 20);
  await until((s) => s.phase === 'raftTest', 'raftTest');
  await page.waitForTimeout(4500);
  await shot(`${R}-31-raft`);
  await until((s) => s.phase === 'roundEnd', 'roundEnd');
  await page.waitForTimeout(2500);
  await shot(`${R}-32-roundend`); await log(`${R} roundEnd`);

  if (round === 0) {
    await page.click('.endbar__btn--water', { force: true });
    await until((s) => s.phase === 'dropTest', 'replay water');
    console.log('replay water OK (1 tap)');
    const lev2 = await (await page.$('.lever')).boundingBox();
    await swipe(lev2.x + lev2.width/2, lev2.y + lev2.height*0.2, lev2.x + lev2.width/2, lev2.y + lev2.height*0.9, 10, 20);
    await until((s) => s.phase === 'roundEnd', 'roundEnd again');
    await page.waitForTimeout(1800);
  }
  if (round + 1 < ROUNDS) {
    await page.click('.endbar__btn--next', { force: true });
    await page.waitForTimeout(600);
  }
}
console.log('ALL ROUNDS OK');
await browser.close();
