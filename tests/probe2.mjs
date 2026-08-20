import { open } from './harness.mjs';
const app = await open('desk');
const info = await app.page.evaluate(() => {
  const out = [];
  window.__imo.scene.traverse((o) => {
    if (o.isInstancedMesh) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({
        count: o.count,
        vertexColors: m.vertexColors,
        hasInstanceColor: !!o.instanceColor,
        firstColor: o.instanceColor ? Array.from(o.instanceColor.array.slice(0, 3)).map(v=>+v.toFixed(3)) : null,
        hasColorAttr: !!o.geometry.attributes.color,
        defines: m.__defines ?? null,
        matColor: m.color.getHexString(),
      });
    }
  });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await app.close();
