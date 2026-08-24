import { ActorSnapshot, FieldCell, Vec2 } from './types';

/**
 * 接近検知(K帯マイクロ波ドップラー)の作動領域。
 *
 * 実機(BEA IXIO-DT1系)に倣い、床上の台形領域として表す。
 * - アンテナの俯角(角度リング)で領域の奥行きが変わる
 * - 幅設定(スライダー)で左右幅が変わる
 * - ドップラー方式なので「センサーへ近づく速度成分」があるものだけに反応する
 *   (一方向検知: 遠ざかる対象は無視)
 *
 * 診断表示と開扉判定は、この同じインスタンスのセル/形状データを使う。
 */
export interface ActivationParams {
  /** センサー取付位置(床投影)。扉中央の上、通路側にわずかに張り出す */
  origin: Vec2;
  /** アンテナ俯角に対応する奥行き [m]。リングで調整する値 */
  depth: number;
  /** 領域の最遠端での全幅 [m]。スライダーで調整する値 */
  farWidth: number;
  /** 扉際での全幅 [m] */
  nearWidth: number;
  /** 検知に必要な接近速度成分 [m/s]。ドップラーの感度に相当 */
  minApproachSpeed: number;
  /** 誤検知抑制のための滞在時間 [s] */
  dwellTime: number;
}

export const CELL_SIZE = 0.28;

export class ActivationField {
  params: ActivationParams;
  cells: FieldCell[] = [];
  /** actor id -> 滞在累計 */
  private dwell = new Map<string, number>();
  /** 直近判定で作動中か */
  triggered = false;
  /** 直近に検知した対象のid */
  detectedIds: string[] = [];

  constructor(params: ActivationParams) {
    this.params = params;
    this.rebuildCells();
  }

  setDepth(depth: number): void {
    this.params.depth = Math.min(4.2, Math.max(0.9, depth));
    this.rebuildCells();
  }

  setFarWidth(w: number): void {
    this.params.farWidth = Math.min(5.2, Math.max(1.2, w));
    this.rebuildCells();
  }

  /** 領域の形状パラメータからセル群を再生成する。判定も同じ形状関数を使う。 */
  rebuildCells(): void {
    const kept = new Map<string, number>();
    for (const c of this.cells) {
      if (c.hot > 0) kept.set(`${c.x.toFixed(2)}|${c.z.toFixed(2)}`, c.hot);
    }
    this.cells = [];
    const p = this.params;
    const zMax = p.origin.z + p.depth;
    for (let z = p.origin.z + CELL_SIZE * 0.5; z < zMax; z += CELL_SIZE) {
      const halfW = this.halfWidthAt(z);
      for (let x = -halfW + CELL_SIZE * 0.5; x < halfW; x += CELL_SIZE) {
        const cx = p.origin.x + x;
        this.cells.push({
          x: cx,
          z,
          size: CELL_SIZE,
          hot: kept.get(`${cx.toFixed(2)}|${z.toFixed(2)}`) ?? 0,
        });
      }
    }
  }

  /** 台形形状: 扉際 nearWidth → 最遠端 farWidth へ線形に広がる */
  private halfWidthAt(z: number): number {
    const p = this.params;
    const t = Math.min(1, Math.max(0, (z - p.origin.z) / p.depth));
    return (p.nearWidth + (p.farWidth - p.nearWidth) * t) * 0.5;
  }

  containsPoint(pt: Vec2): boolean {
    const p = this.params;
    if (pt.z < p.origin.z || pt.z > p.origin.z + p.depth) return false;
    return Math.abs(pt.x - p.origin.x) <= this.halfWidthAt(pt.z);
  }

  /** 領域外縁の折れ線(床描画用)。セルと同じパラメータから生成する。 */
  outline(): Vec2[] {
    const p = this.params;
    const z0 = p.origin.z;
    const z1 = p.origin.z + p.depth;
    const n0 = p.nearWidth * 0.5;
    const n1 = p.farWidth * 0.5;
    return [
      { x: p.origin.x - n0, z: z0 },
      { x: p.origin.x - n1, z: z1 },
      { x: p.origin.x + n1, z: z1 },
      { x: p.origin.x + n0, z: z0 },
    ];
  }

  /**
   * 1ステップ分の判定。
   * ドップラー: 領域内 かつ センサーへ近づく速度成分が閾値以上 の対象が
   * dwellTime 以上滞在すると作動する。
   */
  update(dt: number, actors: ActorSnapshot[]): void {
    const p = this.params;
    this.detectedIds = [];
    const seen = new Set<string>();
    for (const a of actors) {
      if (!this.containsPoint(a.pos)) continue;
      // センサー原点方向への接近速度成分(床面投影)
      const dx = p.origin.x - a.pos.x;
      const dz = p.origin.z - a.pos.z;
      const d = Math.hypot(dx, dz) || 1e-6;
      const approach = (a.vel.x * dx + a.vel.z * dz) / d;
      if (approach < p.minApproachSpeed) continue;
      seen.add(a.id);
      const t = (this.dwell.get(a.id) ?? 0) + dt;
      this.dwell.set(a.id, t);
      if (t >= p.dwellTime) {
        this.detectedIds.push(a.id);
        // 診断表示: 対象を捉えたセルを一瞬明るくする
        for (const c of this.cells) {
          const dd = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
          if (dd < a.radius + c.size) c.hot = 1;
        }
      }
    }
    for (const id of [...this.dwell.keys()]) {
      if (!seen.has(id)) this.dwell.delete(id);
    }
    for (const c of this.cells) c.hot = Math.max(0, c.hot - dt * 2.2);
    this.triggered = this.detectedIds.length > 0;
  }

  reset(): void {
    this.dwell.clear();
    this.triggered = false;
    this.detectedIds = [];
    for (const c of this.cells) c.hot = 0;
  }
}
