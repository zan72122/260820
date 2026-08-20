// Visual tuning harness.
//
// Boots the built game in Chromium, freezes the clock, steps the simulation by
// hand and writes a PNG per moment of interest. Under SwiftShader this says
// nothing about performance -- only about composition, value and colour, which
// is exactly what it is for.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const url = process.env.URL || 'http://127.0.0.1:4173/';
const outDir = process.env.OUT || 'shots';
const tier = process.env.TIER || 'low';
const dpr = process.env.DPR || '1';
const seed = process.env.SEED || '7';
const orientation = process.env.ORIENT || 'portrait';
const shots = (process.env.SHOTS || '0,0.06,0.2,0.55,0.8,0.97,fall').split(',');

const viewport =
  orientation === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-lcd-text',
  ],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const full = `${url}?muted&capture&debug&tier=${tier}&dpr=${dpr}&seed=${seed}`;
console.log('open', full);
await page.goto(full, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__senko && globalThis.__senko.frame > 0, null, {
  timeout: 120000,
});

// The opening fade is a real CSS transition; without waiting it out the first
// screenshot of every run comes back a stop darker than the rest.
await page.waitForFunction(
  () => getComputedStyle(document.getElementById('veil')).opacity === '0',
  null,
  { timeout: 30000 }
);
await page.evaluate(() => globalThis.__senko.stop());

async function settle(steps, dt = 1 / 60) {
  await page.evaluate(
    ([n, d]) => {
      const a = globalThis.__senko;
      for (let i = 0; i < n; i++) {
        // Stand in for a finger resting on the glass, so grip does not bleed
        // away while the harness is settling a stage.
        if (a.session.state === 'burning') a.session.grip = 1;
        a.step(d);
      }
    },
    [steps, dt]
  );
}

for (const shot of shots) {
  const t0 = Date.now();
  if (shot === 'drop' || shot === 'fall' || shot === 'quiet' || shot === 'offer') {
    // Let the closing framing converge before letting go, the way it does when
    // the sparkler actually runs its course.
    await page.evaluate(() => {
      const a = globalThis.__senko;
      a.seek(0.97);
      a.session.grip = 1;
    });
    await settle(260);
    await page.evaluate(() => globalThis.__senko.session._detach());
    if (shot === 'drop') await settle(11);
    else if (shot === 'fall') await settle(48);
    else if (shot === 'quiet') await settle(200, 1 / 40);
    else await settle(150, 1 / 14);
  } else {
    const p = Number(shot);
    await page.evaluate((v) => {
      const a = globalThis.__senko;
      a.session.state = 'burning';
      a.session.burn = v;
      a.session.firstSparkFired = true;
      a.session.grip = 1;
    }, p);
    // Let the particle field fill in for this stage rather than catching it empty.
    await settle(p > 0.1 ? 200 : 40);
  }
  const name = path.join(outDir, `${orientation}-${String(shot).replace('.', '_')}.png`);
  await page.screenshot({ path: name });
  // Numbers, not impressions: a dark frame is very hard to judge by eye.
  const probe = await page.evaluate(() => {
    const a = globalThis.__senko;
    const c = document.createElement('canvas');
    c.width = a.canvas.width;
    c.height = a.canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(a.canvas, 0, 0);
    const box = (x0, y0, x1, y1) => {
      const w = Math.max(1, Math.round((x1 - x0) * c.width));
      const h = Math.max(1, Math.round((y1 - y0) * c.height));
      const d = ctx.getImageData(Math.round(x0 * c.width), Math.round(y0 * c.height), w, h).data;
      let r = 0, g = 0, b = 0, peak = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2];
        peak = Math.max(peak, d[i], d[i + 1], d[i + 2]);
      }
      const n = d.length / 4;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n), peak];
    };
    return {
      sky: box(0.55, 0.04, 0.95, 0.16),
      trees: box(0.6, 0.33, 0.95, 0.42),
      shoji: box(0.03, 0.28, 0.3, 0.5),
      garden: box(0.55, 0.78, 0.95, 0.94),
      hand: box(0.3, 0.01, 0.55, 0.09),
      subject: box(0.35, 0.45, 0.65, 0.72),
    };
  });
  console.log('wrote', name, `${Date.now() - t0}ms`, JSON.stringify(probe));
}

await browser.close();
