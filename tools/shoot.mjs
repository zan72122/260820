/**
 * Drives the game in Chromium and writes screenshots so framing, readability
 * and the reveal can be judged against what a player actually sees.
 *
 * Software rasterisation here is ~50x slower than any real phone GPU, so this
 * uses the fixed-step `tick()` hook to advance game logic and only renders the
 * frames we photograph. FPS numbers from this harness mean nothing (see
 * CLAUDE.md); framing, exposure and state flow do.
 */
import fs from 'node:fs';
import { arg, launch } from './browser.mjs';

const device = arg('device', 'iphone');
const tag = arg('tag', device);
const outDir = arg('out', 'shots');
const { browser, page, dev, errors: logs } = await launch(device, {
  url: arg('url', 'http://127.0.0.1:4173/?fast=1&quality=high&seed=7'),
});
fs.mkdirSync(outDir, { recursive: true });



const shot = async (name) => {
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${outDir}/${tag}-${name}.png` });
};
const tick = (s) => page.evaluate((v) => window.__butai.tick(v), s);
const peek = (v) => page.evaluate((v2) => window.__butai.peek(v2), v);

await page.mouse.click(dev.width / 2, dev.height / 2);
await page.waitForTimeout(1200); // let the boot veil actually fade
await tick(1.2);
await shot('01-wing');
console.log('wing', JSON.stringify(await page.evaluate(() => window.__butai.state())));

// Peek: hold the cloth open and let the camera step up to it.
await peek(0.55);
await tick(1.4);
await shot('02-peek-half');
await peek(1.0);
await tick(1.6);
await shot('03-peek-full');
console.log('peek', JSON.stringify(await page.evaluate(() => window.__butai.state())));

await peek(-1); // release the pinned peek: everything after is real input

// Real drag input, to prove the gesture path works end to end.
const cx = dev.width * 0.5;
const cy = dev.height * 0.55;
await page.mouse.move(cx - dev.width * 0.16, cy);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(cx - dev.width * 0.16 + (dev.width * 0.32 * i) / 10, cy);
}
await page.mouse.up();
await tick(0.6);
console.log('after real drag', JSON.stringify(await page.evaluate(() => window.__butai.state())));
await shot('04-notyet');

// Through the previous act's ending, the applause and the hush.
for (let i = 0; i < 30; i++) {
  const s = await tick(0.7);
  if (s.phase === 'cue') break;
}
await tick(1.6);
await shot('05-cue');
console.log('cue', JSON.stringify(await page.evaluate(() => window.__butai.state())));

// Swipe toward the stage.
await page.mouse.move(dev.width * 0.72, dev.height * 0.74);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(dev.width * (0.72 - 0.055 * i), dev.height * (0.74 - 0.04 * i));
}
await page.mouse.up();
console.log('after swipe', JSON.stringify(await page.evaluate(() => window.__butai.state())));

const marks = [1.2, 1.2, 1.0, 1.0, 1.0, 1.0];
let n = 6;
for (const m of marks) {
  await tick(m);
  await shot(`0${n}-walk`);
  n++;
}
console.log('walk', JSON.stringify(await page.evaluate(() => window.__butai.state())));
await tick(2.2);
await shot('12-bow');
await tick(3.0);
await page.waitForTimeout(1100); // the replay ring fades in on real time
await shot('13-again');
console.log('end', JSON.stringify(await page.evaluate(() => window.__butai.state())));
console.log('camera', JSON.stringify(await page.evaluate(() => window.__butai.camera())));
console.log('backend', await page.evaluate(() => window.__butai.backend));
if (logs.length) console.log('--- console ---\n' + logs.slice(0, 25).join('\n'));
await browser.close();
