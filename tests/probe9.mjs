import { open } from './harness.mjs';
import fs from 'node:fs';
const app = await open('desk');
await app.sim(0.6);
const src = await app.page.evaluate(() => {
  const r = window.__imo.engine.renderer;
  const gl = r.getContext();
  const out = [];
  for (const p of r.info.programs || []) {
    if (String(p.cacheKey).includes('digsite-topsoil')) {
      out.push({ key: p.cacheKey, vs: gl.getShaderSource(p.vertexShader) });
    }
  }
  return out;
});
fs.mkdirSync('shots', { recursive: true });
for (const s of src) fs.writeFileSync('shots/topsoil.vert.glsl', s.vs);
console.log('programs:', src.length);
await app.close();
