import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:5173/?e2e=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
await page.evaluate(() => window.__game.fastForward(8));
await page.evaluate(() => {
  window.__scene.traverse((o) => {
    if (o.name === 'surface') o.material.uniforms.uMurkTint.value.setHex(0xff0000);
  });
  window.__game.fastForward(0.2);
});
await page.screenshot({ path: process.argv[2] });
await browser.close();
