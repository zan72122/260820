import { Vec2, dist2 } from './types';

/**
 * 子どもが床へ一筆で描いた経路を、走行可能な折れ線へ整える。
 * - 近すぎる点を間引き
 * - Chaikin 平滑化
 * - 等間隔リサンプリング
 */
export class PathPlanner {
  static readonly MIN_POINT_GAP = 0.12;
  static readonly SAMPLE_STEP = 0.1;

  static clean(raw: Vec2[]): Vec2[] {
    const pts: Vec2[] = [];
    for (const p of raw) {
      if (pts.length === 0 || dist2(pts[pts.length - 1], p) >= this.MIN_POINT_GAP) {
        pts.push({ x: p.x, z: p.z });
      }
    }
    return pts;
  }

  static smooth(pts: Vec2[], iterations = 2): Vec2[] {
    let cur = pts;
    for (let it = 0; it < iterations; it++) {
      if (cur.length < 3) break;
      const out: Vec2[] = [cur[0]];
      for (let i = 0; i < cur.length - 1; i++) {
        const a = cur[i];
        const b = cur[i + 1];
        out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
      }
      out.push(cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  }

  static resample(pts: Vec2[], step = this.SAMPLE_STEP): Vec2[] {
    if (pts.length < 2) return pts.slice();
    const out: Vec2[] = [pts[0]];
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg = dist2(a, b);
      if (seg <= 1e-9) continue;
      let t = step - carry;
      while (t <= seg) {
        out.push({
          x: a.x + ((b.x - a.x) * t) / seg,
          z: a.z + ((b.z - a.z) * t) / seg,
        });
        t += step;
      }
      carry = seg - (t - step);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  static build(raw: Vec2[]): Vec2[] {
    return this.resample(this.smooth(this.clean(raw)));
  }

  static length(pts: Vec2[]): number {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += dist2(pts[i - 1], pts[i]);
    return len;
  }

  /** 弧長 s [m] 地点の位置と接線方向を返す */
  static sample(pts: Vec2[], s: number): { pos: Vec2; dir: Vec2 } {
    if (pts.length === 0) return { pos: { x: 0, z: 0 }, dir: { x: 0, z: 1 } };
    if (pts.length === 1) return { pos: { ...pts[0] }, dir: { x: 0, z: 1 } };
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = dist2(pts[i - 1], pts[i]);
      if (acc + seg >= s && seg > 1e-9) {
        const t = (s - acc) / seg;
        const a = pts[i - 1];
        const b = pts[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz) || 1;
        return {
          pos: { x: a.x + dx * t, z: a.z + dz * t },
          dir: { x: dx / d, z: dz / d },
        };
      }
      acc += seg;
    }
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const d = Math.max(1e-9, dist2(a, b));
    return {
      pos: { ...b },
      dir: { x: (b.x - a.x) / d, z: (b.z - a.z) / d },
    };
  }
}
