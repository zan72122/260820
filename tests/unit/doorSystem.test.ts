import { describe, expect, it } from 'vitest';
import { DoorSystem, CALIBRATED_DEPTH, MISCALIBRATED_DEPTH } from '../../src/sim/DoorSystem';
import { TrafficActor, ACTOR_PROFILES } from '../../src/sim/TrafficActor';
import { PathPlanner } from '../../src/sim/PathPlanner';
import { crossingPath, enterPath, toThresholdPath } from '../../src/sim/scenarios';
import { DoorState } from '../../src/sim/DoorStateMachine';

const DT = 1 / 60;

function makeActor(
  id: string,
  kind: keyof typeof ACTOR_PROFILES,
  path: { x: number; z: number }[],
  behavior: TrafficActor['profile']['behavior'] = { type: 'pass' },
): TrafficActor {
  const a = new TrafficActor(id, { ...ACTOR_PROFILES[kind], behavior });
  a.setPath(PathPlanner.build(path));
  a.start();
  return a;
}

function run(sys: DoorSystem, actors: TrafficActor[], seconds: number): Set<DoorState> {
  const seen = new Set<DoorState>();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    for (const a of actors) a.update(DT);
    sys.update(DT, actors);
    seen.add(sys.door.state);
  }
  return seen;
}

describe('受け入れ試験(判定ロジック)', () => {
  it('1. 調整後: 横切るだけのロボットには開かない', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    const robot = makeActor('r', 'deliveryRobot', crossingPath());
    run(sys, [robot], 14);
    expect(sys.door.openedOnce).toBe(false);
    expect(sys.door.state).toBe('CLOSED');
  });

  it('2. 調整後: 入口へ向かうロボットには開く', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    const robot = makeActor('r', 'deliveryRobot', enterPath());
    const seen = run(sys, [robot], 12);
    expect(sys.door.openedOnce).toBe(true);
    expect(seen.has('OPENING')).toBe(true);
  });

  it('3. 戸口に残るテストボディがあれば閉じない', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    const body = makeActor('b', 'foamBody', toThresholdPath(), {
      type: 'stopThenGo',
      stopAt: 4.6,
      stopFor: 30,
    });
    const seen = run(sys, [body], 20);
    expect(sys.door.openedOnce).toBe(true);
    // 戸口占有中は決して全閉に戻らない
    expect(sys.door.state).not.toBe('CLOSED');
    expect(sys.door.position).toBeGreaterThan(0.5);
    // 保持(または閉じかけて反転)している
    expect(seen.has('HOLDING')).toBe(true);
  });

  it('3b. 閉扉中に戸口へ入ると OBSTRUCTION → REVERSING で全開へ戻る', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    // まず開けさせる
    const opener = makeActor('o', 'deliveryRobot', enterPath());
    run(sys, [opener], 10);
    // 扉が閉じ始めた頃に戸口へ静止物を置く
    let guard = 0;
    while (sys.door.state !== 'CLOSING' && guard++ < 60 * 20) {
      sys.update(DT, []);
    }
    expect(sys.door.state).toBe('CLOSING');
    // 屋内側から戸口へ入る: 接近検知領域(z>=0.15)の外なので作動せず、
    // カーテンだけが遮られる → OBSTRUCTION
    const blocker = makeActor('b', 'foamBody', [
      { x: 0, z: -0.8 },
      { x: 0, z: 0.05 },
    ]);
    const seen = run(sys, [blocker], 6);
    expect(seen.has('OBSTRUCTION')).toBe(true);
    expect(seen.has('REVERSING')).toBe(true);
    expect(sys.door.position).toBeGreaterThan(0.9);
  });

  it('4. テストボディが去った後は閉じる', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    const body = makeActor('b', 'foamBody', toThresholdPath(), {
      type: 'stopThenRetreat',
      stopAt: 4.6,
      stopFor: 3,
    });
    run(sys, [body], 40);
    expect(sys.door.openedOnce).toBe(true);
    expect(sys.door.state).toBe('CLOSED');
    expect(sys.door.position).toBe(0);
  });

  it('5. 調整前と調整後で、同じ横切り経路の結果が変わる', () => {
    const before = new DoorSystem();
    expect(before.activation.params.depth).toBe(MISCALIBRATED_DEPTH);
    const r1 = makeActor('r', 'deliveryRobot', crossingPath());
    run(before, [r1], 14);
    expect(before.door.openedOnce).toBe(true); // 誤開扉

    const after = new DoorSystem();
    after.activation.setDepth(CALIBRATED_DEPTH);
    const r2 = makeActor('r', 'deliveryRobot', crossingPath());
    run(after, [r2], 14);
    expect(after.door.openedOnce).toBe(false); // 開かない
  });

  it('6. 診断表示を消しても判定は変わらない', () => {
    const results: boolean[] = [];
    for (const diag of [true, false]) {
      const sys = new DoorSystem();
      sys.diagnosticsOn = diag;
      sys.activation.setDepth(CALIBRATED_DEPTH);
      const robot = makeActor('r', 'deliveryRobot', enterPath());
      run(sys, [robot], 12);
      results.push(sys.door.openedOnce);
    }
    expect(results[0]).toBe(results[1]);
  });

  it('一方向検知: 扉から遠ざかる動きでは開かない', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    // 戸口側から通路の奥へ(センサー領域内を遠ざかる方向に通過)
    const away = makeActor('a', 'deliveryRobot', [
      { x: 0, z: 0.4 },
      { x: 0, z: 5 },
    ]);
    run(sys, [away], 10);
    expect(sys.door.openedOnce).toBe(false);
  });

  it('背の低い台車でも戸口保護カーテンは検知する', () => {
    const sys = new DoorSystem();
    sys.activation.setDepth(CALIBRATED_DEPTH);
    const cart = makeActor('c', 'lowCart', toThresholdPath(), {
      type: 'stopThenGo',
      stopAt: 4.6,
      stopFor: 10,
    });
    run(sys, [cart], 15);
    expect(sys.curtain.occupied).toBe(true);
    expect(sys.door.state).not.toBe('CLOSED');
  });

  it('診断セルと判定が同じ形状データを共有する', () => {
    const sys = new DoorSystem();
    // すべてのセル中心は containsPoint 内、外周のすぐ外は false
    for (const c of sys.activation.cells) {
      expect(sys.activation.containsPoint({ x: c.x, z: c.z })).toBe(true);
    }
    const p = sys.activation.params;
    expect(sys.activation.containsPoint({ x: 0, z: p.origin.z + p.depth + 0.01 })).toBe(false);
    // 奥行きを変えるとセルも外周も同時に変わる
    sys.activation.setDepth(1.2);
    const maxZ = Math.max(...sys.activation.cells.map((c) => c.z));
    expect(maxZ).toBeLessThan(p.origin.z + 1.2);
    expect(sys.activation.containsPoint({ x: 0, z: p.origin.z + 1.5 })).toBe(false);
  });
});
