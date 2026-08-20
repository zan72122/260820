import { open, line, circle } from './harness.mjs';
const size = process.argv[2] || 'desk';
const app = await open(size, { fast: false, dpr: 1 });
const shots = process.env.PREFIX || 'dig';
let s;
await app.sim(1.0);
for (let a = 0; a < 6 && (await app.state()).phase === 'trace'; a++) {
  s = await app.state();
  await app.drag(s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p])), { framesPerPoint: 1 });
}
await app.sim(0.8);
await app.shot(`${shots}-a-crown`);
s = await app.state();
await app.drag(line({ x: s.crownScreen.x + 150, y: s.crownScreen.y + 95 }, { x: s.crownScreen.x + 100, y: s.crownScreen.y + 45 }, 8), { framesPerPoint: 2 });
await app.sim(1.0);
await app.shot(`${shots}-b-fork`);
for (let i = 0; i < 5 && (await app.state()).phase === 'lever'; i++) {
  s = await app.state();
  const h = s.forkHandleScreen;
  await app.drag(line(h, { x: h.x + 20, y: h.y + 250 }, 14), { framesPerPoint: 2 });
  if (i === 0) { await app.sim(0.5); await app.shot(`${shots}-c-crack`); }
  await app.sim(0.4);
}
await app.sim(0.8);
await app.shot(`${shots}-d-levered`);
for (let i = 0; i < 8 && (await app.state()).phase === 'brush'; i++) {
  s = await app.state();
  await app.drag(circle(s.crownScreen, 55 + i * 6, 34 + i * 4, 5, 10), { framesPerPoint: 1 });
  if (i === 1) await app.shot(`${shots}-e-brush1`);
}
await app.sim(0.6);
await app.shot(`${shots}-f-brushed`);
for (let i = 0; i < 5 && (await app.state()).phase === 'pull'; i++) {
  s = await app.state();
  await app.drag(line(s.crownScreen, { x: s.crownScreen.x, y: s.crownScreen.y - 300 }, 16), { framesPerPoint: 2, release: i === 4 });
  if (i === 0) await app.shot(`${shots}-g-pull1`);
  await app.sim(0.5);
}
await app.sim(1.0);
await app.shot(`${shots}-h-lifted`);
for (let i = 0; i < 6 && (await app.state()).phase === 'shake'; i++) {
  s = await app.state();
  const c = s.clusterScreen;
  await app.drag([{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y }], { framesPerPoint: 2 });
}
await app.sim(0.6);
await app.shot(`${shots}-i-shaken`);
for (let i = 0; i < 6 && (await app.state()).phase === 'carry'; i++) {
  s = await app.state();
  await app.drag(line(s.clusterScreen, s.crateScreen, 12), { framesPerPoint: 2 });
}
await app.sim(1.2);
await app.shot(`${shots}-j-crate`);
console.log(JSON.stringify(await app.state()).slice(0, 200));
console.log(app.logs.slice(0, 8).join('\n') || 'clean');
await app.close();
