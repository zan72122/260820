import { chromium } from 'playwright';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const SHOTS=process.env.SHOTS; const TAG=process.env.TAG||'look';
const SIZE=JSON.parse(process.env.SIZE||'{"width":390,"height":844}');
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await (await browser.newContext({viewport:SIZE,deviceScaleFactor:1})).newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5173/',{waitUntil:'load'});
await sleep(1500);
for (const [shot, setup] of [['establish',null],['mid',null],['closeControls',{p:0.85}],['threeQuarter',{p:0.45}],['listen',{p:0.45,c:1}],['reveal',{p:0.45,c:1,e:1}]]) {
  await page.evaluate(({shot,setup})=>{
    const b=window.__bp;
    if (setup) {
      b.game.pressure.pressure = setup.p;
      if (setup.c) { b.game.contact.seat(); }
      if (setup.e) { b.game.reveal.open(); }
    }
    b.camera.cut(shot); b.advance(8);
  }, {shot,setup});
  await sleep(2500);
  await page.screenshot({path:`${SHOTS}/${TAG}-${shot}.png`});
}
await browser.close();
