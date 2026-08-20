import { test } from '@playwright/test';
import { boot, record } from './helpers';

type Api = { debugState(): Record<string, unknown>; panelScreen(id: string): { x: number; y: number } | null };

test('diagnostics', async ({ page }) => {
  const rec = record(page);
  await boot(page);
  const size = page.viewportSize()!;
  await page.mouse.click(size.width / 2, size.height * 0.7);
  await page.waitForTimeout(700);
  const target = await page.evaluate(
    () => (window as never as { __nebuta: Api }).__nebuta.panelScreen('belly-r'),
  );
  console.log('TARGET:', JSON.stringify(target), 'SIZE:', JSON.stringify(size));
  console.log('BEFORE:', JSON.stringify(await page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState())));

  await page.mouse.move(size.width * 0.5, size.height * 0.8);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(
      size.width * 0.5 + ((target!.x - size.width * 0.5) * i) / 16,
      size.height * 0.8 + ((target!.y + 40 - size.height * 0.8) * i) / 16,
    );
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300);
  console.log('DRAGGING:', JSON.stringify(await page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState())));
  await page.mouse.up();
  await page.waitForTimeout(3500);
  console.log('AFTER:', JSON.stringify(await page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState())));
  console.log('ERRORS:', JSON.stringify(rec.errors.slice(0, 3)));
});
