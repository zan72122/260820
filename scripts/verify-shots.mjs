// Full labeled screenshot set + perf numbers for external review.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] || 'verify';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});

async function playThrough(vp, label) {
  const page = await browser.newPage({ viewport: vp });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  await page.goto('http://127.0.0.1:5173/?e2e=1&hq=1');
  await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
  const g = (e) => page.evaluate(e);
  const OFF = Math.round(vp.height * 0.085);
  const shot = (n) => page.screenshot({ path: `${out}/${label}-${n}.png` });

  await shot('1-arrive');
  await g('window.__game.fastForward(5.2)');
  await shot('2-kneel');
  await g('window.__game.fastForward(3)');
  await shot('3-ready');
  // hint moment
  await g('window.__game.fastForward(8.5)');
  await shot('4-hint-ripple');

  // discovery: stop mid-sequence for a frame of the wind-up
  const intro = await g('window.__game.introStreakScreen()');
  const R = 60;
  const cx = Math.min(Math.max(intro.x, R + 8), vp.width - R - 8);
  const cy = Math.min(Math.max(intro.y + OFF, 120), vp.height - R - 8);
  await page.mouse.move(cx + R, cy);
  await page.mouse.down();
  for (let i = 1; i <= 11; i++) {
    const a = (i / 11) * 0.8 * 2 * Math.PI;
    await page.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a));
  }
  await page.waitForTimeout(900);
  await shot('5-discovery-winding');
  await page.waitForTimeout(1600);
  await page.mouse.up();
  await page.waitForTimeout(1800);
  await shot('6-after-discovery');

  // clear the rest
  for (let round = 0; round < 14; round++) {
    if ((await g('window.__game.mainRemaining')) === 0) break;
    const streaks = await g('window.__game.streakScreens()');
    const target =
      streaks.find((s) => s.main && ['stalled', 'capture', 'wind'].includes(s.state)) ||
      streaks.find((s) => s.main && s.state === 'drift');
    if (!target) {
      await page.waitForTimeout(600);
      continue;
    }
    const RR = 55;
    const tx = Math.min(Math.max(target.x, RR + 8), vp.width - RR - 8);
    const ty = Math.min(Math.max(target.y + OFF, 120), vp.height - RR - 8);
    await page.mouse.move(tx + RR, ty);
    await page.mouse.down();
    for (let i = 1; i <= 45; i++) {
      const a = (i / 13) * 2 * Math.PI;
      await page.mouse.move(tx + RR * Math.cos(a), ty + RR * Math.sin(a));
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await shot('7-play-late');
  await g('window.__game.fastForward(4)');
  await shot('8-reveal');
  await g('window.__game.fastForward(5)');
  await shot('9-freeplay');
  // transfer
  const stone = await g('window.__game.stoneScreen()');
  await page.mouse.move(stone.x, stone.y + OFF);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await shot('10-transfer');
  await page.waitForTimeout(1800);
  await page.mouse.up();
  const info = {
    label,
    phase: await g('window.__game.phase'),
    hornLoad: await g('window.__game.hornLoad'),
    clarity: await g('window.__game.clarityAvg'),
    metrics: await g('window.__game.metrics'),
    renderInfo: await g('window.__game.renderInfo'),
    errors: errs,
  };
  console.log(JSON.stringify(info, null, 1));
  await page.close();
}

await playThrough({ width: 390, height: 844 }, 'iphone-p');
if (!process.argv[3]) await playThrough({ width: 1180, height: 820 }, 'ipad-l');
await browser.close();
