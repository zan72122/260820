import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [name, vp] of [['ipad-portrait', { width: 820, height: 1180 }], ['ipad-landscape', { width: 1180, height: 820 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: true });
  await page.goto('http://localhost:4173/?e2e=1');
  await page.waitForFunction(() => window.__pinForest?.ready === true);
  await page.evaluate(() => { window.__pinForest.setDepth(0.75); window.__pinForest.advance(1.2); });
  await page.screenshot({ path: `/tmp/claude-0/-home-user-260820/d677db26-3af5-5186-8e42-3a0e6b74e586/scratchpad/shots/${name}.png` });
  await page.close();
}
await browser.close();
