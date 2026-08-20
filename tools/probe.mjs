// One-shot geometry probe: projects the key points into screen space so the
// composition can be checked as numbers rather than squinted at.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:4173/?muted&capture&tier=low&dpr=1&seed=7');
await page.waitForFunction(() => globalThis.__senko?.frame > 0, null, { timeout: 120000 });
const out = await page.evaluate((burn) => {
  const a = globalThis.__senko;
  a.stop();
  a.session.state = 'burning';
  a.session.burn = burn;
  a.session.grip = 1;
  for (let i = 0; i < 300; i++) {
    a.session.grip = 1;
    a.session.burn = burn;
    a.step(1 / 60);
  }
  const frac = (v) => {
    const p = v.clone().project(a.camera);
    return [+((p.x * 0.5 + 0.5) * 100).toFixed(1), +((0.5 - p.y * 0.5) * 100).toFixed(1)];
  };
  return {
    burn,
    frameH: +a.rig.frameHeightSmooth.toFixed(4),
    hangSmooth: +a.rig.hangSmooth.toFixed(4),
    cordLen: +(a.cordAnchor.y - a.sparkler.tip.y).toFixed(4),
    pinchPct: frac(a.cordAnchor),
    tipPct: frac(a.sparkler.tip),
    beadPct: frac(a.fireball.position),
    liveSparks: a.sparks.liveCount,
  };
}, Number(process.env.BURN || 0));
console.log(JSON.stringify(out));
await browser.close();
