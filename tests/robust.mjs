import { open } from './harness.mjs';

const app = await open('phone');
const W = app.size.width, H = app.size.height;
const rnd = (() => { let a = 12345; return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();

// hint escalation, hands off
await app.sim(3.2, true);
await app.shot('hint-3s');
await app.sim(3.2, true);
await app.shot('hint-6s');
await app.sim(3.4, true);
await app.shot('hint-9s');
const hintVisible = await app.page.evaluate(() => {
  const f = document.getElementById('finger');
  return { fingerOpacity: f.style.opacity, trail: document.getElementById('trail').style.opacity };
});
console.log('finger hint after 10s idle:', JSON.stringify(hintVisible));

// abuse: taps, double taps, flicks, multi-touch-ish, off-target drags
let steps = 0;
for (let i = 0; i < 140; i++) {
  const x = 10 + rnd() * (W - 20);
  const y = 10 + rnd() * (H - 20);
  const mode = Math.floor(rnd() * 4);
  if (mode === 0) {
    await app.page.mouse.click(x, y);
  } else if (mode === 1) {
    await app.page.mouse.move(x, y);
    await app.page.mouse.down();
    await app.page.mouse.move(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8);
    await app.page.mouse.up();
  } else if (mode === 2) {
    await app.page.mouse.move(x, y);
    await app.page.mouse.down();
    await app.page.mouse.move(x + (rnd() - 0.5) * 400, y + (rnd() - 0.5) * 400);
    await app.page.mouse.up();
  } else {
    await app.page.mouse.move(x, y);
    await app.page.mouse.down();
    for (let k = 0; k < 5; k++) {
      await app.page.mouse.move(x + Math.sin(k) * 120, y + Math.cos(k) * 120);
      await app.sim(1 / 60);
    }
    // deliberately never released this round
  }
  await app.sim(2 / 60);
  steps++;
}
await app.page.mouse.up().catch(() => {});
await app.sim(1.0);
const s = await app.state();
console.log('after', steps, 'random inputs ->', JSON.stringify({ phase: s.phase, hill: s.hill, cleared: s.cleared, pull: s.pull, fps: s.fps }));
await app.shot('robust-after');
const errs = await app.page.evaluate(() => window.__imo.errors);
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none');
console.log('console issues:', app.logs.filter((l) => !l.includes('toNonIndexed')).slice(0, 6).join('\n') || 'none');
await app.close();
