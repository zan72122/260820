/**
 * Everything is synthesised: no audio files to download, and the mix stays small
 * enough that the spill never turns into an explosion. Sound is decoration only —
 * the picture alone carries the causality at zero volume.
 */
export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = 0
  private lastTick = 0
  private rattleGain: GainNode | null = null
  private spreadGain: GainNode | null = null

  get enabled() {
    return !!this.ctx
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 8
    comp.attack.value = 0.004
    comp.release.value = 0.16
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.62
    this.master.connect(comp)
    comp.connect(this.ctx.destination)

    const len = Math.floor(this.ctx.sampleRate * 1.2)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private get t() {
    return this.ctx!.currentTime
  }

  private budget() {
    if (!this.ctx || !this.master) return false
    if (this.voices > 18) return false
    this.voices++
    setTimeout(() => this.voices--, 400)
    return true
  }

  private noiseSource(playbackRate = 1) {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.playbackRate.value = playbackRate
    return src
  }

  /** Soft, weighty thump: a sponge layer meeting the one below. */
  thud(strength = 1) {
    if (!this.budget()) return
    const t = this.t
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    g.connect(this.master!)

    const osc = this.ctx!.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150 * strength, t)
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.22)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.32)

    const n = this.noiseSource(0.6)
    const f = this.ctx!.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 520
    const ng = this.ctx!.createGain()
    ng.gain.setValueAtTime(0.24 * strength, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    n.connect(f)
    f.connect(ng)
    ng.connect(this.master!)
    n.start(t)
    n.stop(t + 0.2)
  }

  /** Small bright click — one candy landing. Rate limited by design. */
  tick(vel = 1, pitch = 1) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (now - this.lastTick < 0.018) return
    this.lastTick = now
    if (!this.budget()) return
    const t = now
    const n = this.noiseSource(1)
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1800 * pitch + Math.random() * 1400
    f.Q.value = 4.5
    const g = this.ctx.createGain()
    const amp = Math.min(0.3, 0.05 + vel * 0.16)
    g.gain.setValueAtTime(amp, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    n.connect(f)
    f.connect(g)
    g.connect(this.master!)
    n.start(t)
    n.stop(t + 0.06)
  }

  /** Continuous candy-in-bowl shuffle while pouring. */
  rattle(on: boolean) {
    if (!this.ctx) return
    if (on && !this.rattleGain) {
      const t = this.t
      const n = this.noiseSource(0.9)
      const f = this.ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2600
      f.Q.value = 1.1
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.075, t + 0.1)
      n.connect(f)
      f.connect(g)
      g.connect(this.master!)
      n.start(t)
      this.rattleGain = g
      ;(g as unknown as { __src: AudioBufferSourceNode }).__src = n
    } else if (!on && this.rattleGain) {
      const g = this.rattleGain
      this.rattleGain = null
      const t = this.t
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0.0001, t + 0.14)
      const src = (g as unknown as { __src: AudioBufferSourceNode }).__src
      setTimeout(() => {
        try {
          src.stop()
        } catch {
          /* already stopped */
        }
      }, 220)
    }
  }

  /** Buttercream being pushed around by the spatula. */
  spread(on: boolean) {
    if (!this.ctx) return
    if (on && !this.spreadGain) {
      const t = this.t
      const n = this.noiseSource(0.35)
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 900
      const f2 = this.ctx.createBiquadFilter()
      f2.type = 'highpass'
      f2.frequency.value = 180
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.08)
      n.connect(f)
      f.connect(f2)
      f2.connect(g)
      g.connect(this.master!)
      n.start(t)
      this.spreadGain = g
      ;(g as unknown as { __src: AudioBufferSourceNode }).__src = n
    } else if (!on && this.spreadGain) {
      const g = this.spreadGain
      this.spreadGain = null
      const t = this.t
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0.0001, t + 0.12)
      const src = (g as unknown as { __src: AudioBufferSourceNode }).__src
      setTimeout(() => {
        try {
          src.stop()
        } catch {
          /* already stopped */
        }
      }, 200)
    }
  }

  /** Steel entering sponge: a short metal ring plus a dry crumb hiss. */
  knife() {
    if (!this.budget()) return
    const t = this.t
    const n = this.noiseSource(1.1)
    const f = this.ctx!.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(4200, t)
    f.frequency.exponentialRampToValueAtTime(700, t + 0.42)
    f.Q.value = 2.4
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.2, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    n.connect(f)
    f.connect(g)
    g.connect(this.master!)
    n.start(t)
    n.stop(t + 0.55)

    const osc = this.ctx!.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(2100, t)
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.3)
    const og = this.ctx!.createGain()
    og.gain.setValueAtTime(0.06, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    osc.connect(og)
    og.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.36)
  }

  /** Warm two-note sparkle for the finish. */
  chime() {
    if (!this.ctx || !this.master) return
    const base = [784, 1046.5, 1318.5]
    base.forEach((hz, i) => {
      const t = this.t + i * 0.09
      const osc = this.ctx!.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = hz
      const g = this.ctx!.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85)
      osc.connect(g)
      g.connect(this.master!)
      osc.start(t)
      osc.stop(t + 0.9)
    })
  }

  /** Light confirmation blip. */
  pop() {
    if (!this.budget()) return
    const t = this.t
    const osc = this.ctx!.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(540, t)
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1)
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.connect(g)
    g.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.22)
  }

  stopLoops() {
    this.rattle(false)
    this.spread(false)
  }
}
