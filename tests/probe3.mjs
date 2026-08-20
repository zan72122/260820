import { open } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
const info = await app.page.evaluate(() => {
  const out = [];
  window.__imo.scene.traverse((o) => {
    if (o.isInstancedMesh && o.count > 100) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({ count: o.count, vc: m.vertexColors, ic: !!o.instanceColor,
        c0: o.instanceColor ? Array.from(o.instanceColor.array.slice(0,3)).map(v=>+v.toFixed(3)) : null,
        hasColor: !!o.geometry.attributes.color, y: o.position.y, tris: o.geometry.index ? o.geometry.index.count/3 : o.geometry.attributes.position.count/3 });
    }
  });
  return out;
});
console.log(info);
await app.close();
