import { describe, expect, it } from 'vitest';
import { BowlingGame, computeFrames, totalScore } from '../../src/game/scoring';

function play(rolls: number[]): BowlingGame {
  const g = new BowlingGame();
  for (const r of rolls) g.addRoll(r);
  return g;
}

describe('scoring', () => {
  it('パーフェクトは300', () => {
    expect(totalScore(Array(12).fill(10))).toBe(300);
  });

  it('オール9本スペアは190', () => {
    expect(totalScore(Array(21).fill(5))).toBe(150);
    const rolls: number[] = [];
    for (let i = 0; i < 10; i++) rolls.push(9, 1);
    rolls.push(9);
    expect(totalScore(rolls)).toBe(190);
  });

  it('オープンフレームの逐次確定', () => {
    const frames = computeFrames([3, 4, 10, 5, 2]);
    expect(frames[0]!.cumulative).toBe(7);
    expect(frames[1]!.cumulative).toBe(7 + 10 + 5 + 2);
    expect(frames[2]!.cumulative).toBe(7 + 17 + 7);
    expect(frames[3]!.cumulative).toBeNull();
  });

  it('ストライク直後は未確定', () => {
    const frames = computeFrames([10]);
    expect(frames[0]!.cumulative).toBeNull();
  });

  it('スペア+次の1投で確定', () => {
    const frames = computeFrames([7, 3, 4]);
    expect(frames[0]!.cumulative).toBe(14);
    expect(frames[1]!.cumulative).toBeNull();
  });

  it('10フレーム目: ストライクで2本のボーナス投球', () => {
    const g = play([...Array(18).fill(0), 10]);
    expect(g.isOver()).toBe(false);
    g.addRoll(10);
    expect(g.isOver()).toBe(false);
    g.addRoll(10);
    expect(g.isOver()).toBe(true);
    expect(g.total()).toBe(30);
  });

  it('10フレーム目: オープンで2投終了', () => {
    const g = play([...Array(18).fill(0), 3, 4]);
    expect(g.isOver()).toBe(true);
    expect(g.total()).toBe(7);
  });

  it('needsFullRack: フレーム進行', () => {
    const g = new BowlingGame();
    expect(g.needsFullRack()).toBe(true);
    g.addRoll(6);
    expect(g.needsFullRack()).toBe(false); // 2投目はデッドウッドあり
    g.addRoll(2);
    expect(g.needsFullRack()).toBe(true); // 次フレーム
    g.addRoll(10);
    expect(g.needsFullRack()).toBe(true); // ストライク後は次フレーム頭
  });

  it('needsFullRack: 10フレーム目の再ラック', () => {
    const g = play([...Array(18).fill(0), 10]);
    expect(g.needsFullRack()).toBe(true); // X後は再ラック
    g.addRoll(4);
    expect(g.needsFullRack()).toBe(false); // 残りピンに3投目
    const g2 = play([...Array(18).fill(0), 6, 4]);
    expect(g2.needsFullRack()).toBe(true); // スペア後は再ラック
  });

  it('フレームとロールのカウント', () => {
    const g = play([10, 3, 4]);
    expect(g.frame).toBe(2);
    expect(g.rollInFrame).toBe(0);
  });
});
