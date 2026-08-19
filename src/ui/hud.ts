import { FLAVOURS, type FlavourId } from '../core/tuning';

const PHASE_COUNT = 5;

export interface HudHandlers {
  onReplay: () => void;
  onFlavour: (id: FlavourId) => void;
  onToggleSound: () => void;
  onToggleSoftLight: () => void;
  onRestart: () => void;
}

/**
 * CSS is used for exactly three things: the coaching line, the settings and the
 * finish card. Everything the player looks at is real 3D.
 */
export class Hud {
  private root: HTMLElement;
  private coach: HTMLElement;
  private pips: HTMLElement;
  private ring: HTMLElement;
  private swipe: HTMLElement;
  private finish: HTMLElement;
  private fatal: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private lightBtn: HTMLButtonElement;
  private flavourBtns: HTMLButtonElement[] = [];
  private boot: HTMLElement | null;

  constructor(root: HTMLElement, h: HudHandlers) {
    this.root = root;
    this.boot = document.getElementById('boot');

    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    root.appendChild(vignette);

    this.coach = document.createElement('div');
    this.coach.className = 'coach';
    this.coach.setAttribute('role', 'status');
    root.appendChild(this.coach);

    this.pips = document.createElement('div');
    this.pips.className = 'pips';
    for (let i = 0; i < PHASE_COUNT; i++) this.pips.appendChild(document.createElement('i'));
    root.appendChild(this.pips);

    const tools = document.createElement('div');
    tools.className = 'tools';
    this.soundBtn = this.iconButton('🔊', 'おと', h.onToggleSound);
    this.lightBtn = this.iconButton('🔅', 'ひかりをよわく', h.onToggleSoftLight);
    tools.append(this.soundBtn, this.lightBtn);
    root.appendChild(tools);

    this.ring = document.createElement('div');
    this.ring.className = 'ring';
    root.appendChild(this.ring);

    this.swipe = document.createElement('div');
    this.swipe.className = 'swipe';
    // Drawn twice: a dark casing first, so the arrow reads over white meringue
    // and over a dark worktop alike.
    this.swipe.innerHTML = `<svg viewBox="0 0 54 110" aria-hidden="true">
      <g fill="none" stroke="rgba(24,16,12,0.55)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
        <line x1="27" y1="14" x2="27" y2="84"/>
        <polyline points="12,68 27,88 42,68"/>
      </g>
      <g fill="none" stroke="rgba(255,232,196,0.98)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="27" y1="14" x2="27" y2="84"/>
        <polyline points="12,68 27,88 42,68"/>
      </g></svg>`;
    root.appendChild(this.swipe);

    this.finish = document.createElement('div');
    this.finish.className = 'finish';
    const title = document.createElement('p');
    title.className = 'finish__title';
    title.textContent = 'できあがり！';
    const flavours = document.createElement('div');
    flavours.className = 'flavors';
    for (const f of FLAVOURS) {
      const b = document.createElement('button');
      b.className = 'flavor';
      b.style.background = f.swatch;
      b.setAttribute('aria-label', f.label);
      b.dataset.id = f.id;
      b.addEventListener('click', () => {
        h.onFlavour(f.id);
        this.setFlavour(f.id);
      });
      this.flavourBtns.push(b);
      flavours.appendChild(b);
    }
    const replay = document.createElement('button');
    replay.className = 'replay';
    replay.textContent = 'もういちど';
    replay.addEventListener('click', h.onReplay);
    this.finish.append(title, flavours, replay);
    root.appendChild(this.finish);

    this.fatal = document.createElement('div');
    this.fatal.className = 'fatal';
    const fp = document.createElement('p');
    fp.textContent =
      'えがめんが とまりました。もういちど はじめてね。 (グラフィックスが停止しました)';
    const fb = document.createElement('button');
    fb.className = 'replay replay--restart';
    fb.textContent = 'さいスタート';
    fb.addEventListener('click', h.onRestart);
    this.fatal.append(fp, fb);
    root.appendChild(this.fatal);
  }

  private iconButton(glyph: string, label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'iconbtn';
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  hideBoot(): void {
    if (!this.boot) return;
    this.boot.classList.add('is-hidden');
    window.setTimeout(() => this.boot?.remove(), 700);
    this.boot = null;
  }

  setBootHint(text: string): void {
    const el = document.getElementById('boot-hint');
    if (el) el.textContent = text;
  }

  setCoach(text: string | null): void {
    if (!text) {
      this.coach.classList.remove('is-on');
      return;
    }
    if (this.coach.textContent !== text) this.coach.textContent = text;
    this.coach.classList.add('is-on');
  }

  setPhaseIndex(i: number): void {
    const on = i >= 0;
    this.pips.classList.toggle('is-on', on);
    const kids = Array.from(this.pips.children) as HTMLElement[];
    kids.forEach((k, n) => {
      k.classList.toggle('is-done', n < i);
      k.classList.toggle('is-now', n === i);
    });
  }

  showRing(x: number, y: number): void {
    this.ring.style.left = `${x}px`;
    this.ring.style.top = `${y}px`;
    this.ring.classList.add('is-on');
  }

  hideRing(): void {
    this.ring.classList.remove('is-on');
  }

  showSwipe(x: number, y: number, dir: 'up' | 'down'): void {
    this.swipe.style.left = `${x}px`;
    this.swipe.style.top = `${y}px`;
    this.swipe.classList.toggle('is-up', dir === 'up');
    this.swipe.classList.add('is-on');
  }

  hideSwipe(): void {
    this.swipe.classList.remove('is-on');
  }

  showFinish(on: boolean): void {
    this.finish.classList.toggle('is-on', on);
  }

  setFlavour(id: FlavourId): void {
    for (const b of this.flavourBtns) b.classList.toggle('is-on', b.dataset.id === id);
  }

  setSound(on: boolean): void {
    this.soundBtn.textContent = on ? '🔊' : '🔇';
    this.soundBtn.classList.toggle('is-off', !on);
  }

  setSoftLight(on: boolean): void {
    this.lightBtn.textContent = on ? '🔅' : '🔆';
    this.lightBtn.classList.toggle('is-off', on);
  }

  showFatal(on: boolean): void {
    this.fatal.classList.toggle('is-on', on);
  }

  dispose(): void {
    this.root.innerHTML = '';
  }
}
