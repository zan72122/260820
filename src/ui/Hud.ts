/* ------------------------------------------------------------------ *
 * DOM overlay.  Deliberately tiny: one round gauge that mirrors the
 * real roll growing inside the machine, a bale counter, one big button
 * at a time, and a hand that shows a four-year-old what to do.
 * ------------------------------------------------------------------ */

const ICON_BALE = `<svg class="bale-ico" viewBox="0 0 40 40" aria-hidden="true">
  <circle cx="20" cy="20" r="17" fill="#ecefe9" stroke="#9aa398" stroke-width="2"/>
  <circle cx="20" cy="20" r="12" fill="none" stroke="#c3cabf" stroke-width="1.6"/>
  <circle cx="20" cy="20" r="7" fill="none" stroke="#c3cabf" stroke-width="1.6"/>
  <circle cx="20" cy="20" r="2.6" fill="#c3cabf"/>
</svg>`;

const ICON_WRAP = `<svg class="ico" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="19" fill="#fbfcfa" stroke="#5c6459" stroke-width="2.5"/>
  <path d="M8 17h32M7 24h34M8 31h32" stroke="#aab2a6" stroke-width="2.4" fill="none"/>
  <path d="M24 5a19 19 0 0 1 0 38" fill="none" stroke="#7d8779" stroke-width="2.4"/>
  <path d="M38 8l5-3 2 5" fill="none" stroke="#3a4038" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ICON_GATE = `<svg class="ico" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M24 6 L38 22 H30 V40 H18 V22 H10 Z" fill="#3a2a08" stroke="#241a06" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

const ICON_HAND = `<svg class="hand" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M26 40V16a4 4 0 0 1 8 0v18" fill="#f6e2c8" stroke="#5a4326" stroke-width="2.5"/>
  <path d="M34 30a4 4 0 0 1 8 0v6" fill="#f6e2c8" stroke="#5a4326" stroke-width="2.5"/>
  <path d="M42 32a4 4 0 0 1 8 0v10c0 9-6 16-15 16h-4c-8 0-11-5-13-10l-5-11a4 4 0 0 1 7-4l4 7"
        fill="#f6e2c8" stroke="#5a4326" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

const ICON_SOUND_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;
const ICON_SOUND_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>`;

const STEP_RICE = `<svg viewBox="0 0 60 60"><g stroke="#c8b45c" stroke-width="3" stroke-linecap="round" fill="none">
  <path d="M18 54V26M30 54V18M42 54V28"/></g>
  <g fill="#e0c25e"><ellipse cx="18" cy="22" rx="5" ry="9"/><ellipse cx="30" cy="14" rx="5.5" ry="10"/><ellipse cx="42" cy="24" rx="5" ry="9"/></g>
  <rect x="6" y="52" width="48" height="5" rx="2" fill="#6d5636"/></svg>`;
const STEP_MACHINE = `<svg viewBox="0 0 60 60">
  <rect x="8" y="20" width="36" height="24" rx="4" fill="#44603a" stroke="#243019" stroke-width="2"/>
  <circle cx="26" cy="32" r="8" fill="#8e8341" stroke="#2b2b18" stroke-width="2"/>
  <rect x="42" y="26" width="12" height="12" rx="2" fill="#bf5b18"/>
  <circle cx="16" cy="47" r="6" fill="#1c1e1b"/><circle cx="38" cy="47" r="6" fill="#1c1e1b"/></svg>`;
const STEP_BALE = `<svg viewBox="0 0 60 60">
  <circle cx="30" cy="32" r="20" fill="#eef1ec" stroke="#8e9689" stroke-width="2.5"/>
  <circle cx="30" cy="32" r="13" fill="none" stroke="#c3cabf" stroke-width="2"/>
  <circle cx="30" cy="32" r="6" fill="none" stroke="#c3cabf" stroke-width="2"/>
  <path d="M8 15c4 4 4 8 0 12" fill="none" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/></svg>`;

export type ActionKind = 'amber' | 'wrap';

export class Hud {
  private gauge!: HTMLElement;
  private ringFg!: SVGCircleElement;
  private core!: SVGCircleElement;
  private numEl!: HTMLElement;
  private captionEl!: HTMLElement;
  private actionEl!: HTMLButtonElement;
  private hintEl!: HTMLElement;
  private hintTxt!: HTMLElement;
  private dot!: HTMLElement;
  private overlay!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private fadeEl!: HTMLElement;

  private ringLen = 0;
  private actionHandler: (() => void) | null = null;

  onStart: () => void = () => {};
  onSoundToggle: (muted: boolean) => void = () => {};
  private muted = false;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="topbar">
        <div class="gauge" id="gauge">
          <svg viewBox="0 0 100 100">
            <defs>
              <radialGradient id="straw" cx="38%" cy="34%" r="72%">
                <stop offset="0%" stop-color="#e8d488"/>
                <stop offset="55%" stop-color="#c1a94e"/>
                <stop offset="100%" stop-color="#8a7530"/>
              </radialGradient>
            </defs>
            <circle class="ring-bg" cx="50" cy="50" r="44"/>
            <circle class="core" cx="50" cy="50" r="6"/>
            <circle class="core-line" cx="50" cy="50" r="3" />
            <circle class="ring-fg" cx="50" cy="50" r="44"/>
          </svg>
        </div>
        <div class="counter">${ICON_BALE}<span class="num" id="num">0</span></div>
      </div>

