/**
 * Deliberately tiny: one line of text, one guidance ring, one fill meter and the
 * replay button. Nothing here explains a mechanic — the screen does that. The
 * text only names what the child is already looking at.
 */
export class Hud {
  private hintEl = document.getElementById('hint') as HTMLDivElement
  private ringEl = document.getElementById('ring') as HTMLDivElement
  private fillEl = document.getElementById('fill') as HTMLDivElement
  private fillBar = this.fillEl.querySelector('i') as HTMLElement
  private replayEl = document.getElementById('replay') as HTMLButtonElement
  private bootEl = document.getElementById('boot') as HTMLDivElement
  private hint = ''

  constructor(onReplay: () => void) {
    this.replayEl.addEventListener('click', (e) => {
      e.preventDefault()
      onReplay()
    })
  }

  setHint(text: string) {
    if (text === this.hint) return
    this.hint = text
    this.hintEl.textContent = text
    this.hintEl.classList.toggle('show', text.length > 0)
  }

  setRing(x: number | null, y = 0, scale = 1) {
    if (x === null) {
      this.ringEl.hidden = true
      this.ringEl.classList.remove('show')
      return
    }
    this.ringEl.hidden = false
    this.ringEl.classList.add('show')
    this.ringEl.style.left = `${x}px`
    this.ringEl.style.top = `${y}px`
    this.ringEl.style.width = this.ringEl.style.height = `${118 * scale}px`
    this.ringEl.style.margin = `${-59 * scale}px 0 0 ${-59 * scale}px`
  }

  setFill(value: number | null) {
    if (value === null) {
      this.fillEl.classList.remove('show')
      this.fillEl.hidden = true
      return
    }
    this.fillEl.hidden = false
    this.fillEl.classList.add('show')
    this.fillBar.style.height = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
  }

  showReplay(show: boolean) {
    this.replayEl.hidden = !show
  }

  hideBoot() {
    this.bootEl.classList.add('gone')
    window.setTimeout(() => {
      this.bootEl.style.display = 'none'
    }, 600)
  }
}
