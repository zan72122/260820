import { test, expect, type ConsoleMessage } from '@playwright/test';

const VIEWPORTS = {
  iphonePortrait: { width: 390, height: 844 },
  iphoneLandscape: { width: 844, height: 390 },
  ipadPortrait: { width: 1024, height: 1366 },
  ipadLandscape: { width: 1366, height: 1024 },
};

test('boots, renders and exposes a live game state', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.setViewportSize(VIEWPORTS.iphonePortrait);
  await page.goto('/?fast=1');
  await page.waitForFunction(() => Boolean(window.__ume?.ready), null, { timeout: 45_000 });

  const before = await page.evaluate(() => window.__ume!.frames());
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => window.__ume!.frames());
  expect(after).toBeGreaterThan(before);

  expect(await page.evaluate(() => window.__ume!.stage())).toBe('orchard');
  expect(errors.join('\n')).toBe('');
});
