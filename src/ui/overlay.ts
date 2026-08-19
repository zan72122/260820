/**
 * The only DOM the game has.
 *
 * There is deliberately no text tutorial and no coloured arrows. The single
 * on-screen gesture demo below is the *third* and last hint stage, shown once,
 * and only if the teacher's gaze and a classmate's demonstration have both
 * failed to land.
 */
export class Overlay {
  private root: HTMLElement;
  private boot: HTMLElement;
  private bootBar: HTMLElement;
  private hand: HTMLElement | null = null;
  private again: HTMLElement;
  private vignette: HTMLElement;

  constructor() {
    this.root = document.getElementById('overlay')!;
    this.vignette = document.getElementById('vignette')!;

    this.boot = document.createElement('div');
    this.boot.className = 'boot';
    this.boot.innerHTML =
      '<div class="mark"><span>🤫</span></div><div class="load"><i></i></div>';
    document.getElementById('app')!.appendChild(this.boot);
    this.bootBar = this.boot.querySelector('.load i') as HTMLElement;

    this.again = document.createElement('div');
    this.again.className = 'again';
    this.again.innerHTML = '<div class="glyph">↺</div>';
    this.root.appendChild(this.again);
  }

  setProgress(t: number): void {
    this.bootBar.style.width = `${Math.round(Math.max(0, Math.min(1, t)) * 100)}%`;
  }

  onFirstTouch(fn: () => void): void {
    const go = (): void => {
      this.boot.removeEventListener('pointerdown', go);
      fn();
      this.boot.classList.add('gone');
      window.setTimeout(() => this.boot.remove(), 1000);
    };
    this.boot.addEventListener('pointerdown', go);
  }

  /**
   * @param kind  'drag' mimes parting the cloth, 'out' mimes stepping onstage.
   * @param nx,ny normalised screen position to play it at - deliberately offset
   *              from the thing it refers to, so the hand never covers it.
   */
  showHand(kind: 'drag' | 'out', nx: number, ny: number): void {
    this.hideHand();
    const el = document.createElement('div');
    el.className = 'hand-demo';
    el.innerHTML = '<div class="trail"></div><div class="ring"></div>';
    el.style.left = `${nx * 100}%`;
    el.style.top = `${ny * 100}%`;
    const trail = el.querySelector('.trail') as HTMLElement;
    if (kind === 'drag') {
      trail.style.left = '-40px';
      trail.style.width = '96px';
      el.style.animation = 'hand-drag-x 2400ms ease-in-out 2';
    } else {
      trail.style.left = '-40px';
      trail.style.width = '104px';
      trail.style.transform = 'translateY(-50%) rotate(-22deg)';
      el.style.animation = 'hand-swipe-out 2400ms ease-in-out 2';
    }
    el.addEventListener('animationend', () => this.hideHand());
    this.root.appendChild(el);
    this.hand = el;
  }

  hideHand(): void {
    this.hand?.remove();
    this.hand = null;
  }

  showAgain(show: boolean): void {
    this.again.classList.toggle('show', show);
  }

  /** The vignette relaxes for the reveal so the room feels physically bigger. */
  setVignette(strength: number): void {
    this.vignette.style.opacity = String(Math.max(0, Math.min(1, strength)));
  }
}
