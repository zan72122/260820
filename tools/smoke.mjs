/**
 * Chromium smoke pass.
 *
 * Drives the real controls through the whole arc — the two discovery trials,
 * a floor change, a ball change, a height change and a three-surface chain —
 * and reports the state the game reached at each step.
 *
 * Runs under SwiftShader, so frame rate and image quality here mean nothing;
 * this checks that the sequence works and that nothing throws.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const VIEWPORTS = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};

const mode = process.argv[2] ?? 'iphone-portrait';
const vp = VIEWPORTS[mode] ?? VIEWPORTS['iphone-portrait'];
const shots = process.argv.includes('--shots');
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: vp,
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
});

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:5199/?debug=1', { waitUntil: 'load' });
await page
  .waitForFunction(() => window.__lab && document.getElementById('boot')?.classList.contains('gone'), null, { timeout: 90000 })
  .catch(() => errors.push('boot never completed'));

const snap = () => page.evaluate(() => window.__lab.snapshot());
const at = (name) => page.evaluate((n) => window.__lab.screenOf(n), name);
const impactPoint = () => page.evaluate(() => window.__lab.impact());
let shotN = 0;
const shot = async (name) => {
  if (!shots) return;
  await page.screenshot({ path: `${SHOT_DIR}/${mode}-${String(++shotN).padStart(2, '0')}-${name}.png` });
};

async function dragFrom(pt, dx, dy, steps = 14) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(pt.x + (dx * i) / steps, pt.y + (dy * i) / steps);
  await page.mouse.up();
}

async function pullRing() {
  const ring = await at('ring');
  if (!ring) throw new Error('ring not found');
  await dragFrom(ring, 0, vp.height * 0.24);
}

/** Wait until a predicate over the game's own state holds. */
async function until(label, pred, timeout = 120000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeout) {
    last = await snap();
    if (pred(last)) return last;
    await page.waitForTimeout(200);
  }
  errors.push(`timeout waiting for ${label}; state=${JSON.stringify(last)}`);
  return last;
}

const ready = (s) =>
  s.simPhase === 'held' && ['trial1.ready', 'trial2.ready', 'free'].includes(s.phase);

const log = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  const s = await fn();
  log.push({ step: name, ...(s ?? (await snap())) });
  await shot(name);
  console.error(`  ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
};

// --- The pixels are actually being drawn -----------------------------------
const png = await page.screenshot();
const distinct = new Set();
for (let i = 0; i < png.length; i += 997) distinct.add(png[i]);

let apex1 = 0;
let apex2 = 0;

await step('ready', async () => until('trial 1 ready', (s) => s.phase === 'trial1.ready' && ready(s)));

// --- Trial 1: the thick rubber mat ------------------------------------------
await step('trial1-drop', async () => {
  await pullRing();
  const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    const s = await snap();
    apex1 = Math.max(apex1, s.ballY);
    if (['trial1.result', 'presenting'].includes(s.phase)) return s;
    await page.waitForTimeout(80);
  }
  errors.push('trial 1 never resolved');
  return snap();
});

// --- The machine presents sample two by itself ------------------------------
await step('presented', async () =>
  until('trial 2 ready', (s) => s.phase === 'trial2.ready' && ready(s) && s.floor === 'sand')
);

// --- Trial 2: the same ball, the same height, a different floor -------------
await step('trial2-drop', async () => {
  await pullRing();
  const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    const s = await snap();
    apex2 = Math.max(apex2, s.ballY);
    if (['trial2.result', 'free'].includes(s.phase)) return s;
    await page.waitForTimeout(80);
  }
  errors.push('trial 2 never resolved');
  return snap();
});

await step('free-unlocked', async () => until('free play', (s) => s.phase === 'free' && ready(s)));

// --- Stage A: the child changes the floor themselves ------------------------
await step('floor-swiped', async () => {
  const before = (await snap()).floor;
  // Swipe across the sample that is currently loaded — the part of the tray
  // that is always on screen.
  const sample = await impactPoint();
  await dragFrom({ x: sample.x, y: sample.y + 12 }, -vp.width * 0.34, 0);
  return until('floor changed', (s) => s.floor !== before && ready(s));
});
await step('drop-on-chosen-floor', async () => {
  const before = (await snap()).drops;
  await pullRing();
  return until('drop recorded', (s) => s.drops > before && ready(s));
});
await step('mark-left-behind', async () => snap());

// --- Stages B, C and D ------------------------------------------------------
await page.evaluate(() => window.__lab.unlock('chain'));
await step('yard-opened', async () => until('yard active', (s) => s.chainActive && ready(s)));

await step('specimen-changed', async () => {
  const ball = await at('ball4');
  const clamp = await at('clamp');
  await dragFrom(ball, clamp.x - ball.x, clamp.y - ball.y, 18);
  return until('specimen loaded', (s) => s.ball !== 'rubber' && ready(s), 30000);
});

await step('height-changed', async () => {
  const handle = await at('handle');
  await dragFrom(handle, 0, -vp.height * 0.32);
  return until('height raised', (s) => s.heightIndex !== 1, 30000);
});

await step('tiles-placed', async () => {
  for (const [tile, pad] of [['tile3', 'pad1'], ['tile4', 'pad2']]) {
    const t = await at(tile);
    const p = await at(pad);
    if (!t || !p) continue;
    await dragFrom(t, p.x - t.x, p.y - t.y, 20);
    await page.waitForTimeout(900);
  }
  return until('three cradles filled', (s) => s.chainSlots.every(Boolean), 30000);
});

await step('chain-run', async () => {
  const before = (await snap()).drops;
  await pullRing();
  // The ball may finish on a cradle, on the apron, or already be back in the
  // clamp — all we require is that the drop happened and motion stopped.
  return until(
    'chain drop settled',
    (s) => s.drops > before && ['settled', 'held'].includes(s.simPhase),
    90000
  );
});

const finalDebug = await page.evaluate(() => document.getElementById('debug')?.textContent ?? '');

console.log(
  JSON.stringify(
    {
      mode,
      distinctBytes: distinct.size,
      apexTrial1: +apex1.toFixed(3),
      apexTrial2: +apex2.toFixed(3),
      errors,
      log,
      debug: finalDebug.split('\n').filter((l) => l.includes('fps') || l.includes('draw') || l.includes('texture') || l.includes('chain') || l.includes('built')),
    },
    null,
    2
  )
);

await browser.close();
await server.close();
