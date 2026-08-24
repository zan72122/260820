import type { CardiacClock } from '../core/CardiacClock';
import { clamp01, lerp } from '../core/mathutil';
import type { AuscultationChannel } from './AuscultationChannel';
import type { SoundProfile } from './BodySoundField';
import { renderHeartComponent, toAudioBuffer } from './synth';

type ComponentId = 'm1' | 't1' | 'a2' | 'p2';

/** Small, physiological offsets inside each sound (seconds). */
const COMPONENT_OFFSET: Record<ComponentId, number> = {
  m1: 0,
  t1: 0.022,
  a2: 0,
  p2: 0.026,
};

/**
 * The manikin's one heart.
 *
 * S1 is built from its mitral and tricuspid components, S2 from its aortic and
 * pulmonic ones, exactly in that order, always. Which component reaches the ear
 * loudest is the only thing the listening position changes — the rhythm, the
 * pitch and the sequence are identical everywhere on the chest.
 */
export class HeartSoundSource {
  private ctx: BaseAudioContext;
  private buffers = new Map<ComponentId, AudioBuffer>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const sr = ctx.sampleRate;

    this.buffers.set(
      'm1',
      toAudioBuffer(
        ctx,
        renderHeartComponent(sr, {
          seed: 10427,
          duration: 0.15,
          attack: 0.004,
          decay: 32,
          centre: 46,
          q: 1.05,
          partials: [
            [38, 0.85, 26],
            [92, 0.3, 44],
          ],
          level: 1.0,
        }),
      ),
    );
    this.buffers.set(
      't1',
      toAudioBuffer(
        ctx,
        renderHeartComponent(sr, {
          seed: 20851,
          duration: 0.13,
          attack: 0.004,
          decay: 36,
          centre: 58,
          q: 1.2,
          partials: [
            [48, 0.6, 32],
            [108, 0.22, 52],
          ],
          level: 0.78,
        }),
      ),
    );
    this.buffers.set(
      'a2',
      toAudioBuffer(
        ctx,
        renderHeartComponent(sr, {
          seed: 31337,
          duration: 0.1,
          attack: 0.0018,
          decay: 52,
          centre: 74,
          q: 1.5,
          partials: [
            [62, 0.55, 46],
            [148, 0.34, 70],
            [232, 0.14, 96],
          ],
          level: 0.92,
        }),
      ),
    );
    this.buffers.set(
      'p2',
      toAudioBuffer(
        ctx,
        renderHeartComponent(sr, {
          seed: 40961,
          duration: 0.094,
          attack: 0.0018,
          decay: 58,
          centre: 66,
          q: 1.45,
          partials: [
            [56, 0.5, 50],
            [132, 0.26, 78],
          ],
          level: 0.7,
        }),
      ),
    );
  }

  /**
   * Schedule one cardiac cycle into one channel.
   * `profile` is sampled once per beat; the channel's filters keep moving
   * continuously between beats, so a slide is heard as a slide.
   */
  scheduleBeat(
    channel: AuscultationChannel,
    s1Time: number,
    s2Time: number,
    profile: SoundProfile,
    scale = 1,
  ): void {
    const prox = clamp01(profile.proximity);
    const s1Level = profile.s1 * lerp(0.55, 1.0, prox) * scale;
    const s2Level = profile.s2 * lerp(0.55, 1.0, prox) * scale;

    const m1 = s1Level * lerp(0.55, 1.0, profile.s1Balance);
    const t1 = s1Level * lerp(1.0, 0.42, profile.s1Balance);
    const a2 = s2Level * lerp(0.5, 1.0, profile.s2Balance);
    const p2 = s2Level * lerp(1.0, 0.46, profile.s2Balance);

    this.fire(channel, 'm1', s1Time + COMPONENT_OFFSET.m1, m1);
    this.fire(channel, 't1', s1Time + COMPONENT_OFFSET.t1, t1);
    this.fire(channel, 'a2', s2Time + COMPONENT_OFFSET.a2, a2);
    this.fire(channel, 'p2', s2Time + COMPONENT_OFFSET.p2, p2);
  }

  private fire(channel: AuscultationChannel, id: ComponentId, when: number, gain: number): void {
    if (gain <= 0.0015) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(channel.input);
    src.start(Math.max(when, this.ctx.currentTime + 0.002));
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}

export interface ScheduledChannel {
  channel: AuscultationChannel;
  /** Sampled fresh for every beat. */
  profileFor(): SoundProfile;
  scale?: number;
}

/**
 * Look-ahead scheduler. One pass per tick feeds *every* live channel from the
 * same beat, which is what lets the child compare two places without the
 * heartbeat ever re-starting.
 */
export class HeartScheduler {
  private timer: number | null = null;
  private targets: ScheduledChannel[] = [];

  constructor(
    private clock: CardiacClock,
    private source: HeartSoundSource,
    private lookahead = 0.22,
    private interval = 45,
  ) {}

  setTargets(targets: ScheduledChannel[]): void {
    this.targets = targets;
  }

  start(): void {
    if (this.timer !== null) return;
    this.clock.resync();
    this.timer = window.setInterval(() => this.tick(), this.interval);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const beats = this.clock.pullDueBeats(this.lookahead);
    if (!beats.length) return;
    for (const beat of beats) {
      for (const t of this.targets) {
        if (t.channel.getLevel() <= 0.002) continue;
        this.source.scheduleBeat(
          t.channel,
          beat.s1Time,
          beat.s2Time,
          t.profileFor(),
          t.scale ?? 1,
        );
      }
    }
  }
}
