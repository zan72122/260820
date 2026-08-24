export interface Vec2 {
  x: number;
  z: number;
}

export function v2(x: number, z: number): Vec2 {
  return { x, z };
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/** 床上の検知セル。診断表示と判定の両方がこの同一データを参照する。 */
export interface FieldCell {
  x: number;
  z: number;
  size: number;
  /** 直近の検知でこのセルが対象を捉えたか(診断表示のハイライト用) */
  hot: number; // 0..1 decaying
}

/** センサーが観測する移動体のスナップショット */
export interface ActorSnapshot {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  height: number;
}
