import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
})).newPage();
await page.goto('http://127.0.0.1:5173/?e2e=1&seed=1');
await page.waitForFunction(() => window.__uha && window.__uha.snapshot().phase);
const snap = () => page.evaluate(() => window.__uha.snapshot());

async function drag(points, stepMs = 40) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

await page.waitForFunction(() => window.__uha.snapshot().phase === 'inspect', null, { timeout: 30000 });
// sweep
for (let pass = 0; pass < 4; pass++) {
  const s = await snap();
  if (s.cracks.every((c) => c.discovered)) break;
  const a = await page.evaluate(() => window.__uha.grooveScreen(0.1));
  const b = await page.evaluate(() => window.__uha.grooveScreen(0.9));
  await drag([a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b], 300);
  await drag([b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, a], 300);
  console.log('after sweep', pass, JSON.stringify(await snap()));
}
await page.waitForFunction(() => window.__uha.snapshot().phase === 'clean', null, { timeout: 30000 });
console.log('CLEAN reached');
for (let pass = 0; pass < 10; pass++) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = 0.12 + (0.85 - 0.12) * (i / 6);
    const p = await page.evaluate((tt) => window.__uha.grooveScreen(tt), t);
    if (p) pts.push({ x: p.x, y: p.y + 10 });
  }
  await drag(pts, 120);
  const s = await snap();
  console.log(`pass ${pass}: dirt=${s.dirtRemaining.toFixed(4)} init=${s.initialDirt.toFixed(4)} phase=${s.phase} lightFront=${s.lightFront.toFixed(3)} blocker=${s.blocker}`);
  if (s.phase !== 'clean') break;
}
await browser.close();
