import { expect, test } from '@playwright/test';
import { boot, record, stage, waitFor } from './helpers';

test('boots into the craft room with no console errors', async ({ page }) => {
  test.setTimeout(120_000);
  const rec = record(page);
  await boot(page);
  expect(await stage(page), 'the game opens on the bare frame').toBe('intro');
  // the opening shot runs on game time, which stretches on a software rasteriser
  await waitFor(page, "s.stage === 'firstPaper'");
  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});
