/**
 * 音響 ＝ 状態の説明。
 * 水源・竹の機構・石・庭の四層を別ノードへ分け、共有状態から連続的に駆動する。
 * 抽象sonification（角度→音程）はしない。音源事象として聞こえる範囲で作る。
 */
import { buildBank, pick, type SoundBank } from './bank';
import type { GardenState, SimEvent } from '../sim/state';
import type { SimExtras } from '../sim/physics';
import { clamp, makeRng, smoothstep } from '../util/math';

export interface AudioSettings {
  volume: number; // 0..1
  muted: boolean;
  quiet: boolean; // 「静かな音」
}

/** 映像より前に音を鳴らさないための最小遅延（次のフレーム提示に合わせる） */
const PRESENT_DELAY = 0.018;

interface Layer {
  src: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

export class GardenAudio {
  ctx: AudioContext | null = null;
  private bank: SoundBank | null = null;
  private started = false;
  private starting: Promise<void> | null = null;

  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private dry!: GainNode;
  private send!: GainNode;
  private verb!: ConvolverNode;
  private verbReturn!: GainNode;

  private waterThin!: Layer;
  private waterThick!: Layer;
  private waterRush!: Layer;
  private basin!: Layer;
  private dump!: Layer;
  private leaves!: Layer;
  private wind!: Layer;
  private gateRub!: Layer;
  private interior: Layer[] = [];
  private cavity: Layer[] = [];
  private pivot: Layer[] = [];

  private settings: AudioSettings = { volume: 0.85, muted: false, quiet: false };
  private rng = makeRng(0x9a71c);
  private lastVariant = [-1, -1];
  private impactEnergy = 0;
  private birdTimer = 22;
  private tubeLengths: number[];

  constructor(tubeLengths: number[]) {
    this.tubeLengths = tubeLengths;
  }

  get ready(): boolean {
    return this.started;
  }

