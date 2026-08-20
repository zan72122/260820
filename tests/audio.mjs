import { open } from './harness.mjs';
const app = await open('desk');
await app.sim(0.5);
const before = await app.page.evaluate(() => window.__imo.errors.length);
await app.page.mouse.click(300, 400);
await app.sim(0.4);
const info = await app.page.evaluate(async () => {
  const mod = await import('/src/core/audio.ts');
  const a = mod.audio;
  const ctx = a.ctx ?? null;
  const calls = ['leafRustle', 'vineTense', 'forkIn', 'clodCrack', 'soilFall', 'grains', 'tuberPop', 'crateSet', 'digScrape'];
  const failed = [];
  for (const c of calls) {
    try { a[c](0.5); } catch (e) { failed.push(`${c}: ${e.message}`); }
  }
  try { a.haptic('crack'); a.haptic('pop'); } catch (e) { failed.push('haptic: ' + e.message); }
  return { failed, hasCtx: !!ctx };
});
await app.sim(0.6);
const after = await app.page.evaluate(() => window.__imo.errors);
console.log('sound calls failed:', info.failed.length ? info.failed : 'none');
console.log('errors before/after:', before, after.length, after.slice(0, 3));
await app.close();
