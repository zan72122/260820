// Drives a full play-through in Chromium and reports state, console errors and
// screenshots. Usage: node scripts/play.mjs <device> [outDir]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import { seekLocator } from './lib.mjs';

const PROFILES = {
  'iphone-portrait': { width: 390, height: 844, dsf: 2 },
  'iphone-landscape': { width: 844, height: 390, dsf: 2 },
  'ipad-portrait': { width: 820, height: 1180, dsf: 1 },
  'ipad-landscape': { width: 1180, height: 820, dsf: 1 },
};

const name = process.argv[2] || 'iphone-portrait';
const outDir = process.argv[3] || 'shots';
const stopAfter = Number(process.argv[4] || 0);
const profile = PROFILES[name];
if (!profile) throw new Error('unknown profile ' + name);
fs.mkdirSync(outDir, { recursive: true });

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-lcd-text',
    '--no-sandbox',
  ],
});
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: profile.width, height: profile.height },
  deviceScaleFactor: profile.dsf,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

const errors = [];
const warns = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  else if (m.type() === 'warning') warns.push(t);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__dig, null, { timeout: 30000 });

const state = () =>
  page.evaluate(() => ({
    phase: window.__dig.phase(),
    site: window.__dig.site(),
    exposure: +window.__dig.exposure().toFixed(3),
    depth: +window.__dig.maxDepth().toFixed(3),
    signal: +window.__dig.signal().toFixed(3),
    finger: window.__dig.finger(),
    route: window.__dig.route(),
  }));

const shot = (tag) =>
  page.screenshot({ path: `${outDir}/${name}-${tag}.png`, timeout: 120000 });

// tap to start
await page.mouse.move(profile.width / 2, profile.height / 2);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(1200);
await shot('01-start');

const log = [];
let lastPhase = '';
const deadline = Date.now() + 600000;
let guard = 0;
const seen = new Set();

async function press(x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
}
async function release() {
  await page.mouse.up();
}

while (Date.now() < deadline && guard++ < 4000) {
  const s = await state();
  const key = `${s.site}:${s.phase}`;
  if (s.phase !== lastPhase) {
    log.push(`${(guard + '').padStart(4)} site=${s.site} ${s.phase} exp=${s.exposure} depth=${s.depth}`);
    lastPhase = s.phase;
    if (!seen.has(key)) {
      seen.add(key);
      // let the camera settle so the frame shows the real composition
      await page.waitForTimeout(2600);
      await shot(`${String(seen.size).padStart(2, '0')}-s${s.site}-${s.phase}`);
      if (stopAfter && seen.size >= stopAfter) break;
    }
  }

  if (s.phase === 'detect') {
    await seekLocator(page, state, profile.width, profile.height);
  } else if (s.phase === 'water') {
    // wet the ground along the run so the suction has something to lift
    await press(s.finger.x, s.finger.y);
    for (let i = 0; i < 46; i++) {
      const cur = await state();
      if (cur.phase !== 'water') break;
      const [a, b] = cur.route;
      const t = (Math.sin(i * 0.22) + 1) / 2;
      await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      await page.waitForTimeout(65);
      if (i === 24 && !seen.has('water-live')) {
        seen.add('water-live');
        await shot('live-water');
      }
    }
    await release();
  } else if (s.phase === 'vacuum') {
    // sweep back and forth along the buried run, the way the pipe is bared
    await press(s.finger.x, s.finger.y);
    for (let i = 0; i < 70; i++) {
      const cur = await state();
      if (cur.phase !== 'vacuum') break;
      const [a, b] = cur.route;
      const t = (Math.sin(i * 0.18) + 1) / 2;
      await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      await page.waitForTimeout(60);
      if (i === 30 && !seen.has('vac-live')) {
        seen.add('vac-live');
        await shot('live-vacuum');
      }
    }
    await release();
  } else if (s.phase === 'depth') {
    const { x, y } = s.finger;
    await press(x, y);
    for (let i = 0; i < 45; i++) {
      const cur = await state();
      if (cur.phase !== 'depth') break;
      await page.mouse.move(x, y + i * 6);
      await page.waitForTimeout(55);
    }
    await release();
  } else if (s.phase === 'finale') {
    await shot('99-finale');
    break;
  } else {
    await page.waitForTimeout(220);
  }
}

const final = await state();
log.push(`FINAL ${JSON.stringify(final)}`);
console.log(log.join('\n'));
console.log('--- console errors ---');
console.log(errors.length ? errors.slice(0, 20).join('\n') : '(none)');
console.log('--- console warnings ---');
console.log(warns.length ? [...new Set(warns)].slice(0, 12).join('\n') : '(none)');

await browser.close();
process.exit(errors.length ? 1 : 0);
