import { chromium } from 'playwright';

const W = Number(process.env.W ?? 640), H = Number(process.env.H ?? 420);
const tag = process.env.TAG ?? 'play';
const url = process.env.URL ?? 'http://localhost:5173/?q=low';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (m.type()==='error'||m.type()==='warning') logs.push(m.type()+': '+m.text().slice(0,300)); });
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(3500);

const state = () => page.evaluate(() => {
  const a = window.__lightTunnel;
  return { phase: a.phase, kind: a.state.panelKind, seat: +a.state.seat.toFixed(2), clamped: a.state.clamped,
           ring: +a.state.ringAngle.toFixed(2), flow: +a.state.waterFlow.toFixed(2), lid: a.state.lidOpen,
           focus: a.rig.name, moving: a.rig.transitioning, blend: +a.rig.blend.toFixed(2), raftS: +a.raftS.toFixed(2), fps: Math.round(a.fps) };
});
const waitFor = async (pred, label, ms = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const st = await state();
    if (pred(st)) { console.log(`ok  ${label} after ${Date.now()-t0}ms`, JSON.stringify(st)); return st; }
    if (Date.now() - t0 > ms) { console.log(`FAIL ${label} timed out`, JSON.stringify(st)); return st; }
    await page.waitForTimeout(250);
  }
};
const proj = (expr) => page.evaluate((expr) => {
  const a = window.__lightTunnel;
  const v = eval(expr);
  const p = v.clone().project(a.rig.camera);
  return { x: (p.x*0.5+0.5)*window.innerWidth, y: (-p.y*0.5+0.5)*window.innerHeight, z: p.z };
}, expr);
const worldOf = (expr) => `(() => { const o = ${expr}; const v = new a.patch.constructor(); o.getWorldPosition(v); return v; })()`;
const shot = (n) => page.screenshot({ path: `shots/${tag}-${n}.png` });
const drag = async (from, to, steps = 24, hold = 90) => {
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.waitForTimeout(hold);
  console.log('   grabbed:', await page.evaluate(() => window.__lightTunnel.input.activeId));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x-from.x)*(i/steps), from.y + (to.y-from.y)*(i/steps));
    await page.waitForTimeout(14);
  }
  await page.waitForTimeout(hold); await page.mouse.up();
};

console.log('start', JSON.stringify(await state()));
await shot('01-open');

// 1. carry a plate over to the port
const p0 = await proj(worldOf('a.plates[0].group'));
const collar = await proj('a.collarWorld');
console.log('plate', p0, 'collar', collar);
await drag(p0, { x: collar.x, y: collar.y + 46 }, 30, 160);
await waitFor((s) => s.kind === 'rings' && s.seat > 0.95 && !s.moving, 'plate seated');
await shot('02-seated');

// 2. clamps
const cl = await proj(worldOf('a.port.clamps[0]'));
console.log('clamp at', cl);
await page.mouse.move(cl.x, cl.y); await page.mouse.down(); await page.waitForTimeout(110); await page.mouse.up();
await waitFor((s) => s.clamped && !s.moving, 'clamps latched');
await shot('03-clamped');

// 3. turn the collar
const rim = await proj('a.collarWorld');
const c2 = await proj('a.collarWorld');
console.log('rim', rim, 'centre', c2);
await drag({ x: rim.x + 26, y: rim.y }, { x: rim.x + 26 * Math.cos(1.2), y: rim.y + 26 * Math.sin(1.2) }, 22, 160);
await waitFor((s) => Math.abs(s.ring) > 0.15, 'collar turned');
await waitFor((s) => !s.moving, 'camera settled');
await shot('04-turned');

// 4. wait for the camera to reveal the valve, then pull it
await waitFor((s) => s.focus === 'water' && !s.moving, 'valve framed');
const vg = await proj(worldOf('a.valve.gripWorld'));
console.log('valve grip', vg);
await drag(vg, { x: vg.x, y: vg.y + H * 0.3 }, 26, 160);
await waitFor((s) => s.flow > 0.3, 'water on');
await shot('05-water');
await waitFor((s) => s.phase === 'watered', 'reveal');
await page.waitForTimeout(2000);
await shot('06-running');

// 5. workshop: swap to a different plate, which is round one of the lab
await waitFor((s) => s.phase === 'lab', 'workshop open', 40000);
const p1 = await proj(worldOf('a.plates[1].group'));
const collar2 = await proj('a.collarWorld');
await drag(p1, { x: collar2.x, y: collar2.y + 46 }, 30, 160);
await waitFor((s) => s.kind === 'stripes' && s.seat > 0.95, 'second plate fitted', 40000);
await shot('06b-swapped');
console.log('lab round now', await page.evaluate(() => window.__lightTunnel.labRound));

// jump to the launch round rather than replaying every lab round in the test
await page.evaluate(() => { const a = window.__lightTunnel; a.labRound = 3; a.labChanges = 0; a.focusHold = 0; });
await waitFor((s) => s.focus === 'launch' && !s.moving, 'raft framed', 60000);
const rf = await proj(worldOf('a.raft.group'));
console.log('raft', rf);
await drag(rf, { x: rf.x + 70, y: rf.y + 30 }, 10, 70);
await waitFor((s) => s.phase === 'ride', 'raft away');
await shot('07-ride-a');
await waitFor((s) => s.raftS > 8, 'mid flume');
await shot('08-ride-b');
await waitFor((s) => s.raftS > 16, 'lower flume');
await shot('09-ride-c');
await waitFor((s) => s.phase === 'runout', 'run-out');
await shot('10-runout');
await waitFor((s) => s.phase === 'lab', 'back to the workshop', 40000);
await shot('11-lab');

console.log('--- console ---');
console.log(logs.join('\n') || '(clean)');
await browser.close();
