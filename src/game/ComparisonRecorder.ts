import { AuscultationChannel } from '../audio/AuscultationChannel';
import type { BodySoundField, ChestCoord, SoundProfile, WindowId } from '../audio/BodySoundField';
import type { HeartScheduler, ScheduledChannel } from '../audio/HeartSoundSource';
import type { CardiacClock } from '../core/CardiacClock';
import type { RecordTiles } from '../scene/RecordTiles';

interface Entry {
  id: WindowId;
  coord: ChestCoord;
  profile: SoundProfile;
  channel: AuscultationChannel | null;
  /** Cycles left to play. */
  beatsLeft: number;
  lastBeat: number;
}

/**
 * The practice recorder built into the stand.
 *
 * A tile does not hold a recording of a past heartbeat — it holds a *place*.
 * Pressing one lets the heart that is beating right now be heard as it sounds
 * there, so two places can be compared without the rhythm ever restarting.
 */
export class ComparisonRecorder {
  private entries = new Map<WindowId, Entry>();
  private ctx: AudioContext | null = null;
  private destination: AudioNode | null = null;
  private onPlay: ((id: WindowId) => void) | null = null;

  /** How many cycles one press of a tile plays for. */
  beatsPerPress = 3;

  constructor(
    private field: BodySoundField,
    private clock: CardiacClock,
    private tiles: RecordTiles,
  ) {}

  attachAudio(ctx: AudioContext, destination: AudioNode): void {
    this.ctx = ctx;
    this.destination = destination;
  }

  setOnPlay(fn: (id: WindowId) => void): void {
    this.onPlay = fn;
  }

  get count(): number {
    return this.entries.size;
  }

  has(id: WindowId): boolean {
    return this.entries.has(id);
  }

  /** Save the place that was just listened to. */
  record(id: WindowId, coord: ChestCoord): void {
    const profile = this.field.sample(coord);
    const existing = this.entries.get(id);
    if (existing) {
      existing.coord = { ...coord };
      existing.profile = profile;
    } else {
      this.entries.set(id, {
        id,
        coord: { ...coord },
        profile,
        channel: null,
        beatsLeft: 0,
        lastBeat: -1,
      });
    }
    this.tiles.add(id, coord);
  }

  play(id: WindowId): void {
    const e = this.entries.get(id);
    if (!e) return;
    // Restarting a tile that is already playing simply extends it — children
    // press things repeatedly, and that should never chop the sound up.
    e.beatsLeft = this.beatsPerPress;
    e.lastBeat = this.clock.beatIndex();
    if (this.ctx && this.destination && !e.channel) {
      e.channel = new AuscultationChannel(this.ctx, this.destination);
    }
    if (e.channel) {
      e.channel.applyProfile(e.profile, 0.02);
      e.channel.setLevel(1, 0.02);
    }
    this.tiles.markPlaying(id, true);
    this.onPlay?.(id);
  }

  isPlayingAny(): boolean {
    for (const e of this.entries.values()) if (e.beatsLeft > 0) return true;
    return false;
  }

  update(): void {
    const idx = this.clock.beatIndex();
    for (const e of this.entries.values()) {
      if (e.beatsLeft <= 0) continue;
      if (idx !== e.lastBeat) {
        e.beatsLeft -= idx - e.lastBeat;
        e.lastBeat = idx;
        if (e.beatsLeft <= 0) {
          e.channel?.release(0.5);
          this.tiles.markPlaying(e.id, false);
        }
      }
    }
  }

  /** Channels the shared scheduler should feed this tick. */
  scheduledChannels(): ScheduledChannel[] {
    const out: ScheduledChannel[] = [];
    for (const e of this.entries.values()) {
      if (e.channel && e.beatsLeft > 0) {
        out.push({ channel: e.channel, profileFor: () => e.profile, scale: 1 });
      }
    }
    return out;
  }

  refreshScheduler(scheduler: HeartScheduler, live: ScheduledChannel): void {
    scheduler.setTargets([live, ...this.scheduledChannels()]);
  }
}
