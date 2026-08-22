# ピンの森

4歳児向けの観察ゲーム。舞台は博物館の保存修復室。修復中の木製標本
キャビネットに、展示・教育用に大型化した**架空の**ピンシリンダー断面模型が
取り付けられています。正規の鍵を差し込むと、鍵の山と谷に押されて小さな
ピンの群れが波のように上下し、最後の数mmで全部の境界が一本の線
（シアライン）へ揃う——その瞬間を何度でも観察できます。

> 子ども文:「かぎの やまで、ちいさな ぼうの つなぎめを いっぽんの せんに するよ」

⚠️ 本作の鍵輪郭・切削値・ピン長はすべて架空かつ誇張されたデモ用の値で、
実在の鍵システム・キーコード・解錠技術とは無関係です。ピッキング工具や
不正開錠の要素はありません。

## 遊び方（タッチ操作のみ）

- **鍵を奥へ/手前へスワイプ** — 挿入量がそのまま指に追従。途中で止めても、
  引き戻してもよい。斜めスワイプは挿入軸へ自動補正。
- **鍵が最後まで入ったら、大きな円弧ジェスチャで回す** — ピンが揃って
  いれば回り、プラグ→カム→デッドボルト→扉と機構が連鎖する。
  揃っていなければ数度だけ弾性で動いて戻る。
- **扉を少し引く** — ボルトが引っ込んだ後にスワイプで開く。中には小さな
  機械式オルゴール。
- **2回目以降** — 輪郭の違う3本の鍵（まる・さんかく・しかく）をトレイから
  選べる。間違い鍵も奥まで入るが、境界のどこかが線を横切ったまま残る。
  赤表示・点数・警告音はない。
- **∞ボタン** — いつでも自由遊び（鍵の前後運動とピン波の観察）へ。

## 開発

```bash
npm install
npm run dev        # 開発サーバ (5173)
npm run typecheck  # tsc --noEmit
npm run build      # 型検査 + production build (dist/)
npm run preview    # dist/ を 4173 で配信
npm run e2e        # Playwright (Chromium) — preview サーバを自動起動
```

開発用ビジュアル監査スクリプト（`npm run preview` を起動しておく）:

```bash
node scripts/screenshot.mjs <outdir> [portrait|landscape]  # 主要5場面
node scripts/flowshots.mjs <outdir>                        # 導入・トレイ・誤鍵
node scripts/ipadshots.mjs                                 # iPad縦横
```

`?e2e=1` でDPR=1・導入スキップの決定論プロファイル。`window.__pinForest`
に決定論的なテストフック（状態・深さ・境界オフセット・回転など）を公開。

## アーキテクチャ

- **決定論的モデル** — ピン高さは `bladeHeightAt(鍵輪郭, 挿入位置)` の純関数。
  同じ関数が鍵メッシュのシルエット生成にも使われるため、見えている山が
  そのままピンを持ち上げる。物理エンジンは不使用。ばねの見た目だけ
  臨界減衰ばねで平滑化し、論理値は常に決定論。
- **状態機械** — KEY_OUT / KEY_PARTIAL / KEY_INSERTING / KEY_FULL /
  PINS_ALIGNED / PLUG_ROTATING / BOLT_RETRACTING / DOOR_OPEN / FREE_PLAY。
  localStorage に保存し、復帰・画面回転で挿入位置とピン状態を保持。
- **断面表現** — ハウジング・ビブル・プラグの +X 側を実ジオメトリで
  切削した「博物館の断面教育模型」。外観→断面の移行はカメラが無傷側から
  切削側へ回り込む実movesで、フェードもネオン発光もなし。シアラインは
  プラグとハウジングの金属の継ぎ目と細い刻線で読む。
- **主要モジュール** — FictionalKeyProfile / InsertionRail / PinStackRig
  (SpringResponse・ShearAlignment 内包) / Mechanism (PlugAndTailpiece +
  BoltMechanism) / CameraDirector / ChildHintController / ReplayVariation。
- **レンダリング** — three.js WebGL2、全アセット手続き生成（外部DL 0件、
  bundle 約147KB gzip）。ACESトーンマップ、DPR上限2、影は作業灯1灯のみ。

## 既知の制約

- WebGPU 上位品質パス・GLB/KTX2/Meshopt アセットパイプラインは未実装
  （全ジオメトリ手続き生成のため配信アセット自体が存在しない）。
- SwiftShader 上の E2E では FPS・最終画質は判定しない方針
  （CLAUDE.md の WebGL ポリシー準拠）。実機 GPU での確認を推奨。
- 音は WebAudio による小さなオルゴール合成音のみ（初回ジェスチャ後に有効）。
