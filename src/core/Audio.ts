import * as THREE from 'three';
import { clamp, clamp01 } from '../util/math';

function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = w * 0.55 + last * 3.2;
  }
  return buf;
}

interface Spatial {
  panner: PannerNode;
  gain: GainNode;
}

/**
 * Fully procedural site audio. Nothing here is a musical cue: the locator is a
 * plain repeating pulse whose spacing carries the position information.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private engine: Spatial | null = null;
  private water: Spatial | null = null;
  private vacuum: Spatial | null = null;
  private hydraulic: Spatial | null = null;
  private waterGain = 0;
  private vacuumGain = 0;
  private hydGain = 0;
  private nextTick = 0;
  private tickPos = new THREE.Vector3();
  private tickInterval = 0.8;
  private tickActive = false;
  private tickSignal = 0;
  private pebbleCooldown = 0;
  muted = false;
  ready = false;

  /** Must be called from a user gesture (iOS requirement). */
  async start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.noise = noiseBuffer(ctx);
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.engine = this.makeSpatial(24);
    this.water = this.makeSpatial(6);
    this.vacuum = this.makeSpatial(8);
    this.hydraulic = this.makeSpatial(20);

    // ---- idling truck engine, heard from across the lot -------------------
    const lowA = ctx.createOscillator();
    lowA.type = 'sawtooth';
    lowA.frequency.value = 41;
    const lowB = ctx.createOscillator();
    lowB.type = 'sawtooth';
    lowB.frequency.value = 62.5;
    const eng = ctx.createBiquadFilter();
    eng.type = 'lowpass';
    eng.frequency.value = 210;
    eng.Q.value = 1.1;
    const engNoise = ctx.createBufferSource();
    engNoise.buffer = this.noise;
    engNoise.loop = true;
    const engNoiseGain = ctx.createGain();
    engNoiseGain.gain.value = 0.09;
    engNoise.connect(engNoiseGain).connect(eng);
    lowA.connect(eng);
    lowB.connect(eng);
    eng.connect(this.engine.gain);
    this.engine.gain.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 3.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain).connect(lowA.frequency);
    lowA.start();
    lowB.start();
    lfo.start();
    engNoise.start();

    // ---- continuous beds, gated by gain ----------------------------------
    this.buildNoiseBed(this.water, 'bandpass', 2600, 0.9, 0.0);
    this.buildNoiseBed(this.vacuum, 'lowpass', 460, 3.4, 0.0);
    this.buildNoiseBed(this.hydraulic, 'bandpass', 780, 5.5, 0.0);

    // a low body under the suction, so it reads as air volume not hiss
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 74;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.22;
    sub.connect(subGain).connect(this.vacuum.gain);
    sub.start();

    this.nextTick = ctx.currentTime + 0.2;
    this.ready = true;
  }

  private makeSpatial(maxDistance: number): Spatial {
    const ctx = this.ctx!;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.2;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.05;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(panner);
    panner.connect(this.master!);
    return { panner, gain };
  }

  private buildNoiseBed(dst: Spatial, type: BiquadFilterType, freq: number, q: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(dst.gain);
    dst.gain.gain.value = gain;
    src.start();
  }

  private setPos(s: Spatial | null, p: THREE.Vector3) {
    if (!s) return;
    const t = this.ctx!.currentTime;
    if (s.panner.positionX) {
      s.panner.positionX.setTargetAtTime(p.x, t, 0.02);
      s.panner.positionY.setTargetAtTime(p.y, t, 0.02);
      s.panner.positionZ.setTargetAtTime(p.z, t, 0.02);
    } else {
      s.panner.setPosition(p.x, p.y, p.z);
    }
  }

  setListener(camera: THREE.Camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    camera.getWorldPosition(p);
    camera.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.03);
      l.positionY.setTargetAtTime(p.y, t, 0.03);
      l.positionZ.setTargetAtTime(p.z, t, 0.03);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.03);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.03);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.03);
      l.upX.setTargetAtTime(up.x, t, 0.03);
      l.upY.setTargetAtTime(up.y, t, 0.03);
      l.upZ.setTargetAtTime(up.z, t, 0.03);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  setEnginePosition(p: THREE.Vector3) {
    this.setPos(this.engine, p);
  }

  setHydraulic(intensity: number, p: THREE.Vector3) {
    this.hydGain = clamp01(intensity);
    this.setPos(this.hydraulic, p);
  }

  setWater(on: boolean, p: THREE.Vector3) {
    this.waterGain = on ? 0.34 : 0;
    this.setPos(this.water, p);
  }

  setVacuum(power: number, p: THREE.Vector3) {
    this.vacuumGain = clamp01(power) * 0.32;
    this.setPos(this.vacuum, p);
  }

  /** Locator pulse: spacing shortens as the signal strengthens. */
  setDetector(active: boolean, signal: number, p: THREE.Vector3) {
    this.tickActive = active;
    this.tickSignal = clamp01(signal);
    this.tickInterval = 0.78 - 0.68 * Math.pow(this.tickSignal, 1.15);
    this.tickPos.copy(p);
  }

  private blip(when: number, freq: number, dur: number, vol: number, pos: THREE.Vector3) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.86, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.5;
    panner.maxDistance = 18;
    if (panner.positionX) {
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
    } else {
      panner.setPosition(pos.x, pos.y, pos.z);
    }
    osc.connect(g).connect(panner).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /** Grit rattling up the hose wall. */
  pebble(p: THREE.Vector3) {
    if (!this.ctx || this.muted || this.pebbleCooldown > 0) return;
    this.pebbleCooldown = 0.07 + Math.random() * 0.16;
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.005;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1.4 + Math.random() * 0.8;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500 + Math.random() * 2200;
    f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.16, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.refDistance = 2.5;
    if (panner.positionX) {
      panner.positionX.value = p.x;
      panner.positionY.value = p.y;
      panner.positionZ.value = p.z;
    } else {
      panner.setPosition(p.x, p.y, p.z);
    }
    src.connect(f).connect(g).connect(panner).connect(this.master!);
    src.start(when, Math.random() * 1.5, 0.12);
  }

  /** Water draining away from the newly bared surface. */
  drain(p: THREE.Vector3) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, when);
    f.frequency.exponentialRampToValueAtTime(220, when + 1.1);
    f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.13, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.refDistance = 2.5;
    if (panner.positionX) {
      panner.positionX.value = p.x;
      panner.positionY.value = p.y;
      panner.positionZ.value = p.z;
    } else {
      panner.setPosition(p.x, p.y, p.z);
    }
    src.connect(f).connect(g).connect(panner).connect(this.master!);
    src.start(when);
    src.stop(when + 1.3);
  }

  update(dt: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m * 0.85, t, 0.08);
    this.water?.gain.gain.setTargetAtTime(this.waterGain, t, 0.05);
    this.vacuum?.gain.gain.setTargetAtTime(this.vacuumGain, t, 0.07);
    this.hydraulic?.gain.gain.setTargetAtTime(this.hydGain * 0.11, t, 0.06);
    this.pebbleCooldown -= dt;

    if (this.tickActive && !this.muted) {
      const lookahead = t + 0.12;
      let guard = 0;
      while (this.nextTick < lookahead && guard++ < 8) {
        if (this.nextTick < t) this.nextTick = t + 0.01;
        const f = 150 + this.tickSignal * 92;
        this.blip(this.nextTick, f, 0.075 + 0.03 * (1 - this.tickSignal), 0.16 + this.tickSignal * 0.12, this.tickPos);
        this.nextTick += clamp(this.tickInterval, 0.075, 1.0);
      }
    } else {
      this.nextTick = Math.max(this.nextTick, t + 0.05);
    }
  }
}
