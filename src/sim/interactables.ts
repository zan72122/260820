import type { GameState } from './GameState'
import {
  BED_L,
  BED_W,
  BEDS,
  CAN_HOME,
  CAN_OUT,
  CROPS,
  KAKI_PICK,
  TOOL_RACK,
  TSUKUBAI,
} from '../scene/layout'

/** 注水は90tick（1.5秒）かけて行う。 */
export const POUR_TICKS = 90
export const POUR_MOISTURE_PER_TICK = 0.008
export const POUR_DRAIN_PER_TICK = 0.006

export interface Interactable {
  id: string
  x: number
  z: number
  radius: number
  /** 実行可能ならプロンプト文字列、不可なら null */
  prompt(state: GameState): string | null
  apply(state: GameState): void
}

/** 宣言的な対話点の一覧（すべて layout の実座標に紐づく）。 */
export function listInteractables(): Interactable[] {
  const items: Interactable[] = []

  // --- 如雨露: 出しっぱなし位置 / 定位置 ----------------------------------
  items.push({
    id: 'canOut',
    x: CAN_OUT.x,
    z: CAN_OUT.z,
    radius: 0.75,
    prompt: (s) =>
      s.tools.wateringCan === 'out' && s.player.held === null
        ? '如雨露を取る'
        : null,
    apply: (s) => {
      s.tools.wateringCan = 'held'
      s.player.held = 'wateringCan'
    },
  })
  items.push({
    id: 'canHome',
    x: CAN_HOME.x,
    z: CAN_HOME.z,
    radius: 0.8,
    prompt: (s) => {
      if (s.player.held === 'wateringCan') return '如雨露を戻す'
      if (s.tools.wateringCan === 'rack' && s.player.held === null)
        return '如雨露を取る'
      return null
    },
    apply: (s) => {
      if (s.player.held === 'wateringCan') {
        s.tools.wateringCan = 'rack'
        s.player.held = null
      } else {
        s.tools.wateringCan = 'held'
        s.player.held = 'wateringCan'
      }
    },
  })

  // --- 蹲踞で汲む ---------------------------------------------------------
  items.push({
    id: 'tsukubai',
    x: TSUKUBAI.x,
    z: TSUKUBAI.z + 0.35,
    radius: 0.75,
    prompt: (s) =>
      s.player.held === 'wateringCan' && s.canFill < 0.99 ? '水を汲む' : null,
    apply: (s) => {
      s.canFill = 1
    },
  })

  // --- 畝への水やり -------------------------------------------------------
  for (const bed of BEDS) {
    items.push({
      id: `water:${bed.id}`,
      x: bed.x,
      z: bed.z,
      radius: Math.hypot(BED_W, BED_L) / 2 + 0.45,
      prompt: (s) => {
        if (s.player.held !== 'wateringCan') return null
        if (s.canFill <= 0.01) return '（如雨露が空だ）'
        const b = s.beds[bed.id]
        if (!b || b.moisture > 0.95) return null
        return '水をやる'
      },
      apply: (s) => {
        if (s.canFill <= 0.01) return
        s.pouring = { bedId: bed.id, ticksLeft: POUR_TICKS }
      },
    })
  }

  // --- 収穫（両手が空いている時だけ） -------------------------------------
  const cropLabel = { daikon: '大根を抜く', negi: null, tomato: 'トマトを穫る' }
  for (const crop of CROPS) {
    const label = cropLabel[crop.kind]
    if (!label) continue
    items.push({
      id: `harvest:${crop.id}`,
      x: crop.x,
      z: crop.z,
      radius: 0.8,
      prompt: (s) => {
        const c = s.crops[crop.id]
        return c && c.ripe && !c.harvested && s.player.held === null
          ? label
          : null
      },
      apply: (s) => {
        const c = s.crops[crop.id]
        if (c && c.ripe && !c.harvested) {
          c.harvested = true
          s.chores.harvested += 1
        }
      },
    })
  }
  // 柿の低枝（2つまとめて1つの立ち位置）
  items.push({
    id: 'harvest:kaki',
    x: KAKI_PICK.x,
    z: KAKI_PICK.z,
    radius: 0.85,
    prompt: (s) => {
      if (s.player.held !== null) return null
      const any = ['kaki1', 'kaki2'].some((id) => {
        const c = s.crops[id]
        return c && c.ripe && !c.harvested
      })
      return any ? '柿をもぐ' : null
    },
    apply: (s) => {
      for (const id of ['kaki1', 'kaki2']) {
        const c = s.crops[id]
        if (c && c.ripe && !c.harvested) {
          c.harvested = true
          s.chores.harvested += 1
          break
        }
      }
    },
  })

  // --- 鍬・箒の取り/戻し（ラック） ----------------------------------------
  items.push({
    id: 'rack',
    x: TOOL_RACK.x,
    z: TOOL_RACK.z + 0.35,
    radius: 0.85,
    prompt: (s) => {
      if (s.player.held === 'hoe') return '鍬を戻す'
      if (s.player.held === 'broom') return '箒を戻す'
      if (s.player.held === null) {
        if (s.tools.hoe === 'rack') return '鍬を取る'
        if (s.tools.broom === 'rack') return '箒を取る'
      }
      return null
    },
    apply: (s) => {
      if (s.player.held === 'hoe') {
        s.tools.hoe = 'rack'
        s.player.held = null
      } else if (s.player.held === 'broom') {
        s.tools.broom = 'rack'
        s.player.held = null
      } else if (s.tools.hoe === 'rack') {
        s.tools.hoe = 'held'
        s.player.held = 'hoe'
      } else if (s.tools.broom === 'rack') {
        s.tools.broom = 'held'
        s.player.held = 'broom'
      }
    },
  })

  return items
}

const INTERACTABLES = listInteractables()

/** 現在位置で実行可能な最寄りの対話点。 */
export function findInteractable(
  state: GameState,
): { item: Interactable; prompt: string } | null {
  let best: { item: Interactable; prompt: string; d: number } | null = null
  for (const item of INTERACTABLES) {
    const d = Math.hypot(state.player.x - item.x, state.player.z - item.z)
    if (d > item.radius) continue
    const prompt = item.prompt(state)
    if (!prompt) continue
    if (!best || d < best.d) best = { item, prompt, d }
  }
  return best ? { item: best.item, prompt: best.prompt } : null
}
