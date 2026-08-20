import type { ConsoleMessage, Page } from '@playwright/test';

export interface Recorder {
  errors: string[];
  warnings: string[];
}

export function record(page: Page): Recorder {
  const rec: Recorder = { errors: [], warnings: [] };
  page.on('console', (m: ConsoleMessage) => {
    const text = m.text();
    if (m.type() === 'error') rec.errors.push(text);
    else if (m.type() === 'warning') rec.warnings.push(text);
  });
  page.on('pageerror', (e) => rec.errors.push(`pageerror: ${e.message}`));
  return rec;
}

/** Waits for the loading card to go away, which only happens after the bake completes. */
export async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 90_000 });
  await page.waitForTimeout(400);
}

export async function stage(page: Page): Promise<string> {
  return page.evaluate(() => (window as never as { __nebuta: { currentStage: string } }).__nebuta.currentStage);
}

/** A slow, deliberate drag, the way a small hand actually moves. */
export async function drag(
  page: Page,
  from: [number, number],
  to: [number, number],
  steps = 22,
  holdMs = 16,
): Promise<void> {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
    await page.waitForTimeout(holdMs);
  }
  await page.mouse.up();
  await page.waitForTimeout(260);
}

export async function scrub(
  page: Page,
  centre: [number, number],
  radius: number,
  loops = 3,
  stepMs = 14,
): Promise<void> {
  await page.mouse.move(centre[0], centre[1]);
  await page.mouse.down();
  const n = loops * 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = radius * (0.25 + 0.75 * (i / n));
    await page.mouse.move(centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r * 0.7);
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
  await page.waitForTimeout(260);
}
