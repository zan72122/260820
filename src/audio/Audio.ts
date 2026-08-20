/**
 * Fully procedural audio (no assets). The mix exists to explain water pressure
 * and mud state, so every continuous voice is driven by the same values the
 * simulation uses. No fanfares, no UI beeps.
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private noise!: AudioBuffer
  private started = false
  private volume = 0.8

  // continuous voices
  private pumpGain!: GainNode
  private flowGain!: GainNode
  private flowFilter!: BiquadFilterNode
  private splashGain!: GainNode
  private splashFilter!: BiquadFilterNode
  private lotusGain!: GainNode
  private lotusFilter!: BiquadFilterNode

  get ready() {
    return this.started
  }

  async start() {
    if (this.started) return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    const ctx = this.ctx
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(ctx.destination)

    // shared pink-ish noise
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22
    }
    this.noise = buf

    // ---- distant pump: low rumble + faint mechanical beat
    this.pumpGain = ctx.createGain()
    this.pumpGain.gain.value = 0.0
    const pumpLp = ctx.createBiquadFilter()
    pumpLp.type = 'lowpass'
    pumpLp.frequency.value = 190
    const pumpSrc = ctx.createBufferSource()
    pumpSrc.buffer = buf
    pumpSrc.loop = true
    const pumpOsc = ctx.createOscillator()
    pumpOsc.type = 'sawtooth'
    pumpOsc.frequency.value = 41
    const pumpOscG = ctx.createGain()
    pumpOscG.gain.value = 0.11
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 4.6
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.045
    lfo.connect(lfoG).connect(this.pumpGain.gain)
    pumpSrc.connect(pumpLp)
    pumpOsc.connect(pumpOscG).connect(pumpLp)
    pumpLp.connect(this.pumpGain).connect(this.master)
    pumpSrc.start()
    pumpOsc.start()
    lfo.start()

    // ---- hose flow: low vibration inside the reinforced hose
    this.flowGain = ctx.createGain()
    this.flowGain.gain.value = 0
    this.flowFilter = ctx.createBiquadFilter()
    this.flowFilter.type = 'lowpass'
    this.flowFilter.frequency.value = 320
    this.flowFilter.Q.value = 3.5
    const flowSrc = ctx.createBufferSource()
    flowSrc.buffer = buf
    flowSrc.loop = true
    flowSrc.connect(this.flowFilter).connect(this.flowGain).connect(this.master)
    flowSrc.start()

    // ---- jet hitting water / sinking into mud (bandpass sweeps with mud factor)
    this.splashGain = ctx.createGain()
    this.splashGain.gain.value = 0
    this.splashFilter = ctx.createBiquadFilter()
    this.splashFilter.type = 'bandpass'
    this.splashFilter.frequency.value = 1600
    this.splashFilter.Q.value = 0.6
    const splashSrc = ctx.createBufferSource()
    splashSrc.buffer = buf
    splashSrc.loop = true
    splashSrc.connect(this.splashFilter).connect(this.splashGain).connect(this.master)
    splashSrc.start()

    // ---- water striking the hard lotus surface
    this.lotusGain = ctx.createGain()
    this.lotusGain.gain.value = 0
    this.lotusFilter = ctx.createBiquadFilter()
    this.lotusFilter.type = 'bandpass'
    this.lotusFilter.frequency.value = 3400
    this.lotusFilter.Q.value = 1.6
    const lotusSrc = ctx.createBufferSource()
    lotusSrc.buffer = buf
    lotusSrc.loop = true
    lotusSrc.connect(this.lotusFilter).connect(this.lotusGain).connect(this.master)
    lotusSrc.start()

    this.started = true
    this.setVolume(this.volume)
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05)
  }

  /** Continuous mix. mud = 0 water surface .. 1 buried in mud. */
  update(o: { jet: number; pressure: number; mud: number; onLotus: number }) {
    if (!this.started || !this.ctx) return
    const t = this.ctx.currentTime
    const k = 0.06
    this.pumpGain.gain.setTargetAtTime(0.14, t, 0.4)
    this.flowGain.gain.setTargetAtTime(o.jet * (0.13 + 0.2 * o.pressure), t, k)
    this.flowFilter.frequency.setTargetAtTime(200 + 260 * o.pressure, t, k)
    const muffle = 1 - 0.72 * o.mud
    this.splashGain.gain.setTargetAtTime(o.jet * (0.05 + 0.16 * o.pressure) * (0.55 + 0.45 * muffle), t, k)
    this.splashFilter.frequency.setTargetAtTime(420 + 2100 * muffle * (0.5 + 0.5 * o.pressure), t, k)
    this.splashFilter.Q.setTargetAtTime(0.5 + 2.2 * o.mud, t, k)
    this.lotusGain.gain.setTargetAtTime(o.jet * o.onLotus * 0.1, t, k)
  }

  private burst(opts: {
    dur: number
    type: BiquadFilterType
    freq: number
    endFreq?: number
    q: number
    gain: number
    attack?: number
  }) {
    if (!this.started || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.playbackRate.value = 0.8 + Math.random() * 0.5
    const f = ctx.createBiquadFilter()
    f.type = opts.type
    f.frequency.setValueAtTime(opts.freq, t)
    if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), t + opts.dur)
    f.Q.value = opts.q
    const g = ctx.createGain()
    const a = opts.attack ?? 0.008
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + opts.dur + 0.05)
  }

  private thud(freq: number, dur: number, gain: number) {
    if (!this.started || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(freq * 0.45, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  /** hand pushed into mud under a petiole */
  probe() {
    this.burst({ dur: 0.5, type: 'lowpass', freq: 700, endFreq: 220, q: 1, gain: 0.16, attack: 0.05 })
  }
  /** a clod of clay breaks apart */
  clod() {
    this.burst({ dur: 0.28, type: 'bandpass', freq: 900, endFreq: 300, q: 1.2, gain: 0.14 })
    this.thud(110, 0.2, 0.06)
  }
  /** first pale surface uncovered — a quiet, low confirmation, not a jingle */
  reveal() {
    this.thud(150, 0.5, 0.05)
  }
  /** long body shedding water as it leaves the mud */
  shed() {
    this.burst({ dur: 1.25, type: 'bandpass', freq: 480, endFreq: 2600, q: 0.7, gain: 0.2, attack: 0.18 })
  }
  /** placed into the low harvest boat */
  thunk() {
    this.thud(86, 0.35, 0.22)
    this.burst({ dur: 0.16, type: 'lowpass', freq: 1400, endFreq: 400, q: 0.8, gain: 0.09 })
  }
  /** small bubbles near the next petiole */
  bubbles() {
    this.burst({ dur: 0.5, type: 'bandpass', freq: 1200, endFreq: 2400, q: 3.5, gain: 0.05, attack: 0.1 })
  }
  splashSmall() {
    this.burst({ dur: 0.3, type: 'highpass', freq: 900, endFreq: 2400, q: 0.7, gain: 0.09 })
  }
}
