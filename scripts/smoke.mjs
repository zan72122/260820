/**
 * Chromium smoke check for the production build.
 *
 * Runs the real game with `?e2e=1&fast=1`, drives one complete round in both
 * screen orientations and captures screenshots. Software rendering means
 * frame rate and final image quality are NOT judged here — only that the
 * build boots, the causal chain works and the simulation reaches a result.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'artifacts';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3 },
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
];

const results = [];
let failures = 0;

function check(label, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
  return ok;
}

const EXECUTABLE =
  process.env.SMOKE_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}/?e2e=1&fast=1&debug=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 60000 });

  const label = vp.name;
  const s0 = await page.evaluate(() => window.__lab.state());
  check(`${label}: boots with an object waiting at the gate`, s0.runState === 'armed' && s0.phase === 'held', JSON.stringify({ object: s0.object, shot: s0.shot }));
  check(`${label}: orientation detected`, s0.orientation === (vp.width < vp.height ? 'portrait' : 'landscape'), s0.orientation);
  check(`${label}: gate framing shows lever and object together`, s0.shot === 'gate');

  await page.screenshot({ path: `${OUT}/${label}-01-intro.png` });

  // Hint escalation without touching anything.
  await page.evaluate(() => window.__lab.step(15));
  const hinted = await page.evaluate(() => window.__lab.state());
  check(`${label}: still waiting after 15 s of hints`, hinted.runState === 'armed');

  // Pull the gate lever.
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(0.55));
  const moving = await page.evaluate(() => window.__lab.state());
  check(`${label}: gate release starts the object moving`, moving.phase === 'slide' && moving.speed > 0.05, `v=${moving.speed.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/${label}-02-release.png` });

  await page.evaluate(() => window.__lab.step(1.1));
  const midShot = await page.evaluate(() => window.__lab.state());
  check(`${label}: camera follows the slide`, midShot.shot === 'follow' || midShot.shot === 'landing', midShot.shot);
  await page.screenshot({ path: `${OUT}/${label}-03-sliding.png` });

  await page.evaluate(() => window.__lab.step(7));
  const first = await page.evaluate(() => window.__lab.state());
  check(`${label}: first object reaches a result`, first.phase === 'rest', `x=${first.x?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/${label}-04-landed.png` });

  await page.evaluate(() => window.__lab.step(3));
  const offered = await page.evaluate(() => window.__lab.state());
  check(`${label}: a contrasting second object is offered`, offered.stage === 'contrastOffer' || offered.stage === 'contrastRun', offered.stage);

  // Take the offer by hand, then run it from the same gate.
  const placed = await page.evaluate(() => window.__lab.place('feltbag', 'top'));
  check(`${label}: second object can be placed at the same start`, placed === true);
  await page.evaluate(() => window.__lab.pullGate(1));
  await page.evaluate(() => window.__lab.step(9));
  const second = await page.evaluate(() => window.__lab.state());
  check(
    `${label}: second material behaves differently (stops on the bed)`,
    second.phase === 'rest' && second.onSlide === true,
    `onSlide=${second.onSlide} arc=${second.arc?.toFixed(2)}`,
  );
  await page.screenshot({ path: `${OUT}/${label}-05-contrast.png` });

  await page.evaluate(() => window.__lab.step(3));
  const opened = await page.evaluate(() => window.__lab.state());
  check(`${label}: the full trolley opens after the comparison`, opened.layer >= 1, `layer=${opened.layer} stage=${opened.stage}`);
  await page.screenshot({ path: `${OUT}/${label}-06-freeplay.png` });

  const stats = await page.evaluate(() => window.__lab.state());
  results.push(
    `INFO  ${label}: draw calls ${stats.calls}, triangles ${stats.triangles}, textures ${stats.textures}`,
  );

  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const report = results.join('\n');
writeFileSync(`${OUT}/smoke-report.txt`, report + '\n');
console.log(report);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
