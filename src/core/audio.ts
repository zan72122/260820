import { clamp, clamp01 } from './math'

/**
 * Every sound is synthesised at runtime: a quiet greenhouse bed, cord friction,
 * the click of a hook taking the load, and the low soft thump of a fruit
 * meeting netting. Nothing is loaded, nothing is licensed, and the whole thing
 * stays silent until the child's first touch unlocks audio.
 */
export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bedGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private unlocked = false
  private lastSlide = 0

  get ready(): boolean {
    return this.unlocked && this.ctx !== null
  }

  /** Must be called from inside a user gesture. */
  unlock(): void {
    if (this.unlocked) return
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    const ctx = this.ctx
    void ctx.resume()
    this.master = ctx.createGain()
    this.master.gain.value = 0.85
    this.master.connect(ctx.destination)

    // Noise source reused by every effect.
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2 + white * 0.25
    }
    this.noiseBuffer = buf

    // The room: a very low bed of air, filtered right down.
    const bed = ctx.createBufferSource()
    bed.buffer = buf
    bed.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    this.bedGain = ctx.createGain()
    this.bedGain.gain.value = 0.02
    bed.connect(lp).connect(this.bedGain).connect(this.master)
    bed.start()

    this.unlocked = true
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  private noise(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    return src
  }

  /** Cord dragging through the hand and over the bench. */
  cordSlide(intensity: number): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    if (now - this.lastSlide < 0.07) return
    this.lastSlide = now
    const amp = clamp01(intensity)
    if (amp < 0.02) return
    const src = this.noise()
    if (!src) return
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1700 + amp * 1500
    bp.Q.value = 1.1
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.05 * amp, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    src.connect(bp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.2)
  }

  /** A cord end dropping onto a hook. */
  hookClick(): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1150, now)
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.10, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.2)

    const src = this.noise()
    if (src) {
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 2600
      const ng = this.ctx.createGain()
      ng.gain.setValueAtTime(0.05, now)
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
      src.connect(hp).connect(ng).connect(this.master)
      src.start(now)
      src.stop(now + 0.1)
    }
  }

  /**
   * The catch. Low and soft: a body landing in fabric, a breath of air pushed
   * out of the mesh, and the cords taking up the load a moment later.
   */
  contact(intensity: number): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const amp = clamp(intensity, 0.2, 1)

    const body = this.ctx.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(96, now)
    body.frequency.exponentialRampToValueAtTime(52, now + 0.22)
    const bg = this.ctx.createGain()
    bg.gain.setValueAtTime(0.0001, now)
    bg.gain.exponentialRampToValueAtTime(0.19 * amp, now + 0.012)
    bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
    body.connect(bg).connect(this.master)
    body.start(now)
    body.stop(now + 0.5)

    const src = this.noise()
    if (src) {
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1500, now)
      lp.frequency.exponentialRampToValueAtTime(320, now + 0.3)
      const ng = this.ctx.createGain()
      ng.gain.setValueAtTime(0.0001, now)
      ng.gain.exponentialRampToValueAtTime(0.075 * amp, now + 0.018)
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
      src.connect(lp).connect(ng).connect(this.master)
      src.start(now)
      src.stop(now + 0.4)
    }

    // Cord creak, a beat late, as the net takes the weight.
    const creak = this.noise()
    if (creak) {
      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(520, now + 0.05)
      bp.frequency.linearRampToValueAtTime(340, now + 0.4)
      bp.Q.value = 3.5
      const cg = this.ctx.createGain()
      cg.gain.setValueAtTime(0.0001, now + 0.05)
      cg.gain.exponentialRampToValueAtTime(0.03 * amp, now + 0.1)
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
      creak.connect(bp).connect(cg).connect(this.master)
      creak.start(now + 0.05)
      creak.stop(now + 0.6)
    }
  }

  /** The net swinging under a fingertip. */
  sway(intensity: number): void {
    if (!this.ctx || !this.master) return
    const amp = clamp01(intensity)
    if (amp < 0.05) return
    const now = this.ctx.currentTime
    const src = this.noise()
    if (!src) return
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 620 + amp * 500
    bp.Q.value = 0.9
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.035 * amp, now + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)
    src.connect(bp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.42)
  }

  /** A soft mark each time the light moves and the skin colours a little. */
  timeTick(pitch: number): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 420 + pitch * 380
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.022, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  /** A harvested fruit set down on the bench. */
  woodKnock(): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(210, now)
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.12)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.1, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.3)
  }
}
