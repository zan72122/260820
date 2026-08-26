import {
  BACKSTOP_ANGLE,
  FLOW_MAX,
  REST_ANGLE,
  SPILL_ANGLE,
  type GardenState,
  type SimEvent,
  type TubeState,
} from './state';
import { clamp, damp, makeRng, smoothstep } from '../util/math';

/* ── 竹筒の剛体定数（形状から決めた値） ───────────────── */
const G = 9.81;
const TUBE_MASS = 1.15; // kg 乾いた竹の質量
const D_TAIL = 0.082; // m 支点より後方にある竹自身の重心距離
const D_WATER0 = 0.135; // m 静止時の水の重心距離（支点より前）
const D_WATER_SLIDE = 0.4; // 傾くと水が口側へ寄る＝てこが伸びる（正のフィードバック）
const INERTIA = 0.062; // kg m^2
const VISCOUS = 0.03; // 軸のねばり
const MU_PIVOT = 0.006; // 軸の静止摩擦係数
const TAIL_RADIUS = 0.31; // m 支点から打点まで
const DUMP_K = 11.0;
const REST_RESTITUTION = 0.26;
const BACKSTOP_RESTITUTION = 0.16;

const FIXED_DT = 1 / 180;
const MAX_CATCHUP = 0.25; // 復帰時の早送りを禁止する

export interface GateInput {
  grabbed: boolean;
  /** 指が示す開度 */
  target: number;
  /** 指の速度 (開度/秒) */
  velocity: number;
}

export interface SimExtras {
  gateScrape: number;
  basinFlow: number;
  channelFlow: number;
  overflow: number;
}

export class Simulation {
  readonly state: GardenState;
  readonly extras: SimExtras = { gateScrape: 0, basinFlow: 0, channelFlow: 0, overflow: 0 };
  private acc = 0;
  private rng = makeRng(0x5eed1a3);
  private dripAcc = [0, 0];
  private gulpAcc = [0, 0];
  private splashAcc = [0, 0];
  private scrapeAcc = 0;
  private dumpedSince = [false, false];
  private tipAnnounced = [false, false];
  private dumpAnnounced = [false, false];

  constructor(state: GardenState) {
    this.state = state;
  }

  /** 復帰直後に大量の dt を一度に流し込まないためのリセット */
  resetClock(): void {
    this.acc = 0;
  }

  step(dtReal: number, gate: GateInput): void {
    const dt = Math.min(dtReal, MAX_CATCHUP);
    this.acc += dt;
    let guard = 0;
    while (this.acc >= FIXED_DT && guard < 90) {
      this.acc -= FIXED_DT;
      this.tick(FIXED_DT, gate);
      guard++;
    }
    if (guard >= 90) this.acc = 0;
  }

  private emit(e: Omit<SimEvent, 'at'>): void {
    this.state.events.push({ ...e, at: this.state.time });
  }

  private tick(dt: number, gate: GateInput): void {
    const s = this.state;
    s.time += dt;

    this.updateGate(dt, gate);

    /* 流量：開度から決める。細流〜太流は連続量。 */
    const opening01 = clamp((s.gateOpening - 0.05) / 0.95, 0, 1);
    s.flowRate = Math.pow(opening01, 0.85);
    const totalFlow = s.flowRate * FLOW_MAX;
    this.extras.channelFlow = totalFlow;

    if (!s.everOpened) {
      // 開く前：水路の一滴が竹筒の方向へ行きたそうに揺れる
      s.firstDrop = 0.5 + 0.5 * Math.sin(s.time * 1.15) * Math.sin(s.time * 0.37 + 1.1);
      if (s.gateOpening > 0.045) {
        s.everOpened = true;
        s.firstDrop = 0;
        this.emit({ type: 'first-water', tube: 0, velocity: 1, wetness: 0, contact: 0 });
      }
    }

    const twoTubes = s.tubes[1].active;
    let basin = 0;
    let overflow = 0;

    for (const t of s.tubes) {
      t.presence = damp(t.presence, t.active ? 1 : 0, 0.45, dt);
      if (!t.active && t.presence < 0.01) {
        t.inflow = 0;
        t.dumpRate = 0;
        continue;
      }
      const share = twoTubes
        ? t.index === 0
          ? s.splitRatio
          : 1 - s.splitRatio
        : t.index === 0
          ? 1
          : 0;
      const aimed = totalFlow * share;
      const { toBasin, spilled } = this.tickTube(t, dt, aimed);
      basin += toBasin;
      overflow += spilled;
    }

    this.extras.basinFlow = basin;
    this.extras.overflow = overflow;
    s.splitterPresence = damp(s.splitterPresence, twoTubes ? 1 : 0, 0.5, dt);
    s.inAfterglow = s.tubes.some((t) => t.resonanceDecay > 0.12);

    // 四周期目：二本目を設置し、流量を分ける
    if (!s.tubes[1].active && s.cycleCount >= 3 && s.tubes[0].phase !== 'dumping') {
      s.tubes[1].active = true;
    }
  }

