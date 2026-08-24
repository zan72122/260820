// Procedural WebAudio: crane motor, hydraulic whine, warning pips, wire
// tension creaks, the low seating "thunk", sling-release clinks, light wind.
// No music — the weight of the machinery carries the soundscape.

export class GameAudio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private motorOsc!: OscillatorNode
  private motorOsc2!: OscillatorNode
  private motorGain!: GainNode
  private motorFilter!: BiquadFilterNode
  private windGain!: GainNode
  private beepGain!: GainNode
  private beepOsc!: OscillatorNode
  private beepTimer = 0
  private creakTimer = 0
  private noiseBuf!: AudioBuffer

  get started() { return !!this.ctx }

  start() {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.85
    this.master.connect(ctx.destination)

    // shared noise buffer
    const len = ctx.sampleRate * 2
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    let seed = 22
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = (seed / 2147483647) * 2 - 1
    }

    // wind ambience
    const wind = ctx.createBufferSource()
    wind.buffer = this.noiseBuf; wind.loop = true
    const windF = ctx.createBiquadFilter()
    windF.type = 'lowpass'; windF.frequency.value = 320; windF.Q.value = 0.4
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.018
    wind.connect(windF).connect(this.windGain).connect(this.master)
    wind.start()

    // crane hoist motor: detuned saws through a lowpass
    this.motorOsc = ctx.createOscillator(); this.motorOsc.type = 'sawtooth'
    this.motorOsc2 = ctx.createOscillator(); this.motorOsc2.type = 'sawtooth'
    this.motorFilter = ctx.createBiquadFilter()
    this.motorFilter.type = 'lowpass'; this.motorFilter.frequency.value = 260; this.motorFilter.Q.value = 2.5
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0
    this.motorOsc.connect(this.motorFilter)
    this.motorOsc2.connect(this.motorFilter)
    this.motorFilter.connect(this.motorGain).connect(this.master)
    this.motorOsc.frequency.value = 55
    this.motorOsc2.frequency.value = 55.8
    this.motorOsc.start(); this.motorOsc2.start()

    // crane warning pips
    this.beepOsc = ctx.createOscillator(); this.beepOsc.type = 'sine'
    this.beepOsc.frequency.value = 815
    this.beepGain = ctx.createGain(); this.beepGain.gain.value = 0
    this.beepOsc.connect(this.beepGain).connect(this.master)
    this.beepOsc.start()
  }

  // Continuous update: motorLevel 0..1 (winch/traverse speed), moving flag for pips.
  update(dt: number, motorLevel: number, moving: boolean, tension: number, tensionRate: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const g = Math.min(0.16, motorLevel * 0.19) + (motorLevel > 0.01 ? 0.015 : 0)
    this.motorGain.gain.setTargetAtTime(g, t, 0.09)
    const f = 46 + motorLevel * 70 + tension * 12
    this.motorOsc.frequency.setTargetAtTime(f, t, 0.12)
    this.motorOsc2.frequency.setTargetAtTime(f * 1.012, t, 0.12)
    this.motorFilter.frequency.setTargetAtTime(200 + motorLevel * 420, t, 0.1)

    // warning pips while anything moves
    if (moving) {
      this.beepTimer -= dt
      if (this.beepTimer <= 0) {
        this.beepTimer = 1.05
        this.beepGain.gain.cancelScheduledValues(t)
        this.beepGain.gain.setValueAtTime(0.035, t)
        this.beepGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      }
    }

    // wire creaks when tension changes
    this.creakTimer -= dt
    if (Math.abs(tensionRate) > 0.25 && this.creakTimer <= 0) {
      this.creakTimer = 0.28 + Math.random() * 0.5
      this.creak(0.5 + Math.min(0.5, Math.abs(tensionRate) * 0.4))
    }
  }

  private burst(freq: number, q: number, gain: number, dur: number) {
    if (!this.ctx) return
    const ctx = this.ctx, t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.9 + Math.random() * 0.25
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q
    const gn = ctx.createGain()
    gn.gain.setValueAtTime(gain, t)
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(gn).connect(this.master)
    src.start(t, Math.random() * 1.2, dur + 0.05)
  }

  creak(amount: number) { this.burst(900 + Math.random() * 900, 9, 0.02 * amount, 0.16) }

  liftoff() {
    // wires singing as the full weight comes on
    this.creak(1)
    setTimeout(() => this.creak(0.7), 140)
    this.burst(300, 3, 0.03, 0.5)
  }

  // Low, rounded "koton" — a huge mass meeting its supports, not an explosion.
  contact(impact: number) {
    if (!this.ctx) return
    const ctx = this.ctx, t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(64, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4)
    const gn = ctx.createGain()
    const amp = Math.min(0.5, 0.24 + impact * 0.5)
    gn.gain.setValueAtTime(amp, t)
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.75)
    o.connect(gn).connect(this.master)
    o.start(t); o.stop(t + 0.8)
    this.burst(140, 1.4, 0.06, 0.3)
    // small metallic rattle right after (wires easing)
    setTimeout(() => this.clink(0.4), 260)
  }

  clink(amount: number) {
    if (!this.ctx) return
    const ctx = this.ctx, t = ctx.currentTime
    const car = ctx.createOscillator(); car.type = 'sine'
    const mod = ctx.createOscillator(); mod.type = 'sine'
    const mg = ctx.createGain()
    car.frequency.value = 1750 + Math.random() * 500
    mod.frequency.value = 620
    mg.gain.value = 900
    mod.connect(mg).connect(car.frequency)
    const gn = ctx.createGain()
    gn.gain.setValueAtTime(0.028 * amount, t)
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    car.connect(gn).connect(this.master)
    car.start(t); mod.start(t)
    car.stop(t + 0.32); mod.stop(t + 0.32)
  }

  detach() {
    this.clink(1)
    setTimeout(() => this.clink(0.6), 200)
    setTimeout(() => this.clink(0.35), 430)
  }

  couple() {
    this.burst(220, 2, 0.05, 0.25)
    this.clink(0.5)
  }
}
