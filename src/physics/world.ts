import RAPIER from '@dimforge/rapier3d-compat';
import {
  APPROACH_LENGTH,
  BALL_MASS,
  BALL_RADIUS,
  GUTTER_DEPTH,
  GUTTER_WIDTH,
  LANE_LENGTH,
  LANE_WIDTH,
  PIN_MASS,
  pinPositions,
} from '../util/units';
import { FIXED_DT } from '../core/engine';
import { frictionAt } from './oilPattern';
import { pinMassProperties, pinRadiusAt } from '../scene/pinProfile';
import { LANE_FULL_LENGTH } from '../textures/laneWood';

export interface ThrowParams {
  /** 投球位置 x (m, レーン中央0) */
  x: number;
  /** 初速 (m/s) */
  speed: number;
  /** 水平角（度）。正で左（-x）へ */
  angleDeg: number;
  /** 回転量 (rad/s) */
  revRate: number;
  /** 回転軸の向き（度）。0=純前転、90=フルサイドロール（フック最大） */
  axisDeg: number;
}

export interface PinPose {
  standing: boolean;
  enabled: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

const IN = 0.0254;
let rapierReady: Promise<void> | null = null;

/**
 * ボウリングの剛体シミュレーション。描画から独立（Nodeでもそのまま動く）。
 * フックは「オイルマップ由来の接触摩擦 × 回転軸のずれ」から創発させる:
 * 毎ステップ、ボール位置のμをコライダーに書き込み、あとはソルバーに任せる。
 */
export class PhysicsWorld {
  private world: RAPIER.World;
  private ballBody: RAPIER.RigidBody;
  private ballCollider: RAPIER.Collider;
  private pinBodies: RAPIER.RigidBody[];
  /** 論理時間（ステップ数） */
  steps = 0;

  private constructor(world: RAPIER.World, ball: RAPIER.RigidBody, ballCol: RAPIER.Collider, pins: RAPIER.RigidBody[]) {
    this.world = world;
    this.ballBody = ball;
    this.ballCollider = ballCol;
    this.pinBodies = pins;
  }

