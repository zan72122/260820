import { describe, expect, it } from 'vitest'
import {
  HANDOFF_COVERAGE,
  HANDOFF_MIN_FREEPLAY,
  RIPEN_TO_PLAY_COVERAGE,
  SHEET_DEPLOY_TRIGGER,
  createState,
  deserialize,
  hintTarget,
  interactable,
  moveSun,
  nextRound,
  placeSheet,
  pullBag,
  pullSheet,
  reportCoverage,
  serialize,
  tick,
} from '../src/core/state'

const run = (s: ReturnType<typeof createState>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) tick(s, 0.05)
}

describe('opening', () => {
  it('holds the wide shot briefly, then offers the bag', () => {
    const s = createState()
    expect(s.phase).toBe('intro')
    run(s, 1.2)
    expect(s.phase).toBe('bagged')
    expect(interactable(s).has('bag')).toBe(true)
    expect(interactable(s).has('sheet')).toBe(false)
  })

  it('gives no hint at all for the first three seconds', () => {
    const s = createState()
    run(s, 2.9)
    expect(s.hintLevel).toBe(0)
    expect(hintTarget(s)).toBeNull()
    run(s, 0.4)
    expect(s.hintLevel).toBe(1)
    expect(hintTarget(s)).toBe('bag')
  })

  it('escalates to a preliminary movement only after a long wait', () => {
    const s = createState()
    run(s, 9.5)
    expect(s.hintLevel).toBe(2)
  })

  it('drops the hint the moment a finger arrives', () => {
    const s = createState()
    run(s, 5)
    expect(s.hintLevel).toBe(1)
    pullBag(s, 0.1)
    expect(s.hintLevel).toBe(0)
  })
})

describe('the bag', () => {
  it('comes off with one downward pull and holds a look at the fruit', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 0.5)
    expect(s.phase).toBe('bagged')
    pullBag(s, 0.6)
    expect(s.phase).toBe('unbagging')
    expect(s.learned.bag).toBe(true)
    run(s, 1.8)
    expect(s.phase).toBe('observing')
    run(s, 3.5)
    expect(s.phase).toBe('sheetIdle')
  })

  it('survives a reversed drag without breaking', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 0.7)
    pullBag(s, -0.9)
    expect(s.bagPull).toBe(0)
    expect(s.phase).toBe('bagged')
    pullBag(s, 1.4)
    expect(s.phase).toBe('unbagging')
  })

  it('ignores bag pulls once the bag is gone', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 2)
    const before = s.bagPull
    pullBag(s, 0.5)
    expect(s.bagPull).toBe(before)
  })
})

describe('the sheet', () => {
  const toSheet = () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 5.4)
    expect(s.phase).toBe('sheetIdle')
    return s
  }

  it('lets an impatient child reach for the sheet during the held look', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 1.8)
    expect(s.phase).toBe('observing')
    pullSheet(s, 0.1)
    expect(s.phase).toBe('unrolling')
  })

  it('reaches the first bounce only once it is spread far enough', () => {
    const s = toSheet()
    pullSheet(s, SHEET_DEPLOY_TRIGGER - 0.05)
    expect(s.phase).toBe('unrolling')
    pullSheet(s, 0.06)
    expect(s.phase).toBe('firstLight')
    expect(s.sawFirstLight).toBe(true)
    expect(s.learned.sheet).toBe(true)
  })

  it('can be let go halfway and picked up from there', () => {
    const s = toSheet()
    pullSheet(s, 0.3)
    const held = s.sheetDeploy
    run(s, 3)
    expect(s.sheetDeploy).toBe(held)
    pullSheet(s, 0.5)
    expect(s.sheetDeploy).toBeCloseTo(0.8, 5)
  })
})

