import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/?fast=1';
const OUT = process.env.OUT ?? './shots';
mkdirSync(OUT, { recursive: true });

const ONLY = (process.env.VPS ?? '').split(',').filter(Boolean);
const RUN_MAIN = process.env.MAIN !== '0';
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

/** Wait on the game's own state rather than on a guess about frame rate. */
async function waitFor(page, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await snap(page);
    if (predicate(last)) return last;
    await sleep(400);
  }
  return last;
}
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
if (RUN_MAIN) {
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

  // 4a. Settling on the *other* area in the same half must not end the round:
  // the first session is about hearing the two halves against each other.
  const partner = { tricuspid: [0.62, -0.36], mitral: [0.16, 0.06] };
  const firstFound = (await snap(page)).firstWindow;
  if (partner[firstFound]) {
    const same = await page.evaluate(
      ([a, b]) => window.__game.projectChest(a, b),
      partner[firstFound],
    );
    await pressHold(page, same, 7000);
    await sleep(600);
    log.push({ step: 'same-half', ...(await snap(page)) });
  }

  // 4b. Up to the second window, in the other half.
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
for (const vp of VIEWPORTS.filter((v) => !ONLY.length || ONLY.includes(v.name))) {
  const { ctx, page } = await newPage(vp);
  const tips = await page.evaluate(() => window.__game.projectEarTips());
  await page.mouse.click(tips.x, tips.y);
  await waitFor(page, (s) => s.stage === 'centre', 60000);

  // Hold in the middle of the chest until the tubing is freed, then hold on
  // one area until it has been listened to long enough to be saved.
  const centre = await page.evaluate(() => window.__game.projectChest(0, 0.34));
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await waitFor(page, (s) => s.stage === 'seekFirst', 90000);
  await page.mouse.up();

  const mitral = await page.evaluate(() => window.__game.projectChest(0.62, -0.36));
  await page.mouse.move(mitral.x, mitral.y);
  await page.mouse.down();
  await waitFor(page, (s) => s.tiles >= 1, 120000);
  await page.mouse.up();

  // Wait for the working camera, which is the shot the child plays in and the
  // only one everything has to be reachable from.
  await waitFor(page, (s) => s.shot === 'compare' || s.shot === 'play', 120000);
  await sleep(2500);
  const st = await snap(page);
  if (st.shot !== 'compare' && st.shot !== 'play') {
    problems.push(`[${vp.name}] never reached the working camera (stage ${st.stage})`);
  }
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

// ------------------------------------- shipping render path (shadows, IBL)
if (RUN_MAIN) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (/GL Driver Message|GPU stall|SwiftShader|software/i.test(t)) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[shipping] console.${m.type()}: ${t}`);
  });
  page.on('pageerror', (e) => problems.push(`[shipping] pageerror: ${e.message}`));
  await page.goto(BASE.split('?')[0], { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await sleep(6000);
  const tips = await page.evaluate(() => window.__game.projectEarTips());
  await page.mouse.click(tips.x, tips.y);
  await sleep(9000);
  report.shipping = await page.evaluate(() => window.__game.snapshot());
  if (report.shipping.stage !== 'centre') {
    problems.push(`[shipping] did not reach the first listen (stage ${report.shipping.stage})`);
  }
  await ctx.close();
}

// ---------------------------------------------------- offline audio check
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[audio] pageerror: ${e.message}`));
  await page.goto(`${BASE.split('?')[0]}?fast=1&selftest=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__audioSelfTest, null, { timeout: 60000 });
  report.audio = await page.evaluate(() => window.__audioSelfTest);
  await ctx.close();
}

// ------------------------------------------------------------- assertions
const failures = [];
const a = report.audio;
const by = Object.fromEntries(a.windows.map((w) => [w.id, w]));
if (!a.sweepMonotonic) failures.push('sound field is not monotonic across the chest');
if (!(by.mitral.balance > by.tricuspid.balance))
  failures.push('mitral should favour the first sound more than tricuspid');
if (!(by.tricuspid.balance > by.centre.balance))
  failures.push('tricuspid should favour the first sound more than the sternum');
if (!(by.centre.balance > by.pulmonic.balance))
  failures.push('pulmonic should favour the second sound more than the sternum');
if (!(by.pulmonic.balance > by.aortic.balance))
  failures.push('aortic should favour the second sound most');
if (!(by.aortic.brightness > by.mitral.brightness * 1.5))
  failures.push('the upper areas should sound more defined than the apex');
for (const v of report.viewports) {
  for (const [k, ok] of Object.entries(v.onScreen)) {
    if (ok === false) failures.push(`${v.name}: ${k} is off screen`);
  }
  for (const [k, ok] of Object.entries(v.clearOfHud)) {
    if (ok === false) failures.push(`${v.name}: ${k} is under the sound button`);
  }
}
const last = RUN_MAIN ? report.main[report.main.length - 1] : null;
if (last) {
const beforeRotate = report.main.find((l) => l.step === 'rotated-before');
if (last.tiles !== beforeRotate.tiles) failures.push('record tiles lost on rotation');
if (last.discovered.length !== beforeRotate.discovered.length)
  failures.push('discovered areas lost on rotation');
if (last.beat <= beforeRotate.beat) failures.push('heartbeat did not continue across rotation');
if (report.main.find((l) => l.step === 'four-windows').tiles < 3)
  failures.push('did not reach three saved places');
if (report.main.find((l) => l.step === 'posture').roll < 0.5)
  failures.push('the posture rail did not respond to a swipe');
const r3 = report.main.find((l) => l.step === 'round-3');
const r4 = report.main.find((l) => l.step === 'round-4');
if (!(r4.knocks > r3.knocks))
  failures.push('the instructor never knocked the beat during the marked rounds');
if (last.audioInterrupted) failures.push('audio was left interrupted');
// The first session has to put the two halves of the chest against each other.
const sameHalf = report.main.find((l) => l.step === 'same-half');
if (sameHalf && sameHalf.stage !== 'seekSecond')
  failures.push('a second area from the same half ended the first session early');
if (sameHalf && sameHalf.tiles < 2)
  failures.push('a same-half area was not saved even though it was listened to');
const second = report.main.find((l) => l.step === 'second-window');
const upper = ['aortic', 'pulmonic'];
const halves = new Set(second.discovered.map((d) => (upper.includes(d) ? 'upper' : 'lower')));
if (halves.size < 2)
  failures.push('the first two areas came from the same half of the chest');
// The simulation must leave almost the whole frame budget for drawing.
if (last.render && last.render.updateMs > 6)
  failures.push(`simulation costs ${last.render.updateMs} ms a frame, too much of the budget`);
}
report.failures = failures;

await browser.close();
report.problems = problems;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log('--- audio measured offline ---');
console.log('sweep is monotonic across the chest:', report.audio.sweepMonotonic);
for (const w of report.audio.windows) {
  console.log(
    `  ${w.id.padEnd(10)} S1 ${w.s1.toFixed(4)}  S2 ${w.s2.toFixed(4)}  S1/S2 ${w.balance.toFixed(2).padStart(5)}  definition ${w.brightness.toFixed(3)}`,
  );
}
console.log('--- run ---');
for (const l of report.main ?? []) {
  console.log(
    `  ${l.step.padEnd(18)} stage=${String(l.stage).padEnd(15)} tiles=${l.tiles} found=[${l.discovered.join(',')}] beat=${l.beat} knocks=${l.knocks} roll=${l.roll} portrait=${l.portrait}`,
  );
}
console.log('--- scene cost (hardware independent) ---');
{
  const r = (report.main ?? []).filter((l) => l.render).slice(-1)[0];
  if (r) {
    console.log(
      `  draw calls ${r.render.calls}  triangles ${r.render.triangles}  shader programs ${r.render.programs}  geometries ${r.render.geometries}  textures ${r.render.textures}`,
    );
    console.log(`  simulation cost per frame (median, excluding the draw): ${r.render.updateMs} ms`);
  }
}
console.log('--- viewports ---');
for (const v of report.viewports) {
  console.log(`  ${v.name.padEnd(18)} ${v.width}x${v.height}@${v.dpr}  stage=${v.state.stage}  everything on screen and clear of the HUD: ${Object.values(v.onScreen).every((x) => x !== false) && Object.values(v.clearOfHud).every((x) => x !== false)}`);
}
console.log('--- console problems ---', problems.length ? problems : 'none');
console.log('--- failures ---', failures.length ? failures : 'none');
if (failures.length || problems.length) process.exitCode = 1;
