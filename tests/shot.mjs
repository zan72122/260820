import { chromium } from 'playwright';
import fs from 'node:fs';

const SIZES = {
  phone: { width: 390, height: 844, dpr: 3, mobile: true },   // iPhone 14 class
  phoneLand: { width: 844, height: 390, dpr: 3, mobile: true },
  pad: { width: 820, height: 1180, dpr: 2, mobile: true },    // iPad Air portrait
  padLand: { width: 1180, height: 820, dpr: 2, mobile: true },
  desk: { width: 1280, height: 800, dpr: 1, mobile: false },
};

export async function launch(sizeName = 'phone') {
  const size = SIZES[sizeName];
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
    isMobile: size.mobile,
    hasTouch: size.mobile,
  });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  const url = process.env.FULL_QUALITY ? 'http://localhost:5173/' : 'http://localhost:5173/?fast=1';
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__imo, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { browser, context, page, logs, size };
}

export async function shot(page, name) {
  fs.mkdirSync('shots', { recursive: true });
  await page.screenshot({ path: `shots/${name}.png` });
}

export const state = (page) => page.evaluate(() => window.__imo.state());
