import type { Game } from '../game/game'

interface SliderSpec {
  label: string
  min: number
  max: number
  step: number
  value: number
  apply: (v: number) => void
  format?: (v: number) => string
}

/**
 * Development-only tuning surface, reachable at `?debug=1`. Every value here
 * ships at the number it was tuned to, so the game is complete without it.
 */
export function mountDebug(game: Game, root: HTMLElement): void {
  const panel = document.createElement('div')
  panel.id = 'debug'
  root.appendChild(panel)

  const section = (title: string): void => {
    const h = document.createElement('h4')
    h.textContent = title
    panel.appendChild(h)
  }

  const slider = (spec: SliderSpec): void => {
    const label = document.createElement('label')
    const name = document.createElement('span')
    name.textContent = spec.label
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(spec.min)
    input.max = String(spec.max)
    input.step = String(spec.step)
    input.value = String(spec.value)
    const out = document.createElement('span')
    const fmt = spec.format ?? ((v: number) => v.toFixed(2))
    out.textContent = fmt(spec.value)
    input.addEventListener('input', () => {
      const v = Number(input.value)
      out.textContent = fmt(v)
      spec.apply(v)
    })
    label.append(name, input, out)
    panel.appendChild(label)
  }

  section('light')
  slider({
    label: 'dusk sky',
    min: 0.2,
    max: 2.2,
    step: 0.02,
    value: game.debugSkyBrightness,
    apply: (v) => (game.debugSkyBrightness = v),
  })
  slider({
    label: 'lamp gain',
    min: 0.2,
    max: 2.5,
    step: 0.02,
    value: game.debugLampGain,
    apply: (v) => (game.debugLampGain = v),
  })
  slider({
    label: 'exposure',
    min: 0.4,
    max: 2.4,
    step: 0.02,
    value: game.debugExposure,
    apply: (v) => game.setExposure(v),
  })
  slider({
    label: 'bloom',
    min: 0,
    max: 1,
    step: 0.02,
    value: 0.26,
    apply: (v) => game.setBloom(v),
  })

  section('machine')
  slider({
    label: 'charge rate',
    min: 0.2,
    max: 3,
    step: 0.05,
    value: game.debugChargeScale,
    apply: (v) => (game.debugChargeScale = v),
  })
  slider({
    label: 'roller speed',
    min: 0.4,
    max: 2.2,
    step: 0.05,
    value: game.debugRollerScale,
    apply: (v) => (game.debugRollerScale = v),
  })
  slider({
    label: 'fill circuits',
    min: 0,
    max: 1,
    step: 0.02,
    value: 0,
    apply: (v) => game.fillCircuits(v),
  })

  section('render')
  slider({
    label: 'render scale',
    min: 0.5,
    max: 1,
    step: 0.02,
    value: 1,
    apply: (v) => game.setRenderScale(v),
  })
  slider({
    label: 'shadow map',
    min: 256,
    max: 2048,
    step: 256,
    value: 1024,
    apply: (v) => game.setShadowQuality(v),
    format: (v) => String(v),
  })

  section('camera')
  const row = document.createElement('div')
  row.className = 'row'
  for (const shot of ['overview', 'climb', 'top', 'ride', 'firstLight', 'discovery', 'selector', 'finale']) {
    const b = document.createElement('button')
    b.textContent = shot
    b.addEventListener('click', () => game.jumpToShot(shot))
    row.appendChild(b)
  }
  panel.appendChild(row)

  section('state')
  const stat = document.createElement('div')
  stat.className = 'stat'
  panel.appendChild(stat)
  window.setInterval(() => {
    const s = game.stats
    stat.textContent = Object.entries(s)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    stat.style.whiteSpace = 'pre'
  }, 250)
}
