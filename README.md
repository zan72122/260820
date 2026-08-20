# 長岡花火の一晩 — 第一夜「会場のじゅんび」

信濃川の河川敷にできた、長岡花火の会場。
花火が上がる前の夕方から、花火の夜へ切り替わるまでを遊ぶ、
iPhone / iPad 向けのモバイル web ゲームです。

このリポジトリは、その一夜のうちの **最初のパート（会場編）** を実装したものです。

## 遊びかた

タップだけで遊べます。自由カメラはありません。
見せたい絵はゲーム側がカメラで連れていきます。

1. **はしの さくを おろそう** — 橋の入口の通行止めバリケードを 3 つ下ろす
2. **あかりを つけよう** — 河川敷の案内灯と足元灯を 5 か所つける
3. **よるに しよう！** — 本部の大元スイッチを引いて、夕方を花火の夜に変える

操作するたびに会場が変わります。
柵を下ろせば人が橋を渡りはじめ、灯りをつければ遊歩道に人が集まり、
最後のスイッチで空が深い青に沈んで、川面と橋に灯りが映ります。

## 動かす

```bash
npm install
npm run dev       # http://localhost:5173  （--host 付きなので同じ Wi-Fi の iPhone からも開けます）
npm run build     # 型チェック + 本番ビルド（dist/）
npm run preview   # ビルド結果を確認
```

実機で見るときは、`npm run dev` が表示する Network の URL を
iPhone / iPad の Safari で開いてください。

### 開発用ショートカット

`?dbg=<場面>` を付けると、その場面から始まります。

`intro` / `gate` / `gateopen` / `lights` / `litpath` / `lever` / `night` / `finale`

例: `http://localhost:5173/?dbg=lever`

```bash
npm run preview            # 別ターミナルで
npm run shots              # 各場面 × 端末サイズを ./shots に書き出す
```

`npm run shots` はヘッドレス Chromium（ソフトウェア GL）で撮るため、
構図・UI・進行の確認用です。色味やなめらかさの最終判断は実機で行ってください。

## つくり

外部アセットは使っていません。地面・鋼材・コンクリート・アスファルト・
ブルーシート・草・窓明かりのテクスチャは、起動時に canvas 上で生成しています。

```
src/
  main.ts                 起動と組み立て
  core/
    Game.ts               レンダラ / ポストプロセス / ループ / 章の差し替え
    CameraDirector.ts     ショット（始点→終点）をゆっくり見せるカメラ演出
    Picker.ts             画面上の距離で拾うタップ判定（小さな対象でも押せる）
    Audio.ts              WebAudio で合成する川・風・虫・効果音
    util.ts               乱数・補間・ノイズ
  world/
    layout.ts             会場の寸法と、踏み跡・使用感の分布
    environment.ts        空・太陽・空気。時刻 0（夕方）〜1（夜）で一括制御
    water.ts              信濃川の川面（フレネル・きらめき・灯りの映り込み）
    terrain.ts            河川敷の地面（草地と踏み固められた土のブレンド）
    grass.ts              インスタンス描画の草。逆光で穂が透ける
    bridge.ts             長生橋を思わせる連続トラス橋
    props.ts              柵・コーン・ブルーシート・本部テント・仮設トイレ・電柱・木
    city.ts               遠景の町並みと丘、夜の窓明かり
    crowd.ts              座っている人・立っている人・渡りはじめる人
    lights.ts             灯りの管理（グロー / 光だまり / 実光源）
    markers.ts            「ここを さわってね」の目印
    interactives.ts       バリケード・通行止め看板・大元スイッチ
    materials.ts          共有マテリアル
    textures.ts           canvas で作る手続き的テクスチャ
    geom.ts               部材・掃引などのジオメトリ補助
  chapters/
    VenueChapter.ts       この章の進行・カメラ・演出
  ui/
    Hud.ts, style.css     開始画面 / 進行表示 / 指示 / リプレイ
```

### 章（チャプター）を足すには

`core/Game.ts` の `Chapter` インターフェース（`scene` / `director` / `enter` /
`update` / `onTap` / `dispose` / `exposure` / `bloomStrength`）を実装して、
`game.setChapter(next)` で差し替えます。
`Environment` の時刻や `LampSystem` はそのまま使い回せます。

## 画質

端末に合わせて自動で決めます（`core/Game.ts` の `detectQuality`）。
モバイルでは草の本数・テクスチャ解像度・シャドウマップ・解像度を落とし、
それでもフレームが重い場合は描画解像度を静かに下げます。
