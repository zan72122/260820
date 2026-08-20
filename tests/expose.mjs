import { open } from './harness.mjs';
const app = await open('desk', { fast: false, dpr: 1 });
await app.sim(0.6);
for (const [ex, sun, env, hemi] of [[1.08,3.0,1.9,1.05],[0.8,2.4,1.2,0.6],[0.62,2.0,0.95,0.45]]) {
  await app.page.evaluate(([ex, sun, env, hemi]) => {
    const e = window.__imo.engine;
    e.renderer.toneMappingExposure = ex;
    e.sun.intensity = sun;
    e.scene.environmentIntensity = env;
    e.scene.traverse((o) => { if (o.isHemisphereLight) o.intensity = hemi; });
  }, [ex, sun, env, hemi]);
  await app.shot(`exposure-${ex}`);
}
await app.close();
