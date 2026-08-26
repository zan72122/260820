import { expect } from '@playwright/test';

export const SCREENS = {
  'iPhone portrait': { width: 393, height: 852 },
  'iPhone landscape': { width: 852, height: 393 },
  'iPad portrait': { width: 820, height: 1180 },
  'iPad landscape': { width: 1180, height: 820 }
};

export async function boot(page, query = '?fast=1&seed=4242') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/' + query, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__toami, null, { timeout: 40000 });
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 20000 });
  return errors;
}

export const state = (page) => page.evaluate(() => window.__toami.state);
export const advance = (page, s) => page.evaluate((sec) => window.__toami.advance(sec), s);

/**
 * Draw a real arc with the pointer, the way a hand does: many small steps
 * along a curve from the lower left to the upper right.
 */
export async function arcSwipe(page, {
  fromX = 0.22, fromY = 0.82, toX = 0.78, toY = 0.30, bow = 0.16, steps = 22, stepMs = 12
} = {}) {
  const vp = page.viewportSize();
  const x0 = fromX * vp.width, y0 = fromY * vp.height;
  const x1 = toX * vp.width, y1 = toY * vp.height;
  // Perpendicular offset makes the path an arc rather than a straight drag.
  const dx = x1 - x0, dy = y1 - y0;
  const px = -dy, py = dx;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const b = Math.sin(t * Math.PI) * bow;
    await page.mouse.move(x0 + dx * t + px * b, y0 + dy * t + py * b);
    if (stepMs) await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

export async function upSwipe(page, { atX = 0.5, fromY = 0.72, toY = 0.32, steps = 12 } = {}) {
  const vp = page.viewportSize();
  const x = atX * vp.width;
  await page.mouse.move(x, fromY * vp.height);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, fromY * vp.height + (toY - fromY) * vp.height * (i / steps));
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
}

export async function tap(page, nx = 0.5, ny = 0.45) {
  const vp = page.viewportSize();
  await page.mouse.click(nx * vp.width, ny * vp.height, { delay: 40 });
}

/** Step the game and assert the rope's two ends never leave the frame. */
export async function advanceWatchingFraming(page, seconds, slices = 12) {
  let worst = 0;
  for (let i = 0; i < slices; i++) {
    const s = await page.evaluate((sec) => window.__toami.advance(sec), seconds / slices);
    worst = Math.max(worst, s.framingError);
  }
  return worst;
}

export function expectNoErrors(errors) {
  expect(errors, 'runtime errors: ' + errors.join(' | ')).toEqual([]);
}
