import type { QualityTier } from '../core/Quality';

/**
 * Almost nothing. One line of text at two moments in the whole game, and a
 * quality gear parked in the corner, out of the play area.
 */
export class Hud {
  private readonly caption = document.getElementById('caption') as HTMLDivElement;
  private readonly gear = document.getElementById('gear') as HTMLButtonElement;
  private readonly menu = document.getElementById('panelMenu') as HTMLDivElement;
  private readonly qRow = document.getElementById('qRow') as HTMLDivElement;
  private readonly qStat = document.getElementById('qStat') as HTMLDivElement;
  private readonly restart = document.getElementById('restartBtn') as HTMLButtonElement;
  private hideAt = 0;
  private shown = new Set<string>();

  onQuality: ((t: QualityTier) => void) | null = null;
  onRestart: (() => void) | null = null;

  constructor() {
    this.gear.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menu.classList.toggle('on');
    });
    this.qRow.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onQuality?.(b.dataset.q as QualityTier);
      });
    });
    this.restart.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menu.classList.remove('on');
      this.shown.clear();
      this.onRestart?.();
    });
    for (const el of [this.gear, this.menu]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  /** Says a thing once, after the child has already made it happen. */
  say(key: string, text: string, seconds = 4.5): void {
    if (this.shown.has(key)) return;
    this.shown.add(key);
    this.caption.textContent = text;
    this.caption.classList.add('on');
    this.hideAt = performance.now() + seconds * 1000;
  }

  update(): void {
    if (this.hideAt && performance.now() > this.hideAt) {
      this.caption.classList.remove('on');
      this.hideAt = 0;
    }
  }

  setQuality(tier: QualityTier, note: string): void {
    this.qRow.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('sel', b.dataset.q === tier);
    });
    this.qStat.textContent = note;
  }

  resetCaptions(): void {
    this.shown.clear();
    this.caption.classList.remove('on');
    this.hideAt = 0;
  }

  static bootDone(): void {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.add('gone');
    window.setTimeout(() => boot.remove(), 1000);
  }
}
