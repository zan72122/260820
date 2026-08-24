import { PathPlanner } from './PathPlanner';
import { ActorSnapshot, Vec2 } from './types';

export type ActorKind = 'deliveryRobot' | 'wheelchairRig' | 'lowCart' | 'foamBody';

export type ActorBehavior =
  | { type: 'pass' }
  /** 弧長 stopAt で stopFor 秒停止してから先へ進む。stopAt<0 なら戸口で自動決定 */
  | { type: 'stopThenGo'; stopAt: number; stopFor: number }
  /** 弧長 stopAt で stopFor 秒停止してから来た道を戻る。stopAt<0 なら戸口で自動決定 */
  | { type: 'stopThenRetreat'; stopAt: number; stopFor: number };

export interface ActorProfile {
  kind: ActorKind;
  speed: number; // [m/s]
  radius: number; // 床投影の半径 [m]
  height: number; // [m]
  behavior: ActorBehavior;
}

export const ACTOR_PROFILES: Record<ActorKind, Omit<ActorProfile, 'behavior'>> = {
  deliveryRobot: { kind: 'deliveryRobot', speed: 0.9, radius: 0.3, height: 1.1 },
  wheelchairRig: { kind: 'wheelchairRig', speed: 0.45, radius: 0.36, height: 0.95 },
  lowCart: { kind: 'lowCart', speed: 0.75, radius: 0.28, height: 0.38 },
  foamBody: { kind: 'foamBody', speed: 0.6, radius: 0.26, height: 1.68 },
};

/**
 * 試験対象(配送ロボット等)。描かれた経路を運動学的に走行する。
 * 乱数は使わず、同じ経路と同じプロファイルなら毎回同じ軌跡になる。
 */
export class TrafficActor {
  readonly id: string;
  profile: ActorProfile;
  path: Vec2[] = [];
  private s = 0; // 弧長位置
  private direction = 1; // 1=前進, -1=後退
  private stopTimer = 0;
  private stopped = false;
  private stopDone = false;
  pos: Vec2 = { x: 0, z: 0 };
  vel: Vec2 = { x: 0, z: 0 };
  heading: Vec2 = { x: 0, z: 1 };
  finished = false;
  started = false;
  /** 走行距離(車輪回転の描画用) */
  odometer = 0;
  /** stopAt<0 のとき、経路が戸口(原点)へ最初に近づく弧長 */
  private autoStopAt = 0;

  constructor(id: string, profile: ActorProfile) {
    this.id = id;
    this.profile = profile;
  }

  setPath(path: Vec2[]): void {
    this.path = path;
    this.s = 0;
    this.direction = 1;
    this.stopped = false;
    this.stopDone = false;
    this.finished = false;
    this.started = false;
    this.odometer = 0;
    const { pos, dir } = PathPlanner.sample(path, 0);
    this.pos = pos;
    this.heading = dir;
    this.vel = { x: 0, z: 0 };

    // 戸口停止位置の自動決定(描かれた経路が扉中央 0.5m 圏へ入る最初の地点)
    const b = this.profile.behavior;
    if ((b.type === 'stopThenGo' || b.type === 'stopThenRetreat') && b.stopAt < 0) {
      let s = 0;
      let found = -1;
      for (let i = 0; i < path.length; i++) {
        if (i > 0) {
          s += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
        }
        if (found < 0 && Math.hypot(path[i].x, path[i].z) < 0.5) found = s;
      }
      this.autoStopAt = found >= 0 ? found : PathPlanner.length(path) * 0.8;
    }
  }

  private effectiveStopAt(b: { stopAt: number }): number {
    return b.stopAt >= 0 ? b.stopAt : this.autoStopAt;
  }

  start(): void {
    if (this.path.length >= 2) this.started = true;
  }

  update(dt: number): void {
    if (!this.started || this.finished || this.path.length < 2) {
      this.vel = { x: 0, z: 0 };
      return;
    }
    const b = this.profile.behavior;
    const total = PathPlanner.length(this.path);

    if (this.stopped) {
      this.stopTimer -= dt;
      this.vel = { x: 0, z: 0 };
      if (this.stopTimer <= 0) {
        this.stopped = false;
        this.stopDone = true;
        if (b.type === 'stopThenRetreat') this.direction = -1;
      }
      return;
    }

    if (!this.stopDone && (b.type === 'stopThenGo' || b.type === 'stopThenRetreat')) {
      if (this.direction === 1 && this.s >= this.effectiveStopAt(b)) {
        this.stopped = true;
        this.stopTimer = b.stopFor;
        this.vel = { x: 0, z: 0 };
        return;
      }
    }

    const prev = this.pos;
    this.s += this.profile.speed * dt * this.direction;
    this.odometer += this.profile.speed * dt;

    if (this.direction === 1 && this.s >= total) {
      this.s = total;
      this.finished = true;
    } else if (this.direction === -1 && this.s <= 0) {
      this.s = 0;
      this.finished = true;
    }

    const { pos, dir } = PathPlanner.sample(this.path, this.s);
    this.pos = pos;
    this.heading = this.direction === 1 ? dir : { x: -dir.x, z: -dir.z };
    if (dt > 0) {
      this.vel = { x: (pos.x - prev.x) / dt, z: (pos.z - prev.z) / dt };
    }
  }

  snapshot(): ActorSnapshot {
    return {
      id: this.id,
      pos: this.pos,
      vel: this.vel,
      radius: this.profile.radius,
      height: this.profile.height,
    };
  }
}
