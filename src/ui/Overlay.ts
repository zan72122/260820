import type { AudioSession, OutputMode } from '../core/AudioSession';
import { Signal } from '../core/Signals';

const ICON_SOUND = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5"/><path d="M22 9.5l-5 5"/></svg>`;
const ICON_REPLAY = `<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.5h-4.5"/></svg>`;

/**
 * The only non-diegetic surface in the game: a sound control, and a single
 * loop glyph offered after a run so the moment can be reached again in two
 * taps. Nothing here explains how to play — that is the scene's job.
 */
export class Overlay {
  readonly onReplay = new Signal<void>();

  private root: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private replayBtn!: HTMLButtonElement;
  private modeButtons: Record<OutputMode, HTMLButtonElement> = {} as never;

  constructor(root: HTMLElement, private audio: AudioSession) {
    this.root = root;
    this.build();
    this.audio.onStateChange.on(() => this.sync());
    this.sync();
  }

  private build(): void {
    const cluster = document.createElement('div');
    cluster.className = 'ctl-cluster';

    this.soundBtn = document.createElement('button');
    this.soundBtn.className = 'ctl';
    this.soundBtn.type = 'button';
    this.soundBtn.setAttribute('aria-label', '音の設定');
    this.soundBtn.innerHTML = ICON_SOUND;
    this.soundBtn.addEventListener('click', () => {
      const open = this.panel.classList.toggle('is-open');
      this.soundBtn.classList.toggle('is-open', open);
    });
    cluster.appendChild(this.soundBtn);
    this.root.appendChild(cluster);

    this.panel = document.createElement('div');
    this.panel.className = 'audio-panel';
    this.panel.innerHTML = `
      <div data-role="label">おと</div>
      <input type="range" min="0" max="100" value="85" aria-label="音量" />
      <div class="seg" data-role="mode">
        <button type="button" data-mode="speaker">スピーカー</button>
        <button type="button" data-mode="headphone">ヘッドホン</button>
      </div>
      <div class="seg" data-role="mute" style="margin-top:8px">
        <button type="button" data-mute="off">おと あり</button>
        <button type="button" data-mute="on">おと なし</button>
      </div>
    `;
    const slider = this.panel.querySelector('input') as HTMLInputElement;
    slider.addEventListener('input', () => {
      this.audio.setVolume(Number(slider.value) / 100);
    });
    for (const b of Array.from(
      this.panel.querySelectorAll<HTMLButtonElement>('[data-mode]'),
    )) {
      const mode = b.dataset.mode as OutputMode;
      this.modeButtons[mode] = b;
      b.addEventListener('click', () => this.audio.setOutputMode(mode));
    }
    for (const b of Array.from(
      this.panel.querySelectorAll<HTMLButtonElement>('[data-mute]'),
    )) {
      b.addEventListener('click', () => this.audio.setMuted(b.dataset.mute === 'on'));
    }
    this.root.appendChild(this.panel);

    this.replayBtn = document.createElement('button');
    this.replayBtn.className = 'replay';
    this.replayBtn.type = 'button';
    this.replayBtn.setAttribute('aria-label', 'もういちど');
    this.replayBtn.innerHTML = ICON_REPLAY;
    this.replayBtn.addEventListener('click', () => {
      this.showReplay(false);
      this.onReplay.emit();
    });
    this.root.appendChild(this.replayBtn);
  }

  private sync(): void {
    this.soundBtn.innerHTML = this.audio.muted ? ICON_MUTED : ICON_SOUND;
    for (const mode of ['speaker', 'headphone'] as OutputMode[]) {
      this.modeButtons[mode]?.classList.toggle('is-on', this.audio.outputMode === mode);
    }
    for (const b of Array.from(
      this.panel.querySelectorAll<HTMLButtonElement>('[data-mute]'),
    )) {
      b.classList.toggle('is-on', (b.dataset.mute === 'on') === this.audio.muted);
    }
  }

  showReplay(show: boolean): void {
    this.replayBtn.classList.toggle('is-on', show);
  }
}
