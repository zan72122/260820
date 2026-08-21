# ウォーターブラスト ― ボートを坂の上へ！

4歳の子ども（iPhone / iPad のブラウザ）向けの、因果を一つだけ発見させる 3D ゲームです。

舞台は開園前のウォーターコースター試験区間。子どもは白いラフトを前へスワイプして
送り出しますが、ラフトは谷底の待機くぼみへ戻って止まります。
坂の床に並んだ噴射ノズルと、その脇の噴射レバーだけが手がかりです。

レバーを押し続けると、ポンプが立ち上がり、ノズルへ水が満ち、手前から奥へ噴射が始まり、
太い水塊がラフトの後部を押し、ラフトは上り坂を上ってゆきます。
指を離せば減速し、もう一度押せばまた進みます。失敗も罰もありません。

規則が分かったあとは、**一度に一つだけ**条件を変えながら遊びます。

| 走行 | 変えるもの | 見た目に出るもの |
| --- | --- | --- |
| 1 走目 | ―（最初の謎） | 試験用重り袋が 1 個 |
| 2 走目 | 重さ（軽い） | 袋なし。短い噴射でも勢いよく上る |
| 3 走目 | 重さ（重い） | 袋 2 個。沈み込み、動き出しが遅い。長く押す必要がある |
| 4 走目 | コース（同じ重さ） | 噴射区間が 2 つ。どこで押し始めるかを読む |

数値・速度計・重量表示は一切ありません。重さは袋の数・沈み方・ゴムの変形・動き出しで、
水圧はレバーの押し込み・ノズルの白さ・噴流の太さ・ポンプ音・色帯メーターで示します。

## 操作

* ラフトを前へスワイプ ― 試走開始
* 噴射レバーを押し続ける ― 画面端に据え付けられた実物のレバー（指がノズルとラフトを隠しません）
* 重り袋を荷台へドラッグ ― 台の上の袋を掴んで、荷台の近くまで持っていけば自動で吸着します
  （荷台に載っている袋は動かせません。ラフトに触れた指は必ず「送り出す」意味になります）

数秒操作がないと、ノズル内の水が一度だけ脈動し、レバーが水圧でわずかに震え、
ラフトがくぼみで小さく揺れます。点滅する矢印は出しません。

## 動かす

```bash
npm install
npm run dev        # 開発サーバ
npm run typecheck  # 型検査
npm run build      # 型検査 + production build
npm run preview    # ビルド結果の確認
npm run smoke      # Chromium で 4 走分を実際に操作する煙試験
```

`?fast=1` を付けて開くと、低負荷プロファイル（DPR 1、影・粒子・追加水面なし、
決定論的シード）で動きます。CI やソフトウェア GL 環境用で、
この状態で描画品質や fps を評価してはいけません。

## 構成

```
src/core/        Simulation（固定ステップ物理）、StateMachine、Game（配線）、
                 AdaptiveQuality、Config（全チューニング値）、Rng
src/course/      CourseSpline / CourseGeometry / BlastZone / NozzleBank
src/raft/        RaftDynamics（1次元運動）/ RaftView（morph 変形）/ BallastPreset
src/water/       WaterSurfaceRenderer / JetRenderer / FoamField / SplashEffect / TrailReview
src/world/       Environment（空・太陽・環境光）/ Structure（架構・通路・ポンプ室）/
                 Scenery（遠景・遅延ロード）/ Textures（手続き生成の材質）
src/camera/      CameraRail（8 つの固定フレーミング、自由カメラなし）
src/audio/       PumpAudioController（全て WebAudio による合成音）
src/ui/          BlastLever / InputController / ChildGuidanceState / ReplayController
```

ゲームの状態は明示的な state machine です。

`BOOT → OBSERVE_VALLEY → RELEASE_TEST_RAFT → RAFT_COASTS → RAFT_RESTS_BEFORE_HILL →
DISCOVER_NOZZLES → PRESS_BLAST_CONTROL → JETS_FILL → RAFT_ACCELERATES → CREST →
SPLASH_FINISH → CHANGE_ONE_VARIABLE → REPLAY`

噴射側の遷移は何度でも再入できます。上り切れなければ待機くぼみへ戻るだけで、
ゲームオーバーになる終端状態はありません。

## 物理

剛体シミュレーションも CFD も使いません。滑走中心線上の 1 次元距離 `s` と速度 `v` だけを、
1/240 秒の固定ステップで積分します。

* 勾配（`dy/ds`）による重力加速
* 水膜・空気による抗力、わずかなクーロン摩擦
* 谷底の溜まり水と、後退するラフトを捕まえる待機くぼみの減衰
* 重り袋の個数から有効質量（`F/m` が効くので重いほど長く押す必要がある）
* ノズル区間ごとの推力（供給されているノズルのみ、ラフト後方の到達範囲内で加算）

左右の揺れと上下動だけを別のばねで足しています。乱数は決定論的な種付き PRNG のみで、
同じ操作は必ず同じ結果になります。

## 端末と品質

WebGL 2 を基本とし、`AdaptiveQuality` が DPR・影・粒子数・噴流の分割数・水面の層数・
caustics を段階的に調整します。`navigator.gpu` を持つ端末では上位段から開始します。
広告・課金・ログイン・分析 SDK はありません。
