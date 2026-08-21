import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 640, height: 420 } });
const logs=[]; page.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') logs.push(m.type()+': '+m.text().slice(0,240)); });
page.on('pageerror',e=>logs.push('PAGEERROR '+e.message));
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForTimeout(6000);
const q = () => page.evaluate(() => window.__lightTunnel.tier ?? 'n/a');
await page.click('#gear'); await page.waitForTimeout(400);
for (const tier of ['high','low','medium']) {
  await page.click(`#qRow button[data-q="${tier}"]`);
  await page.waitForTimeout(3500);
  console.log('set', tier, '->', await page.evaluate(() => ({ tier: window.__lightTunnel.tier, dpr: window.__lightTunnel.renderer.getPixelRatio(), shadows: window.__lightTunnel.renderer.shadowMap.enabled })));
  await page.screenshot({ path: `shots/q-${tier}.png` });
}
// restart
await page.evaluate(() => { const a = window.__lightTunnel; a.state.lidOpen = true; a.state.waterFlow = 0.7; });
await page.waitForTimeout(1200);
await page.click('#restartBtn');
await page.waitForTimeout(3000);
console.log('after restart', await page.evaluate(() => ({ phase: window.__lightTunnel.phase, lid: window.__lightTunnel.state.lidOpen, flow: window.__lightTunnel.state.waterFlow })));
await page.screenshot({ path: 'shots/q-restart.png' });
console.log(logs.join('\n') || '(clean)');
await browser.close();
