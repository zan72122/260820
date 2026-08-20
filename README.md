# モモの光のじゅうたん

4歳児向けのモバイルWebゲーム。文章もアイコンも使わず、

> 「下に置いた白いものが、どうしてモモをピンクにするのだろう」

という謎から、

> 「下からも光が当たるようになったから、色づいた」

という理解へ、そして

> 「シートをどこへ置くと、どんな色づきになるだろう」

という遊びへ進みます。

モモに直接色を塗る操作は存在しません。色は必ず「反射シートの置き方」と
「時間の経過」の結果として現れます。

---

## 遊びの流れ

| 段階 | 画面 | 一指操作 |
| --- | --- | --- |
| `bagged` | 袋をかぶったモモ、巻かれたシート、地面 | 紙袋の下端を下へ引く |
| `unbagging` → `observing` | 袋が紙らしく皺を作って外れ、淡いモモが現れる | （観察の間） |
| `sheetIdle` → `unrolling` | ロールが回り、シートが地面の凹凸へ沿って広がる | シート端を枝の下へ引く |
| `firstLight` | シート表面が明るくなり、モモ下側の産毛に反射光が入り、埃が一度だけ反射方向を示す | （局所反応を見る間） |
| `ripening` | 太陽・シート・モモが同じ斜め構図に入る | 太陽を左右へ動かす |
| `freeplay` | 産毛と色勾配の接写 → 自由配置 | シートを振る／伸ばす／折り返す |
| `handoff` | 枝の先の二個目 | 次のモモに触れる |

失敗状態はありません。どこにシートを置いても、自然な範囲で違う桃色模様が
生まれます。モモが焼ける・枯れるといった展開は作っていません。

### ヒント

- 最初の3秒は何も出しません。
- 3秒後：紙袋の下端、またはシート端が風で一度だけ動きます。
- 9秒後：対象そのものが数センチだけ動いて戻る予備動作。
- 一度成功した操作のヒントは、次のモモでも出しません。
- 矢印・文章・音声説明は一切使いません。効果音は環境音と接触音のみです。

---

## 技術方針

- **Vite + TypeScript + Three.js**、WebGL 2 が最低基準。WebGPU は使いません。
- 主要マテリアルは `MeshPhysicalMaterial` を `onBeforeCompile` で拡張する方式。
  PBR・影・トーンマッピングは Three に任せ、産毛・fuzz shell・blush mask・
  反射寄与だけを注入しています。
- **テクスチャは全て手続き生成**（`src/scene/textures.ts`）。外部アセットは
  ゼロなので、記録すべき第三者ライセンスはありません。
- 広告・ログイン・課金・分析 SDK は入れていません。ネットワーク通信もしません。

### 光の工学的な偽装

真のリアルタイム GI は使いません。反射シートを「一様に光る凸多角形」とみなし、
微小面へ届く放射照度を Lambert の輪郭積分で**解析的に解いています**
（`src/sim/lightMath.ts`）。

```
E = L · Σ_edges acos(rᵢ·rⱼ) · ( normalize(rᵢ × rⱼ) · n )
```

同じ式を TypeScript と GLSL の両方に持たせ、1つの値から次を駆動します。

1. モモ表面の補助照明（`indirectDiffuse` への加算）
2. blush mask の成長速度（CPU、96×64 の果皮パラメータ空間）
3. 接地影の持ち上がり（枝・葉・地面にも同じ寄与を加算）
4. 産毛 rim の明るさ（fuzz shell と skin の rim 項）
5. 周囲の葉へのごく弱い bounce

点光源をシート上に置く方式ではないため、シートを広げてもモモ全体が
白飛びしません。シートを折り返して面積を減らすと、実際に届く光が減ります。

### 色づき

`src/sim/blush.ts` の成長則は

```
rate = (直達日射 · 0.45 + 反射照度 · 3.2) · 個体ムラ · (1 − 0.55 · 現在値) · 0.26
```

で、経過は太陽の移動量（`simTime`）に比例します。**指を離した瞬間に色が塗られる
ことはありません。** 局所照明は即座に変わり、果皮色は太陽を数回動かす間に
じわじわ広がります。日向・葉影・シート反射・果梗周囲・産毛が別々に効くため、
仕上がりは全体 fade ではなく不均一な模様になります。

### 品質ティア

| | low | balanced | high |
| --- | --- | --- | --- |
| devicePixelRatio 上限 | 1.35 | 1.9 | 2.25 |
| fuzz shell | 1 | 3 | 5 |
| 影マップ | 1024 / hard | 1536 / soft | 2048 / soft |
| 背景樹・草・埃 | 少 | 中 | 多 |

`LoadGovernor` がフレーム時間を平滑化し、renderScale を 1 フレーム 1.2% 以内で
緩やかに動かします。持続的な負荷のときだけティアを 1 段下げます。
**どのティアでも「シートを動かす→下から光が届く→色づきが変わる」因果は保持します。**

### 端末対応

- safe-area（`env(safe-area-inset-*)`）、縦横回転、`visualViewport` リサイズ。
- 回転しても、外した袋・シート位置・太陽位置・色づき mask を維持します。
- 音声は最初のポインタ操作で開始（自動再生制限に対応）。
- WebGL context lost / restored を処理。blush mask は CPU 側の `Float32Array`
  なので消えません。
- `sessionStorage` に状態と色づき mask を保存し、リロードしても続きから遊べます。

---

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm run typecheck  # tsc --noEmit
npm run test       # vitest（状態遷移・光学・果実形状）
npm run build      # 型検査 + production build
npm run preview    # dist をプレビュー
npm run e2e        # Playwright（Chromium）
```

### 自動テスト用フック

`?fast=1` で決定的・低負荷モードになります（`E2E_FAST` 相当）。
`?tier=low|balanced|high` でティアを固定できます。

`window.momo.debug()` が現在の状態を返し、`window.momo.test` が
`bag / sheet / lateral / fold / reach / sun / skip / ripen` を提供します。
`skip` はシミュレーションとカメラを実時間なしで進めるため、
SwiftShader のような低フレームレート環境でも決定的に検証できます。

### 画面撮影

```bash
npm run build && npm run preview &
TIER=balanced OUT=shots node tools/shoot.mjs
```

390×844 / 844×390 / 1024×1366 / 1366×1024 の 4 解像度で、
袋付き・袋外し・シート途中・最初の反射・色づき途中・自由配置を撮影します。

目視監査の記録は [`docs/visual-audit.md`](docs/visual-audit.md) にあります。

> **注意**: このリポジトリの CI/クラウド実行環境は SwiftShader（ソフトウェア
> ラスタライザ）です。FPS・アニメーションの滑らかさ・最終的な見た目の品質は
> ここでは判定できません。GPU・視覚回帰・性能テストは、ハードウェア
> アクセラレーションが確認できるローカルまたは CI ランナーで行ってください。

---

## ディレクトリ

```
src/
  core/     app（配線）, state（純粋な状態機械）, input, quality, audio, storage
  sim/      lightMath（解析反射）, blush（色づき）, noise
  scene/    peach, peachShape, bag, sheet, orchard, lightRig, cameraRig, motes,
            textures（全手続き生成）, terrain, bounceMaterial
tests/      vitest（状態遷移・光学・形状）
e2e/        Playwright（起動・因果・回転・実指操作）
tools/      shoot.mjs（撮影）
```
