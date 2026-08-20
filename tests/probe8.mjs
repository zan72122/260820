import { open, line } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
await app.sim(1.0);
let s;
for (let a = 0; a < 6 && (await app.state()).phase === 'trace'; a++) {
  s = await app.state();
  await app.drag(s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p])), { framesPerPoint: 1 });
}
await app.sim(0.8);
s = await app.state();
await app.drag(line({ x: s.crownScreen.x + 150, y: s.crownScreen.y + 95 }, { x: s.crownScreen.x + 100, y: s.crownScreen.y + 45 }, 8), { framesPerPoint: 2 });
await app.sim(1.0);
for (let i = 0; i < 5 && (await app.state()).phase === 'lever'; i++) {
  s = await app.state();
  await app.drag(line(s.forkHandleScreen, { x: s.forkHandleScreen.x + 20, y: s.forkHandleScreen.y + 250 }, 14), { framesPerPoint: 2 });
  await app.sim(0.4);
}
await app.sim(1.5);
await app.page.evaluate(() => window.__imo.fillMask());
await app.sim(1.0);
console.log('after fill', JSON.stringify(await app.state()).slice(0, 170));
await app.shot('probe-fillmask');
await app.close();