  private updateGate(dt: number, gate: GateInput): void {
    const s = this.state;
    s.gateGrabbed = gate.grabbed;
    const prevOpening = s.gateOpening;

    if (gate.grabbed) {
      const strain = gate.target - s.gateOpening;
      // 最初の20%に強い静止摩擦を持たせる
      const stiction = s.gateOpening < 0.2 ? 0.082 : 0.028;
      if (!s.gateSlipping && Math.abs(strain) > stiction) {
        s.gateSlipping = true;
        this.emit({
          type: 'gate-breakaway',
          tube: 0,
          velocity: clamp(Math.abs(strain) * 6, 0.2, 1),
          wetness: 0,
          contact: 0,
        });
      }
      if (s.gateSlipping) {
        s.gateOpening = damp(s.gateOpening, gate.target, 0.026, dt);
        if (Math.abs(gate.target - s.gateOpening) < 0.005 && Math.abs(gate.velocity) < 0.04) {
          s.gateSlipping = false;
        }
      } else {
        // 木部がたわむだけ。水門はすぐ同じ距離を動かない。
        s.gateOpening += strain * 0.55 * dt;
      }
      s.gateOpening = clamp(s.gateOpening, 0, 1);
      s.gateStrain = damp(s.gateStrain, clamp(gate.target - s.gateOpening, -0.3, 0.3), 0.05, dt);
    } else {
      s.gateSlipping = false;
      s.gateStrain = damp(s.gateStrain, 0, 0.09, dt);
    }

    const moved = Math.abs(s.gateOpening - prevOpening) / dt; // 開度/秒
    const rub = clamp(moved * 1.9, 0, 1);
    const flex = clamp(Math.abs(s.gateStrain) * 3.4, 0, 1);
    // 抵抗音は「動いていないのに力がかかっている」ときに最も強い
    const target = gate.grabbed ? clamp(rub * 0.55 + flex * 0.85, 0, 1) : rub * 0.5;
    this.extras.gateScrape = damp(this.extras.gateScrape, target, 0.035, dt);

    if (this.extras.gateScrape > 0.05) {
      this.scrapeAcc += dt * (7 + this.extras.gateScrape * 46);
      while (this.scrapeAcc >= 1) {
        this.scrapeAcc -= 1;
        this.emit({
          type: 'gate-scrape',
          tube: 0,
          velocity: this.extras.gateScrape * (0.55 + 0.45 * this.rng()),
          wetness: 0,
          contact: this.rng() * 2 - 1,
        });
      }
    }
  }

