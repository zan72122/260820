import { open, line, circle } from './harness.mjs';

const size = process.argv[2] || 'desk';
const app = await open(size, { fast: process.env.FULL_QUALITY !== '1' });
const log = [];
const mark = async (label) => {
  const s = await app.state();
  log.push(`${label.padEnd(22)} phase=${s.phase} hill=${s.hill} kind=${s.kind} trace=${s.trace} lever=${s.lever} cleared=${s.cleared} exposed=${s.exposed}/${s.tubers} pull=${s.pull} mud=${s.mud} carry=${s.carry}`);
  return s;
};

let t = 0;
const clock = async (sec, render = false) => { t += sec; await app.sim(sec, render); };

await mark('start');
await app.shot(`${size}-01-open`);

// hint escalation, untouched
await clock(9.5);
await app.shot(`${size}-02-hints`);
await mark('after 10s idle');

// 1. trace the vine
let s = await app.state();
for (let attempt = 0; attempt < 6 && (await app.state()).phase === 'trace'; attempt++) {
  s = await app.state();
  const pts = s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p]));
  await app.drag(pts, { framesPerPoint: 1 });
}
await clock(0.8);
s = await mark('traced');
await app.shot(`${size}-03-traced`);

// 2. place the fork away from the crown, then release
s = await app.state();
const w = app.size.width;
const start = { x: Math.min(w - 30, s.crownScreen.x + w * 0.28), y: s.crownScreen.y + 90 };
await app.drag(line(start, { x: s.crownScreen.x + w * 0.18, y: s.crownScreen.y + 40 }, 8), { framesPerPoint: 2 });
await clock(1.0);
s = await mark('fork placed');
await app.shot(`${size}-04-fork`);

// 3. lever the handle down
for (let i = 0; i < 4 && (await app.state()).phase === 'lever'; i++) {
  s = await app.state();
  const h = s.forkHandleScreen;
  await app.drag(line({ x: h.x, y: h.y }, { x: h.x + 20, y: h.y + 260 }, 14), { framesPerPoint: 2 });
  await clock(0.4);
}
s = await mark('levered');
await app.shot(`${size}-05-lever`);

// 4. brush the soil away
for (let i = 0; i < 8 && (await app.state()).phase === 'brush'; i++) {
  s = await app.state();
  await app.drag(circle(s.crownScreen, 55 + i * 6, 34 + i * 4, 5, 10), { framesPerPoint: 1 });
}
s = await mark('brushed');
await app.shot(`${size}-06-brushed`);

// 5. pull the crown up
for (let i = 0; i < 5 && (await app.state()).phase === 'pull'; i++) {
  s = await app.state();
  await app.drag(line(s.crownScreen, { x: s.crownScreen.x, y: s.crownScreen.y - 300 }, 14), { framesPerPoint: 2 });
  await clock(0.6);
}
s = await mark('pulled');
await app.shot(`${size}-07-pulled`);

// 6. shake the soil off
for (let i = 0; i < 6 && (await app.state()).phase === 'shake'; i++) {
  s = await app.state();
  const c = s.clusterScreen;
  await app.drag([{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y }], { framesPerPoint: 2 });
}
s = await mark('shaken');
await app.shot(`${size}-08-shaken`);

// 7. carry to the crate
for (let i = 0; i < 6 && (await app.state()).phase === 'carry'; i++) {
  s = await app.state();
  await app.drag(line(s.clusterScreen, s.crateScreen, 12), { framesPerPoint: 2 });
}
await clock(1.2);
s = await mark('in crate');
await app.shot(`${size}-09-crate`);

// 8. straight on to the next vine, no result screen
await clock(1.5);
await app.shot(`${size}-10-handoff`);
for (let i = 0; i < 5 && (await app.state()).hill === 0; i++) {
  s = await app.state();
  const nx = s.nextVinePath;
  await app.drag(line(nx[0], nx[2], 6), { framesPerPoint: 2 });
  await clock(0.5);
}
s = await mark('second hill');
await app.shot(`${size}-11-second`);

console.log(log.join('\n'));
console.log('sim seconds:', t.toFixed(1));
console.log('console issues:', app.logs.length ? app.logs.slice(0, 12).join('\n') : 'none');
await app.close();
