// Screenshot utility for visual iteration.
// usage: node tools/shot.mjs <name> [w] [h] [script...]
// scripts (comma separated): wait:<ms> angle:<rad> lever:<y> solve swipe snap state
import { chromium } from '@playwright/test';

const [, , name = 'shot', wArg = '390', hArg = '844', ...cmds] = process.argv;
const w = parseInt(wArg), h = parseInt(hArg);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5173/?e2e=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__SAM__ !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(1200);

for (const cmd of cmds.join(' ').split(',').map((s) => s.trim()).filter(Boolean)) {
  const [op, arg] = cmd.split(':');
  if (op === 'wait') await page.waitForTimeout(parseInt(arg));
  else if (op === 'angle') await page.evaluate((a) => window.__SAM__.setTableAngle(a), parseFloat(arg));
  else if (op === 'lever') await page.evaluate((a) => window.__SAM__.setLever(a), parseFloat(arg));
  else if (op === 'solve') await page.evaluate(() => window.__SAM__.solveActive());
  else if (op === 'swipe') await page.evaluate(() => window.__SAM__.swipe());
  else if (op === 'snap') await page.evaluate(() => window.__SAM__.snapCamera());
  else if (op === 'front') await page.evaluate(() => window.__SAM__.snapFront());
  else if (op === 'goto') await page.evaluate((i) => window.__SAM__.goto(i), parseInt(arg));
  else if (op === 'reveal') await page.evaluate(() => window.__SAM__.snapReveal());
  else if (op === 'wheel') await page.evaluate((a) => window.__SAM__.wheel(a), parseFloat(arg));
  else if (op === 'state') console.log(JSON.stringify(await page.evaluate(() => window.__SAM__.state())));
}

await page.waitForTimeout(400);
await page.screenshot({ path: `shots/${name}.png` });
if (errors.length) console.log('CONSOLE ERRORS:', JSON.stringify(errors.slice(0, 8), null, 1));
else console.log('no console errors');
await browser.close();