  /**
   * 起動時に一度だけ呼ぶ。AudioContext を作り、短音とループを全て事前に用意する。
   * iOS では suspended のまま作られるので、音はまだ出ない。
   */
  async prepare(): Promise<void> {
    if (this.started) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.bank = buildBank(ctx, this.tubeLengths);
      this.buildGraph();
      this.started = true;
    })();
    return this.starting;
  }

  /** 最初の水門操作で呼ぶ。ここで初めて resume する。 */
  async unlock(): Promise<void> {
    await this.prepare();
    await this.resume();
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    const bank = this.bank!;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -9;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.22;
    this.limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    this.master.connect(this.limiter);

    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.dry.connect(this.master);

    this.verb = ctx.createConvolver();
    this.verb.normalize = true;
    this.verb.buffer = bank.reverbIR;
    this.send = ctx.createGain();
    this.send.gain.value = 1;
    this.verbReturn = ctx.createGain();
    this.verbReturn.gain.value = this.settings.quiet ? 0.2 : 0.33;
    this.send.connect(this.verb);
    this.verb.connect(this.verbReturn);
    this.verbReturn.connect(this.master);

    const loop = (buf: AudioBuffer, gain: number, filter: BiquadFilterNode, sendAmt = 0.2): Layer => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.dry);
      const s = ctx.createGain();
      s.gain.value = sendAmt;
      g.connect(s);
      s.connect(this.send);
      src.start(ctx.currentTime + 0.02);
      return { src, gain: g, filter };
    };

    const lp = (f: number, q = 0.7, type: BiquadFilterType = 'lowpass'): BiquadFilterNode => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      return n;
    };

    /* Water source */
    this.waterThin = loop(bank.waterThin, 0, lp(6000), 0.18);
    this.waterThick = loop(bank.waterThick, 0, lp(6000), 0.18);
    this.waterRush = loop(bank.waterRush, 0, lp(6000), 0.2);
    this.basin = loop(bank.basinBed, 0, lp(7000), 0.26);
    this.dump = loop(bank.dumpBed, 0, lp(3000), 0.24);

    /* Bamboo mechanism（筒内部の水と空洞共鳴、軸の摩擦） */
    for (let i = 0; i < this.tubeLengths.length; i++) {
      this.interior.push(loop(bank.tubeInterior, 0, lp(1400), 0.12));
      this.cavity.push(loop(bank.tubeInterior, 0, lp(240, 7.5, 'bandpass'), 0.16));
      this.pivot.push(loop(bank.pivotRub, 0, lp(1100, 3.0, 'bandpass'), 0.1));
    }

    /* 木製水門 */
    this.gateRub = loop(bank.gateRub, 0, lp(1400, 1.4, 'bandpass'), 0.12);

    /* Garden（常に小さく） */
    this.leaves = loop(bank.leaves, 0.035, lp(9000), 0.3);
    this.wind = loop(bank.wind, 0.03, lp(400), 0.2);
  }

  setSettings(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = this.settings.muted ? 0 : this.settings.volume * (this.settings.quiet ? 0.55 : 1);
    this.master.gain.setTargetAtTime(vol, t, 0.05);
    this.verbReturn.gain.setTargetAtTime(this.settings.quiet ? 0.2 : 0.33, t, 0.08);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend().catch(() => undefined);
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume().catch(() => undefined);
  }

  /* ── 連続層 ───────────────────────────── */

  update(state: GardenState, extras: SimExtras, dt: number): void {
    if (!this.started || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const q = this.settings.quiet ? 0.62 : 1;
    const set = (p: AudioParam, v: number, tc = 0.05): void => {
      p.setTargetAtTime(v, t, tc);
    };

    /* 水路の流れ：細流 ↔ 太流 ↔ 奔流 を等出力crossfade */
    const f = state.flowRate;
    const present = smoothstep(0, 0.05, f);
    const xThin = Math.cos((Math.min(f, 0.65) / 0.65) * Math.PI * 0.5);
    const xThick = Math.sin((Math.min(f, 0.65) / 0.65) * Math.PI * 0.5) * (1 - smoothstep(0.7, 1, f) * 0.55);
    const xRush = smoothstep(0.55, 1, f);
    set(this.waterThin.gain.gain, present * xThin * 0.3 * q);
    set(this.waterThick.gain.gain, present * xThick * 0.34 * q);
    set(this.waterRush.gain.gain, present * xRush * 0.3 * q);
    set(this.waterThin.filter.frequency, 3200 + f * 4200, 0.12);
    set(this.waterThick.filter.frequency, 2400 + f * 5200, 0.12);
    set(this.waterRush.filter.frequency, 2000 + f * 6000, 0.12);

    /* 鉢の水面 */
    set(this.basin.gain.gain, clamp(extras.basinFlow * 0.42, 0, 1) * 0.32 * q, 0.09);

    /* 排水（ザバッ） */
    let totalDump = 0;
    for (const tb of state.tubes) totalDump += tb.dumpRate;
    set(this.dump.gain.gain, clamp(totalDump * 0.36, 0, 1) * 0.5 * q, 0.035);
    set(this.dump.filter.frequency, 900 + clamp(totalDump, 0, 3) * 900, 0.06);

    /* 竹筒の内部：水音と空洞共鳴の比率を穏やかに動かす（音階にはしない） */
    for (let i = 0; i < state.tubes.length; i++) {
      const tb = state.tubes[i];
      const act = tb.presence;
      const inflow = clamp(tb.inflow * 2.6, 0, 1);
      const fill = tb.fillRatio;
      set(this.interior[i].gain.gain, inflow * (1 - fill * 0.45) * 0.3 * act * q, 0.08);
      set(this.cavity[i].gain.gain, inflow * (0.25 + fill * 0.85) * 0.22 * act * q, 0.12);
      // 残った気柱の長さから共鳴帯域を決める。狭い範囲でゆっくり動かす。
      const cavLen = Math.max(0.1, tb.length * (1 - fill * 0.72));
      const fc = clamp(343 / (4 * cavLen), 175, 350);
      set(this.cavity[i].filter.frequency, fc, 0.35);
      set(this.interior[i].filter.frequency, 900 + (1 - fill) * 900, 0.3);

      /* 軸の摩擦：角速度と支点荷重から */
      const rub = clamp(Math.abs(tb.angularVelocity) * 0.55, 0, 1) * clamp(tb.pivotLoad / 22, 0.2, 1);
      set(this.pivot[i].gain.gain, rub * 0.17 * act * q, 0.03);
      set(this.pivot[i].filter.frequency, 820 + clamp(tb.pivotLoad / 24, 0, 1) * 620, 0.1);
    }

    /* 木製水門の擦れ */
    set(this.gateRub.gain.gain, extras.gateScrape * 0.2 * q, 0.03);
    set(this.gateRub.filter.frequency, 1000 + Math.abs(state.gateStrain) * 2600, 0.06);

    /* 庭：常に小さく。余韻中は少しだけ引く。 */
    const glow = state.inAfterglow ? 0.72 : 1;
    set(this.leaves.gain.gain, 0.036 * glow * q, 0.4);
    set(this.wind.gain.gain, 0.03 * glow * q, 0.6);

    this.impactEnergy = Math.max(0, this.impactEnergy - dt * 0.42);

    /* 遠い鳥。余韻中は鳴らさない。 */
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 26 + this.rng() * 34;
      const bank = this.bank;
      if (!state.inAfterglow && bank) {
        this.oneShot(pick(bank.birds, this.rng()), {
          gain: 0.05 * q,
          rate: 0.95 + this.rng() * 0.12,
          send: 0.7,
          pan: this.rng() * 1.6 - 0.8,
          lp: 5200,
        });
      }
    }
  }

  /* ── 事象 ─────────────────────────────── */

  handle(events: SimEvent[], state: GardenState): void {
    if (!this.started || !this.bank) return;
    const bank = this.bank;
    const q = this.settings.quiet ? 0.6 : 1;
    for (const e of events) {
      switch (e.type) {
        case 'gate-scrape':
          this.oneShot(pick(bank.gateGrains, this.rng()), {
            gain: 0.055 * e.velocity * q,
            rate: 0.85 + this.rng() * 0.4,
            send: 0.1,
            pan: -0.35,
            lp: 9000,
          });
          break;
        case 'gate-breakaway':
          this.oneShot(pick(bank.gateGrains, this.rng()), {
            gain: 0.13 * e.velocity * q,
            rate: 0.7 + this.rng() * 0.2,
            send: 0.18,
            pan: -0.35,
            lp: 7000,
          });
          break;
        case 'first-water':
          this.oneShot(pick(bank.drips, this.rng()), {
            gain: 0.16 * q,
            rate: 1.1,
            send: 0.3,
            pan: -0.2,
            lp: 11000,
          });
          break;
        case 'inlet-drip':
          this.oneShot(pick(bank.drips, this.rng()), {
            gain: 0.05 * e.velocity * q,
            rate: 0.8 + this.rng() * 0.55,
            send: 0.22,
            pan: e.contact * 0.25 + (e.tube ? 0.35 : -0.1),
            lp: 12000,
          });
          break;
        case 'gulp':
          this.oneShot(pick(bank.gulps, this.rng()), {
            gain: 0.075 * e.velocity * (0.4 + e.wetness) * q,
            rate: 0.82 + this.rng() * 0.34 - e.wetness * 0.12,
            send: 0.14,
            pan: e.tube ? 0.3 : -0.05,
            lp: 2600,
          });
          break;
        case 'tip-start':
          this.oneShot(pick(bank.axleCreaks, this.rng()), {
            gain: 0.075 * clamp(e.velocity, 0.2, 1.2) * q,
            rate: 0.9 + this.rng() * 0.24,
            send: 0.16,
            pan: e.tube ? 0.28 : -0.05,
            lp: 6500,
          });
          break;
        case 'dump-start':
          this.oneShot(pick(bank.splashes, this.rng()), {
            gain: 0.2 * clamp(e.velocity, 0.2, 1.2) * q,
            rate: 0.75 + this.rng() * 0.2,
            send: 0.34,
            pan: e.tube ? 0.25 : -0.05,
            lp: 5200,
          });
          break;
        case 'basin-splash':
          this.oneShot(pick(bank.splashes, this.rng()), {
            gain: 0.045 * clamp(e.velocity, 0.1, 1.2) * q,
            rate: 0.85 + this.rng() * 0.5,
            send: 0.3,
            pan: e.contact * 0.3,
            lp: 9000,
          });
          break;
        case 'backstop':
          this.oneShot(pick(bank.backstops, this.rng()), {
            gain: 0.11 * clamp(e.velocity / 1.6, 0.15, 1) * q,
            rate: 0.9 + this.rng() * 0.2,
            send: 0.24,
            pan: e.tube ? 0.3 : -0.05,
            lp: 2400,
            delay: PRESENT_DELAY,
          });
          break;
        case 'impact':
          this.playImpact(e, state);
          break;
        default:
          break;
      }
    }
  }

  /** 「コン」。同じ音を毎回鳴らさない。 */
  private playImpact(e: SimEvent, state: GardenState): void {
    const bank = this.bank!;
    const list = bank.impacts[e.tube] ?? bank.impacts[0];
    let v = Math.floor(this.rng() * list.length);
    if (v === this.lastVariant[e.tube] ) v = (v + 1 + Math.floor(this.rng() * (list.length - 1))) % list.length;
    this.lastVariant[e.tube] = v;

    const q = this.settings.quiet ? 0.62 : 1;
    const norm = clamp(e.velocity / 1.45, 0, 1.15);
    // 20周期聞いても疲れないよう、連続打の蓄積で少し抑える
    const fatigue = 1 / (1 + this.impactEnergy * 0.35);
    const gain = Math.pow(norm, 0.62) * 0.5 * q * fatigue;
    this.impactEnergy += norm * 0.6;

    const wet = e.wetness;
    const tube = state.tubes[e.tube];
    // 濡れた竹は少し鈍く低く、乾いた竹は硬い
    const rate = (1 - wet * 0.05) * (0.975 + this.rng() * 0.05);
    const lp = 9500 - wet * 3800 - (this.settings.quiet ? 1800 : 0);
    const send = clamp(0.2 + norm * 0.2 + (tube ? tube.length * 0.12 : 0), 0.1, 0.5);
    this.oneShot(list[v], {
      gain,
      rate,
      send,
      pan: e.tube ? 0.3 : -0.05,
      lp,
      hp: 100,
      delay: PRESENT_DELAY,
    });
  }

  private oneShot(
    buffer: AudioBuffer,
    o: { gain: number; rate: number; send: number; pan: number; lp: number; hp?: number; delay?: number },
  ): void {
    const ctx = this.ctx!;
    if (o.gain < 0.0015) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = o.rate;
    let node: AudioNode = src;
    if (o.hp) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = o.hp;
      hp.Q.value = 0.7;
      node.connect(hp);
      node = hp;
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lp;
    lp.Q.value = 0.7;
    node.connect(lp);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(o.pan, -1, 1);
    const g = ctx.createGain();
    g.gain.value = o.gain;
    lp.connect(pan);
    pan.connect(g);
    g.connect(this.dry);
    const s = ctx.createGain();
    s.gain.value = o.send;
    g.connect(s);
    s.connect(this.send);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
      s.disconnect();
      lp.disconnect();
      pan.disconnect();
    };
  }
}
