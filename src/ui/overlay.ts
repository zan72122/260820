import { getGlyph, glyphSvgPath, LETTERS } from '../game/glyphs';

/**
 * Minimal HTML overlay: the letter rack shown after a cast is finished.
 * Letter faces are generated from the same canonical glyph data as the 3D.
 * No text is required to use it.
 */

export class Overlay {
  private root: HTMLElement;
  private rack: HTMLDivElement;
  onPick: ((letter: string) => void) | null = null;
  private doneLetters = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.rack = document.createElement('div');
    this.rack.id = 'letter-rack';
    this.rack.style.cssText = `
      position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom));
      transform: translate(-50%, 140%);
      display: flex; gap: 12px; padding: 12px 16px;
      background: rgba(30, 26, 22, 0.82);
      border: 1px solid rgba(190, 170, 140, 0.25);
      border-radius: 18px;
      transition: transform 0.55s cubic-bezier(0.2, 0.9, 0.25, 1.05);
      pointer-events: auto;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    `;
    this.root.appendChild(this.rack);
  }

  buildButtons() {
    this.rack.innerHTML = '';
    for (const letter of LETTERS) {
      const def = getGlyph(letter);
      const done = this.doneLetters.has(letter);
      const btn = document.createElement('button');
      btn.dataset.letter = letter;
      btn.setAttribute('aria-label', letter);
      btn.style.cssText = `
        width: 74px; height: 74px; border-radius: 14px;
        border: 2px solid ${done ? 'rgba(212,164,98,0.9)' : 'rgba(200,190,175,0.35)'};
        background: ${done ? 'linear-gradient(160deg,#3a2d1c,#2a2118)' : 'linear-gradient(160deg,#33302b,#26231f)'};
        padding: 6px; cursor: pointer; -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      `;
      const fill = done ? '#d29a4e' : '#b9ab97';
      btn.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%">
        <path d="${glyphSvgPath(def)}" fill="${fill}" fill-rule="evenodd"/>
      </svg>`;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        btn.style.transform = 'scale(0.92)';
      });
      btn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        btn.style.transform = '';
        this.onPick?.(letter);
      });
      this.rack.appendChild(btn);
    }
  }

  markDone(letter: string) { this.doneLetters.add(letter); }

  show() {
    this.buildButtons();
    requestAnimationFrame(() => {
      this.rack.style.transform = 'translate(-50%, 0)';
    });
  }

  hide() {
    this.rack.style.transform = 'translate(-50%, 140%)';
  }
}
