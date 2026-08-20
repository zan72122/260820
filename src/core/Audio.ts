/**
 * Every sound in the game is synthesised — there is nothing to download, and
 * nothing needs a loading screen. The mix is deliberately environmental:
 * running water underneath everything, distant cicadas, and small, precise
 * sounds for the things the player causes.
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private streamPan: StereoPannerNode | null = null
  private streamGain: GainNode | null = null
  private chimeAt = 0
  private started = false

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  get time(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** Must be called from inside a user gesture (iOS Safari requirement). */
  unlock(): void {
    if (this.started) {
      this.ctx?.resume()
      return
    }
    this.started = true
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime)
    this.master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 2.0)
    this.master.connect(ctx.destination)

    // 2 seconds of white noise, reused by every noise-based voice.
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = w * 0.55 + last * 3.2
      }
    }
    this.noise = buf

    this.buildStream()
    this.buildCicadas()
    ctx.resume()
  }

  private src(loop = true): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = loop
    return s
  }

  // ---- ambience ---------------------------------------------------------

  private buildStream(): void {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.20
    this.streamGain = out
    const pan = ctx.createStereoPanner()
    pan.pan.value = -0.2
    this.streamPan = pan
    out.connect(pan).connect(this.master!)

    // Two bands: the low rush of moving water and the bright trickle on top.
    const bands: [number, number, number][] = [
      [420, 0.9, 0.55],
      [1600, 1.4, 0.40],
      [3800, 2.2, 0.16],
    ]
    for (const [freq, q, g] of bands) {
      const s = this.src()
      if (!s) return
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = freq
      bp.Q.value = q
      const gn = ctx.createGain()
      gn.gain.value = g
      // Slow wandering so it never sounds like a static hiss.
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07 + Math.random() * 0.16
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = freq * 0.16
      lfo.connect(lfoGain).connect(bp.frequency)
      lfo.start()
      s.connect(bp).connect(gn).connect(out)
      s.start()
    }
  }

  private buildCicadas(): void {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.030
    const pan = ctx.createStereoPanner()
    pan.pan.value = 0.55
    out.connect(pan).connect(this.master!)

    const s = this.src()
    if (!s) return
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 4300
    bp.Q.value = 6
    const am = ctx.createGain()
    am.gain.value = 0.0
    // The rasp: fast amplitude modulation is what makes it read as a cicada.
    const buzz = ctx.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 47
    const buzzGain = ctx.createGain()
    buzzGain.gain.value = 0.5
    buzz.connect(buzzGain).connect(am.gain)
    const bias = ctx.createConstantSource()
    bias.offset.value = 0.5
    bias.connect(am.gain)
    // Long swells, as if the chorus rises and falls across the garden.
    const swell = ctx.createOscillator()
    swell.frequency.value = 0.043
    const swellGain = ctx.createGain()
    swellGain.gain.value = 0.45
    const swellOut = ctx.createGain()
    swellOut.gain.value = 0.55
    swell.connect(swellGain).connect(swellOut.gain)

    s.connect(bp).connect(am).connect(swellOut).connect(out)
    s.start()
    buzz.start()
    bias.start()
    swell.start()

    // A second, more distant voice a little detuned.
    const s2 = this.src()
    if (s2) {
      const bp2 = ctx.createBiquadFilter()
      bp2.type = 'bandpass'
      bp2.frequency.value = 5600
      bp2.Q.value = 9
      const g2 = ctx.createGain()
      g2.gain.value = 0.35
      const pan2 = ctx.createStereoPanner()
      pan2.pan.value = -0.7
      s2.connect(bp2).connect(g2).connect(pan2).connect(out)
      s2.start()
    }
  }

  /** Keep the stream sitting where the flume actually is on screen. */
  setStreamPan(p: number): void {
    if (this.streamPan) this.streamPan.pan.value = Math.max(-1, Math.min(1, p))
  }

  setStreamIntensity(v: number): void {
    if (this.streamGain && this.ctx) {
      this.streamGain.gain.setTargetAtTime(0.20 * v, this.ctx.currentTime, 0.25)
    }
  }

  // ---- one-shots --------------------------------------------------------

  private burst(
    freq: number,
    q: number,
    gain: number,
    attack: number,
    decay: number,
    pan = 0,
    sweepTo?: number,
  ): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const s = this.src(false)
    if (!s) return
    s.playbackRate.value = 0.8 + Math.random() * 0.4
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(freq, t)
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + decay)
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    s.connect(bp).connect(g).connect(p).connect(this.master)
    s.start(t, Math.random() * 1.5)
    s.stop(t + attack + decay + 0.05)
  }

  private tone(
    f0: number,
    f1: number,
    gain: number,
    dur: number,
    type: OscillatorType = 'sine',
    pan = 0,
  ): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    o.connect(g).connect(p).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  /** The water changing note as a bundle rides over a culm node. */
  nodePass(pan = 0, strength = 1): void {
    this.burst(1500, 1.6, 0.07 * strength, 0.012, 0.16, pan, 620)
  }

  /** The tips breaking the surface. */
  dip(pan = 0): void {
    this.burst(1100, 1.1, 0.055, 0.012, 0.13, pan, 2400)
  }

  /** Lacquer on bamboo. */
  chopstickTick(pan = 0): void {
    this.burst(2300, 12, 0.055, 0.002, 0.045, pan)
    this.burst(3900, 16, 0.030, 0.002, 0.030, pan)
  }

  /** The moment the bundle breaks the surface. */
  lift(pan = 0): void {
    this.burst(900, 1.0, 0.10, 0.05, 0.42, pan, 2600)
    this.burst(2600, 2.5, 0.05, 0.08, 0.30, pan)
  }

  drip(pan = 0): void {
    this.tone(760 + Math.random() * 300, 1900, 0.055, 0.075, 'sine', pan)
    this.burst(3400, 8, 0.018, 0.002, 0.03, pan)
  }

  /** Into the tsuyu: the small, satisfying "chapun". */
  chapun(pan = 0): void {
    this.tone(230, 620, 0.13, 0.16, 'sine', pan)
    this.burst(1200, 1.2, 0.12, 0.008, 0.20, pan, 400)
    this.burst(3000, 3, 0.05, 0.004, 0.09, pan)
  }

  /** A wind bell somewhere on the veranda. Rare, and always quiet. */
  maybeChime(now: number): void {
    if (!this.ctx || now - this.chimeAt < 9) return
    if (Math.random() > 0.16) {
      this.chimeAt = now - 6
      return
    }
    this.chimeAt = now
    const ctx = this.ctx
    const t = ctx.currentTime
    const base = 1750 + Math.random() * 500
    for (let i = 0; i < 2; i++) {
      const car = ctx.createOscillator()
      car.frequency.value = base * (i === 0 ? 1 : 2.76)
      const mod = ctx.createOscillator()
      mod.frequency.value = base * 3.4
      const modGain = ctx.createGain()
      modGain.gain.setValueAtTime(base * 1.1, t)
      modGain.gain.exponentialRampToValueAtTime(1, t + 0.4)
      mod.connect(modGain).connect(car.frequency)
      const g = ctx.createGain()
      const start = t + i * 0.09
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.035 / (i + 1), start + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.4)
      const p = ctx.createStereoPanner()
      p.pan.value = -0.6
      car.connect(g).connect(p).connect(this.master!)
      car.start(start)
      mod.start(start)
      car.stop(start + 2.6)
      mod.stop(start + 2.6)
    }
  }
}