  static async create(): Promise<PhysicsWorld> {
    rapierReady ??= RAPIER.init() as Promise<void>;
    await rapierReady;
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = FIXED_DT;

    const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const addBox = (
      hx: number,
      hy: number,
      hz: number,
      x: number,
      y: number,
      z: number,
      friction: number,
      restitution: number,
      rotZ = 0,
    ): void => {
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setFriction(friction)
        .setRestitution(restitution);
      if (rotZ !== 0) {
        const half = rotZ / 2;
        desc.setRotation({ w: Math.cos(half), x: 0, y: 0, z: Math.sin(half) });
      }
      world.createCollider(desc, fixed);
    };

    // レーン面（ファウルライン→デッキ後端）: 上面 y=0
    addBox(LANE_WIDTH / 2, 0.05, LANE_FULL_LENGTH / 2, 0, -0.05, LANE_FULL_LENGTH / 2, 0.32, 0.03);
    // アプローチ
    addBox(1.5, 0.05, APPROACH_LENGTH / 2, 0, -0.05, -APPROACH_LENGTH / 2, 0.32, 0.0);
    // ガター: V字2枚で近似（ボールが中央に収まる）
    const gutterCx = LANE_WIDTH / 2 + GUTTER_WIDTH / 2;
    const tilt = 0.5;
    const gLen = LANE_FULL_LENGTH + 0.4;
    for (const side of [-1, 1]) {
      for (const half of [-1, 1]) {
        addBox(
          GUTTER_WIDTH / 2.6,
          0.008,
          gLen / 2,
          side * gutterCx + half * GUTTER_WIDTH * 0.19,
          -GUTTER_DEPTH - 0.004,
          gLen / 2,
          0.25,
          0.1,
          -half * tilt,
        );
      }
      // ガター外壁（キャッピング側面）
      addBox(0.015, 0.08, gLen / 2, side * (gutterCx + GUTTER_WIDTH / 2 + 0.015), -0.02, gLen / 2, 0.2, 0.3);
    }
    // キックバック（デッキ側壁。フェノール板は跳ねる）
    const kickStart = LANE_LENGTH - 0.72;
    const kickLen = LANE_FULL_LENGTH - kickStart + 0.45;
    for (const side of [-1, 1]) {
      addBox(0.0225, 0.25, kickLen / 2, side * (LANE_WIDTH / 2 + 0.0225), 0.25 - GUTTER_DEPTH, kickStart + kickLen / 2, 0.2, 0.42);
    }
    // ピット: 落下床と後壁・天井（スイープ位置）
    addBox(1.5, 0.05, 0.45, 0, -0.3, LANE_FULL_LENGTH + 0.45, 0.6, 0.0);
    addBox(1.5, 0.5, 0.05, 0, 0.2, LANE_FULL_LENGTH + 0.85, 0.6, 0.05);

    // ボール
    const ballBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, BALL_RADIUS, -3.2)
        .setCcdEnabled(true)
        .setLinearDamping(0.025)
        .setAngularDamping(0.03),
    );
    // 摩擦はMin結合: ペアμ=ボール側μとなり、オイルマップの値がそのまま効く
    const ballCollider = world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setMass(BALL_MASS)
        .setFriction(0.05)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0.05),
      ballBody,
    );
    ballBody.setEnabled(false);

    // ピン: プロファイル由来の複合コライダー＋実測質量特性
    const mp = pinMassProperties(PIN_MASS);
    const pins: RAPIER.RigidBody[] = [];
    for (const p of pinPositions()) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, 0, p.z)
          .setCcdEnabled(true)
          .setLinearDamping(0.03)
          .setAngularDamping(0.08)
          .setAdditionalMassProperties(
            PIN_MASS,
            { x: 0, y: mp.comY, z: 0 },
            { x: mp.inertia[0], y: mp.inertia[1], z: mp.inertia[2] },
            { w: 1, x: 0, y: 0, z: 0 },
          ),
      );
      const addPart = (desc: RAPIER.ColliderDesc, y: number): void => {
        world.createCollider(
          desc.setTranslation(0, y, 0).setDensity(0).setFriction(0.32).setRestitution(0.3),
          body,
        );
      };
      // 底の平坦面（直立安定性）
      addPart(RAPIER.ColliderDesc.cylinder(0.35 * IN, pinRadiusAt(0.15 * IN) * 0.97), 0.35 * IN);
      // 腹（3球で凸包近似）
      for (const hIn of [2.4, 4.5, 6.3]) {
        addPart(RAPIER.ColliderDesc.ball(pinRadiusAt(hIn * IN) * 0.97), hIn * IN);
      }
      // ネック
      addPart(RAPIER.ColliderDesc.cylinder(1.5 * IN, pinRadiusAt(10 * IN) * 0.95), 10 * IN);
      // ヘッド
      addPart(RAPIER.ColliderDesc.ball(pinRadiusAt(13.5 * IN) * 0.95), 13.5 * IN);
      pins.push(body);
    }

    return new PhysicsWorld(world, ballBody, ballCollider, pins);
  }

  /** 1固定ステップ進める。ボール接地点のμをオイルマップから反映 */
  step(): void {
    const t = this.ballBody.translation();
    this.ballCollider.setFriction(frictionAt(t.x, t.z));
    this.world.step();
    this.steps++;
    // 場外へ飛び出したピンはデッドウッド扱いで無効化（無限落下を防ぐ）
    for (const b of this.pinBodies) {
      if (b.isEnabled() && b.translation().y < -0.6) b.setEnabled(false);
    }
  }

  throwBall(p: ThrowParams): void {
    const rad = (p.angleDeg * Math.PI) / 180;
    const axis = (p.axisDeg * Math.PI) / 180;
    this.ballBody.setEnabled(true);
    this.ballBody.setTranslation({ x: p.x, y: BALL_RADIUS + 0.002, z: 0.02 }, true);
    // angleDeg 正 = ボウラーの左（+x）へ。axisDeg 正 = 左（+x）へ曲がるフック
    this.ballBody.setLinvel(
      { x: Math.sin(rad) * p.speed, y: 0, z: Math.cos(rad) * p.speed },
      true,
    );
    // 前転成分 +x / サイドロール成分 -z（ω_z<0 → 接地点スリップ-x → 摩擦+x → 左へフック）
    this.ballBody.setAngvel(
      { x: Math.cos(axis) * p.revRate, y: 0, z: -Math.sin(axis) * p.revRate },
      true,
    );
  }

  /** ボールを構え位置へ戻し物理を無効化（構え中は演出側が動かす） */
  stageBall(): void {
    this.ballBody.setEnabled(false);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, false);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, false);
    this.ballBody.setTranslation({ x: 0, y: BALL_RADIUS, z: -3.2 }, false);
  }

  ballPose(): { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number }; enabled: boolean } {
    return {
      position: this.ballBody.translation(),
      rotation: this.ballBody.rotation(),
      enabled: this.ballBody.isEnabled(),
    };
  }

  ballSpeed(): number {
    const v = this.ballBody.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** 直立判定: 傾き25°未満・デッキ上に残っている */
  private isStanding(body: RAPIER.RigidBody): boolean {
    if (!body.isEnabled()) return false;
    const q = body.rotation();
    // ローカル+Yの世界成分（クォータニオン回転の3列目...2列目）
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    const t = body.translation();
    return (
      upY > Math.cos((25 * Math.PI) / 180) &&
      t.y < 0.06 &&
      t.y > -0.03 &&
      Math.abs(t.x) < LANE_WIDTH / 2 + 0.02 &&
      t.z > LANE_LENGTH - 0.6 &&
      t.z < LANE_FULL_LENGTH + 0.1
    );
  }

  pinPoses(): PinPose[] {
    return this.pinBodies.map((b) => ({
      standing: this.isStanding(b),
      enabled: b.isEnabled(),
      position: b.translation(),
      rotation: b.rotation(),
    }));
  }

  standingCount(): number {
    return this.pinBodies.reduce((n, b) => n + (this.isStanding(b) ? 1 : 0), 0);
  }

  /**
   * ピンを再ラック。standing[i]=true のピンをスポットへ直立させ、
   * それ以外は無効化（デッドウッド撤去）。全て true で新フレーム。
   */
  rackPins(standing?: boolean[]): void {
    const spots = pinPositions();
    this.pinBodies.forEach((b, i) => {
      const keep = standing ? (standing[i] ?? false) : true;
      if (keep) {
        b.setEnabled(true);
        b.setTranslation({ x: spots[i]!.x, y: 0.001, z: spots[i]!.z }, false);
        b.setRotation({ w: 1, x: 0, y: 0, z: 0 }, false);
        b.setLinvel({ x: 0, y: 0, z: 0 }, false);
        b.setAngvel({ x: 0, y: 0, z: 0 }, false);
      } else {
        b.setEnabled(false);
      }
    });
  }

  /** デッドウッドのみ撤去。立っているピンは現位置に残す（実機のピンセッター同様） */
  clearDeadwood(standing: boolean[]): void {
    this.pinBodies.forEach((b, i) => {
      if (!standing[i]) b.setEnabled(false);
    });
  }

  /** 転倒・跳ね回りが収まったか（投球後の判定タイミング用） */
  isSettled(): boolean {
    const bt = this.ballBody.translation();
    const ballDone =
      !this.ballBody.isEnabled() ||
      bt.z > LANE_FULL_LENGTH + 0.2 ||
      bt.y < -0.12 ||
      this.ballSpeed() < 0.08;
    if (!ballDone) return false;
    for (const b of this.pinBodies) {
      if (!b.isEnabled()) continue;
      const v = b.linvel();
      const w = b.angvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const spin = Math.hypot(w.x, w.y, w.z);
      const t2 = b.translation();
      const onDeck = t2.z > LANE_LENGTH - 0.7 && t2.y > -0.02;
      // デッキ上のピンは静止を要求。場外（ガター/ピット）はゆっくりなら無視
      if (onDeck ? speed > 0.12 || spin > 1.0 : speed > 0.6) return false;
    }
    return true;
  }
}
