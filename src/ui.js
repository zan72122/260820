// 画面表示 -- 文字に頼らない。絵と動きだけで次の操作を伝える。
const SVGNS = 'http://www.w3.org/2000/svg';

const HAND = `<path d="M31 62 V30 a5 5 0 0 1 10 0 v-9 a5 5 0 0 1 10 0 v9 a5 5 0 0 1 10 0 v13 a5 5 0 0 1 9 3
 v14 c0 12-8 21-20 21 h-9 c-7 0-11-3-14-8 L18 55 a5.5 5.5 0 0 1 9-6 z"
 fill="#fff" stroke="#2a2118" stroke-width="3.4" stroke-linejoin="round"/>`;

export class UI {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hint" id="hint">
        <svg viewBox="0 0 100 100" class="hand">${HAND}</svg>
        <svg viewBox="0 0 120 160" class="arrows" id="arrows"></svg>
      </div>
      <div class="steps" id="steps"></div>
      <button class="iconbtn sound" id="sound" aria-label="sound"></button>
      <div class="bigbtn" id="bigbtn"><div class="ring"></div><div class="glyph" id="bigglyph"></div></div>
      <div class="vignette"></div>
      <div class="flash" id="flash"></div>
    `;
    this.hint = root.querySelector('#hint');
    this.arrows = root.querySelector('#arrows');
    this.steps = root.querySelector('#steps');
    this.bigbtn = root.querySelector('#bigbtn');
    this.bigglyph = root.querySelector('#bigglyph');
    this.flashEl = root.querySelector('#flash');
    this.soundBtn = root.querySelector('#sound');
    this.muted = false;
    this._drawSound();
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.muted = !this.muted;
      this._drawSound();
      if (this.onMute) this.onMute(this.muted);
    });
    this.hint.style.opacity = '0';
    this.bigbtn.style.display = 'none';
    this.stepEls = [];
  }
  _drawSound() {
    this.soundBtn.innerHTML = `<svg viewBox="0 0 40 40">
      <path d="M9 16 h6 l8-6 v20 l-8-6 H9 z" fill="#fff8ec"/>
      ${this.muted
        ? '<path d="M27 14 L35 26 M35 14 L27 26" stroke="#fff8ec" stroke-width="3.2" stroke-linecap="round"/>'
        : '<path d="M27 14 a9 9 0 0 1 0 12 M31 10 a15 15 0 0 1 0 20" stroke="#fff8ec" stroke-width="3" fill="none" stroke-linecap="round"/>'}
      </svg>`;
  }

  /* type: tap | down | up | across | circle */
  showHint(type, x = null, y = null) {
    this.hint.dataset.type = type;
    this.hint.style.opacity = '1';
    let a = '';
    if (type === 'down') a = `<g class="chev cdown"><path d="M28 96 L60 128 L92 96" /><path d="M28 60 L60 92 L92 60" opacity=".6"/></g>`;
    else if (type === 'up') a = `<g class="chev cup"><path d="M28 64 L60 32 L92 64" /><path d="M28 100 L60 68 L92 100" opacity=".6"/></g>`;
    else if (type === 'across') a = `<g class="chev cacross"><path d="M40 40 L72 72 L40 104"/><path d="M4 40 L36 72 L4 104" opacity=".6"/></g>`;
    else if (type === 'circle') a = `<g class="chev ccircle"><circle cx="60" cy="76" r="34" stroke-dasharray="10 9"/><path d="M84 54 L94 62 L82 70"/></g>`;
    this.arrows.innerHTML = a;
    this.setHintPos(x, y);
  }
  setHintPos(x, y) {
    if (x == null) { this.hint.style.left = '50%'; this.hint.style.top = '62%'; }
    else { this.hint.style.left = x + 'px'; this.hint.style.top = y + 'px'; }
  }
  hideHint() { this.hint.style.opacity = '0'; }

  setSteps(n) {
    this.steps.innerHTML = '';
    this.stepEls = [];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'stepdot';
      this.steps.appendChild(d);
      this.stepEls.push(d);
    }
  }
  setStep(i) {
    this.stepEls.forEach((d, k) => {
      d.classList.toggle('on', k < i);
      d.classList.toggle('cur', k === i);
    });
  }
  clearSteps() { this.steps.innerHTML = ''; this.stepEls = []; }

  showBig(glyph, cb) {
    this.bigglyph.innerHTML = glyph;
    this.bigbtn.style.display = 'flex';
    requestAnimationFrame(() => this.bigbtn.classList.add('in'));
    this._bigcb = cb;
    this.bigbtn.onclick = (e) => { e.stopPropagation(); this.hideBig(); cb && cb(); };
  }
  hideBig() { this.bigbtn.classList.remove('in'); this.bigbtn.style.display = 'none'; }

  flash(color = 'rgba(255,240,210,0.55)', ms = 420) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
      this.flashEl.style.opacity = '0';
    });
  }
}

export const GLYPH = {
  kine: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="76" rx="34" ry="13" fill="#cfa06b"/>
    <path d="M16 76 v-6 c0-8 15-13 34-13 s34 5 34 13 v6" fill="#b8875a"/>
    <rect x="41" y="14" width="18" height="46" rx="7" fill="#e6c295" stroke="#a97c4d" stroke-width="2"/>
    <rect x="20" y="20" width="60" height="9" rx="4.5" fill="#d9b184" stroke="#a97c4d" stroke-width="2"/>
    <ellipse cx="50" cy="62" rx="20" ry="8" fill="#fdfaf3"/>
  </svg>`,
  replay: `<svg viewBox="0 0 100 100">
    <path d="M50 20 a30 30 0 1 0 30 30" fill="none" stroke="#fff8ec" stroke-width="9" stroke-linecap="round"/>
    <path d="M36 12 L54 22 L34 34 Z" fill="#fff8ec"/>
  </svg>`,
};