  private tickTube(t: TubeState, dt: number, aimed: number): { toBasin: number; spilled: number } {
    /* 竹筒が受け止められる割合（傾くほど水は口から外れて鉢へ落ちる） */
    const capture = smoothstep(0.3, 0.08, t.angle) * t.presence;
    let inflow = aimed * capture;
    let missed = aimed - inflow;

    const room = t.capacity - t.waterMass;
    if (inflow * dt > room) {
      missed += inflow - room / dt;
      inflow = room / dt;
    }
    t.inflow = inflow;
    t.waterMass = clamp(t.waterMass + inflow * dt, 0, t.capacity);

    /* ── 排水 ─────────────────────────────── */
    let dump = 0;
    if (t.angle > SPILL_ANGLE && t.waterMass > 0.0005) {
      dump =
        DUMP_K * Math.pow(t.waterMass, 0.8) * Math.pow(t.angle - SPILL_ANGLE, 1.05) * t.presence;
      dump = Math.min(dump, t.waterMass / dt);
      t.waterMass = Math.max(0, t.waterMass - dump * dt);
    }
    t.dumpRate = damp(t.dumpRate, dump, 0.02, dt);

    /* ── 剛体：支点まわりのモーメント ─────────── */
    /* 短い竹は寸法どおり軽く、てこも短く、早く傾く */
    const sc = t.length / 0.64;
    const mass = TUBE_MASS * sc * sc;
    const lever = (D_WATER0 + D_WATER_SLIDE * (t.angle - REST_ANGLE)) * sc;
    const c = Math.cos(t.angle);
    const load = G * (t.waterMass + mass) * c;
    t.pivotLoad = load;
    let torque = G * c * (t.waterMass * lever - mass * D_TAIL * sc);
    torque -= VISCOUS * sc * t.angularVelocity;
    torque -= MU_PIVOT * load * Math.tanh(t.angularVelocity * 45);

    t.angularVelocity += (torque / (INERTIA * sc * sc * sc)) * dt;
    t.angle += t.angularVelocity * dt;

    t.fillRatio = t.waterMass / t.capacity;
    t.cycleTimer += dt;
    t.sinceImpact += dt;

    /* ── 事象 ─────────────────────────────── */
    if (!this.tipAnnounced[t.index] && t.angularVelocity > 0.42 && t.angle > REST_ANGLE + 0.02) {
      this.tipAnnounced[t.index] = true;
      t.phase = 'tipping';
      this.emit({
        type: 'tip-start',
        tube: t.index,
        velocity: clamp(t.angularVelocity * 0.5, 0.2, 1.2),
        wetness: t.wetness,
        contact: 0,
      });
    }
    if (!this.dumpAnnounced[t.index] && dump > 0.25) {
      this.dumpAnnounced[t.index] = true;
      this.dumpedSince[t.index] = true;
      t.phase = 'dumping';
      this.emit({
        type: 'dump-start',
        tube: t.index,
        velocity: clamp(dump / 2.2, 0.25, 1.3),
        wetness: t.wetness,
        contact: 0,
      });
    }

    /* 支持材への当たり（鈍い） */
    if (t.angle > BACKSTOP_ANGLE) {
      t.angle = BACKSTOP_ANGLE;
      if (t.angularVelocity > 0.5) {
        this.emit({
          type: 'backstop',
          tube: t.index,
          velocity: clamp(t.angularVelocity * TAIL_RADIUS * sc, 0.1, 2.2),
          wetness: t.wetness,
          contact: 0,
        });
      }
      t.angularVelocity = -t.angularVelocity * BACKSTOP_RESTITUTION;
    }

    /* 石への当たり ＝「コン」 */
    if (t.angle < REST_ANGLE) {
      t.angle = REST_ANGLE;
      const v = -t.angularVelocity * TAIL_RADIUS * sc;
      if (v > 0.09) {
        const main = this.dumpedSince[t.index] && v > 0.5;
        t.impactVelocity = v;
        t.resonanceDecay = Math.max(t.resonanceDecay, clamp(v / 1.5, 0.12, 1));
        t.sinceImpact = 0;
        t.phase = 'ringing';
        this.emit({
          type: 'impact',
          tube: t.index,
          velocity: v,
          wetness: t.wetness,
          contact: this.rng() * 2 - 1,
        });
        if (main) {
          this.dumpedSince[t.index] = false;
          t.cycleCount++;
          this.state.cycleCount++;
          t.lastCycleTime = t.cycleTimer;
          t.cycleTimer = 0;
          this.tipAnnounced[t.index] = false;
          this.dumpAnnounced[t.index] = false;
          this.emit({
            type: 'cycle-complete',
            tube: t.index,
            velocity: v,
            wetness: t.wetness,
            contact: 0,
          });
        }
      }
      t.angularVelocity = -t.angularVelocity * REST_RESTITUTION;
      if (Math.abs(t.angularVelocity) < 0.22) t.angularVelocity = 0;
    }

    /* 余韻の減衰：長い竹ほどゆっくり */
    const tau = 0.75 + t.length * 1.9 + t.wetness * 0.35;
    t.resonanceDecay = Math.max(0, t.resonanceDecay - dt / tau);

    /* 含水 */
    const wetTarget = clamp(0.12 + Math.min(t.cycleCount, 8) * 0.085 + t.fillRatio * 0.3, 0, 1);
    t.wetness = damp(t.wetness, wetTarget, 1.6, dt);

    /* 位相 */
    if (t.phase !== 'ringing' || t.resonanceDecay < 0.12) {
      if (dump > 0.05) t.phase = 'dumping';
      else if (t.angularVelocity > 0.42) t.phase = 'tipping';
      else if (t.angle > REST_ANGLE + 0.012) t.phase = t.waterMass > 0.02 ? 'leaning' : 'returning';
      else if (inflow > 0.001 || t.waterMass > 0.02) t.phase = 'filling';
      else t.phase = 'still';
    }

    /* 入口の滴・内部のコポ・鉢の飛沫（決定論的な粒） */
    if (inflow > 0.004) {
      this.dripAcc[t.index] += dt * (2.4 + inflow * 26);
      while (this.dripAcc[t.index] >= 1) {
        this.dripAcc[t.index] -= 1;
        this.emit({
          type: 'inlet-drip',
          tube: t.index,
          velocity: clamp(0.25 + inflow * 1.2, 0.15, 1),
          wetness: t.wetness,
          contact: this.rng() * 2 - 1,
        });
      }
      this.gulpAcc[t.index] += dt * (0.8 + inflow * 7.5) * (0.35 + t.fillRatio);
      while (this.gulpAcc[t.index] >= 1) {
        this.gulpAcc[t.index] -= 1;
        this.emit({
          type: 'gulp',
          tube: t.index,
          velocity: clamp(0.2 + inflow * 1.1, 0.12, 0.9),
          wetness: t.fillRatio,
          contact: this.rng() * 2 - 1,
        });
      }
    }

    const toBasin = missed + dump;
    if (toBasin > 0.02) {
      this.splashAcc[t.index] += dt * (3 + toBasin * 11);
      while (this.splashAcc[t.index] >= 1) {
        this.splashAcc[t.index] -= 1;
        this.emit({
          type: 'basin-splash',
          tube: t.index,
          velocity: clamp(toBasin * 0.6, 0.1, 1.2),
          wetness: 1,
          contact: this.rng() * 2 - 1,
        });
      }
    }

    return { toBasin, spilled: missed };
  }
}
