import { open } from './harness.mjs';
const app = await open('desk');
await app.sim(0.6);
await app.page.evaluate(() => window.__imo.fillMask());
await app.sim(0.5);
const info = await app.page.evaluate(() => {
  const r = window.__imo.engine.renderer;
  const out = [];
  window.__imo.scene.traverse((o) => {
    if (o.material && o.material.customProgramCacheKey && o.material.customProgramCacheKey() === 'digsite-topsoil') {
      const props = r.properties.get(o.material);
      const u = props.uniforms;
      const tex = u && u.uMask ? u.uMask.value : null;
      out.push({
        pos: o.getWorldPosition(new o.position.constructor()).toArray().map((v)=>+v.toFixed(2)),
        hasUniforms: !!u,
        hasUMask: !!(u && u.uMask),
        texType: tex ? tex.constructor.name : null,
        texVersion: tex ? tex.version : null,
        dataMax: tex && tex.image && tex.image.data ? Math.max(...tex.image.data.slice(0, 4000)) : null,
        uLift: u && u.uLift ? u.uLift.value : null,
        uCrack: u && u.uCrack ? u.uCrack.value : null,
        inList: props.uniformsList ? props.uniformsList.some((e) => e[0] && e[0].id === 'uMask') : 'n/a',
        listNames: props.uniformsList ? props.uniformsList.map((e) => e[0] && e[0].id).filter((n) => n && n.startsWith('u')).join(',') : 'n/a',
      });
    }
  });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await app.close();
