// Quick framing capture: opening shot in every orientation, plus the finale.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const PROFILES = {
  'iphone-portrait': [390, 844, 2],
  'iphone-landscape': [844, 390, 2],
  'ipad-portrait': [820, 1180, 1],
  'ipad-landscape': [1180, 820, 1],
};
const out = process.argv[2] || 'shots-frames';
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const errors = [];
for (const [name, [w, h, dsf]] of Object.entries(PROFILES)) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: w, height: h },
    deviceScaleFactor: dsf,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__dig, null, { timeout: 40000 });
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${name}-open.png`, timeout: 120000 });
  console.log(name, 'ok');
  await ctx.close();
}
console.log('errors:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
