/* ------------------------------------------------------------------ *
 * Every sound is synthesised — no assets, no downloads.  The context is
 * only created inside a real user gesture so iOS lets it run.
 * ------------------------------------------------------------------ */

type Ctx = AudioContext & { resume(): Promise<void> }

export class GameAudio {
  private ctx: Ctx | null = null
  private master!: GainNode
  private engineGain!: GainNode
  private enginePitch: OscillatorNode[] = []
  private cutGain!: GainNode
  private pourGain!: GainNode
  private pourFilter!: BiquadFilterNode
  private threshGain!: GainNode
  private noiseBuf!: AudioBuffer
  private started = false
  private muted = false

  get ready() {
    return this.started
  }

  start() {
    if (this.started) return
    const AC: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext
    if (!AC) return
    try {
      this.ctx = new AC() as Ctx
    } catch {
      return
    }
    const ctx = this.ctx
    this.started = true

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.85
    this.master.connect(ctx.destination)

    // shared white noise
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    /* ---- diesel engine: two detuned saws plus lopassed rumble ---- */
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    const engFilter = ctx.createBiquadFilter()
    engFilter.type = 'lowpass'
    engFilter.frequency.value = 340
    engFilter.Q.value = 3
    this.engineGain.connect(engFilter).connect(this.master)
    for (const [f, g] of [
      [37, 0.5],
      [55.5, 0.3],
      [111, 0.12],
    ]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og).connect(this.engineGain)
      o.start()
      this.enginePitch.push(o)
    }
    const engNoise = ctx.createBufferSource()
    engNoise.buffer = buf
    engNoise.loop = true
    const engNoiseF = ctx.createBiquadFilter()
    engNoiseF.type = 'lowpass'
    engNoiseF.frequency.value = 220
    const engNoiseG = ctx.createGain()
    engNoiseG.gain.value = 0.55
    engNoise.connect(engNoiseF).connect(engNoiseG).connect(this.engineGain)
    engNoise.start()

    /* ---- cutting rustle: bandpassed noise ---- */
    this.cutGain = ctx.createGain()
    this.cutGain.gain.value = 0
    const cutSrc = ctx.createBufferSource()
    cutSrc.buffer = buf
    cutSrc.loop = true
    const cutF = ctx.createBiquadFilter()
    cutF.type = 'bandpass'
    cutF.frequency.value = 2600
    cutF.Q.value = 0.7
    const cutHi = ctx.createBiquadFilter()
    cutHi.type = 'highpass'
    cutHi.frequency.value = 900
    cutSrc.connect(cutF).connect(cutHi).connect(this.cutGain).connect(this.master)
    cutSrc.start()

    /* ---- threshing drum whir, heard during the cut-away ---- */
    this.threshGain = ctx.createGain()
    this.threshGain.gain.value = 0
    const th = ctx.createOscillator()
    th.type = 'square'
    th.frequency.value = 96
    const thF = ctx.createBiquadFilter()
    thF.type = 'bandpass'
    thF.frequency.value = 420
    thF.Q.value = 2.2
    th.connect(thF).connect(this.threshGain).connect(this.master)
    th.start()

    /* ---- the pour: broad noise, "zaaa" ---- */
    this.pourGain = ctx.createGain()
    this.pourGain.gain.value = 0
    const pourSrc = ctx.createBufferSource()
    pourSrc.buffer = buf
    pourSrc.loop = true
    this.pourFilter = ctx.createBiquadFilter()
    this.pourFilter.type = 'bandpass'
    this.pourFilter.frequency.value = 1500
    this.pourFilter.Q.value = 0.45
    const pourHi = ctx.createBiquadFilter()
    pourHi.type = 'highpass'
    pourHi.frequency.value = 420
    pourSrc.connect(this.pourFilter).connect(pourHi).connect(this.pourGain).connect(this.master)
    pourSrc.start()

    void ctx.resume()
  }

  private ramp(p: AudioParam, v: number, t = 0.12) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    p.cancelScheduledValues(now)
    p.setTargetAtTime(v, now, Math.max(0.01, t / 3))
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.ramp(this.master.gain, m ? 0 : 0.85, 0.15)
  }

  setEngine(load: number, running: boolean) {
    if (!this.ctx) return
    this.ramp(this.engineGain.gain, running ? 0.05 + load * 0.07 : 0, 0.35)
    const base = 37 * (1 + load * 0.22)
    this.enginePitch.forEach((o, i) => this.ramp(o.frequency, base * [1, 1.5, 3][i], 0.4))
  }

  setCut(v: number) {
    if (!this.ctx) return
    this.ramp(this.cutGain.gain, Math.min(1, v) * 0.13, 0.18)
  }

  setThresh(v: number) {
    if (!this.ctx) return
    this.ramp(this.threshGain.gain, Math.min(1, v) * 0.045, 0.3)
  }

  setPour(v: number) {
    if (!this.ctx) return
    this.ramp(this.pourGain.gain, Math.min(1, v) * 0.3, 0.12)
    this.ramp(this.pourFilter.frequency, 900 + Math.min(1, v) * 1800, 0.3)
  }

  private blipAt(freq: number, dur: number, type: OscillatorType, gain: number, slide = 1) {
    const ctx = this.ctx
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = type
    const g = ctx.createGain()
    const now = ctx.currentTime
    o.frequency.setValueAtTime(freq, now)
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), now + dur)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    o.connect(g).connect(this.master)
    o.start(now)
    o.stop(now + dur + 0.02)
  }

  blip() {
    this.blipAt(660, 0.11, 'triangle', 0.16, 1.5)
  }

  clunk() {
    this.blipAt(150, 0.2, 'square', 0.13, 0.55)
    const ctx = this.ctx
    if (!ctx) return
    const s = ctx.createBufferSource()
    s.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 700
    const g = ctx.createGain()
    const now = ctx.currentTime
    g.gain.setValueAtTime(0.18, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    s.connect(f).connect(g).connect(this.master)
    s.start(now)
    s.stop(now + 0.25)
  }

  chime(step = 0) {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    this.blipAt(notes[step % notes.length], 0.34, 'sine', 0.14, 1.0)
    this.blipAt(notes[step % notes.length] * 2, 0.22, 'triangle', 0.05, 1.0)
  }

  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((n, i) => {
      window.setTimeout(() => this.blipAt(n, 0.42, 'triangle', 0.13, 1.0), i * 135)
    })
  }
}
