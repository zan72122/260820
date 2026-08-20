import { open } from './harness.mjs';
const app = await open('desk');
const n = await app.page.evaluate(() => {
  let count = 0;
  const seen = [];
  window.__imo.scene.traverse((o) => {
    if (o.material && o.material.customProgramCacheKey && o.material.customProgramCacheKey() === 'digsite-topsoil') {
      count++;
      let p = o.parent, chain = [];
      while (p) { chain.push(p.name || p.type); p = p.parent; }
      seen.push(chain.join('<'));
    }
  });
  return { count, seen };
});
console.log(n.count);
n.seen.forEach((s) => console.log(' ', s));
await app.close();
