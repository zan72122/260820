// Hide candidate meshes one at a time to identify a visual artifact.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:5173/?e2e=1&noshadow=1');
await page.waitForFunction(() => window.__game && window.__game.metrics.frames > 5);
await page.evaluate(() => window.__game.fastForward(8));
const out = process.argv[2];
for (const name of ['wetRing', 'surface', 'litter']) {
  await page.evaluate((n) => {
    const scene = window.__scene;
    scene.traverse((o) => {
      if (o.name === n) o.visible = false;
    });
  }, name);
  await page.evaluate(() => window.__game.fastForward(0.2));
  await page.screenshot({ path: `${out}/hide-${name}.png` });
}
await browser.close();