      <div class="caption" id="caption"><div class="big"></div><div class="sub"></div></div>

      <button class="action" id="action" type="button"><span class="ico-slot"></span><span class="label"></span></button>

      <div class="hint" id="hint">${ICON_HAND}<div class="txt"></div></div>
      <div class="touchdot" id="dot"></div>

      <button class="sound" id="sound" type="button" aria-label="おと">${ICON_SOUND_ON}</button>

      <div class="overlay" id="overlay">
        <h1>いねロール</h1>
        <div class="tag">しりょういね ＷＣＳ</div>
        <div class="steps">
          <div class="step">${STEP_RICE}<span>いねを あつめる</span></div>
          <div class="arrow">▶</div>
          <div class="step">${STEP_MACHINE}<span>なかで まるくなる</span></div>
          <div class="arrow">▶</div>
          <div class="step">${STEP_BALE}<span>ゴロン！と でてくる</span></div>
        </div>
        <button class="start" id="start" type="button">あそぶ</button>
        <div class="note">ゆびで さわって すすむ ／ よこに うごかして まがる</div>
      </div>

      <div class="fade-black" id="fade"></div>
    `;

    this.gauge = root.querySelector('#gauge')!;
    this.ringFg = root.querySelector('.ring-fg')!;
    this.core = root.querySelector('.core')!;
    this.numEl = root.querySelector('#num')!;
    this.captionEl = root.querySelector('#caption')!;
    this.actionEl = root.querySelector('#action')!;
    this.hintEl = root.querySelector('#hint')!;
    this.hintTxt = root.querySelector('#hint .txt')!;
    this.dot = root.querySelector('#dot')!;
    this.overlay = root.querySelector('#overlay')!;
    this.soundBtn = root.querySelector('#sound')!;
    this.fadeEl = root.querySelector('#fade')!;

    const r = 44;
    this.ringLen = 2 * Math.PI * r;
    this.ringFg.setAttribute('stroke-dasharray', `${this.ringLen}`);
    this.ringFg.setAttribute('stroke-dashoffset', `${this.ringLen}`);

    this.actionEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.actionHandler?.();
    });
    root.querySelector('#start')!.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.onStart();
    });
    this.soundBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.muted = !this.muted;
      this.soundBtn.innerHTML = this.muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
      this.onSoundToggle(this.muted);
    });
  }

  /* --- gauge: same numbers the 3-D roll uses --------------------- */
  setFill(f: number) {
    const c = Math.max(0, Math.min(1, f));
    this.ringFg.setAttribute('stroke-dashoffset', `${this.ringLen * (1 - c)}`);
    // radius mirrors the chamber: grows by area, matching the real roll
    const r = Math.sqrt(36 + (34 * 34 - 36) * c);
    this.core.setAttribute('r', `${r}`);
    this.gauge.classList.toggle('full', c >= 0.999);
  }

  setCount(n: number, bump = false) {
    this.numEl.textContent = String(n);
    if (bump) {
      this.numEl.classList.remove('bump');
      void this.numEl.offsetWidth;
      this.numEl.classList.add('bump');
    }
  }

  caption(big: string, sub = '') {
    (this.captionEl.querySelector('.big') as HTMLElement).textContent = big;
    (this.captionEl.querySelector('.sub') as HTMLElement).textContent = sub;
    this.captionEl.classList.add('show');
  }

  hideCaption() {
    this.captionEl.classList.remove('show');
  }

  action(label: string, kind: ActionKind, handler: () => void) {
    this.actionHandler = handler;
    (this.actionEl.querySelector('.label') as HTMLElement).textContent = label;
    (this.actionEl.querySelector('.ico-slot') as HTMLElement).innerHTML =
      kind === 'wrap' ? ICON_WRAP : ICON_GATE;
    this.actionEl.classList.toggle('wrap-btn', kind === 'wrap');
    this.actionEl.classList.add('show', 'pulse');
  }

  hideAction() {
    this.actionHandler = null;
    this.actionEl.classList.remove('show', 'pulse');
  }

  hint(text: string) {
    this.hintTxt.textContent = text;
    this.hintEl.classList.add('show');
  }

  hideHint() {
    this.hintEl.classList.remove('show');
  }

  touch(on: boolean, clientX = 0, clientY = 0) {
    this.dot.classList.toggle('on', on);
    if (on) {
      this.dot.style.left = `${clientX}px`;
      this.dot.style.top = `${clientY}px`;
    }
  }

  hideTitle() {
    this.overlay.classList.add('hide');
  }

  fade(on: boolean) {
    this.fadeEl.classList.toggle('on', on);
  }
}
