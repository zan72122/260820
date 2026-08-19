/** Shared Chromium launch for the dev tools in this folder. */
import { chromium } from 'playwright';

/** The container ships Chromium separately from the playwright npm package. */
const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const DEVICES = {
  iphone: { width: 390, height: 844 },
  iphoneland: { width: 844, height: 390 },
  ipad: { width: 1024, height: 768 },
  ipadport: { width: 768, height: 1024 },
  small: { width: 320, height: 568 },
};

export const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};

export async function launch(device = 'iphone', { dpr = 1, url } = {}) {
  const dev = DEVICES[device] ?? DEVICES.iphone;
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    // Software rasterisation. Frame times from here are meaningless as a
    // device number; framing, state flow and correctness are not.
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error ' + m.text());
  });
  if (url) {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.__butai, null, { timeout: 120000 });
  }
  return { browser, page, dev, errors };
}
