import { describe, expect, it } from 'vitest';
import { PhysicsWorld, type ThrowParams } from '../../src/physics/world';
import { frictionAt, MU_DRY } from '../../src/physics/oilPattern';
import { FT, LANE_WIDTH } from '../../src/util/units';

const POCKET_SHOT: ThrowParams = {
  x: 0.2,
  speed: 8.5,
  angleDeg: 0,
  revRate: 24,
  axisDeg: 35,
};

async function runShot(p: ThrowParams, maxSeconds = 10): Promise<{ world: PhysicsWorld; standing: number }> {
  const world = await PhysicsWorld.create();
  world.rackPins();
  world.throwBall(p);
  const maxSteps = Math.round(maxSeconds * 120);
  for (let i = 0; i < maxSteps; i++) {
    world.step();
    if (i > 240 && world.isSettled()) break;
  }
  return { world, standing: world.standingCount() };
}

describe('oilPattern', () => {
  it('オイルゾーンはドライより滑る', () => {
    expect(frictionAt(0, 6)).toBeLessThan(frictionAt(0, 14));
    expect(frictionAt(0, 14)).toBe(MU_DRY);
  });
  it('外板はセンターよりドライ', () => {
    expect(frictionAt(0.45, 6)).toBeGreaterThan(frictionAt(0, 6));
  });
  it('40ft以降はμ一定', () => {
    expect(frictionAt(0.1, 13)).toBe(frictionAt(0.1, 18));
  });
});

describe('PhysicsWorld', () => {
  it('ポケットショットでピンが倒れる', async () => {
    const { standing } = await runShot(POCKET_SHOT);
    expect(standing).toBeLessThanOrEqual(4);
  }, 30000);

  it('同一パラメータ→同一結果（決定論）', async () => {
    const a = await runShot(POCKET_SHOT);
    const b = await runShot(POCKET_SHOT);
    expect(b.standing).toBe(a.standing);
    const pa = a.world.pinPoses();
    const pb = b.world.pinPoses();
    for (let i = 0; i < 10; i++) {
      expect(pb[i]!.position.x).toBeCloseTo(pa[i]!.position.x, 10);
      expect(pb[i]!.position.z).toBeCloseTo(pa[i]!.position.z, 10);
      expect(pb[i]!.standing).toBe(pa[i]!.standing);
    }
  }, 60000);

  it('大きく外した球はガターに落ちピンは倒れない', async () => {
    const { world, standing } = await runShot({ x: 0.4, speed: 7, angleDeg: -2.5, revRate: 5, axisDeg: 0 });
    expect(standing).toBe(10);
    const bp = world.ballPose();
    expect(Math.abs(bp.position.x)).toBeGreaterThan(LANE_WIDTH / 2);
  }, 30000);

  it('フックボールはドライバックエンドで左へ曲がる', async () => {
    const world = await PhysicsWorld.create();
    world.rackPins();
    world.throwBall({ x: 0.26, speed: 8.0, angleDeg: 0, revRate: 26, axisDeg: 38 });
    let xAt40ft = NaN;
    let xAtOil = NaN;
    for (let i = 0; i < 120 * 6; i++) {
      world.step();
      const z = world.ballPose().position.z;
      if (Number.isNaN(xAtOil) && z >= 28 * FT) xAtOil = world.ballPose().position.x;
      if (Number.isNaN(xAt40ft) && z >= 56 * FT) {
        xAt40ft = world.ballPose().position.x;
        break;
      }
    }
    // オイル上ではほぼ直進、バックエンドで左（-x）へ動く
    expect(xAtOil).toBeGreaterThan(0.26 - 0.06);
    expect(xAt40ft).toBeLessThan(xAtOil - 0.03);
  }, 30000);

  it('再ラックで指定ピンだけ立つ', async () => {
    const world = await PhysicsWorld.create();
    world.rackPins([true, false, true, false, false, false, false, false, false, true]);
    expect(world.standingCount()).toBe(3);
  }, 20000);
});
