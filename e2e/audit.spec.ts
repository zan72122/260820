import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'e2e', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
  padPortrait: { width: 1024, height: 1366 },
  padLandscape: { width: 1366, height: 1024 },
};

async function boot(page: Page, stage?: string): Promise<void> {
  const q = stage ? `/?fast=1&manual=1&stage=${stage}` : '/?fast=1&manual=1';
  await page.goto(q);
  await page.waitForFunction(() => Boolean(window.__ume?.ready), null, { timeout: 45_000 });
  await page.evaluate(() => window.__ume!.advanceTime(1.2));
}

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.__ume!.advanceTime(0.4));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

type Size = { width: number; height: number };

async function captureAll(page: Page, size: Size, tag: string): Promise<void> {
  await page.setViewportSize(size);

  // 1. First contact with the game: the orchard, untouched.
  await boot(page);
  await shot(page, `${tag}-01-orchard-initial`);

  // 2. Net spread, sun sent on, fruit down and gathered.
  await page.evaluate(() => {
    window.__ume!.act('spread', 1);
    window.__ume!.advanceTime(0.6);
    window.__ume!.act('sun', 1);
    window.__ume!.advanceTime(6);
    window.__ume!.act('lift', 0.75);
    window.__ume!.advanceTime(3.5);
  });
  await shot(page, `${tag}-02-orchard-gathered`);

  // 3. Salt actually falling onto the fruit.
  await boot(page, 'pickling');
  await page.evaluate(() => {
    window.__ume!.act('scoopOver');
    window.__ume!.act('salt', 0.5);
    window.__ume!.advanceTime(0.35);
  });
  await shot(page, `${tag}-03-salt-falling`);

  // 4. Days passing: skin wet, drips, juice gathering.
  await page.evaluate(() => {
    window.__ume!.act('salt', 0.6);
    window.__ume!.advanceTime(1);
    window.__ume!.act('days', 2.2);
    window.__ume!.advanceTime(3);
  });
  await shot(page, `${tag}-04-brine-early`);

  // 5. The level well up between the fruit.
  await page.evaluate(() => {
    window.__ume!.act('days', 3.4);
    window.__ume!.advanceTime(6);
  });
  await shot(page, `${tag}-05-brine-risen`);

  // 6. Drying: fruit laid out, sun sent across.
  await boot(page, 'drying');
  await page.evaluate(() => {
    window.__ume!.act('placeAll', 1);
    window.__ume!.advanceTime(2);
    window.__ume!.act('sun', 0.85);
    window.__ume!.advanceTime(5);
  });
  await shot(page, `${tag}-06-drying`);

  // 7. Free play: fruit turned over, the finishing plate offered, nothing forced.
  await page.evaluate(() => {
    window.__ume!.act('rollAll');
    window.__ume!.advanceTime(2);
    window.__ume!.act('sun', 0.6);
    window.__ume!.advanceTime(5);
    window.__ume!.act('plate');
    window.__ume!.advanceTime(1.5);
  });
  await shot(page, `${tag}-07-freeplay`);
}

test('capture the play arc in portrait', async ({ page }) => {
  await captureAll(page, SIZES.portrait, 'phone-portrait');
});

test('capture the play arc in landscape', async ({ page }) => {
  await captureAll(page, SIZES.landscape, 'phone-landscape');
});

test('capture tablet portrait framing', async ({ page }) => {
  await page.setViewportSize(SIZES.padPortrait);
  await boot(page);
  await shot(page, 'pad-portrait-01-orchard');
  await boot(page, 'pickling');
  await page.evaluate(() => {
    window.__ume!.act('salt', 1);
    window.__ume!.act('days', 4);
    window.__ume!.advanceTime(4);
  });
  await shot(page, 'pad-portrait-05-brine');
});

test('capture tablet landscape framing', async ({ page }) => {
  await page.setViewportSize(SIZES.padLandscape);
  await boot(page, 'pickling');
  await page.evaluate(() => {
    window.__ume!.act('salt', 1);
    window.__ume!.act('days', 4);
    window.__ume!.advanceTime(4);
  });
  await shot(page, 'pad-landscape-05-brine');
  await boot(page, 'drying');
  await page.evaluate(() => {
    window.__ume!.act('placeAll', 1);
    window.__ume!.act('sun', 0.7);
    window.__ume!.advanceTime(2.5);
    window.__ume!.act('rollAll');
    window.__ume!.act('sun', 0.5);
    window.__ume!.advanceTime(3.5);
  });
  await shot(page, 'pad-landscape-06-drying');
});
