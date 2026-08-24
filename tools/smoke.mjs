import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/?fast=1';
const OUT = process.env.OUT ?? './shots';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3 },
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
});

const problems = [];
const report = {};

async function newPage(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const text = m.text();
    // SwiftShader's own driver chatter is not the application's output.
    if (/GL Driver Message|GPU stall|SwiftShader|Automatic fallback to software/i.test(text)) return;
    if (m.type() === 'error' || m.type() === 'warning') {
      problems.push(`[${vp.name}] console.${m.type()}: ${text}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`[${vp.name}] pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 20000 });
  await sleep(1200);
  return { ctx, page };
}

const snap = (page) => page.evaluate(() => window.__game.snapshot());
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });

async function pressHold(page, pt, ms, moves = []) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await sleep(ms);
  for (const m of moves) {
    await page.mouse.move(m.x, m.y, { steps: 14 });
    await sleep(m.hold ?? 300);
  }
  await page.mouse.up();
}

// ---------------------------------------------------------------- main run
{
  const vp = VIEWPORTS[0];
  const { ctx, page } = await newPage(vp);
  const log = [];

  log.push({ step: 'load', ...(await snap(page)) });
  await shot(page, '01-eartips');

  // 1. Seat the eartips — the first touch and the audio unlock.
  const tips = await page.evaluate(() => window.__game.projectEarTips());
  await page.mouse.click(tips.x, tips.y);
  await sleep(1800);
  log.push({ step: 'after-eartips', ...(await snap(page)) });
  await shot(page, '02-centre');

  // 2. Press and hold at the neutral spot in the middle of the chest.
  let target = await page.evaluate(() => window.__game.projectChest(0, 0.3));
  await pressHold(page, target, 6500);
  let s = await snap(page);
  log.push({ step: 'centre-held', ...s });

  // 3. Slide down and out to the lower left of the chest.
  const mitral = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
  target = await page.evaluate(() => window.__game.projectChest(0, 0.3));
  await pressHold(page, target, 600, [{ ...mitral, hold: 5200 }]);
  s = await snap(page);
  log.push({ step: 'first-window', ...s });
  await shot(page, '03-first-window');

  // The reveal should now be running (it needs the dwell first).
  await sleep(900);
  const during = await snap(page);
  log.push({ step: 'reveal', ...during });
  await shot(page, '04-reveal');
  await sleep(4200);
  log.push({ step: 'after-reveal', ...(await snap(page)) });
  await shot(page, '05-after-reveal');

  // 4. Up to the second window.
  const aortic = await page.evaluate(() => window.__game.projectChest(-0.44, 0.68));
  await pressHold(page, aortic, 5600);
  log.push({ step: 'second-window', ...(await snap(page)) });
  await shot(page, '06-second-window');

  // 5. Compare by pressing the tiles that were set down on the stand.
  for (const id of ['mitral', 'aortic', 'mitral']) {
    const t = await page.evaluate((w) => window.__game.projectTile(w), id);
    if (t) {
      await page.mouse.click(t.x, t.y);
      await sleep(2600);
    }
  }
  log.push({ step: 'compared', ...(await snap(page)) });
  await shot(page, '07-compare');

  // 6. Find the remaining two areas.
  for (const [lat, sup] of [[0.16, 0.06], [0.36, 0.64]]) {
    const p = await page.evaluate(([a, b]) => window.__game.projectChest(a, b), [lat, sup]);
    await pressHold(page, p, 5600);
    await sleep(300);
  }
  log.push({ step: 'four-windows', ...(await snap(page)) });
  await shot(page, '08-four-windows');

  // 7. Rounds three and four: listen around while the rail is knocked.
  for (let round = 0; round < 2; round++) {
    for (const [lat, sup] of [[0.62, -0.36], [-0.44, 0.68], [0.36, 0.64]]) {
      const p = await page.evaluate(([a, b]) => window.__game.projectChest(a, b), [lat, sup]);
      await pressHold(page, p, 5200);
      await sleep(200);
    }
    log.push({ step: `round-${round + 3}`, ...(await snap(page)) });
  }
  await shot(page, '09-free-play');

  // 8. One tap on any tile returns straight to comparing.
  const back = await page.evaluate(() => window.__game.projectTile('mitral'));
  if (back) {
    await page.mouse.click(back.x, back.y);
    await sleep(1500);
  }
  log.push({ step: 'return-to-compare', ...(await snap(page)) });

  // 9. Posture change on the rail.
  const rail = await page.evaluate(() => window.__game.projectRail());
  await page.mouse.move(rail.x, rail.y);
  await page.mouse.down();
  await page.mouse.move(rail.x, rail.y - 90, { steps: 12 });
  await page.mouse.up();
  await sleep(1500);
  log.push({ step: 'posture', ...(await snap(page)) });
  await shot(page, '10-posture');

  // 10. Continuity of the sound field along a straight slide.
  const sweep = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      out.push(window.__game.probe(-0.44 + t * 1.06, 0.68 - t * 1.04));
    }
    return out;
  });
  report.sweep = sweep;

  // 11. Rotate and confirm nothing is lost.
  const before = await snap(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(1400);
  const after = await snap(page);
  log.push({ step: 'rotated-before', ...before });
  log.push({ step: 'rotated-after', ...after });
  await shot(page, '11-rotated-landscape');

  report.main = log;
  await ctx.close();
}

// ------------------------------------------------------- viewport coverage
report.viewports = [];
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(vp);
  const tips = await page.evaluate(() => window.__game.projectEarTips());
  await page.mouse.click(tips.x, tips.y);
  await sleep(1600);
  const centre = await page.evaluate(() => window.__game.projectChest(0, 0.3));
  await pressHold(page, centre, 6200);
  const mitral = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
  await pressHold(page, mitral, 5200);
  await sleep(5200);
  const st = await snap(page);
  // Every point the child must reach has to be on screen and clear of the
  // sound button in the corner.
  const points = await page.evaluate(() => ({
    aortic: window.__game.projectChest(-0.44, 0.68),
    pulmonic: window.__game.projectChest(0.36, 0.64),
    tricuspid: window.__game.projectChest(0.16, 0.06),
    mitral: window.__game.projectChest(0.62, -0.36),
    rail: window.__game.projectRail(),
    tile: window.__game.projectTile('mitral'),
  }));
  const onScreen = Object.fromEntries(
    Object.entries(points).map(([k, p]) => [
      k,
      p ? p.x > 8 && p.x < vp.width - 8 && p.y > 8 && p.y < vp.height - 8 : null,
    ]),
  );
  const clearOfHud = Object.fromEntries(
    Object.entries(points).map(([k, p]) => [k, p ? !(p.x > vp.width - 70 && p.y < 70) : null]),
  );
  report.viewports.push({ ...vp, state: st, points, onScreen, clearOfHud });
  await shot(page, `vp-${vp.name}`);
  await ctx.close();
}

await browser.close();
report.problems = problems;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ problems, viewports: report.viewports.map(v => ({ name: v.name, stage: v.state.stage, tiles: v.state.tiles, onScreen: v.onScreen, clearOfHud: v.clearOfHud })) }, null, 2));
console.log('--- main log ---');
for (const l of report.main) console.log(l.step, JSON.stringify(l));
