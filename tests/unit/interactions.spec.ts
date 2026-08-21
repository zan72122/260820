import { describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from '../../src/sim/GameState'
import type { Action } from '../../src/sim/actions'
import { simulate, type SimWorld } from '../../src/sim/simulate'
import {
  BEDS,
  CAN_HOME,
  CAN_OUT,
  COLLIDERS,
  CROPS,
  KAKI_PICK,
  TSUKUBAI,
  WALKABLE,
} from '../../src/scene/layout'

const world: SimWorld = { colliders: COLLIDERS, bounds: WALKABLE }

const at = (x: number, z: number): Action => ({ type: 'teleport', x, z })
const E: Action = { type: 'interact' }

function run(s: GameState, actions: Action[][]): GameState {
  for (const a of actions) s = simulate(s, a, world)
  return s
}

function ticks(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = simulate(s, [], world)
  return s
}

describe('庭仕事のインタラクション', () => {
  it('如雨露: 取る→汲む→注ぐ→戻す の全チェーン', () => {
    let s = createInitialState(42)
    expect(s.tools.wateringCan).toBe('out')

    // 取る
    s = run(s, [[at(CAN_OUT.x, CAN_OUT.z)], [E]])
    expect(s.player.held).toBe('wateringCan')
    expect(s.tools.wateringCan).toBe('held')

    // 汲む
    s = run(s, [[at(TSUKUBAI.x, TSUKUBAI.z + 0.4)], [E]])
    expect(s.canFill).toBe(1)

    // 注ぐ（bedA）: 注水が始まり、時間とともに湿る
    const bedA = BEDS[0]!
    s = run(s, [[at(bedA.x + 0.7, bedA.z)], [E]])
    expect(s.pouring?.bedId).toBe('bedA')
    const m0 = s.beds['bedA']!.moisture
    const f0 = s.canFill
    s = ticks(s, 120)
    expect(s.beds['bedA']!.moisture).toBeGreaterThan(m0 + 0.4)
    expect(s.canFill).toBeLessThan(f0)
    expect(s.pouring).toBeNull()

    // 戻す
    s = run(s, [[at(CAN_HOME.x, CAN_HOME.z)], [E]])
    expect(s.player.held).toBeNull()
    expect(s.tools.wateringCan).toBe('rack')
    expect(s.chores.toolsTidy).toBe(true)
  })

  it('移動すると注水はキャンセルされる', () => {
    let s = createInitialState(42)
    const bedA = BEDS[0]!
    s = run(s, [
      [at(CAN_OUT.x, CAN_OUT.z)],
      [E],
      [at(TSUKUBAI.x, TSUKUBAI.z + 0.4)],
      [E],
      [at(bedA.x + 0.7, bedA.z)],
      [E],
    ])
    expect(s.pouring).not.toBeNull()
    s = simulate(s, [{ type: 'move', dirX: 1, dirZ: 0 }], world)
    expect(s.pouring).toBeNull()
  })

  it('収穫: 両手が空いていれば熟した作物を穫れ、道具を持っていると穫れない', () => {
    let s = createInitialState(42)
    const daikon1 = CROPS.find((c) => c.id === 'daikon1')!

    // 如雨露を持ったままでは抜けない
    s = run(s, [[at(CAN_OUT.x, CAN_OUT.z)], [E], [at(daikon1.x + 0.5, daikon1.z)], [E]])
    expect(s.crops['daikon1']!.harvested).toBe(false)

    // 置いてから抜く
    s = run(s, [[at(CAN_HOME.x, CAN_HOME.z)], [E], [at(daikon1.x + 0.5, daikon1.z)], [E]])
    expect(s.crops['daikon1']!.harvested).toBe(true)
    expect(s.chores.harvested).toBe(1)

    // 未熟な大根は抜けない（隣の熟した株が届かない位置から）
    const daikon3 = CROPS.find((c) => c.id === 'daikon3')!
    s = run(s, [[at(daikon3.x, daikon3.z + 0.55)], [E]])
    expect(s.crops['daikon3']!.harvested).toBe(false)
    expect(s.chores.harvested).toBe(1)

    // 柿は2回もげる
    s = run(s, [[at(KAKI_PICK.x, KAKI_PICK.z)], [E], [E]])
    expect(s.crops['kaki1']!.harvested).toBe(true)
    expect(s.crops['kaki2']!.harvested).toBe(true)
    expect(s.chores.harvested).toBe(3)
  })

  it('両方の畝を潤すと「水やり」達成', () => {
    let s = createInitialState(42)
    s = run(s, [[at(CAN_OUT.x, CAN_OUT.z)], [E]])
    for (const bed of BEDS) {
      s = run(s, [[at(TSUKUBAI.x, TSUKUBAI.z + 0.4)], [E]])
      s = run(s, [[at(bed.x + 0.7, bed.z)], [E]])
      s = ticks(s, 130)
    }
    expect(s.chores.watered).toBe(true)
  })

  it('インタラクション込みでも決定的', () => {
    const script: Action[][] = [
      [at(CAN_OUT.x, CAN_OUT.z)],
      [E],
      [at(TSUKUBAI.x, TSUKUBAI.z + 0.4)],
      [E],
      [at(BEDS[0]!.x + 0.7, BEDS[0]!.z)],
      [E],
      ...Array.from({ length: 200 }, () => [] as Action[]),
    ]
    const runAll = () => {
      let s = createInitialState(7)
      for (const a of script) s = simulate(s, a, world)
      return JSON.stringify(s)
    }
    expect(runAll()).toBe(runAll())
  })
})
