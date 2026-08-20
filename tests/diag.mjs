import { open, line } from './harness.mjs';
const app = await open('desk');
await app.sim(0.5);
let s = await app.state();
for (let attempt = 0; attempt < 6 && (await app.state()).phase === 'trace'; attempt++) {
  s = await app.state();
  const pts = s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p]));
  await app.drag(pts, { framesPerPoint: 1 });
}
await app.sim(1.0);
s = await app.state();
console.log('phase', s.phase, 'handle', s.forkHandleScreen, 'crown', s.crownScreen, 'lever', s.lever);
const h = s.forkHandleScreen;
await app.page.mouse.move(h.x, h.y);
await app.page.mouse.down();
await app.sim(1/60);
for (let i = 1; i <= 12; i++) {
  await app.page.mouse.move(h.x + i, h.y + i * 22);
  await app.sim(1/60);
  const st = await app.state();
  if (i % 4 === 0) console.log(' step', i, 'lever', st.lever, 'phase', st.phase);
}
await app.page.mouse.up();
await app.sim(0.5);
console.log('final', JSON.stringify((await app.state())).slice(0, 200));
await app.close();
