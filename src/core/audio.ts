/**
 * Every sound is synthesised — no asset downloads on a phone connection.
 * The palette stays material-led: cloth, metal, air, batter. Nothing arcade.
 */
export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private ambient: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null
  muted = false

  ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return true
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return false
    try {
      this.ctx = new AC()
    } catch {
      return false
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.75
    this.master.connect(this.ctx.destination)
    const len = Math.floor(this.ctx.sampleRate * 2)
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = w * 0.5 + last * 2
    }
    return true
  }

  get time() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.75
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur)
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.06, dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', bendTo?: number) {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (bendTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, bendTo), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  /** Spatula sweeping through batter. */
  fold(strength = 1) {
    this.noise(0.34, 420 + strength * 160, 1.1, 0.055 * strength, 'lowpass', 240)
  }
  /** Thick ribbon of batter landing in the pan. */
  pour(level = 1) {
    this.noise(0.22, 300 + level * 120, 2.2, 0.05, 'bandpass', 180)
    this.tone(110 + level * 40, 0.18, 0.03, 'sine', 70)
  }
  ovenDoor() {
    this.tone(78, 0.34, 0.15, 'sine', 44)
    this.noise(0.2, 900, 1.0, 0.06, 'lowpass')
  }
  /** Low, calm bake hum while the batter climbs. */
  startBakeAmbient() {
    if (!this.ctx || !this.master || !this.noiseBuf || this.ambient) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    filter.Q.value = 0.6
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 0.9)
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    this.ambient = { src, gain, filter }
  }
  stopBakeAmbient() {
    if (!this.ctx || !this.ambient) return
    const { src, gain } = this.ambient
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5)
    src.stop(this.ctx.currentTime + 0.6)
    this.ambient = null
  }
  /** Mitts closing on a hot pan: cloth first, then a dull metal note. */
  grip() {
    this.noise(0.26, 1500, 0.7, 0.05, 'lowpass')
    this.tone(300, 0.1, 0.02, 'triangle', 210)
  }
  /** Air and weight through the big turn. */
  flipWhoosh() {
    this.noise(0.85, 220, 0.9, 0.07, 'bandpass', 900)
  }
  flipSettle() {
    this.tone(92, 0.3, 0.1, 'sine', 58)
    this.noise(0.16, 1200, 1.2, 0.04, 'lowpass')
  }
  /** Central tube seating on the bottle neck. */
  clink() {
    this.tone(1650, 0.24, 0.06, 'sine', 1450)
    this.tone(2480, 0.16, 0.03, 'sine', 2300)
  }
  /** Palette knife travelling around the wall. */
  knife(speed: number) {
    this.noise(0.16, 1800 + speed * 900, 5.5, 0.03 + speed * 0.02, 'bandpass')
  }
  /** The pan letting go. */
  release() {
    this.noise(0.55, 700, 0.8, 0.07, 'lowpass', 300)
    this.tone(190, 0.35, 0.04, 'sine', 120)
  }
  /** Finger press into a cooled chiffon. */
  press() {
    this.tone(150, 0.16, 0.05, 'sine', 96)
    this.noise(0.12, 500, 1.0, 0.02, 'lowpass')
  }
  chime() {
    this.tone(880, 0.35, 0.05, 'sine')
    this.tone(1320, 0.45, 0.035, 'sine')
  }
  tick() {
    this.tone(660, 0.07, 0.03, 'sine')
  }
}
