import { open } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
await app.sim(0.8);
// look straight down at the first hill and hide the canopy
await app.page.evaluate(() => {
  const e = window.__imo.engine;
  e.scene.traverse((o) => { if (o.isInstancedMesh && o.count < 120) o.visible = false; });
  e.camera.position.set(0.9, 1.1, -0.9);
  e.camera.lookAt(0, 0.2, 0);
  e.camera.updateMatrixWorld();
  e.renderer.render(e.scene, e.camera);
});
await app.page.screenshot({ path: 'shots/probe-patch-before.png' });
const info = await app.page.evaluate(() => {
  const out = { found: 0, uniforms: null };
  const d = window.__imo;
  // reach into the director through the scene graph
  let site = null;
  d.scene.traverse((o) => { if (o.material && o.material.customProgramCacheKey && o.material.customProgramCacheKey() === 'digsite-topsoil') { site = o; out.found++; } });
  if (site) {
    out.pos = site.getWorldPosition(new (site.position.constructor)()).toArray();
    out.visible = site.visible;
    out.tris = site.geometry.index.count / 3;
    out.hasBowl = !!site.geometry.attributes.aBowlY;
    out.hasCrack = !!site.geometry.attributes.aCrack;
  }
  return out;
});
console.log(info);
await app.close();
