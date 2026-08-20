// 実時間での描画コストを測る（fast モードではなく本番ループ）
import { chromium } from 'playwright';
const CH = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: CH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [name, w, h, dpr, q] of [['portrait-high', 390, 844, 2, 'high'], ['portrait-mid', 390, 844, 2, 'mid'], ['portrait-low', 390, 844, 2, 'low'], ['landscape-high', 844, 390, 2, 'high']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  p.on('pageerror', (e) => console.error('ERR', e.message));
  await p.goto(`http://localhost:5173/?q=${q}`);
  await p.waitForFunction(() => !!window.__nagaoka);
  await p.evaluate(() => { window.__nagaoka.begin(); });
  await p.waitForTimeout(3200);
  await p.evaluate(() => window.__nagaoka.niagara());
  await p.waitForTimeout(4000);
  await p.evaluate(() => window.__nagaoka.shell());
  // 開発の直後がいちばん重い
  const res = await p.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 3800));
    const t = [];
    let last = performance.now();
    await new Promise((done) => {
      const tick = () => {
        const now = performance.now();
        t.push(now - last); last = now;
        if (t.length < 150) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
    t.sort((a, b) => a - b);
    return {
      median: +t[Math.floor(t.length / 2)].toFixed(2),
      p95: +t[Math.floor(t.length * 0.95)].toFixed(2),
      worst: +t[t.length - 1].toFixed(2),
      state: window.__nagaoka.state(),
    };
  });
  console.log(name, 'frame ms median/p95/worst =', res.median, res.p95, res.worst,
    '| parts', res.state.particles, 'smoke', res.state.smoke, 'phase', res.state.phase, 'canvas', await p.evaluate(() => [scene.width, scene.height]));
  await p.close();
}
await b.close();
