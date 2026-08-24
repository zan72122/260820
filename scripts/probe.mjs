import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
page.on('pageerror', (e) => console.error('PAGEERROR', e));
await page.goto('http://localhost:5173/?e2e=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, { timeout: 15000 });
await page.mouse.click(195, 422);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) {
  const info = await page.evaluate(() => {
    const g = window.__game;
    return { s: g.state(), pose: g.pose(), settled: g.settled(), cam: g.cam ? g.cam() : null };
  });
  console.log(i, JSON.stringify(info));
  if (info.s === 'IDLE') break;
  await sleep(500);
}
await page.screenshot({ path: '/tmp/claude-0/-home-user-260820/c804b67f-e1ad-534e-a5bd-040f39f435bc/scratchpad/probe-idle.png' });
const cam = await page.evaluate(() => window.__game.cam && window.__game.cam());
console.log('final cam', JSON.stringify(cam));
await browser.close();
