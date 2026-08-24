# 見えない目の調律室――入る人だけ見つけよう

4歳から遊べる、写実的な3DモバイルWebゲーム。
安全な自動ドア試験施設で、接近センサーと戸口保護センサーを調律する。

子どもが空間と動きから発見する三つの規則:

1. 人が通る道と、ドアが見ている場所が重なると開く
2. 前を横切るだけなら開かなくてよい
3. 戸口に人や物が残っていたら閉じない

センサー領域は最初は見えない。誤作動を一度経験した後だけ、
点検レンズから診断モードで可視化できる。調整後は再び隠し、
見えない状態でも結果を予測できるかを試す。

## 技術

- Vite + TypeScript + Three.js(WebGL 2)
- 実在方式(BEA IXIO-DT1系: マイクロ波レーダー+赤外線カーテン)を基礎に
  したセンサーモデル → `docs/sensor-calibration-reference.md`
- 診断表示と開閉判定は同一の `SensorField` データを共有
- 扉は 7状態の状態機械(CLOSED/OPENING/OPEN/HOLDING/CLOSING/OBSTRUCTION/REVERSING)

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run typecheck  # 型検査
npm test           # 判定ロジックの単体テスト(vitest)
npm run build      # 型検査 + production build
npm run test:e2e   # Chromium スモークE2E(要ビルド。プレビューは自動起動)
node scripts/screenshots.mjs  # 4画面サイズのスクリーンショット(要プレビュー起動)
```

URLパラメータ:

- `?fast=1` — 低品質固定(E2E_FAST 相当)
- `?e2e=1` — 決定的モード。シミュレーションは `window.__game.step(秒)` でのみ進む

## 操作(タッチのみ)

- 点検レンズの開閉: 一方向スワイプ
- 角度リング: 画面上の円運動(奥行き調整)
- 幅スライダー: 物理風スライダー
- 経路: 床へ太い一筆描き → 対象を発車位置へドラッグ
- 予想: 開いた/閉じた扉の小さな模型を台に置く
- 発車: レバーを下へ倒す

自由カメラ・ピンチズーム・二指回転は使わない。
