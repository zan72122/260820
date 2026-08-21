import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 720, height: 450 } });
page.on('pageerror',e=>console.log('ERR '+e.message));
page.on('console',m=>{ if(m.type()==='error') console.log('E: '+m.text().slice(0,200)); });
await page.goto('http://localhost:5173/?q=low', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await page.evaluate(() => { window.__dev.fit(0, 0.8); });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__dev.launch(); });
const marks = [];
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(1300);
  const st = await page.evaluate(() => ({ s: +window.__lightTunnel.raftS.toFixed(1), p: window.__lightTunnel.phase }));
  marks.push(st);
  await page.screenshot({ path: `shots/ride-${i}.png` });
}
console.log(JSON.stringify(marks));
await browser.close();
