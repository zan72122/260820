import { chromium } from 'playwright';
import fs from 'node:fs';

const SHOTS = process.env.SHOTS;
const TAG = process.env.TAG || 'iphone-portrait';
const SIZE = JSON.parse(process.env.SIZE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(process.env.URL || 'http://127.0.0.1:5173/', { waitUntil: 'load' });
await sleep(2000);

const st = () => page.evaluate(() => window.__bp.state());
const adv = (s) => page.evaluate((n) => window.__bp.advance(n), s);
const at = (n) => page.evaluate((k) => window.__bp.screenOf(k), n);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${TAG}-${n}.png` });
const audioState = () => page.evaluate(() => ({ ctx: window.__bp.audio.ctx?.state ?? null, t: +(window.__bp.audio.now).toFixed(2) }));

const log = (k, v) => console.log(k.padEnd(12), JSON.stringify(v));

await adv(7);
await shot('01-open');
log('open', await st());
log('audio-pre', await audioState());

// --- 1. place the chestpiece (this touch is what starts the audio) --------
const fossaPx = () => page.evaluate(() => {
  const b = window.__bp, f = b.scene.manikin.fossa;
  const v = new f.constructor(f.x, f.y, f.z).project(b.camera.camera);
  return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
});
let cp = await at('chestpiece');
let fossa = await fossaPx();
log('anchors', { cp, fossa });
await page.mouse.move(cp.x, cp.y);
await page.mouse.down();
for (let i = 1; i <= 16; i++) {
  const t = i / 16;
  fossa = await fossaPx();
  await page.mouse.move(cp.x + (fossa.x - cp.x) * t, cp.y + (fossa.y - cp.y) * t);
  await adv(0.05);
}
await page.mouse.up();
await adv(1.6);
await sleep(300);
log('placed', await st());
log('audio', await audioState());
await shot('02-placed');

// --- 2. inflate ------------------------------------------------------------
for (let i = 0; i < 16; i++) {
  const b = await at('bulb');
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await adv(0.22);
  await page.mouse.up();
  await adv(0.18);
  const s = await st();
  if (s.pressure > 0.8) break;
}
await adv(0.6);
log('inflated', await st());
log('voicing', await page.evaluate(() => window.__bp.game.pressure.stage));
await shot('03-inflated');

// --- 3. the silence --------------------------------------------------------
const beforeHold = (await st()).sounds;
await sleep(3500);
await adv(2.4);
const holdState = await st();
log('silence', holdState);
log('silent?', { newSounds: holdState.sounds - beforeHold });
await shot('04-silence');

// --- 4. open the valve a little -------------------------------------------
const v0 = await at('valve');
const R = 26;
const soundsBeforeValve = (await st()).sounds;
await page.mouse.move(v0.x - R, v0.y);
await page.mouse.down();
for (let i = 1; i <= 14; i++) {
  const a = Math.PI + (i / 14) * Math.PI * 0.5;
  await page.mouse.move(v0.x + Math.cos(a) * R, v0.y + Math.sin(a) * R);
  await sleep(120);
}
await page.mouse.up();
log('valve', await st());

// --- 5. listen -------------------------------------------------------------
let firstSound = null, revealSeen = null;
let lastSounds = soundsBeforeValve;
const trace = [];
for (let i = 0; i < 90; i++) {
  await sleep(900);
  const s = await st();
  trace.push({ p: +s.pressure.toFixed(3), stage: s.stage, sounds: s.sounds, beat: s.beat, exp: +s.exposure.toFixed(2) });
  if (!firstSound && s.sounds > lastSounds) { firstSound = s; await shot('05-first-sound'); log('SOUND', s); }
  if (!revealSeen && s.exposure > 0.6) { revealSeen = s; await shot('06-reveal'); log('reveal', s); }
  if (s.beat === 'fading' || s.beat === 'comparison' || s.beat === 'ready') break;
}
log('afterwindow', await st());
await shot('07-after');
fs.writeFileSync(`${SHOTS}/${TAG}-trace.json`, JSON.stringify(trace, null, 1));

// --- 6. silence again, then the comparison and the replay ------------------
for (let i = 0; i < 60; i++) {
  await adv(1.2);
  await sleep(220);
  const s = await st();
  if (s.beat === 'comparison' && !fs.existsSync(`${SHOTS}/${TAG}-08-comparison.png`)) { await shot('08-comparison'); log('compare', s); }
  if (s.beat === 'ready') { await shot('09-ready'); log('ready', s); break; }
}

const replayVisible = await page.isVisible('.replay.is-on');
log('replayBtn', { visible: replayVisible });
if (replayVisible) {
  await page.click('.replay');
  await adv(3.5);
  await sleep(400);
  log('run2', await st());
  await shot('10-run2');
}

// --- 7. orientation flip mid-state ----------------------------------------
const before = await st();
await page.setViewportSize({ width: SIZE.height, height: SIZE.width });
await sleep(1200);
await adv(1.0);
const after = await st();
log('rotate-before', before);
log('rotate-after', after);
await shot('11-rotated');

fs.writeFileSync(`${SHOTS}/${TAG}-console.txt`, logs.join('\n'));
console.log('--- console (errors/warnings) ---');
console.log(logs.join('\n') || '(none)');
await browser.close();
