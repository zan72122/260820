import { expect, test } from '@playwright/test';
import { boot, record, stage } from './helpers';

test('boots into the craft room with no console errors', async ({ page }) => {
  const rec = record(page);
  await boot(page);
  expect(await stage(page)).toBe('intro');
  await page.waitForTimeout(4200);
  expect(await stage(page)).toBe('firstPaper');
  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});
