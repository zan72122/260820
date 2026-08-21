import * as THREE from 'three';

/**
 * Everything is synthesised — no asset downloads — and everything is placed in
 * space, so the sound of water climbing the riser genuinely travels past the
 * camera and comes out overhead.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private started = false;

  private motorOsc?: OscillatorNode;
  private motorSub?: OscillatorNode;
  private motorGain?: GainNode;
  private motorFilter?: BiquadFilterNode;
  private motorPan?: PannerNode;

  private riserSrc?: AudioBufferSourceNode;
  private riserFilter?: BiquadFilterNode;
  private riserGain?: GainNode;
  private riserPan?: PannerNode;

  private gushSrc?: AudioBufferSourceNode;
  private gushFilter?: BiquadFilterNode;
  private gushGain?: GainNode;
  private gushPan?: PannerNode;

  private basinSrc?: AudioBufferSourceNode;
  private basinGain?: GainNode;
  private basinPan?: PannerNode;

  private roomGain?: GainNode;

  get ready() {
    return this.started;
  }

  async start() {
    if (this.started) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.4);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w; // a little brown in the white, so it reads as air not static
      d[i] = w * 0.55 + b * 1.6;
    }

    // room tone: extractor fans and distant plant
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = this.noise;
    roomSrc.loop = true;
    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 320;
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0.055;
    roomSrc.connect(roomFilter).connect(this.roomGain).connect(this.master);
    roomSrc.start();

    this.started = true;
  }

  private pan(pos: THREE.Vector3, refDistance = 3.5): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.maxDistance = 90;
    p.rolloffFactor = 0.9;
    this.setPos(p, pos);
    return p;
  }

  private setPos(p: PannerNode, v: THREE.Vector3) {
    if (p.positionX) {
      p.positionX.value = v.x;
      p.positionY.value = v.y;
      p.positionZ.value = v.z;
    } else {
      (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(v.x, v.y, v.z);
    }
  }

  updateListener(camera: THREE.PerspectiveCamera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.05);
      l.positionY.setTargetAtTime(p.y, t, 0.05);
      l.positionZ.setTargetAtTime(p.z, t, 0.05);
      l.forwardX.setTargetAtTime(f.x, t, 0.05);
      l.forwardY.setTargetAtTime(f.y, t, 0.05);
      l.forwardZ.setTargetAtTime(f.z, t, 0.05);
      l.upX.setTargetAtTime(up.x, t, 0.05);
      l.upY.setTargetAtTime(up.y, t, 0.05);
      l.upZ.setTargetAtTime(up.z, t, 0.05);
    } else {
      const legacy = l as unknown as {
        setPosition(x: number, y: number, z: number): void;
        setOrientation(a: number, b: number, c: number, d: number, e: number, g: number): void;
      };
      legacy.setPosition(p.x, p.y, p.z);
      legacy.setOrientation(f.x, f.y, f.z, up.x, up.y, up.z);
    }
  }

  /* --------------------------- one-shots --------------------------- */

  /** Dry metallic click of a stem turning a notch. */
  valveTick(pos: THREE.Vector3, strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 2.5);
    pan.connect(this.master);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * strength, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    g.connect(pan);
    for (const [f, gain] of [
      [2100, 1],
      [3170, 0.5],
      [4640, 0.28],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * (0.96 + Math.random() * 0.08), t);
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 0.2);
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1800;
    nf.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.09 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(nf).connect(ng).connect(pan);
    n.start(t);
    n.stop(t + 0.2);
  }

  /** Water arriving in the glass: a swallow with bubbles behind it. */
  waterIn(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 2.2);
    pan.connect(this.master);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    n.connect(f).connect(g).connect(pan);
    n.start(t);
    n.stop(t + 1.6);
    for (let i = 0; i < 7; i++) this.bubble(pos, t + 0.15 + i * 0.11 + Math.random() * 0.05);
  }

  private bubble(pos: THREE.Vector3, when: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const pan = this.pan(pos, 2);
    pan.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f0 = 320 + Math.random() * 520;
    o.frequency.setValueAtTime(f0, when);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.6, when + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.09, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    o.connect(g).connect(pan);
    o.start(when);
    o.stop(when + 0.14);
  }

  /** Trapped air finding its way out. */
  airHiss(pos: THREE.Vector3, strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 2.4);
    pan.connect(this.master);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * strength, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    n.connect(f).connect(g).connect(pan);
    n.start(t);
    n.stop(t + 0.9);
  }

  /** Hand pump: leather-and-brass clack, then a gulp if it actually drew water. */
  primeStroke(pos: THREE.Vector3, wet: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 2);
    pan.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    o.connect(lp).connect(g).connect(pan);
    o.start(t);
    o.stop(t + 0.2);
    if (wet) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2.2;
      f.frequency.setValueAtTime(700, t + 0.05);
      f.frequency.exponentialRampToValueAtTime(240, t + 0.4);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + 0.05);
      ng.gain.exponentialRampToValueAtTime(0.2, t + 0.1);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      n.connect(f).connect(ng).connect(pan);
      n.start(t + 0.05);
      n.stop(t + 0.6);
      for (let i = 0; i < 3; i++) this.bubble(pos, t + 0.12 + i * 0.07);
    }
  }

  /** The "it is ready now" change of tone, with no words attached. */
  primedChime(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 4);
    pan.connect(this.master);
    [392, 523.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.1, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 1.1);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 1.2);
    });
  }

  contactorClunk(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 2.2);
    pan.connect(this.master);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    n.connect(f).connect(g).connect(pan);
    n.start(t);
    n.stop(t + 0.2);
  }

  splash(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.pan(pos, 5);
    pan.connect(this.master);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    n.connect(f).connect(g).connect(pan);
    n.start(t);
    n.stop(t + 1.7);
  }

  /* --------------------------- sustained --------------------------- */

  private ensureMotor(pos: THREE.Vector3) {
    if (this.motorOsc || !this.ctx) return;
    const ctx = this.ctx;
    this.motorPan = this.pan(pos, 3);
    this.motorPan.connect(this.master);
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.value = 400;
    this.motorFilter.Q.value = 3;
    this.motorGain.connect(this.motorFilter).connect(this.motorPan);
    this.motorOsc = ctx.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.value = 24;
    this.motorSub = ctx.createOscillator();
    this.motorSub.type = 'sine';
    this.motorSub.frequency.value = 48;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    this.motorOsc.connect(this.motorGain);
    this.motorSub.connect(subGain).connect(this.motorGain);
    this.motorOsc.start();
    this.motorSub.start();
  }

  private ensureRiser(pos: THREE.Vector3) {
    if (this.riserSrc || !this.ctx) return;
    const ctx = this.ctx;
    this.riserPan = this.pan(pos, 4);
    this.riserPan.connect(this.master);
    this.riserGain = ctx.createGain();
    this.riserGain.gain.value = 0;
    this.riserFilter = ctx.createBiquadFilter();
    this.riserFilter.type = 'bandpass';
    this.riserFilter.Q.value = 1.1;
    this.riserFilter.frequency.value = 500;
    this.riserSrc = ctx.createBufferSource();
    this.riserSrc.buffer = this.noise;
    this.riserSrc.loop = true;
    this.riserSrc.connect(this.riserFilter).connect(this.riserGain).connect(this.riserPan);
    this.riserSrc.start();
  }

  private ensureGush(pos: THREE.Vector3) {
    if (this.gushSrc || !this.ctx) return;
    const ctx = this.ctx;
    this.gushPan = this.pan(pos, 6);
    this.gushPan.connect(this.master);
    this.gushGain = ctx.createGain();
    this.gushGain.gain.value = 0;
    this.gushFilter = ctx.createBiquadFilter();
    this.gushFilter.type = 'bandpass';
    this.gushFilter.Q.value = 0.5;
    this.gushFilter.frequency.value = 1800;
    this.gushSrc = ctx.createBufferSource();
    this.gushSrc.buffer = this.noise;
    this.gushSrc.loop = true;
    this.gushSrc.connect(this.gushFilter).connect(this.gushGain).connect(this.gushPan);
    this.gushSrc.start();
  }

  private ensureBasin(pos: THREE.Vector3) {
    if (this.basinSrc || !this.ctx) return;
    const ctx = this.ctx;
    this.basinPan = this.pan(pos, 7);
    this.basinPan.connect(this.master);
    this.basinGain = ctx.createGain();
    this.basinGain.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.6;
    f.frequency.value = 1200;
    this.basinSrc = ctx.createBufferSource();
    this.basinSrc.buffer = this.noise;
    this.basinSrc.loop = true;
    this.basinSrc.connect(f).connect(this.basinGain).connect(this.basinPan);
    this.basinSrc.start();
  }

  /**
   * One call per frame ties every sustained voice to the same state the visuals
   * use, so the pitch of the motor and the height of the water can never drift apart.
   */
  updateContinuous(opts: {
    motorPos: THREE.Vector3;
    rpm: number;
    flow: number;
    dry: boolean;
    riserPos: THREE.Vector3;
    riserFill: number;
    riserFlow: number;
    gushPos: THREE.Vector3;
    gush: number;
    basinPos: THREE.Vector3;
    basin: number;
    underground: boolean;
  }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ensureMotor(opts.motorPos);
    this.ensureRiser(opts.riserPos);
    this.ensureGush(opts.gushPos);
    this.ensureBasin(opts.basinPos);

    if (this.motorOsc && this.motorGain && this.motorFilter && this.motorSub) {
      const hz = 22 + opts.rpm * 27;
      this.motorOsc.frequency.setTargetAtTime(hz, t, 0.18);
      this.motorSub.frequency.setTargetAtTime(hz * 2, t, 0.18);
      // running dry is thinner and rattlier — never a failure, just wrong-sounding
      const body = opts.dry ? 0.45 : 1;
      this.motorGain.gain.setTargetAtTime(opts.rpm * 0.17 * body, t, 0.2);
      this.motorFilter.frequency.setTargetAtTime(260 + opts.rpm * (opts.dry ? 900 : 420), t, 0.25);
    }
    if (this.riserGain && this.riserFilter && this.riserPan) {
      this.setPos(this.riserPan, opts.riserPos);
      this.riserGain.gain.setTargetAtTime(Math.min(0.28, opts.riserFlow * 0.5) * (opts.riserFill > 0.01 ? 1 : 0), t, 0.25);
      this.riserFilter.frequency.setTargetAtTime(380 + opts.riserFill * 900, t, 0.3);
    }
    if (this.gushGain) this.gushGain.gain.setTargetAtTime(opts.gush * 0.3, t, 0.3);
    if (this.basinGain) this.basinGain.gain.setTargetAtTime(opts.basin * 0.22, t, 0.4);
    if (this.roomGain) this.roomGain.gain.setTargetAtTime(opts.underground ? 0.06 : 0.02, t, 0.6);
  }
}
