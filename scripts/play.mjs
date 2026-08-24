// Drives a full play-through with synthetic pointer circles and reports
// state at each milestone. Usage: node scripts/play.mjs [outdir]
import { chromium } from '@playwright/test';

const out = process.argv[2] || 'playshots';
const vp = { width: 390, height: 844 };
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: vp });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text());
});
await page.goto('http://127.0.0.1:5173/?e2e=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);

const g = (expr) => page.evaluate(expr);

async function circle(cx, cy, r, turns, msPerTurn = 700, dir = 1) {
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  await page.waitForTimeout(60);
  const steps = Math.max(12, Math.round(turns * 13));
  for (let i = 1; i <= steps; i++) {
    const a = dir * (i / steps) * turns * 2 * Math.PI;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
}

const OFF = Math.round(vp.height * 0.085); // finger sits below the reaction point

// --- reach ready
await g('window.__game.fastForward(8)');
console.log('phase:', await g('window.__game.phase'));
await page.screenshot({ path: `${out}/p1-ready.png` });

// --- first discovery: quarter turn near the intro streak
let intro = await g('window.__game.introStreakScreen()');
console.log('intro streak at', intro);
await circle(intro.x, intro.y + OFF, 70, 0.55, 900);
// keep the finger down a moment; the scripted sequence plays
await page.waitForTimeout(400);
console.log('after quarter turn phase:', await g('window.__game.phase'), 'circling:', await g('window.__game.circling'));
await page.screenshot({ path: `${out}/p2-discovery.png` });
await page.mouse.up();
await page.waitForTimeout(2600);
console.log('after discovery phase:', await g('window.__game.phase'), 'mainRemaining:', await g('window.__game.mainRemaining'), 'clarity:', await g('window.__game.clarityAvg'));
await page.screenshot({ path: `${out}/p3-after-discovery.png` });

// --- wind the rest
for (let round = 0; round < 14; round++) {
  const remaining = await g('window.__game.mainRemaining');
  if (remaining === 0) break;
  const streaks = await g('window.__game.streakScreens()');
  const target =
    streaks.find((s) => s.main && (s.state === 'stalled' || s.state === 'capture' || s.state === 'wind')) ||
    streaks.find((s) => s.main && s.state === 'drift');
  if (!target) {
    console.log('no target; states:', JSON.stringify(streaks.map((s) => s.state)));
    await page.waitForTimeout(800);
    continue;
  }
  const R = 55;
  const cx = Math.min(Math.max(target.x, R + 8), vp.width - R - 8);
  const cy = Math.min(Math.max(target.y + OFF, 120), vp.height - R - 8);
  await circle(cx, cy, R, 3.4, 650);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const rem = await g('window.__game.mainRemaining');
  console.log(`round ${round}: mainRemaining=${rem} load=${await g('window.__game.hornLoad')} clarity=${(await g('window.__game.clarityAvg')).toFixed(3)}`);
  if (round >= 5 && rem > 0) {
    console.log('  stuck detail:', JSON.stringify((await g('window.__game.streakScreens()')).filter((s) => s.main)));
    console.log('  debug:', JSON.stringify(await g('window.__game.debug')));
  }
}
await page.screenshot({ path: `${out}/p4-cleared.png` });
console.log('phase:', await g('window.__game.phase'));

// --- reveal → freeplay
await g('window.__game.fastForward(8)');
console.log('phase now:', await g('window.__game.phase'), 'wisps:', await g('window.__game.wispRemaining'));
await page.screenshot({ path: `${out}/p5-freeplay.png` });

// --- transfer to stone
const stone = await g('window.__game.stoneScreen()');
console.log('stone at', stone, 'load', await g('window.__game.hornLoad'));
await page.mouse.move(stone.x, stone.y + OFF);
await page.mouse.down();
await page.waitForTimeout(2600);
await page.mouse.up();
console.log('load after transfer:', await g('window.__game.hornLoad'));
await page.screenshot({ path: `${out}/p6-stone.png` });

// --- replay button
const replayVisible = await page.evaluate(() => document.getElementById('replay').classList.contains('show'));
console.log('replay visible:', replayVisible);
await page.evaluate(() => window.__game.replay());
await page.waitForTimeout(300);
console.log('after replay:', await g('window.__game.phase'), 'main:', await g('window.__game.mainRemaining'), 'clarity:', await g('window.__game.clarityAvg'));

console.log('metrics:', JSON.stringify(await g('window.__game.metrics')));
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
