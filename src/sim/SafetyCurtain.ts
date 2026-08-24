import { ActorSnapshot, FieldCell, Vec2 } from './types';

/**
 * 戸口保護のアクティブ赤外線カーテン。
 *
 * 実機(BEA IXIO-DT1系)では、扉面に沿って2列×多数の赤外スポットが
 * 敷居を覆う。ここでは床面へ並ぶ有限個の検知セルとしてモデル化し、
 * 対象の bounding volume(床投影円+高さ)との重なりで在/不在を決める。
 *
 * 赤外光は不可視。診断モードでだけセルとして描画され、
 * 通常運転時には何も描かない。
 */
export interface CurtainParams {
  /** 扉中央(床投影) */
  center: Vec2;
  /** 敷居の全幅(有効開口幅) [m] */
  width: number;
  /** スポット列の z 位置(扉線からのオフセット) [m] */
  rowOffsets: number[];
  /** 1列あたりのスポット数 */
  spotsPerRow: number;
  /** カーテンが感知できる最小の対象高さ [m] */
  minHeight: number;
}

export class SafetyCurtain {
  params: CurtainParams;
  cells: FieldCell[] = [];
  /** いま敷居に何かが居るか */
  occupied = false;
  blockedIds: string[] = [];

  constructor(params: CurtainParams) {
    this.params = params;
    this.rebuildCells();
  }

  rebuildCells(): void {
    this.cells = [];
    const p = this.params;
    const pitch = p.width / p.spotsPerRow;
    for (const dz of p.rowOffsets) {
      for (let i = 0; i < p.spotsPerRow; i++) {
        this.cells.push({
          x: p.center.x - p.width / 2 + pitch * (i + 0.5),
          z: p.center.z + dz,
          size: pitch * 0.82,
          hot: 0,
        });
      }
    }
  }

  update(dt: number, actors: ActorSnapshot[]): void {
    this.blockedIds = [];
    let any = false;
    for (const c of this.cells) {
      let hit = false;
      for (const a of actors) {
        if (a.height < this.params.minHeight) continue;
        const dd = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
        if (dd <= a.radius + c.size * 0.5) {
          hit = true;
          if (!this.blockedIds.includes(a.id)) this.blockedIds.push(a.id);
        }
      }
      if (hit) {
        c.hot = 1;
        any = true;
      } else {
        c.hot = Math.max(0, c.hot - dt * 3);
      }
    }
    this.occupied = any;
  }

  reset(): void {
    this.occupied = false;
    this.blockedIds = [];
    for (const c of this.cells) c.hot = 0;
  }
}
