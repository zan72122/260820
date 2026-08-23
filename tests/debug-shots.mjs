// Visual audit helper: full-quality screenshots of key moments.
// Usage: node tests/debug-shots.mjs  (preview server on :4173 must be running)
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function shoot(name, vw, vh, actions) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  await page.goto('http://localhost:4173/?e2e&hq');
  await page.waitForFunction(() => !!window.__kc);
  await page.evaluate(() => window.__kc.pause());
  await actions(page);
  await page.evaluate(() => window.__kc.render());
  await page.screenshot({ path: `test-results/shots/${name}.png` });
  await page.close();
}

const step = (page, s) => page.evaluate((v) => window.__kc.step(v), s);
const setSpacing = (page, v) => page.evaluate((s) => window.__kc.setSpacing(s), v);
const valve = (page) => page.evaluate(() => window.__kc.openValve());
const next = (page) => page.evaluate(() => window.__kc.next());

// AV intro 3/4 view
await shoot('hq-av-intro', 1366, 1024, async (p) => {
  await step(p, 0.8);
});
// AV wide, demo test falling
await shoot('hq-av-wide-fall', 844, 390, async (p) => {
  await step(p, 5.4);
});
// AV result after demo (portrait)
await shoot('hq-av-result', 390, 844, async (p) => {
  await step(p, 16);
});
// AV ok spacing, capsule mid-channel
await shoot('hq-av-ok-mid', 844, 390, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 2.1);
});
// AV captured
await shoot('hq-av-captured', 844, 390, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 12);
});
// AV narrow stuck (portrait)
await shoot('hq-av-narrow-stuck', 390, 844, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.28);
  await valve(p);
  await step(p, 5);
});
// OO adjust wide
await shoot('hq-oo-wide', 844, 390, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
});
// OO ok mid-fall
await shoot('hq-oo-ok-mid', 390, 844, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
  await setSpacing(p, 0.41);
  await valve(p);
  await step(p, 2.0);
});
// LT ok mid-roll
await shoot('hq-lt-ok-mid', 844, 390, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
  await setSpacing(p, 0.41);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
  await setSpacing(p, -0.1);
  await valve(p);
  await step(p, 2.2);
});
// LT wide (bridge doesn't reach)
await shoot('hq-lt-wide', 844, 390, async (p) => {
  await step(p, 16);
  await setSpacing(p, -0.08);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
  await setSpacing(p, 0.41);
  await valve(p);
  await step(p, 14);
  await next(p);
  await step(p, 8);
  await valve(p);
  await step(p, 2.4);
});

await browser.close();
console.log('shots done');
