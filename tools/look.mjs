import { chromium } from 'playwright';
const shots = JSON.parse(process.env.SHOTS);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W??900), height: Number(process.env.H??560) } });
const logs=[]; page.on("console",m=>{ if((m.type()==="error"||m.type()==="warning")&&logs.length<8) logs.push(m.type()+": "+m.text().slice(0,400)); }); page.on("pageerror",e=>logs.push("ERR "+e.message));
await page.goto('http://localhost:5173/' + (process.env.Q ? '?q=' + process.env.Q : ''), { waitUntil: 'load' });
await page.waitForTimeout(5000);
for (const s of shots) {
  await page.evaluate((s) => {
    if (s.fit) window.__dev.fit(s.fit[0], s.fit[1]);
    if (s.ring !== undefined) window.__dev.app.state.ringAngle = s.ring;
    if (s.js) eval(s.js);
    if (s.cam) window.__dev.cam(...s.cam);
    else if (s.focus) window.__dev.focus(s.focus);
  }, s);
  await page.waitForTimeout(s.wait ?? 1200);
  await page.screenshot({ path: s.out });
}
console.log(logs.join('\n') || '(clean)');
await browser.close();
