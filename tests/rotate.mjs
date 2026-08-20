import { open, line, circle } from './harness.mjs';

const app = await open('desk');
await app.sim(1.0);
let s;
for (let a = 0; a < 6 && (await app.state()).phase === 'trace'; a++) {
  s = await app.state();
  await app.drag(s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p])), { framesPerPoint: 1 });
}
await app.sim(0.6);
s = await app.state();
const w = app.size.width;
await app.drag(line({ x: s.crownScreen.x + w * 0.28, y: s.crownScreen.y + 90 }, { x: s.crownScreen.x + w * 0.18, y: s.crownScreen.y + 40 }, 8), { framesPerPoint: 2 });
await app.sim(1.0);
for (let i = 0; i < 5 && (await app.state()).phase === 'lever'; i++) {
  s = await app.state();
  await app.drag(line(s.forkHandleScreen, { x: s.forkHandleScreen.x + 20, y: s.forkHandleScreen.y + 250 }, 14), { framesPerPoint: 2 });
  await app.sim(0.4);
}
for (let i = 0; i < 4 && (await app.state()).phase === 'brush'; i++) {
  s = await app.state();
  await app.drag(circle(s.crownScreen, 55 + i * 6, 34 + i * 4, 5, 10), { framesPerPoint: 1 });
}
const before = await app.state();
console.log('before rotate  ', JSON.stringify({ phase: before.phase, cleared: before.cleared, exposed: before.exposed, portrait: before.portrait }));

// landscape -> portrait -> landscape, mid-dig
await app.page.setViewportSize({ width: 500, height: 900 });
await app.sim(0.6);
const mid = await app.state();
console.log('portrait       ', JSON.stringify({ phase: mid.phase, cleared: mid.cleared, exposed: mid.exposed, portrait: mid.portrait }));
await app.shot('rotate-portrait');
await app.page.setViewportSize({ width: 900, height: 500 });
await app.sim(0.6);
const after = await app.state();
console.log('back to landscape', JSON.stringify({ phase: after.phase, cleared: after.cleared, exposed: after.exposed, portrait: after.portrait }));
await app.shot('rotate-landscape');

const ok = before.cleared === mid.cleared && mid.cleared === after.cleared && before.phase === after.phase;
console.log(ok ? 'PASS dig state survives rotation' : 'FAIL dig state changed');
console.log('console issues:', app.logs.filter((l) => !l.includes('toNonIndexed')).slice(0, 8).join('\n') || 'none');
await app.close();
