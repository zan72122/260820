/**
 * 音は素材を持たず WebAudio で合成する。
 * 川の音・風・遠くのざわめき、そして操作の手ごたえ。
 */

function noiseBuffer(ctx: AudioContext, seconds = 4) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    d[i] = last * 3.2
  }
  return buf
}

export class Ambience {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private riverGain: GainNode | null = null
  private windGain: GainNode | null = null
  private crowdGain: GainNode | null = null
  private cricketGain: GainNode | null = null
  private started = false
  muted = false

  async start() {
    if (this.started) return
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.started = true
    const ctx = new AC()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3)

    const buf = noiseBuffer(ctx, 5)

    // 川の音
    const river = ctx.createBufferSource()
    river.buffer = buf
    river.loop = true
    const riverLp = ctx.createBiquadFilter()
    riverLp.type = 'lowpass'
    riverLp.frequency.value = 620
    const riverHp = ctx.createBiquadFilter()
    riverHp.type = 'highpass'
    riverHp.frequency.value = 90
    const rg = ctx.createGain()
    rg.gain.value = 0.075
    river.connect(riverHp).connect(riverLp).connect(rg).connect(master)
    river.start()
    this.riverGain = rg

    // 風
    const wind = ctx.createBufferSource()
    wind.buffer = buf
    wind.loop = true
    const windLp = ctx.createBiquadFilter()
    windLp.type = 'lowpass'
    windLp.frequency.value = 330
    const wg = ctx.createGain()
    wg.gain.value = 0.05
    wind.connect(windLp).connect(wg).connect(master)
    wind.start()
    this.windGain = wg
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.035
    lfo.connect(lfoGain).connect(wg.gain)
    lfo.start()

    // 遠くのざわめき
    const crowd = ctx.createBufferSource()
    crowd.buffer = buf
    crowd.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 1.4
    const cg = ctx.createGain()
    cg.gain.value = 0.012
    crowd.connect(bp).connect(cg).connect(master)
    crowd.start()
    this.crowdGain = cg

    // 夜の虫
    const cricket = ctx.createBufferSource()
    cricket.buffer = buf
    cricket.loop = true
    const cbp = ctx.createBiquadFilter()
    cbp.type = 'bandpass'
    cbp.frequency.value = 4200
    cbp.Q.value = 7
    const kg = ctx.createGain()
    kg.gain.value = 0
    cricket.connect(cbp).connect(kg).connect(master)
    cricket.start()
    this.cricketGain = kg
    const trill = ctx.createOscillator()
    trill.type = 'sine'
    trill.frequency.value = 9
    const trillGain = ctx.createGain()
    trillGain.gain.value = 0.012
    trill.connect(trillGain).connect(kg.gain)
    trill.start()
  }

  setNight(k: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.cricketGain?.gain.setTargetAtTime(0.014 * k, t, 1.2)
    this.windGain?.gain.setTargetAtTime(0.05 - 0.018 * k, t, 1.2)
    this.riverGain?.gain.setTargetAtTime(0.075 + 0.01 * k, t, 1.2)
  }

  setCrowd(k: number) {
    if (!this.ctx) return
    this.crowdGain?.gain.setTargetAtTime(0.012 + 0.03 * k, this.ctx.currentTime, 1.0)
  }

  setMuted(m: boolean) {
    this.muted = m
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2)
  }

  private env(dur: number, peak: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    return g
  }

  /** バリケードが下りる音（木と金属の混じった手ごたえ）。 */
  clack() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const g = this.env(0.42, 0.32)
    g.connect(this.master)
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(220, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(86, ctx.currentTime + 0.25)
    o.connect(g)
    o.start()
    o.stop(ctx.currentTime + 0.5)

    const n = ctx.createBufferSource()
    n.buffer = noiseBuffer(ctx, 0.3)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1400
    f.Q.value = 1.1
    const ng = this.env(0.22, 0.16)
    n.connect(f).connect(ng).connect(this.master)
    n.start()
    n.stop(ctx.currentTime + 0.3)
  }

  /** 灯りがつく音（やわらかい鐘）。 */
  chime(step = 0) {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const scale = [0, 2, 4, 7, 9, 12, 14]
    const semi = scale[step % scale.length] + (step >= scale.length ? 12 : 0)
    const f = 392 * Math.pow(2, semi / 12)
    for (const [mult, gain, dur] of [
      [1, 0.16, 1.5],
      [2.01, 0.07, 1.1],
      [3.02, 0.035, 0.8],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mult
      const g = this.env(dur, gain)
      o.connect(g).connect(this.master)
      o.start()
      o.stop(ctx.currentTime + dur + 0.1)
    }
  }

  /** 夜へ切り替わる大きな音。 */
  swell() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.3, now + 1.8)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 7)
    g.connect(this.master)
    for (const [f, type] of [
      [65.4, 'sine'],
      [98, 'sine'],
      [130.8, 'triangle'],
      [196, 'sine'],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(f * 0.82, now)
      o.frequency.exponentialRampToValueAtTime(f, now + 2.6)
      const og = ctx.createGain()
      og.gain.value = 0.4
      o.connect(og).connect(g)
      o.start(now)
      o.stop(now + 7.5)
    }
    // きらめき
    const n = ctx.createBufferSource()
    n.buffer = noiseBuffer(ctx, 4)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1800, now)
    bp.frequency.exponentialRampToValueAtTime(5200, now + 3.4)
    bp.Q.value = 3
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.exponentialRampToValueAtTime(0.05, now + 2.2)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 6.5)
    n.connect(bp).connect(ng).connect(this.master)
    n.start(now)
    n.stop(now + 7)
  }
}