describe('ripening and play', () => {
  const toRipening = () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 5.4)
    pullSheet(s, 1)
    expect(s.phase).toBe('firstLight')
    run(s, 3)
    expect(s.phase).toBe('ripening')
    return s
  }

  it('never turns the fruit red the instant the light moves', () => {
    const s = toRipening()
    const before = s.simTime
    moveSun(s, 0.1)
    expect(s.simTime).toBeGreaterThan(before)
    expect(s.phase).toBe('ripening')
  })

  it('opens free placement once colour is unmistakable', () => {
    const s = toRipening()
    reportCoverage(s, RIPEN_TO_PLAY_COVERAGE + 0.01)
    tick(s, 0.05)
    expect(s.phase).toBe('freeplay')
    const can = interactable(s)
    expect(can.has('sheetBody')).toBe(true)
    expect(can.has('sheet')).toBe(true)
    expect(can.has('sun')).toBe(true)
  })

  it('accepts every placement without any failure state', () => {
    const s = toRipening()
    reportCoverage(s, 0.4)
    tick(s, 0.05)
    for (const lat of [-3, -1, -0.2, 0.5, 1, 7]) {
      placeSheet(s, { lateral: lat })
      expect(s.sheetLateral).toBeGreaterThanOrEqual(-1)
      expect(s.sheetLateral).toBeLessThanOrEqual(1)
    }
    for (const f of [-1, 0.3, 2]) {
      placeSheet(s, { fold: f })
      expect(s.sheetFold).toBeGreaterThanOrEqual(0)
      expect(s.sheetFold).toBeLessThanOrEqual(1)
    }
    expect(s.phase).toBe('freeplay')
  })

  it('keeps the sun inside its arc however hard it is dragged', () => {
    const s = toRipening()
    for (let i = 0; i < 50; i++) moveSun(s, 1)
    expect(s.sunT).toBeLessThanOrEqual(0.94)
    for (let i = 0; i < 50; i++) moveSun(s, -1)
    expect(s.sunT).toBeGreaterThanOrEqual(0.06)
  })

  it('offers the next fruit only after a real spell of free play', () => {
    const s = toRipening()
    reportCoverage(s, HANDOFF_COVERAGE + 0.05)
    tick(s, 0.05)
    expect(s.phase).toBe('freeplay')
    run(s, HANDOFF_MIN_FREEPLAY - 2)
    expect(s.phase).toBe('freeplay')
    run(s, 3)
    expect(s.phase).toBe('handoff')
    expect(interactable(s).has('nextBag')).toBe(true)
  })
})

describe('second fruit', () => {
  it('starts with no intro and no hints for skills already learned', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 5.4)
    pullSheet(s, 1)
    run(s, 3)
    moveSun(s, 0.2)
    const next = nextRound(s)
    expect(next.round).toBe(1)
    expect(next.phase).toBe('bagged')
    expect(next.learned.bag).toBe(true)
    expect(next.learned.sheet).toBe(true)
    expect(next.learned.sun).toBe(true)
    run(next, 4)
    expect(next.hintLevel).toBe(1)
    expect(hintTarget(next)).toBeNull()
    run(next, 6)
    expect(hintTarget(next)).toBe('bag')
  })
})

describe('persistence', () => {
  it('round-trips the whole state', () => {
    const s = createState()
    run(s, 1.2)
    pullBag(s, 1)
    run(s, 5.4)
    pullSheet(s, 0.8)
    moveSun(s, 0.12)
    const back = deserialize(serialize(s))
    expect(back).not.toBeNull()
    expect(back!.phase).toBe(s.phase)
    expect(back!.sheetDeploy).toBeCloseTo(s.sheetDeploy, 6)
    expect(back!.sunT).toBeCloseTo(s.sunT, 6)
    expect(back!.learned).toEqual(s.learned)
  })

  it('survives junk', () => {
    expect(deserialize(null)).toBeNull()
    expect(deserialize('not json')).toBeNull()
    expect(deserialize('{"v":9}')).toBeNull()
  })
})
