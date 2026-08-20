/**
 * All sound is synthesised - no files, no voice-over. Nothing here ever names
 * the solution; it is summer air, paper, fabric and soil.
 */

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private wind: AudioBufferSourceNode | null = null
  private windGain: GainNode | null = null
  private cicada: OscillatorNode[] = []
  private lastRustle = 0
  private started = false
  enabled = true

  /** Must be called from a real user gesture. */
  start(): void {
    if (this.started || !this.enabled) return
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      this.enabled = false
      return
    }
    this.started = true
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.0
    this.master.connect(ctx.destination)
    this.master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5)

    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf

    // Wind bed.
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const g = ctx.createGain()
    g.gain.value = 0.07
    src.connect(lp).connect(g).connect(this.master)
    src.start()
    this.wind = src
    this.windGain = g

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.09
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.045
    lfo.connect(lfoGain).connect(g.gain)
    lfo.start()

    // Cicadas, distant.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = 3200 + i * 640
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 9
      bp.frequency.value = osc.frequency.value
      const am = ctx.createGain()
      am.gain.value = 0.0
      const trem = ctx.createOscillator()
      trem.type = 'sine'
      trem.frequency.value = 22 + i * 5
      const tremGain = ctx.createGain()
      tremGain.gain.value = 0.0035
      trem.connect(tremGain).connect(am.gain)
      osc.connect(bp).connect(am).connect(this.master)
      osc.start()
      trem.start()
      this.cicada.push(osc)
    }
    this.resume()
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  private burst(freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx
    if (!ctx || !this.noise || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.7 + Math.random() * 0.6
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    const now = ctx.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(gain, now + dur * 0.18)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + dur + 0.05)
  }

  /** Paper being worked between fingers. */
  paper(intensity: number): void {
    const now = performance.now()
    if (now - this.lastRustle < 55) return
    this.lastRustle = now
    this.burst(2100 + Math.random() * 1500, 1.6, 0.13, 0.05 + intensity * 0.11)
  }

  /** Woven sheet dragging over soil. */
  drag(intensity: number): void {
    const now = performance.now()
    if (now - this.lastRustle < 70) return
    this.lastRustle = now
    this.burst(700 + Math.random() * 500, 1.1, 0.2, 0.04 + intensity * 0.1)
  }

  thud(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const g = ctx.createGain()
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.18)
    g.gain.setValueAtTime(0.16, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.35)
    this.burst(420, 0.8, 0.12, 0.05, 'lowpass')
  }

  /** A breath of warm air when the light first comes back up. No words. */
  shimmer(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    for (const [f, gain, delay] of [
      [523.25, 0.035, 0],
      [783.99, 0.024, 0.09],
      [1046.5, 0.016, 0.2],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, now + delay)
      g.gain.linearRampToValueAtTime(gain, now + delay + 0.35)
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 2.2)
      osc.connect(g).connect(this.master)
      osc.start(now + delay)
      osc.stop(now + delay + 2.4)
    }
  }

  /** Fingertip on fruit skin: almost nothing, which is the point. */
  touchFruit(): void {
    this.burst(3600, 3, 0.07, 0.028)
  }

  breeze(strength: number): void {
    if (!this.windGain || !this.ctx) return
    const now = this.ctx.currentTime
    this.windGain.gain.cancelScheduledValues(now)
    this.windGain.gain.setValueAtTime(this.windGain.gain.value, now)
    this.windGain.gain.linearRampToValueAtTime(0.07 + strength * 0.09, now + 0.6)
    this.windGain.gain.linearRampToValueAtTime(0.07, now + 2.4)
  }

  dispose(): void {
    try {
      this.wind?.stop()
      for (const o of this.cicada) o.stop()
      void this.ctx?.close()
    } catch {
      /* nothing to do */
    }
    this.ctx = null
    this.started = false
  }
}
