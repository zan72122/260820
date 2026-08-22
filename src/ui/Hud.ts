import { KeyProfileSpec } from '../game/FictionalKeyProfile';
import { keySilhouettePath } from '../scene/KeyModel';

/**
 * Minimal DOM overlay: a key tray (wide sheet with side-view silhouettes so
 * the mountain profile can be read and predicted before inserting), one
 * free-play button, one key-return button, and the single child sentence.
 * No score, no timer, no warnings.
 */
export interface HudCallbacks {
  onSelectKey(index: number): void;
  onFreePlay(): void;
  onReturnKey(): void;
}

const CSS = `
.pf-btn {
  position: fixed; z-index: 20;
  width: 64px; height: 64px; border-radius: 50%;
  border: none; background: rgba(46, 38, 28, 0.72);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center;
  color: #e8d9b8; touch-action: manipulation; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding-top: env(safe-area-inset-top);
}
.pf-btn:active { transform: scale(0.94); }
.pf-btn svg { width: 34px; height: 34px; }
#pf-free { top: calc(14px + env(safe-area-inset-top)); right: 14px; }
#pf-return { top: calc(14px + env(safe-area-inset-top)); left: 14px; }
#pf-tray {
  position: fixed; z-index: 30; left: 0; right: 0;
  bottom: 0; padding: 12px 10px calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(56,45,32,0.0), rgba(38,31,22,0.92) 26%);
  display: flex; gap: 10px; justify-content: center;
  transform: translateY(110%); transition: transform 0.45s cubic-bezier(.2,.9,.3,1);
}
#pf-tray.open { transform: translateY(0); }
.pf-card {
  flex: 0 1 200px; max-width: 32vw;
  background: #efe6d2; border-radius: 14px; border: none;
  padding: 8px 6px 6px; box-shadow: 0 3px 12px rgba(0,0,0,0.4);
  touch-action: manipulation; cursor: pointer;
}
.pf-card:active { transform: scale(0.96); }
.pf-card canvas { width: 100%; height: auto; display: block; }
.pf-card .pf-name {
  font-size: 15px; color: #4c3b24; text-align: center; margin-top: 2px;
  font-weight: 600;
}
#pf-sentence {
  position: fixed; z-index: 25; left: 50%; bottom: calc(9vh + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  background: rgba(250, 243, 225, 0.94); color: #4a3820;
  border-radius: 20px; padding: 12px 22px; font-size: clamp(15px, 4.2vw, 21px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  opacity: 0; transition: opacity 0.8s; pointer-events: none;
  max-width: 86vw; text-align: center; line-height: 1.5;
}
#pf-sentence.show { opacity: 1; }
.pf-hidden { display: none !important; }
`;

export class Hud {
  private tray: HTMLDivElement;
  private freeBtn: HTMLButtonElement;
  private returnBtn: HTMLButtonElement;
  private sentence: HTMLDivElement;
  private cards: HTMLButtonElement[] = [];
  private sentenceTimer = 0;

  constructor(keys: readonly KeyProfileSpec[], cb: HudCallbacks) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.tray = document.createElement('div');
    this.tray.id = 'pf-tray';
    for (let i = 0; i < keys.length; i++) {
      const spec = keys[i]!;
      const card = document.createElement('button');
      card.className = 'pf-card';
      card.dataset['key'] = String(i);
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 130;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#efe6d2';
      ctx.fillRect(0, 0, 300, 130);
      // side-view silhouette: the mountain line the pins will follow
      ctx.save();
      ctx.translate(14, 6);
      ctx.scale(0.9, 0.9);
      ctx.fillStyle =
        spec.finish === 'brass' ? '#b8933f' : spec.finish === 'nickelSilver' ? '#9aa09b' : '#8d6f31';
      ctx.fill(keySilhouettePath(spec, 300, 118));
      // bow mark: circle / triangle / square
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 7;
      const bx = 272;
      const by = 62;
      ctx.beginPath();
      if (i === 0) ctx.arc(bx, by, 20, 0, Math.PI * 2);
      else if (i === 1) {
        ctx.moveTo(bx, by - 22);
        ctx.lineTo(bx + 20, by + 14);
        ctx.lineTo(bx - 20, by + 14);
        ctx.closePath();
      } else ctx.rect(bx - 18, by - 18, 36, 36);
      ctx.stroke();
      ctx.restore();
      card.appendChild(canvas);
      const name = document.createElement('div');
      name.className = 'pf-name';
      name.textContent = spec.name;
      card.appendChild(name);
      card.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        cb.onSelectKey(i);
      });
      this.tray.appendChild(card);
      this.cards.push(card);
    }
    document.body.appendChild(this.tray);

    this.freeBtn = this.makeButton(
      'pf-free',
      // infinity loop icon
      '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="3"><path d="M10 18c-3 0-5-2.2-5-5s2-5 5-5c5 0 11 16 16 16 3 0 5-2.2 5-5s-2-5-5-5c-5 0-11 16-16 16-3 0-5-2.2-5-5s2-5 5-5" transform="translate(0,5) scale(1,0.75)"/></svg>',
      cb.onFreePlay
    );
    this.returnBtn = this.makeButton(
      'pf-return',
      // key returning to tray icon
      '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="10" cy="12" r="5"/><path d="M14 15l12 12M22 25h5M26 21v5"/></svg>',
      cb.onReturnKey
    );

    this.sentence = document.createElement('div');
    this.sentence.id = 'pf-sentence';
    document.body.appendChild(this.sentence);
  }

  private makeButton(id: string, svg: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'pf-btn pf-hidden';
    b.innerHTML = svg;
    b.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      fn();
    });
    document.body.appendChild(b);
    return b;
  }

  showTray(show: boolean): void {
    this.tray.classList.toggle('open', show);
  }

  showFreePlay(show: boolean): void {
    this.freeBtn.classList.toggle('pf-hidden', !show);
  }

  showReturnKey(show: boolean): void {
    this.returnBtn.classList.toggle('pf-hidden', !show);
  }

  say(text: string, seconds = 5): void {
    this.sentence.textContent = text;
    this.sentence.classList.add('show');
    window.clearTimeout(this.sentenceTimer);
    this.sentenceTimer = window.setTimeout(() => {
      this.sentence.classList.remove('show');
    }, seconds * 1000);
  }
}
