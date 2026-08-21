import { describe, expect, it } from 'vitest';
import { computeThrow, MAX_ANGLE, MAX_SPEED, MIN_SPEED, type SwingSample } from '../../src/input/swing';

/** 直線ストローク（下→上）を合成 */
function straight(vyUp: number, vx = 0, n = 12, dt = 0.016): SwingSample[] {
  const out: SwingSample[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ t: i * dt, x: 0.5 + vx * i * dt, y: 0.8 - vyUp * i * dt });
  }
  return out;
}

/** 湾曲ストローク: 前半右へ、後半左へ */
function curved(curl: number, vyUp = 1.0, n = 16, dt = 0.016): SwingSample[] {
  const out: SwingSample[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const half = (n * dt) / 2;
    const vx = t < half ? curl / 2 : -curl / 2;
    const prev = out[i - 1];
    out.push({
      t,
      x: prev ? prev.x + vx * dt : 0.5,
      y: 0.8 - vyUp * t,
    });
  }
  return out;
}

describe('computeThrow', () => {
  it('サンプル不足や後ろ向きは投球不成立', () => {
    expect(computeThrow([], 0)).toBeNull();
    expect(computeThrow(straight(-0.5), 0)).toBeNull();
  });

  it('速いフリックほど球速が上がり上限で飽和', () => {
    const slow = computeThrow(straight(0.5), 0)!;
    const fast = computeThrow(straight(1.2), 0)!;
    const max = computeThrow(straight(5), 0)!;
    expect(slow.speed).toBeGreaterThanOrEqual(MIN_SPEED);
    expect(fast.speed).toBeGreaterThan(slow.speed);
    expect(max.speed).toBe(MAX_SPEED);
  });

  it('横に流すと投球角がつき、範囲内に収まる', () => {
    const right = computeThrow(straight(1.0, 0.3), 0)!;
    const left = computeThrow(straight(1.0, -0.3), 0)!;
    expect(right.angleDeg).toBeLessThan(0);
    expect(left.angleDeg).toBeGreaterThan(0);
    expect(Math.abs(right.angleDeg)).toBeLessThanOrEqual(MAX_ANGLE);
  });

  it('湾曲ストロークで回転がつく', () => {
    const hooked = computeThrow(curved(0.8), 0)!;
    const flat = computeThrow(straight(1.0), 0)!;
    expect(hooked.revRate).toBeGreaterThan(flat.revRate);
    expect(hooked.axisDeg).toBeGreaterThan(0);
  });

  it('投球位置はレーン内にクランプされる', () => {
    const p = computeThrow(straight(1.0), 5)!;
    expect(p.x).toBeLessThan(0.53);
  });
});
