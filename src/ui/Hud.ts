/**
 * 画面まわり。文字は少なく、かなを中心に。
 * 4歳児が「いま なにを するか」を一目で分かるようにする。
 */

export type StepState = 'todo' | 'active' | 'done'

const STEPS = [
  { icon: '🚧', label: 'はしを ひらく' },
  { icon: '💡', label: 'あかりを つける' },
  { icon: '🌙', label: 'よるに する' },
]

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

export class Hud {
  private root: HTMLElement
  private loading: HTMLElement
  private startVeil: HTMLElement
  private endVeil: HTMLElement
  private hud: HTMLElement
  private steps: HTMLElement[] = []
  private task: HTMLElement
  private taskMain: HTMLElement
  private taskCount: HTMLElement
  private shoutBox: HTMLElement
  private shoutText: HTMLElement
  private flash: HTMLElement
  private rotate: HTMLElement
  private shoutTimer = 0

  onStart: () => void = () => {}
  onReplay: () => void = () => {}

  constructor(root: HTMLElement) {
    this.root = root

    this.flash = el('div')
    this.flash.id = 'flash'
    root.appendChild(this.flash)

    this.hud = el('div')
    this.hud.id = 'hud'
    STEPS.forEach((s) => {
      const step = el('div', 'step')
      step.appendChild(el('div', 'step-dot', s.icon))
      step.appendChild(el('div', 'step-label', s.label))
      this.hud.appendChild(step)
      this.steps.push(step)
    })
    root.appendChild(this.hud)

    this.task = el('div')
    this.task.id = 'task'
    this.taskMain = el('span', undefined, '')
    this.taskCount = el('span', 'task-count', '')
    this.task.appendChild(this.taskMain)
    this.task.appendChild(this.taskCount)
    root.appendChild(this.task)

    this.shoutBox = el('div')
    this.shoutBox.id = 'shout'
    this.shoutText = el('div', 'shout-text', '')
    this.shoutBox.appendChild(this.shoutText)
    root.appendChild(this.shoutBox)

    this.rotate = el('div', undefined, '<span>📱</span><span>よこむきに すると もっと ひろく みえるよ</span>')
    this.rotate.id = 'rotate'
    root.appendChild(this.rotate)

    // ---- はじめる画面 ----
    this.startVeil = el('div', 'veil')
    const title = el('div', 'title-block')
    title.appendChild(el('div', 'title-kicker', 'NAGAOKA · SHINANO RIVER'))
    title.appendChild(el('h1', 'title-main', '長岡花火の一晩'))
    title.appendChild(el('div', 'title-sub', 'だいいちや　—　かいじょうの じゅんび'))
    this.startVeil.appendChild(title)
    const startBtn = el('button', 'btn', 'はじめる')
    startBtn.addEventListener('click', () => this.onStart())
    this.startVeil.appendChild(startBtn)
    this.startVeil.appendChild(
      el('div', 'hint-note', 'ゆびで タップして あそびます<br>おとが でます'),
    )
    root.appendChild(this.startVeil)

    // ---- おわり画面 ----
    this.endVeil = el('div', 'veil is-hidden')
    const endTitle = el('div', 'title-block')
    endTitle.appendChild(el('div', 'title-kicker', 'YORU NI NATTA'))
    endTitle.appendChild(el('h1', 'title-main', 'よるに なった'))
    endTitle.appendChild(
      el('div', 'title-sub', 'かいじょうの じゅんびが できました<br>つぎは そらに はなびが あがります'),
    )
    this.endVeil.appendChild(endTitle)
    const again = el('button', 'btn ghost', 'もういちど')
    again.addEventListener('click', () => this.onReplay())
    this.endVeil.appendChild(again)
    root.appendChild(this.endVeil)

    this.loading = el('div', undefined, 'よみこみちゅう…')
    this.loading.id = 'loading'
    root.appendChild(this.loading)
  }

  hideLoading() {
    this.loading.classList.add('is-hidden')
    setTimeout(() => this.loading.remove(), 800)
  }

  showStart(v: boolean) {
    this.startVeil.classList.toggle('is-hidden', !v)
  }

  showEnd(v: boolean) {
    this.endVeil.classList.toggle('is-hidden', !v)
  }

  showHud(v: boolean) {
    this.hud.classList.toggle('is-on', v)
    this.rotate.classList.toggle('is-on', v)
  }

  setStep(i: number, state: StepState) {
    const s = this.steps[i]
    if (!s) return
    s.classList.toggle('is-active', state === 'active')
    s.classList.toggle('is-done', state === 'done')
  }

  setTask(text: string, done?: number, total?: number) {
    this.taskMain.textContent = text
    if (total !== undefined) {
      this.taskCount.textContent = '●'.repeat(done ?? 0) + '○'.repeat(total - (done ?? 0))
    } else {
      this.taskCount.textContent = ''
    }
    this.task.classList.add('is-on')
  }

  hideTask() {
    this.task.classList.remove('is-on')
  }

  shout(text: string, ms = 2600) {
    this.shoutText.textContent = text
    this.shoutText.classList.add('is-on')
    window.clearTimeout(this.shoutTimer)
    this.shoutTimer = window.setTimeout(() => {
      this.shoutText.classList.remove('is-on')
    }, ms)
  }

  doFlash(strength = 0.6, ms = 900) {
    this.flash.style.transition = 'opacity 90ms ease'
    this.flash.style.opacity = String(strength)
    window.setTimeout(() => {
      this.flash.style.transition = `opacity ${ms}ms ease`
      this.flash.style.opacity = '0'
    }, 90)
  }

  reset() {
    this.showEnd(false)
    this.hideTask()
    this.steps.forEach((s) => {
      s.classList.remove('is-done')
      s.classList.remove('is-active')
    })
    void this.root
  }
}
