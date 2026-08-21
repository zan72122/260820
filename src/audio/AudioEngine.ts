import type { LightingState } from '../core/Lighting'
import { lerp, Rng } from '../util/math'

/**
 * Everything is synthesised — no audio files, so the whole game is one small
 * static bundle that works offline.
 *
 * The rule the mix follows: the swing is the pulse. There is no continuous
 * soundtrack telling the child how to feel; the period of the swing and the tick
 * of the clock are the rhythm, and the evening chorus changes underneath them.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private ambientBus!: GainNode
  private noiseBuf!: AudioBuffer
  private started = false

  private birdGain!: GainNode
  private insectGain!: GainNode
  private murmurGain!: GainNode
  private droneGain!: GainNode
  private droneOscs: OscillatorNode[] = []

  private birdTimer = 0
  private insectTimer = 0
  private rng = new Rng(31337)

  /** Rising pentatonic used by the light-on chimes, so progress sounds like progress. */
  private scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]
  private chimeStep = 0

  get ready(): boolean {
    return this.started
  }

  /** Must be called from inside a user gesture on mobile. */
  async unlock(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
      return
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    await ctx.resume().catch(() => undefined)

    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.ambientBus = ctx.createGain()
    this.ambientBus.gain.value = 1
    this.ambientBus.connect(this.master)

    // one second of pink-ish noise, reused by everything that needs air
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57555 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16
    }
    this.noiseBuf = buf

    this.birdGain = this.bus(0)
    this.insectGain = this.bus(0)
    this.murmurGain = this.bus(0)

    // distant town: filtered noise, no detail, just presence
    const murmur = ctx.createBufferSource()
    murmur.buffer = buf
    murmur.loop = true
    const mf = ctx.createBiquadFilter()
    mf.type = 'lowpass'
    mf.frequency.value = 420
    mf.Q.value = 0.6
    const mf2 = ctx.createBiquadFilter()
    mf2.type = 'highpass'
    mf2.frequency.value = 90
    murmur.connect(mf).connect(mf2).connect(this.murmurGain)
    murmur.start()

    // barely-there drone: the swing's own resonance, keyed to the park
    this.droneGain = this.bus(0)
    for (const [f, g] of [
      [55, 0.5],
      [82.4, 0.28],
      [110, 0.18],
    ] as [number, number][]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const gg = ctx.createGain()
      gg.gain.value = g
      o.connect(gg).connect(this.droneGain)
      o.start()
      this.droneOscs.push(o)
    }

    this.started = true
  }

  private bus(v: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.value = v
    g.connect(this.ambientBus)
    return g
  }

  private noise(dur: number, when: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noiseBuf
    s.loop = true
    s.start(when)
    s.stop(when + dur + 0.05)
    return s
  }

  private env(when: number, attack: number, decay: number, peak: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
    return g
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    peak: number,
    type: OscillatorType = 'sine',
    detune = 0,
  ): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const g = this.env(when, 0.006, dur, peak)
    o.connect(g).connect(this.master)
    o.start(when)
    o.stop(when + dur + 0.1)
  }

  // ------------------------------------------------------------------ events

  /** Air rushing past at the bottom of the arc. First link in the audio chain. */
  bottomPass(speed01: number): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const s = this.noise(0.34, t)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(320, t)
    f.frequency.exponentialRampToValueAtTime(900 + speed01 * 800, t + 0.1)
    f.frequency.exponentialRampToValueAtTime(260, t + 0.34)
    f.Q.value = 0.9
    const g = this.env(t, 0.05, 0.3, 0.05 + speed01 * 0.16)
    s.connect(f).connect(g).connect(this.master)
  }

  /** Chain links taking the load, at the top of the arc. */
  chainCreak(amp01: number): void {
    if (!this.started || amp01 < 0.12) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const s = this.noise(0.2, t)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1400 + this.rng.range(-260, 320)
    f.Q.value = 6
    const g = this.env(t, 0.01, 0.18, 0.012 + amp01 * 0.035)
    s.connect(f).connect(g).connect(this.master)
  }

  /** The linkage taking up its slack, just before the tooth drops. */
  mechanism(delay = 0.05): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime + delay
    const s = this.noise(0.09, t)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 240
    f.Q.value = 3
    const g = this.env(t, 0.004, 0.08, 0.06)
    s.connect(f).connect(g).connect(this.master)
    this.tone(96, t, 0.07, 0.035, 'triangle')
  }

  /** The clock itself. One crisp click per tooth, never late. */
  click(teeth: number, delay = 0.15): void {
    if (!this.started) return
    const ctx = this.ctx!
    for (let i = 0; i < teeth; i++) {
      const t = ctx.currentTime + delay + i * 0.085
      const s = this.noise(0.05, t)
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2600 - i * 120
      f.Q.value = 9
      const g = this.env(t, 0.001, 0.042, 0.16)
      s.connect(f).connect(g).connect(this.master)
      // the metallic body of the click
      this.tone(1750 - i * 60, t, 0.05, 0.05, 'square')
      this.tone(560, t, 0.07, 0.03, 'triangle')
    }
  }

  /** The pawl lifting on the non-driving pass — softer, and nothing advances. */
  recock(delay = 0.02): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime + delay
    const s = this.noise(0.05, t)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1200
    f.Q.value = 5
    const g = this.env(t, 0.002, 0.045, 0.035)
    s.connect(f).connect(g).connect(this.master)
  }

  /** A lamp striking: a small ballast tick, then the note it adds to the chord. */
  lightOn(distance01: number, delay = 0.3): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime + delay
    // electrical tick
    const s = this.noise(0.04, t)
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 3200
    const g = this.env(t, 0.001, 0.035, 0.05 * (1 - distance01 * 0.5))
    s.connect(f).connect(g).connect(this.master)

    const semi = this.scale[Math.min(this.scale.length - 1, this.chimeStep)]
    this.chimeStep++
    const base = 293.66 // D4
    const freq = base * Math.pow(2, semi / 12)
    const vol = lerp(0.075, 0.03, distance01)
    this.tone(freq, t + 0.03, lerp(0.9, 2.0, distance01), vol, 'sine')
    this.tone(freq * 2, t + 0.03, 0.5, vol * 0.3, 'sine', 4)
  }

  /** The moon coming out — a wide, soft swell with no attack. */
  moonReveal(delay = 0.2): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime + delay
    for (const [mult, vol] of [
      [1, 0.05],
      [1.5, 0.03],
      [2.0, 0.022],
      [3.0, 0.012],
    ] as [number, number][]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 220 * mult
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 1.1)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2)
      o.connect(g).connect(this.master)
      o.start(t)
      o.stop(t + 4.4)
    }
  }

  /** One distant bell when the whole town comes up. Once, and never again. */
  bell(delay = 0.5): void {
    if (!this.started) return
    const ctx = this.ctx!
    const t = ctx.currentTime + delay
    const partials: [number, number, number][] = [
      [1.0, 0.075, 6.5],
      [2.0, 0.035, 4.2],
      [2.4, 0.028, 3.4],
      [3.0, 0.018, 2.6],
      [4.2, 0.012, 1.9],
      [5.4, 0.008, 1.3],
    ]
    for (const [mult, vol, dur] of partials) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 146.83 * mult
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      // a distant bell arrives softened by the whole valley
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1800
      o.connect(g).connect(lp).connect(this.master)
      o.start(t)
      o.stop(t + dur + 0.2)
    }
  }

  private chirp(now: number, high: boolean): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f0 = high ? this.rng.range(2600, 3600) : this.rng.range(1500, 2200)
    o.frequency.setValueAtTime(f0, now)
    o.frequency.exponentialRampToValueAtTime(f0 * this.rng.range(0.72, 1.5), now + 0.09)
    const g = this.env(now, 0.012, 0.1, 0.06)
    o.connect(g).connect(this.birdGain)
    o.start(now)
    o.stop(now + 0.22)
  }

  private cricket(now: number): void {
    const ctx = this.ctx!
    // a cricket is a short burst of pulses, not a tone
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.028
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = this.rng.range(4200, 5000)
      const g = this.env(t, 0.002, 0.016, 0.05)
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 4600
      f.Q.value = 12
      o.connect(f).connect(g).connect(this.insectGain)
      o.start(t)
      o.stop(t + 0.05)
    }
  }

  update(dt: number, L: LightingState, swingAmplitude: number): void {
    if (!this.started || !this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const ramp = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, now, 0.6)

    ramp(this.birdGain, L.birds * 0.5)
    ramp(this.insectGain, L.insects * 0.42)
    ramp(this.murmurGain, L.townMurmur * 0.16)
    ramp(this.droneGain, 0.012 + swingAmplitude * 0.03)

    this.birdTimer -= dt
    if (this.birdTimer <= 0 && L.birds > 0.05) {
      this.birdTimer = this.rng.range(0.5, 2.6) / Math.max(0.15, L.birds)
      const n = this.rng.int(1, 3)
      for (let i = 0; i < n; i++) this.chirp(now + i * this.rng.range(0.08, 0.2), this.rng.next() > 0.5)
    }

    this.insectTimer -= dt
    if (this.insectTimer <= 0 && L.insects > 0.03) {
      this.insectTimer = this.rng.range(0.12, 0.7) / Math.max(0.1, L.insects)
      this.cricket(now)
    }
  }

  setMuted(m: boolean): void {
    if (!this.started) return
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx!.currentTime, 0.15)
  }

  resetChimes(): void {
    this.chimeStep = 0
  }

  suspend(): void {
    void this.ctx?.suspend()
  }

  resume(): void {
    void this.ctx?.resume()
  }
}
