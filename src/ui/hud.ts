import type { GameState } from '../sim/GameState'
import { findInteractable } from '../sim/interactables'

/**
 * 最小限のHUD: 中央下のプロンプトと右上の「夕方の仕事」。
 * DOMだけで完結し、描画には一切触れない。
 */
export class Hud {
  private readonly prompt = document.getElementById('prompt')
  private readonly chores = document.getElementById('chores')
  private lastPrompt: string | null = null
  private lastChores = ''
  private shownHint = false

  update(state: GameState): void {
    const hit = findInteractable(state)
    let text: string | null = null
    if (state.pouring) {
      text = '……水をやっている'
    } else if (hit) {
      text = hit.prompt.startsWith('（') ? hit.prompt : `E　${hit.prompt}`
    } else if (!this.shownHint && state.tick < 60 * 12) {
      text = 'WASD 歩く ／ ドラッグ 見回す ／ E 使う'
    }
    if (text !== this.lastPrompt && this.prompt) {
      this.lastPrompt = text
      this.prompt.hidden = text === null
      this.prompt.textContent = text ?? ''
      if (text === null) this.shownHint = state.tick > 60 * 12
    }

    if (this.chores) {
      const mark = (done: boolean) => (done ? '〆' : '・')
      const lines = [
        '— 夕方の仕事 —',
        `${mark(state.chores.watered)} 畑に水をやる`,
        `${mark(state.chores.harvested >= 3)} 収穫する（${state.chores.harvested}/3）`,
        `${mark(state.chores.toolsTidy)} 道具を片付ける`,
      ].join('\n')
      if (lines !== this.lastChores) {
        this.lastChores = lines
        this.chores.hidden = false
        this.chores.textContent = lines
      }
    }
  }
}
