# マンゴーのハンモック / Mango Hammock

一本の枝。一個のマンゴー。一枚の白いネット。
そして「なぜ果実の下にハンモックをかけるのか」という一つの謎。

4歳児向けの、文字のない短編モバイルWebゲームです。
説明もチュートリアルも失敗もありません。
子どもがネットの端を枝のフックへかけ、光を動かして時間を進めると、
マンゴーが熟し、やがて自然に離れ、ネットが受け止めます。

A short, wordless mobile web game for four-year-olds. There is no text, no
tutorial, no failure state and nothing to unlock. A child hooks both ends of a
net onto a branch, moves the light to move the day, and watches one mango
ripen, let go, fall, and be caught.

---

## 遊びかた / Playing it

一指だけで最初から最後まで遊べます。ピンチもカメラ回転もありません。

1. 台の上に置かれた白いネットの端を、枝のフックへドラッグする（左右とも）
2. 画面をなぞって光を動かす。動かすたびに果皮の色づきが少しずつ広がる
3. 熟しきると、果柄がわずかに細くなり、マンゴーが自然に離れて落ちる
4. ネットが受け止め、深く沈み、一度だけポヨンと戻って静止する
5. ネットを指で押すと、重さに応じてゆっくり揺れる
6. ネットの端をフックから外すと、マンゴーが台へ転がり出て、次の実が始まる

One finger does everything. Nothing requires two.

## 動かす / Running it

```sh
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type check + production bundle into dist/
npm run preview    # serve the built bundle on http://127.0.0.1:4173
npm test           # simulation and state-machine unit tests (no GPU needed)
npm run e2e        # Playwright: builds, serves and drives the real game
npm run shots      # capture the five key moments at four screen sizes
node scripts/perf.mjs   # CPU cost of one update, per quality tier
```

`npm run e2e` and `npm run shots` need a preview server; the Playwright config
starts one itself, `scripts/serve.sh` starts one for the capture scripts.

### URL の切り替え / URL switches

| Query | Effect |
| --- | --- |
| `?q=low` `?q=mid` `?q=high` | Force a quality tier instead of detecting one |
| `?fast=1` | Cheapest possible frame: no shadows, no dust, small textures |
| `?seed=12345` | Fix the run's seed, so every fruit is reproducible |
| `?e2e=1` | Deterministic capture mode, and exposes `window.__mango` for tests |

`window.__mango` exists **only** with `?e2e=1`. Nothing in the game reads it.

## つくり / How it is built

- **Vite + TypeScript + Three.js**, targeting WebGL 2. No framework, no state
  library, no backend, no analytics, no ads, no login.
- **アセットはゼロ**。果皮、樹皮、葉、紐の繊維、細かい網目、床、そして環境光の
  プローブまで、すべて起動時にコードで生成します。外部素材は一切ありません
  (see [docs/ASSETS.md](docs/ASSETS.md)).
- The whole simulation runs at a fixed timestep, so the catch looks the same on
  a slow phone and a fast desktop.

```
src/
  core/      seeded RNG, easing and springs, quality tiers, pointer input, audio
  gfx/       noise, and the texture lab that generates every map at boot
  sim/       NetSim (Verlet rope net) and FruitSim (the authored catch)
  world/     mango, net mesh, branch, leaves, greenhouse, dynamic tubes
  game/      layout constants, state machine, camera director, the controller
tests/       unit tests for the three pieces that must never drift
e2e/         Playwright tests that drive the real game with a real pointer
scripts/     capture and probe scripts used while building this
docs/        design notes and the asset/licensing record
```

Read [docs/DESIGN.md](docs/DESIGN.md) for why the catch is written the way it
is, and for the finished-or-not checklist with evidence.

## 対応 / Platform handling

Full-screen canvas, Pointer Events (single pointer only), safe-area insets fed
into the camera framing, orientation changes, audio unlocked on the first
touch, and WebGL context loss and restore.

**実機確認はしていません。** Verified in headless Chromium (SwiftShader) at
390x844, 844x390, 1024x1366 and 1366x1024. It has **not** been run on real
iPhone or iPad hardware, so nothing here should be read as a device-tested
claim. Frame rate and final visual quality in particular must be judged on a
GPU-accelerated device, not on a software rasteriser.

## ライセンス / Licence

Code in this repository is original work written for this project. Every
texture and every mesh is generated at runtime by that code. See
[docs/ASSETS.md](docs/ASSETS.md).
