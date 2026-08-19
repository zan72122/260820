/**
 * End-to-end behaviour check, driven with the same one-finger gestures a child
 * would use. Logic time is advanced with the fixed-step tick() hook because the
 * software rasteriser in this container renders at roughly half a frame per
 * second; that says nothing about a real device and everything about GPU-less CI.
 */
import { arg, launch } from './browser.mjs';

const device = arg('device', 'iphone');
const { browser, page, dev, errors } = await launch(device, {
  url: arg('url', 'http://127.0.0.1:4173/?fast=1&quality=high&seed=3'),
});
const W = dev.width;
const H = dev.height;
// Gestures are normalised by the short screen edge, so the same finger travel
// means the same thing however the device is held. Drive the test that way too.
const U = Math.min(W, H);


const fails = [];
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fails.push(msg);
};


const tick = (s) => page.evaluate((v) => window.__butai.tick(v), s);
const st = () => page.evaluate(() => window.__butai.state());
const cam = () => page.evaluate(() => window.__butai.camera());

// --- boot ---------------------------------------------------------------
ok((await st()).phase === 'boot', 'starts in boot, waiting for a first touch');
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(400);
await tick(0.5);
ok((await st()).phase === 'wait', 'first touch starts the wait in the wing');

const drag = async (fromX, fromY, toX, toY, steps = 12) => {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps);
  }
  await page.mouse.up();
};

// --- the mystery holds for a beat --------------------------------------
await tick(2.0);
ok((await st()).phase === 'wait' && (await st()).hintStage === 0, 'no hint in the first seconds');

// --- peeking, in either direction --------------------------------------
const camBefore = await cam();
// A small pull: the cloth follows, the camera leans, nothing else happens yet.
await page.mouse.move(W * 0.66, H * 0.55);
await page.mouse.down();
for (let i = 1; i <= 5; i++) await page.mouse.move(W * 0.66 - U * 0.035 * i, H * 0.55);
await tick(0.5); // let the cloth and the camera respond to what has been pulled
const mid = await st();
const camPeek = await cam();
ok(mid.gap > 0.08, `dragging LEFT opens the cloth (gap ${mid.gap}m)`);
ok(mid.gap < 0.36, 'a peek is only ever a peek (<=~30cm)');
ok(Math.abs(camPeek.z - camBefore.z) > 0.15, `the camera leans in with the peek (dz ${(camPeek.z - camBefore.z).toFixed(2)}m)`);
ok(mid.phase === 'wait', 'a glance alone does not interrupt anything');

// Pull further and the teacher answers.
for (let i = 6; i <= 12; i++) await page.mouse.move(W * 0.66 - U * 0.035 * i, H * 0.55);
await page.mouse.up();
await tick(0.4);
ok((await st()).phase === 'notYet', 'a real peek gets the "not yet" answer');

await tick(3.0);
ok((await st()).phase === 'wait', 'the "not yet" resolves back to waiting, never a fail state');
ok((await st()).warned === true, 'the not-yet only happens once');

// dragging the other way must work too
await drag(W * 0.5 - U * 0.16, H * 0.5, W * 0.5 + U * 0.16, H * 0.5);
const rightDrag = await st();
ok(rightDrag.gap > 0.05, `dragging RIGHT also opens the cloth (gap ${rightDrag.gap}m)`);

// --- the act before ours ends and the cue arrives ----------------------
let phase = '';
for (let i = 0; i < 30; i++) {
  const s = await tick(0.5);
  phase = s.phase;
  if (phase === 'cue') break;
}
ok(phase === 'cue', 'the previous act ends and the teacher signals');

// --- going out ---------------------------------------------------------
await drag(W * 0.5 + U * 0.2, H * 0.72, W * 0.5 - U * 0.16, H * 0.4, 8);
ok((await st()).phase === 'walk', 'a swipe toward the stage sends the child out');

let sawReveal = false;
for (let i = 0; i < 40; i++) {
  const s = await tick(0.4);
  if (s.revealT > 0.9) sawReveal = true;
  if (s.phase === 'bow' || s.phase === 'again') break;
}
ok(sawReveal, 'the house reveal completes during the walk');
const endCam = await cam();
ok(endCam.z > 3.0 || (await st()).phase === 'bow', 'the camera pulls back for the reveal');

for (let i = 0; i < 30; i++) {
  const s = await tick(0.5);
  if (s.phase === 'again') break;
}
ok((await st()).phase === 'again', 'the round finishes and offers another go');

// --- replay ------------------------------------------------------------
await page.mouse.click(W / 2, H * 0.8);
await tick(0.4);
const r2 = await st();
ok(r2.phase === 'wait' && r2.round === 1, 'tapping starts a fresh round from the wing');
ok(r2.warned === false && r2.revealT === 0, 'the second round resets cleanly');

// --- hint escalation ---------------------------------------------------
for (let i = 0; i < 26; i++) await tick(0.8);
const hinted = await st();
ok(hinted.hintStage >= 2, `hints escalate when nothing happens (stage ${hinted.hintStage})`);

// --- orientation change ------------------------------------------------
await page.setViewportSize({ width: H, height: W });
await page.waitForTimeout(500);
await tick(0.5);
const land = await page.evaluate(() => window.__butai.camera());
ok(land.fov > 40 && land.fov < 82, `landscape keeps a sane field of view (${land.fov} deg)`);
ok(errors.length === 0, `no runtime errors (${errors.slice(0, 3).join(' | ') || 'none'})`);

console.log(`\n${fails.length ? `${fails.length} FAILED` : 'all checks passed'}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
