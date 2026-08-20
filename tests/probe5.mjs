import { open } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
await app.sim(0.6);
const r = await app.page.evaluate(() => {
  let out = 'none';
  window.__imo.scene.traverse((o) => {
    if (o.isInstancedMesh && o.count === 150) {
      const c = new (o.instanceColor.constructor)(new Float32Array(o.count * 3), 3);
      for (let i = 0; i < o.count; i++) { c.array[i*3] = 1; c.array[i*3+1] = 0; c.array[i*3+2] = 0; }
      o.instanceColor = c;
      o.instanceColor.needsUpdate = true;
      o.material.needsUpdate = true;
      out = 'set red';
    }
  });
  return out;
});
console.log(r);
await app.shot('probe-redtrees');
await app.close();
