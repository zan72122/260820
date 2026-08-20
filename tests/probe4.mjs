import { open } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
await app.sim(0.6);
await app.page.evaluate(() => {
  window.__imo.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 150) o.visible = false; });
});
await app.shot('probe-notrees');
await app.page.evaluate(() => {
  window.__imo.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 150) { o.visible = true; o.material.fog = false; o.material.needsUpdate = true; } });
});
await app.shot('probe-nofog');
await app.close();
