import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [['iphone-portrait',390,844],['iphone-landscape',844,390],['ipad-portrait',820,1180],['ipad-landscape',1180,820],['iphone-se',375,667]];
const SHOTS = ['establish','mid','closeControls','threeQuarter','listen','compare'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
let worst = 1e9, worstAt = '';
for (const [tag,w,h] of SIZES) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/', { waitUntil: 'load' });
  await sleep(1200);
  console.log(`\n== ${tag} ${w}x${h} ==`);
  for (const s of SHOTS) {
    await page.evaluate((n)=>{window.__bp.camera.cut(n);window.__bp.advance(6);}, s);
    const r = await page.evaluate(()=>{
      const b=window.__bp,out={};
      for (const k of ['bulb','valve']) { const p=b.screenOf(k); out[k]=[Math.round(p.x),Math.round(p.y)]; }
      const V=b.scene.manikin.fossa.constructor;
      const pr=(x,y,z)=>{const v=new V(x,y,z).project(b.camera.camera);return [Math.round(((v.x+1)/2)*window.innerWidth),Math.round(((1-v.y)/2)*window.innerHeight)];};
      out.fossa=pr(b.scene.manikin.fossa.x,b.scene.manikin.fossa.y,b.scene.manikin.fossa.z);
      out.cuff=pr(0.30,0.79,0.02); out.gauge=pr(0.40,0.90,0.55);
      return out;
    });
    const border = (p)=>Math.min(p[0], w-p[0], p[1], h-p[1]);
    const b1 = border(r.bulb), b2 = border(r.valve);
    const m = Math.min(b1,b2);
    if (['closeControls','threeQuarter','listen'].includes(s) && m < worst) { worst = m; worstAt = `${tag}/${s}`; }
    console.log(s.padEnd(14), JSON.stringify(r), `border bulb=${b1} valve=${b2}`);
  }
  await ctx.close();
}
console.log(`\nworst interactive border in working shots: ${worst}px at ${worstAt}`);
await browser.close();
