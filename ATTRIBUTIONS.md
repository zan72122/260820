# Attributions

## 外部素材

**このプロジェクトは外部素材を一切使用していません。**

テクスチャ、ジオメトリ、効果音のすべてが実行時にコードで生成されます。
そのため再配布が必要なアセットはありません。

| 種類 | 生成場所 |
| --- | --- |
| ゲルコートのノーマル、FRP のラフネス、ステンレスの加工目、ローレット、EPDM のシボ、ラフト生地、コンクリート、caustics、泡筋、雲、空のグラデーション、試験パネルの成形レリーフと透過マップ | `src/materials/Textures.ts`（Canvas 2D + value noise / Voronoi） |
| 試験筒シェル、開口部、カットエッジ、サドルネック、フランジ、シール、コラー、クランプ、試験パネル、ラフト、架台、弁、工場遠景 | `src/world/*.ts`（すべて手続き mesh） |
| 着座音「コトン」、リングのディテント、ラッチ、弁、水音、環境音、リビール音 | `src/core/Audio.ts`（Web Audio API のみ。音声ファイルなし） |

## 依存ライブラリ

| ライブラリ | ライセンス | 用途 |
| --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) | MIT | WebGL レンダリング |
| [Vite](https://github.com/vitejs/vite) | MIT | 開発サーバー / バンドル |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | 型検査 |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | 自動プレイスルー（開発時のみ） |

これらは `npm install` で取得され、`dist/` には three.js のみがバンドルされます。

## 設計上の注記

PBR テクスチャの配信形式として KTX2/Basis を採用する選択肢もありましたが、
本作は全テクスチャを実行時生成しているため、転送すべき画像がそもそも存在しません。
結果として KTX2 を使う場合よりペイロードが小さく、デコード用の
トランスコーダも不要です。将来スキャン由来のテクスチャを導入する場合は
KTX2/Basis へ切り替えてください。
