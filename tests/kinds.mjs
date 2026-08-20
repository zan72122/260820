import { open, line, circle } from './harness.mjs';
const app = await open('padLand', { fast: false, dpr: 1 });
const W = app.size.width;
const digOne = async (n) => {
  let s;
  for (let a = 0; a < 8 && (await app.state()).phase === 'trace'; a++) {
    s = await app.state();
    await app.drag(s.vinePath.flatMap((p, i, arr) => (i ? line(arr[i - 1], p, 4).slice(1) : [p])), { framesPerPoint: 1 });
  }
  await app.sim(0.6);
  s = await app.state();
  await app.drag(line({ x: s.crownScreen.x + W * 0.2, y: s.crownScreen.y + 90 }, { x: s.crownScreen.x + W * 0.13, y: s.crownScreen.y + 40 }, 8), { framesPerPoint: 2 });
  await app.sim(1.0);
  for (let i = 0; i < 6 && (await app.state()).phase === 'lever'; i++) {
    s = await app.state();
    await app.drag(line(s.forkHandleScreen, { x: s.forkHandleScreen.x + 20, y: s.forkHandleScreen.y + 250 }, 14), { framesPerPoint: 2 });
    await app.sim(0.4);
  }
  for (let i = 0; i < 10 && (await app.state()).phase === 'brush'; i++) {
    s = await app.state();
    await app.drag(circle(s.crownScreen, 55 + i * 6, 34 + i * 4, 5, 10), { framesPerPoint: 1 });
  }
  for (let i = 0; i < 6 && (await app.state()).phase === 'pull'; i++) {
    s = await app.state();
    await app.drag(line(s.crownScreen, { x: s.crownScreen.x, y: s.crownScreen.y - 300 }, 16), { framesPerPoint: 2 });
    await app.sim(0.5);
  }
  await app.sim(0.8);
  s = await app.state();
  await app.shot(`kind-${n}-${s.kind}`);
  console.log(`hill ${s.hill} kind=${s.kind} tubers=${s.tubers} phase=${s.phase}`);
  for (let i = 0; i < 8 && (await app.state()).phase === 'shake'; i++) {
    s = await app.state();
    const c = s.clusterScreen;
    await app.drag([{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y }], { framesPerPoint: 2 });
  }
  await app.sim(0.4);
  await app.shot(`kind-${n}-clean`);
  for (let i = 0; i < 10 && (await app.state()).phase === 'carry'; i++) {
    s = await app.state();
    await app.drag(line(s.clusterScreen, s.crateScreen, 12), { framesPerPoint: 2 });
  }
  await app.sim(1.2);
  s = await app.state();
  if (s.phase === 'handoff') {
    for (let i = 0; i < 6 && (await app.state()).hill === n; i++) {
      s = await app.state();
      await app.drag(line(s.nextVinePath[0], s.nextVinePath[2], 6), { framesPerPoint: 2 });
      await app.sim(0.5);
    }
  }
  console.log('  -> now', JSON.stringify(await app.state()).slice(0, 90));
};
await app.sim(1.0);
for (let n = 0; n < 3; n++) await digOne(n);
await app.shot('kinds-final');
console.log(app.logs.filter((l) => !l.includes('toNonIndexed')).slice(0, 5).join('\n') || 'clean');
await app.close();
