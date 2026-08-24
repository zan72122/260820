import { test, expect } from '@playwright/test';
import { boot, state, slide, waitPhase, setSpeed } from './helpers';

/**
 * Repeats conversions + train passes on phone/tablet viewports in both
 * orientations and records draw calls, triangles, frame budget and JS heap
 * growth. FPS numbers under SwiftShader are not judged (per CLAUDE.md) —
 * only workload metrics and stability are asserted.
 */

const VIEWPORTS = [
  { name: 'iphone-portrait', w: 390, h: 844 },
  { name: 'iphone-landscape', w: 844, h: 390 },
  { name: 'ipad-portrait', w: 1024, h: 1366 },
  { name: 'ipad-landscape', w: 1366, h: 1024 },
];

for (const vp of VIEWPORTS) {
  test(`20+ conversions stay healthy on ${vp.name}`, async ({ page }) => {
    // SwiftShader needs generous wall-clock at tablet resolutions
    test.setTimeout(1_500_000);
    await boot(page, { fast: 10, w: vp.w, h: vp.h });
    await page.waitForTimeout(500);

    const heap0 = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
    let maxCalls = 0, maxTris = 0;
    let dir: 1 | -1 = -1;
    let conversions = 0;

    for (let i = 0; i < 21; i++) {
      await page.waitForFunction(() => (window as any).__mono.phase === 'idle', null, { timeout: 240_000 });
      await slide(page, dir);
      const started = await page
        .waitForFunction(() => (window as any).__mono.phase !== 'idle', null, { timeout: 8_000 })
        .then(() => true).catch(() => false);
      if (!started) continue; // a train arrived exactly then; try again
      await page.waitForFunction(
        () => ['signal', 'train', 'idle'].includes((window as any).__mono.phase),
        null, { timeout: 240_000 },
      );
      conversions++;
      dir = dir === -1 ? 1 : -1;
      const s = await state(page);
      maxCalls = Math.max(maxCalls, s.metrics.calls);
      maxTris = Math.max(maxTris, s.metrics.tris);
      expect(s.t).toBeGreaterThanOrEqual(-0.001);
      expect(s.t).toBeLessThanOrEqual(1.001);
    }
    expect(conversions).toBeGreaterThanOrEqual(20);

    const heap1 = await page.evaluate(() => {
      (window as any).gc?.();
      return (performance as any).memory?.usedJSHeapSize ?? 0;
    });
    const growthMb = (heap1 - heap0) / 1048576;
    const s = await state(page);
    console.log(`[perf ${vp.name}] calls(max)=${maxCalls} tris(max)=${maxTris} ` +
      `frame-ema=${s.metrics.ms.toFixed(1)}ms heap-growth=${growthMb.toFixed(1)}MB dpr=${s.metrics.dpr}`);

    expect(maxCalls).toBeLessThan(600);
    expect(maxTris).toBeLessThan(300_000);
    expect(growthMb).toBeLessThan(30);
  });
}

test('input latency: handle reacts within a frame budget', async ({ page }) => {
  await boot(page);
  const vp = page.viewportSize()!;
  const cx = vp.width / 2, cy = vp.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  await page.mouse.move(cx - vp.width * 0.2, cy, { steps: 4 });
  await page.waitForFunction(() => (window as any).__mono.lever < 0.95);
  const dt = Date.now() - t0;
  await page.mouse.up();
  console.log(`[latency] lever responded in ~${dt}ms (includes test-harness overhead)`);
  expect(dt).toBeLessThan(1500); // SwiftShader frames are ~100-200ms; real devices are far faster
});
