import { chromium } from '@playwright/test';
const vp = { width: 390, height: 844 };
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: vp });
await page.goto('http://127.0.0.1:5173/?e2e=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
const g = (e) => page.evaluate(e);
await g('window.__game.fastForward(8)');
const OFF = Math.round(vp.height * 0.085);
// discovery
const intro = await g('window.__game.introStreakScreen()');
await page.mouse.move(intro.x + 70, intro.y + OFF);
await page.mouse.down();
for (let i = 1; i <= 14; i++) {
  const a = (i / 14) * 0.8 * 2 * Math.PI;
  await page.mouse.move(intro.x + 70 * Math.cos(a), intro.y + OFF + 70 * Math.sin(a));
}
await page.waitForTimeout(2500);
await page.mouse.up();
await page.waitForTimeout(2000);
console.log('phase', await g('window.__game.phase'));
// find far streak
const far = (await g('window.__game.streakScreens()')).filter((s) => s.main && s.wx > 0.3);
console.log('far streaks', JSON.stringify(far));
if (far.length) {
  const t = far[0];
  const cx = Math.min(Math.max(t.x, 60), vp.width - 60);
  const cy = Math.min(Math.max(t.y + OFF, 120), vp.height - 60);
  console.log('circling at', cx, cy);
  await page.mouse.move(cx + 65, cy);
  await page.mouse.down();
  for (let turn = 0; turn < 5; turn++) {
    for (let i = 1; i <= 13; i++) {
      const a = ((turn * 13 + i) / 13) * 2 * Math.PI;
      await page.mouse.move(cx + 65 * Math.cos(a), cy + 65 * Math.sin(a));
    }
    const d = await g('window.__game.debug');
    const s = (await g('window.__game.streakScreens()')).filter((x) => x.main);
    console.log(
      `turn ${turn}: tip=[${d.tip.map((v) => v.toFixed(2))}] circ=${await g('window.__game.circling')} angSp=${d.angSpeed.toFixed(2)} rw=${d.radiusWorld.toFixed(3)} active=${d.activeState} streak=${JSON.stringify(s.map((x) => [x.wx.toFixed(2), x.wz.toFixed(2), x.state]))}`
    );
  }
  await page.mouse.up();
}
await browser.close();
