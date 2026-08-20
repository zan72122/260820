/**
 * Chromium smoke check for the production build.
 *
 * Runs the real game with `?e2e=1&fast=1`. Every viewport gets the opening
 * sequence — object waiting at the gate, hints, release, result, contrast —
 * and one viewport also plays the whole progression through both later
 * layers. Software rendering means frame rate and final image quality are NOT
 * judged here; only that the build boots, the causal chain works and the
 * simulation reaches the results it should.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const EXECUTABLE =
  process.env.SMOKE_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'artifacts';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3, deep: true },
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
];

const results = [];
let failures = 0;

const check = (label, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
  return ok;
};
const info = (line) => results.push(`INFO  ${line}`);

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('favicon')) errors.push(text);
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  const label = vp.name;
  const lab = (fn, arg) => page.evaluate(fn, arg);
  const state = () => page.evaluate(() => window.__lab.state());
  const step = (s) => page.evaluate((n) => window.__lab.step(n), s);
  const shotPng = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, scale: 'css' });

  await page.goto(`${BASE}/?e2e=1&fast=1&debug=1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 90000 });

  // --- the first question ------------------------------------------------
  const s0 = await state();
  check(
    `${label}: opens with one object held at the gate`,
    s0.runState === 'armed' && s0.phase === 'held',
    JSON.stringify({ object: s0.object, shot: s0.shot }),
  );
  check(
    `${label}: orientation drives a different camera rig`,
    s0.orientation === (vp.width < vp.height ? 'portrait' : 'landscape'),
    s0.orientation,
  );
  check(`${label}: opening shot holds lever and object together`, s0.shot === 'gate');
  await shotPng('01-intro');

  // Hints escalate on their own and never release the gate.
  await step(16);
  const hinted = await state();
  check(`${label}: 16 s of hints do not start the object`, hinted.runState === 'armed' && hinted.phase === 'held');

  // A partial pull must not be enough.
  await lab(() => window.__lab.pullGate(0.3));
  await step(0.8);
  const partial = await state();
  check(`${label}: a half pull leaves the gate shut`, partial.phase === 'held');

  await lab(() => window.__lab.pullGate(1));
  await step(0.4);
  const moving = await state();
  check(
    `${label}: pulling the lever starts the object moving`,
    moving.phase === 'slide' && moving.speed > 0.05,
    `v=${moving.speed.toFixed(2)} shot=${moving.shot}`,
  );
  check(`${label}: the release is still framed with the lever`, moving.shot === 'gate');
  await shotPng('02-release');

  await step(0.75);
  await shotPng('03-sliding');
  await step(8);
  const first = await state();
  check(`${label}: the first object reaches a result`, first.phase === 'rest', `x=${first.x?.toFixed(2)}`);
  await shotPng('04-landed');

  const shots = await page.evaluate(() => window.__lab.shots());
  check(
    `${label}: shot grammar ran gate -> follow -> landing`,
    shots.includes('gate') && shots.includes('follow') && shots.includes('landing'),
    shots.join(' > '),
  );

  await step(3.5);
  const offered = await state();
  check(
    `${label}: a contrasting second object is offered`,
    offered.stage === 'contrastOffer' || offered.stage === 'contrastRun',
    offered.stage,
  );
  check(`${label}: the camera returns to the whole slide`, offered.shot === 'overview', offered.shot);

  const placed = await lab(() => window.__lab.place('feltbag', 'top'));
  check(`${label}: the second object goes to the same start`, placed === true);
  const held2 = await state();
  check(`${label}: the boom actually holds it`, held2.phase === 'held' && held2.zone === 'top');

  await lab(() => window.__lab.pullGate(1));
  await step(9);
  const second = await state();
  check(
    `${label}: same slide, same start, different material, different result`,
    second.phase === 'rest' && second.onSlide === true && first.onSlide === false,
    `felt stops on the bed at ${second.arc?.toFixed(2)} m; steel left it and rolled to x=${first.x?.toFixed(2)}`,
  );
  await shotPng('05-contrast');

  await step(3);
  const opened = await state();
  check(
    `${label}: the full trolley only opens after that comparison`,
    opened.layer >= 1 && opened.stage === 'free',
    `layer=${opened.layer}`,
  );
  await shotPng('06-freeplay');

  if (vp.deep) {
    // --- layer 2: the same object from a different height ----------------
    const before2 = await state();
    check(`${label}: the other start bands stay shut at layer 1`, before2.layer === 1);

    for (const id of ['rubberball', 'woodcyl']) {
      await lab((o) => window.__lab.place(o, 'top'), id);
      await lab(() => window.__lab.pullGate(1));
      await step(9);
    }
    await step(2);
    const l2 = await state();
    check(`${label}: start bands open once three materials have run`, l2.layer >= 2, `layer=${l2.layer}`);

    const midOk = await lab(() => window.__lab.place('steel', 'middle'));
    check(`${label}: an object can now be started half way down`, midOk === true);
    await lab(() => window.__lab.pullGate(1));
    await step(9);
    const mid = await state();
    check(
      `${label}: a lower start gives a shorter result`,
      mid.phase === 'rest' && mid.x < first.x - 0.5,
      `top x=${first.x?.toFixed(2)} vs middle x=${mid.x?.toFixed(2)}`,
    );
    await shotPng('07-middle-start');

    await step(3);
    const l3 = await state();
    check(`${label}: surface tools open after a height comparison`, l3.layer >= 3, `layer=${l3.layer}`);

    // --- layer 3: change the bed, not the object -------------------------
    const dry = await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        window.__lab.tool('cloth', 2.6);
        window.__lab.tool('cloth', 3.0);
        window.__lab.tool('cloth', 3.4);
        window.__lab.step(0.05);
      }
      return window.__lab.surface();
    });
    info(`${label}: after wiping, wet total ${dry.wet.toFixed(1)}`);
    await lab(() => window.__lab.place('feltbag', 'top'));
    await lab(() => window.__lab.pullGate(1));
    await step(9);
    const onDry = await state();

    await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        window.__lab.tool('dropper', 2.4);
        window.__lab.tool('dropper', 2.9);
        window.__lab.tool('dropper', 3.3);
        window.__lab.step(0.05);
      }
    });
    const wetTotals = await page.evaluate(() => window.__lab.surface());
    check(`${label}: the dropper puts water back on the bed`, wetTotals.wet > dry.wet + 2, `${dry.wet.toFixed(1)} -> ${wetTotals.wet.toFixed(1)}`);
    const rearmed = await lab(() => window.__lab.place('feltbag', 'top'));
    check(`${label}: the same object can be run again on a changed bed`, rearmed === true);
    await lab(() => window.__lab.pullGate(1));
    await step(9);
    const onWet = await state();
    check(
      `${label}: same object, same start, wetter bed, further along`,
      onWet.arc > onDry.arc + 0.15,
      `dry ${onDry.arc?.toFixed(2)} m vs wet ${onWet.arc?.toFixed(2)} m`,
    );
    await shotPng('08-wet-bed');

    const sanded = await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        window.__lab.tool('sand', 1.2);
        window.__lab.tool('sand', 1.6);
        window.__lab.step(0.05);
      }
      return window.__lab.surface();
    });
    check(`${label}: sand can be sprinkled on the bed`, sanded.sand > 2, sanded.sand.toFixed(1));
    await lab(() => window.__lab.place('steel', 'top'));
    await lab(() => window.__lab.pullGate(1));
    await step(9);
    const onSand = await state();
    check(
      `${label}: grit on the bed shortens the same experiment`,
      onSand.x < first.x - 0.3,
      `clean x=${first.x?.toFixed(2)} vs sanded x=${onSand.x?.toFixed(2)}`,
    );

    await page.evaluate(() => window.__lab.tool('strip', 2.2));
    const strip = await page.evaluate(() => window.__lab.surface());
    check(`${label}: a rubber strip can be laid on the bed`, strip.rubber > 1, strip.rubber.toFixed(1));
    check(`${label}: four distinguishable bed states exist`, strip.states >= 3, `distinct=${strip.states}`);
    await shotPng('09-surface-tools');

    // --- the pad is a place to put a guess, not a target -----------------
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) {
        window.__lab.tool('cloth', 1.4);
        window.__lab.tool('cloth', 2.2);
        window.__lab.step(0.05);
      }
    });
    await lab(() => window.__lab.moveMat(20, 0));
    await lab(() => window.__lab.place('woodcyl', 'top'));
    await lab(() => window.__lab.pullGate(1));
    await step(10);
    const noMat = await state();
    await lab(() => window.__lab.moveMat(5.4, 0));
    await lab(() => window.__lab.place('woodcyl', 'top'));
    await lab(() => window.__lab.pullGate(1));
    await step(10);
    const onMat = await state();
    check(`${label}: the run still completes with the pad down`, onMat.phase === 'rest');
    check(
      `${label}: landing on the soft pad stops it sooner`,
      onMat.x < noMat.x - 0.3,
      `pad away x=${noMat.x?.toFixed(2)} vs pad at 5.4 x=${onMat.x?.toFixed(2)}`,
    );
    await shotPng('10-mat');

    const tel = await page.evaluate(() => {
      const s = window.__lab.state();
      return { runs: s.runs, layer: s.layer };
    });
    info(`${label}: ${tel.runs} runs completed, layer ${tel.layer}`);
  }

  const stats = await state();
  info(`${label}: draw calls ${stats.calls}, triangles ${stats.triangles}, textures ${stats.textures}`);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const report = results.join('\n');
writeFileSync(`${OUT}/smoke-report.txt`, report + '\n');
console.log(report);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
