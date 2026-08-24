/**
 * 船体の低周波揺れ。魚の短いbite impulseとは完全に独立した信号として扱い、
 * カメラ・穂先・糸・吊り物すべてがこの一つの信号を参照する。
 */
export class BoatSway {
  time = 0;
  /** 揺れの強さ（ラウンド条件で変化する） */
  amplitude = 1;

  heave = 0; // 上下 (m)
  rollX = 0; // 左右傾き (rad)
  rollZ = 0; // 前後傾き (rad)

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    const a = this.amplitude;
    // 二つの非整合な長周期を混ぜて、機械的なループ感を消す
    this.heave = a * (0.008 * Math.sin(t * 0.42) + 0.004 * Math.sin(t * 0.83 + 1.7));
    this.rollX = a * (0.006 * Math.sin(t * 0.31 + 0.6) + 0.003 * Math.sin(t * 0.57 + 2.9));
    this.rollZ = a * (0.005 * Math.sin(t * 0.37 + 1.2) + 0.0025 * Math.sin(t * 0.71));
  }
}
