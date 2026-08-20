import { expect, test } from '@playwright/test';
import { boot, drag, record, scrub, waitFor } from './helpers';
import type { Page } from '@playwright/test';

type Api = {
  currentStage: string;
  debugState(): Record<string, unknown>;
  panelScreen(id: string): { x: number; y: number } | null;
  onScreen(w: string): { x: number; y: number; inside: boolean };
  jumpTo(s: string): void;
};

const api = <T>(page: Page, fn: (g: Api) => T): Promise<T> =>
  page.evaluate(fn as never, undefined) as Promise<T>;

const read = (page: Page) =>
  page.evaluate(() => (window as never as { __nebuta: Api }).__nebuta.debugState());
const panelAt = (page: Page, id: string) =>
  page.evaluate((pid) => (window as never as { __nebuta: Api }).__nebuta.panelScreen(pid), id);

/** The renderer runs slowly under a software rasteriser, so every wait polls game state. */
const SETTLE = 900;

test('the whole craft, from bare frame to parade', async ({ page }) => {
  test.setTimeout(420_000);
  const rec = record(page);
  await boot(page);
  const size = page.viewportSize()!;
  const cx = size.width / 2;

  /* --- the frame resolves into the first sheet ------------------------------ */
  await page.mouse.click(cx, size.height * 0.7);
  await waitFor(page, "s.stage === 'firstPaper'");

  /* --- carry a sheet somewhere silly: nothing tears, nothing is lost --------- */
  await drag(page, [cx, size.height * 0.78], [size.width * 0.05, size.height * 0.97], 12);
  await page.waitForTimeout(900);
  let s = await read(page);
  expect(s.remaining, 'the sheet goes quietly back to the pile').toBe(10);

  /* --- and now onto the frame ---------------------------------------------- */
  const belly = (await panelAt(page, 'belly-r'))!;
  await drag(page, [cx, size.height * 0.82], [belly.x, belly.y + 40], 16);
  await waitFor(page, 's.pendingSmooth !== null');
  s = await read(page);
  expect(s.remaining as number, 'the first sheet is on').toBeLessThan(10);
  const first = s.pendingSmooth as string;
  expect(first, 'the first sheet asks to be smoothed').toBeTruthy();

  /* --- smooth from the middle outward, letting go part way through ---------- */
  let spot = (await panelAt(page, first))!;
  await scrub(page, [spot.x, spot.y + 40], 60, 1);
  await page.waitForTimeout(500);
  spot = (await panelAt(page, first))!;
  await scrub(page, [spot.x, spot.y + 40], 110, 2);
  await waitFor(page, 's.pendingSmooth === null');
  s = await read(page);
  const cov = (s.smoothCoverage as Record<string, number>)[first];
  expect(cov, 'the finger left a smoothed area').toBeGreaterThan(0.05);
  expect(s.pendingSmooth, 'the first-paper lesson is done').toBeNull();

  /* --- move on, then paste the rest in whatever order --------------------- */
  await page.waitForTimeout(400);
  await page.locator('.bigbtn.show').click({ timeout: 40_000 });
  await waitFor(page, "s.stage === 'freePaper'");

  // paste in whatever order the nebuta presents its unfinished side
  for (let round = 0; round < 13; round++) {
    const st = await read(page);
    if ((st.remaining as number) === 0) break;
    const states = st.states as Record<string, string>;
    let pick: { id: string; x: number; y: number } | null = null;
    for (const id of Object.keys(states)) {
      if (states[id] !== 'stack') continue;
      const at = await panelAt(page, id);
      if (!at || at.facing < 0.2) continue;
      if (at.x < 40 || at.x > size.width - 40 || at.y < 90 || at.y > size.height - 90) continue;
      pick = { id, x: at.x, y: at.y };
      break;
    }
    if (!pick) {
      await page.waitForTimeout(1400);
      continue;
    }
    const wanted = (st.remaining as number) - 1;
    await drag(page, [cx, size.height * 0.88], [pick.x, pick.y], 10, 12);
    await waitFor(page, `s.remaining <= ${wanted} || s.pendingSmooth !== null`, 45_000).catch(() => {});
    const p = await panelAt(page, pick.id);
    if (p) await scrub(page, [p.x, p.y + 30], 80, 1, 10);
    await waitFor(page, 's.pendingSmooth === null', 45_000).catch(() => {});
    await page.waitForTimeout(SETTLE);
  }
  s = await read(page);
  const byHand = (s.attached as string[]).length - 3; // the three teacher-made fins
  console.log('AFTER PAPER:', JSON.stringify({ remaining: s.remaining, byHand }));
  expect(byHand, 'the child pasted most of it by hand').toBeGreaterThanOrEqual(5);

  /* --- sumi: fast strokes, then slow ones ---------------------------------- */
  await page.locator('.bigbtn.show').click({ timeout: 40_000 });
  await waitFor(page, "s.stage === 'ink'");
  s = await read(page);
  expect(s.remaining, 'the teacher pasted whatever was left').toBe(0);
  for (let i = 0; i < 4; i++) {
    await drag(page, [cx - 90, size.height * (0.42 + i * 0.05)], [cx + 90, size.height * (0.44 + i * 0.05)], 8, 6);
  }
  await page.waitForTimeout(600);
  for (let i = 0; i < 3; i++) {
    await drag(page, [cx - 70, size.height * (0.5 + i * 0.05)], [cx + 70, size.height * (0.5 + i * 0.05)], 26, 40);
  }
  s = await read(page);
  console.log('AFTER INK:', JSON.stringify({ inkProgress: s.inkProgress }));
  expect(s.inkProgress as number, 'the brush followed the planned lines').toBeGreaterThan(0);

  /* --- the teacher's wax, then dye, layered ------------------------------- */
  await page.locator('.bigbtn.show').click({ timeout: 40_000 });
  await waitFor(page, "s.stage === 'wax'");
  await waitFor(page, "s.stage === 'dye'", 90_000);

  await page.locator('.palette .swatch').nth(0).click();
  for (let i = 0; i < 5; i++) {
    await drag(page, [cx - 110, size.height * (0.4 + i * 0.05)], [cx + 110, size.height * (0.42 + i * 0.05)], 12, 10);
  }
  await page.locator('.palette .swatch').nth(4).click();
  for (let i = 0; i < 3; i++) {
    await drag(page, [cx - 80, size.height * (0.44 + i * 0.05)], [cx + 80, size.height * (0.44 + i * 0.05)], 12, 10);
  }
  await page.waitForTimeout(900);
  s = await read(page);
  console.log('AFTER DYE:', JSON.stringify({ dyeCoverage: s.dyeCoverage }));
  expect(s.dyeCoverage as number, 'dye went onto the paper').toBeGreaterThan(0);

  expect(rec.errors, rec.errors.join('\n')).toEqual([]);
});
