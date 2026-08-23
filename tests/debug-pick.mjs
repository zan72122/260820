import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://localhost:4173/?e2e');
await page.waitForFunction(() => !!window.__kc);
await page.evaluate(() => window.__kc.pause());
await page.evaluate(() => window.__kc.step(3.7));
await page.evaluate(() => window.__kc.render());
for (const [px, py] of [[528, 360], [540, 350], [520, 370]]) {
  const nx = (px / 1366) * 2 - 1;
  const ny = -((py / 1024) * 2 - 1);
  const res = await page.evaluate(([a, b]) => window.__kc.pick(a, b), [nx, ny]);
  console.log(px, py, res);
}
await page.screenshot({ path: 'test-results/shots/debug-landscape.png' });
await browser.close();
