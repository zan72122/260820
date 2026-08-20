import type { AudioEngine } from '../core/Audio';

const ICONS = {
  loud: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b3323" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="#e6b95c"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.4 6.6a8 8 0 0 1 0 10.8"/></svg>`,
  quiet: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b3323" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="#e6b95c"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/></svg>`,
  off: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b3323" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="#cfc3a6"/><path d="m16 9.5 4.5 5M20.5 9.5 16 14.5"/></svg>`,
};

/**
 * The only DOM chrome in the game: a wordless volume knob. Everything the
 * child actually plays with lives in the canvas and is touched directly.
 */
export class Overlay {
  private root: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private audio: AudioEngine;

  constructor(host: HTMLElement, audio: AudioEngine) {
    this.audio = audio;
    this.root = document.createElement('div');
    this.root.className = 'corner';

    this.soundBtn = document.createElement('button');
    this.soundBtn.className = 'knob';
    this.soundBtn.type = 'button';
    this.soundBtn.setAttribute('aria-label', '音の大きさ / sound volume');
    this.soundBtn.innerHTML = ICONS.loud;
    this.soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.audio.unlock().then(() => {
        const v = this.audio.cycleVolume();
        this.refresh(v);
      });
    });
    this.root.appendChild(this.soundBtn);
    host.appendChild(this.root);
  }

  refresh(volume = this.audio.volume): void {
    this.soundBtn.innerHTML = volume > 0.6 ? ICONS.loud : volume > 0.01 ? ICONS.quiet : ICONS.off;
  }

  dispose(): void {
    this.root.remove();
  }
}
