import { Palette } from '../game/palettes';

type HintIcon = 'up' | 'side' | 'tap';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function swatchRow(colors: number[]) {
  const row = el('div', 'swatches');
  for (const c of colors) {
    const s = el('div', 'swatch');
    const hex = `#${c.toString(16).padStart(6, '0')}`;
    s.style.background = `radial-gradient(circle at 34% 28%, #fff8, ${hex} 62%, ${hex})`;
    row.appendChild(s);
  }
  return row;
}

/** CSS is used only for lightweight chrome — every game object lives in WebGL. */
export class UI {
  private root: HTMLElement;
  private titleLayer: HTMLElement;
  private hintLayer: HTMLElement;
  private hintCard: HTMLElement;
  private hintIcon: HTMLElement;
  private hintText: HTMLElement;
  private finishLayer: HTMLElement;
  private settingsLayer: HTMLElement;
  private doneBtn: HTMLButtonElement;
  private choiceRow: HTMLElement;
  private loading: HTMLElement;
  private gear!: HTMLButtonElement;

  onStart: () => void = () => {};
  onDone: () => void = () => {};
  onReplay: (samePalette: boolean) => void = () => {};
  onReduceMotion: (v: boolean) => void = () => {};
  onMute: (v: boolean) => void = () => {};

  reduceMotion = false;
  muted = false;

  constructor(root: HTMLElement) {
    this.root = root;

    this.loading = el('div', '', 'MIRROR GLAZE');
    this.loading.id = 'loading';
    root.appendChild(this.loading);

    // ---- title -----------------------------------------------------------
    this.titleLayer = el('div', 'layer');
    this.titleLayer.id = 'title';
    const brand = el(
      'div',
      'brand',
      '<span class="jp">ミラーグレーズ アトリエ</span><span class="en">Mirror Glaze Atelier</span>'
    );
    const startBtn = el('button', 'big-button');
    startBtn.appendChild(swatchRow([0xff9dbe, 0xfff2e4, 0xa8d8f6]));
    startBtn.appendChild(el('span', '', 'はじめる'));
    startBtn.addEventListener('click', () => this.onStart());
    this.titleLayer.append(brand, startBtn);
    root.appendChild(this.titleLayer);

    // ---- hint ------------------------------------------------------------
    this.hintLayer = el('div', 'layer');
    this.hintLayer.id = 'hint';
    this.hintCard = el('div', 'hint-card');
    this.hintIcon = el('div', 'hint-icon up');
    this.hintText = el('span', '', '');
    this.hintCard.append(this.hintIcon, this.hintText);
    this.hintLayer.appendChild(this.hintCard);
    root.appendChild(this.hintLayer);

    // ---- done ------------------------------------------------------------
    this.doneBtn = el('button');
    this.doneBtn.id = 'done';
    this.doneBtn.appendChild(el('span', 'check'));
    this.doneBtn.appendChild(el('span', '', 'できた'));
    this.doneBtn.addEventListener('click', () => this.onDone());
    root.appendChild(this.doneBtn);

    // ---- finish ----------------------------------------------------------
    this.finishLayer = el('div', 'layer');
    this.finishLayer.id = 'finish';
    this.finishLayer.appendChild(el('div', 'finish-title', 'できあがり！'));
    this.choiceRow = el('div', 'choices');
    this.finishLayer.appendChild(this.choiceRow);
    root.appendChild(this.finishLayer);

    // ---- settings --------------------------------------------------------
    const gear = el('button', '', '⚙');
    this.gear = gear;
    gear.id = 'gear';
    gear.addEventListener('click', () => this.toggleSettings());
    root.appendChild(gear);

    this.settingsLayer = el('div', 'layer');
    this.settingsLayer.id = 'settings';
    const motion = this.makeToggle('うごきを よわく', false, (v) => {
      this.reduceMotion = v;
      this.onReduceMotion(v);
    });
    const sound = this.makeToggle('おと', true, (v) => {
      this.muted = !v;
      this.onMute(!v);
    });
    const close = el('button', 'big-button');
    close.appendChild(el('span', '', 'とじる'));
    close.addEventListener('click', () => this.toggleSettings(false));
    this.settingsLayer.append(motion, sound, close);
    root.appendChild(this.settingsLayer);
  }

  private makeToggle(label: string, initial: boolean, cb: (v: boolean) => void) {
    const b = el('button', 'toggle');
    const l = el('span', '', label);
    const s = el('span', 'state', initial ? 'オン' : 'オフ');
    if (!initial) s.classList.add('off');
    let v = initial;
    b.addEventListener('click', () => {
      v = !v;
      s.textContent = v ? 'オン' : 'オフ';
      s.classList.toggle('off', !v);
      cb(v);
    });
    b.append(l, s);
    return b;
  }

  private settingsOpen = false;
  toggleSettings(force?: boolean) {
    this.settingsOpen = force ?? !this.settingsOpen;
    this.settingsLayer.classList.toggle('show', this.settingsOpen);
  }

  get settingsVisible() {
    return this.settingsOpen;
  }

  ready() {
    this.loading.classList.add('hide');
    setTimeout(() => this.loading.remove(), 600);
  }

  showGear(v: boolean) {
    this.gear.style.display = v ? 'flex' : 'none';
    if (!v) this.toggleSettings(false);
  }

  showTitle(v: boolean) {
    this.titleLayer.classList.toggle('show', v);
  }

  private lastHint: string | null = null;
  hint(text: string | null, icon: HintIcon = 'tap') {
    if (text === this.lastHint) return;
    this.lastHint = text;
    if (!text) {
      this.hintLayer.classList.remove('show');
      return;
    }
    this.hintText.textContent = text;
    this.hintIcon.className = `hint-icon ${icon}`;
    this.hintLayer.classList.add('show');
  }

  showDone(v: boolean) {
    this.doneBtn.classList.toggle('show', v);
  }

  showFinish(current: Palette, next: Palette, v: boolean) {
    if (v) {
      this.choiceRow.innerHTML = '';
      const same = el('button', 'choice');
      same.appendChild(swatchRow(current.colors));
      same.appendChild(el('span', '', 'おなじいろ'));
      same.addEventListener('click', () => this.onReplay(true));

      const other = el('button', 'choice');
      other.appendChild(swatchRow(next.colors));
      other.appendChild(el('span', '', next.name));
      other.addEventListener('click', () => this.onReplay(false));

      this.choiceRow.append(same, other);
    }
    this.finishLayer.classList.toggle('show', v);
  }

  get element() {
    return this.root;
  }
}
