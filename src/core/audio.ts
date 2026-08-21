import { clamp01, lerp } from './math'

type Ctor = typeof AudioContext

function getContextCtor(): Ctor | null {
  const w = window as Window & { webkitAudioContext?: Ctor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    // Light low-pass gives brown-ish noise: closer to rolling and wind than hiss.
    last = (last + 0.035 * white) / 1.035
    d[i] = last * 3.2
  }
  return buf
}

/**
 * All continuous voices are built once and kept alive; one-shots come from a
 * small fixed pool. Nothing allocates per frame.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null

  private rollerGain: GainNode | null = null
  private rollerFilter: BiquadFilterNode | null = null
  private genGain: GainNode | null = null
  private genOsc: OscillatorNode | null = null
  private windGain: GainNode | null = null
  private ready = false

  private lastCricket = 0

  /** Must be called from inside a user gesture: iOS will not start audio otherwise. */
  async unlock(): Promise<void> {
    if (this.ready) {
      await this.ctx?.resume()
      return
    }
    const Ctor = getContextCtor()
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    await ctx.resume().catch(() => undefined)

    const master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)
    this.master = master
    master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.4)

    this.noise = makeNoiseBuffer(ctx, 3)

    // --- evening air ---------------------------------------------------
    const wind = ctx.createBufferSource()
    wind.buffer = this.noise
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 340
    const windGain = ctx.createGain()
    windGain.gain.value = 0.05
    wind.connect(windFilter).connect(windGain).connect(master)
    wind.start()
    this.windGain = windGain

    // --- rolling resin on steel axles -----------------------------------
    const roll = ctx.createBufferSource()
    roll.buffer = this.noise
    roll.loop = true
    const rollFilter = ctx.createBiquadFilter()
    rollFilter.type = 'bandpass'
    rollFilter.frequency.value = 240
    rollFilter.Q.value = 0.9
    const rollGain = ctx.createGain()
    rollGain.gain.value = 0
    roll.connect(rollFilter).connect(rollGain).connect(master)
    roll.start()
    this.rollerGain = rollGain
    this.rollerFilter = rollFilter

    // --- generator whine -------------------------------------------------
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 60
    const oscFilter = ctx.createBiquadFilter()
    oscFilter.type = 'lowpass'
    oscFilter.frequency.value = 900
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0
    osc.connect(oscFilter).connect(oscGain).connect(master)
    osc.start()
    this.genOsc = osc
    this.genGain = oscGain

    this.ready = true
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => undefined)
  }

  resume(): void {
    void this.ctx?.resume().catch(() => undefined)
  }

  /** `speed` is a 0..1 normalised roller surface speed. */
  setRollerNoise(speed: number, dt: number): void {
    if (!this.ready || !this.rollerGain || !this.rollerFilter || !this.ctx) return
    const s = clamp01(speed)
    const t = this.ctx.currentTime
    this.rollerGain.gain.setTargetAtTime(s * 0.3, t, Math.max(0.02, dt * 2))
    this.rollerFilter.frequency.setTargetAtTime(lerp(150, 620, s), t, 0.08)
  }

  /** `load` is a 0..1 normalised generator shaft speed. */
  setGenerator(load: number): void {
    if (!this.ready || !this.genGain || !this.genOsc || !this.ctx) return
    const s = clamp01(load)
    const t = this.ctx.currentTime
    this.genGain.gain.setTargetAtTime(s * 0.028, t, 0.09)
    this.genOsc.frequency.setTargetAtTime(lerp(48, 205, s), t, 0.12)
  }

  setWind(level: number): void {
    if (!this.ready || !this.windGain || !this.ctx) return
    this.windGain.gain.setTargetAtTime(clamp01(level) * 0.07, this.ctx.currentTime, 0.6)
  }

  /** The relay in the distribution box closing: a dry mechanical snap. */
  relayClick(): void {
    const ctx = this.ctx
    if (!this.ready || !ctx || !this.master || !this.noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 1.6
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 2100
    f.Q.value = 3.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 2)
    src.stop(t + 0.09)
  }

  /** A filament warming inside a diffuser: a soft upward swell, never a chime. */
  lampSwell(pitch = 1): void {
    const ctx = this.ctx
    if (!this.ready || !ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(184 * pitch, t)
    osc.frequency.exponentialRampToValueAtTime(268 * pitch, t + 0.42)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.16)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 1.0)
  }

  /** Throwing a selector lever over centre. */
  leverThrow(): void {
    const ctx = this.ctx
    if (!this.ready || !ctx || !this.master || !this.noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.85
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 420
    f.Q.value = 1.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 2)
    src.stop(t + 0.24)
  }

  footstep(): void {
    const ctx = this.ctx
    if (!this.ready || !ctx || !this.master || !this.noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.6 + Math.random() * 0.25
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 620
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 2)
    src.stop(t + 0.16)
  }

  /** Occasional distant cricket so the park is never acoustically dead. */
  tickAmbience(dt: number): void {
    if (!this.ready || !this.ctx || !this.master) return
    this.lastCricket -= dt
    if (this.lastCricket > 0) return
    this.lastCricket = 2.6 + Math.random() * 5.5
    const ctx = this.ctx
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 3900 + Math.random() * 700
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.075
      g.gain.setValueAtTime(0.0001, s)
      g.gain.exponentialRampToValueAtTime(0.012, s + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.05)
    }
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.3)
  }
}
