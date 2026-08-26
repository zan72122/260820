import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const q of ['fast', 'low', 'high']) {
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(`http://localhost:5173/?fast=1&q=${q}&seed=7`);
  await p.waitForFunction(() => !!window.__toami);
  const r = await p.evaluate(() => {
    const T = window.__toami, g = T.game;
    T.advance(1.0);
    T.cast({ distance: 8, azimuth: 0.1, sharpness: 0.7, smoothness: 0.9, wobble: 0.2 });
    T.advance(1.6);
    const t0 = performance.now();
    for (let i = 0; i < 30; i++) { g.update(1 / 60); g.render(); }
    const ms = (performance.now() - t0) / 30;
    return {
      quality: T.quality.name, calls: g.renderer.info.render.calls,
      tris: g.renderer.info.render.triangles, programs: g.renderer.info.programs.length,
      cpuGpuMsPerFrame: +ms.toFixed(2), textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries
    };
  });
  console.log(JSON.stringify(r));
  await p.close();
}
await b.close();
