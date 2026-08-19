// 画面の文字とゆびのヒント。ボタンは置かず、ことばと動きだけで伝える。

const PROGRESS_R = 34;

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="basketCount"><span class="icon">🎍</span><span class="num">0</span></div>
      <div id="rotate">よこ・たてどちらでも あそべます</div>
      <div id="gesture">
        <div id="trail"></div>
        <div id="finger"></div>
        <div id="arrow">⬆️</div>
      </div>
      <div id="progress">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="${PROGRESS_R}" fill="rgba(255,252,244,0.35)" stroke="rgba(90,70,36,0.35)" stroke-width="9"/>
          <circle id="progressArc" cx="44" cy="44" r="${PROGRESS_R}" fill="none" stroke="#f0c36a"
            stroke-width="9" stroke-linecap="round" transform="rotate(-90 44 44)"
            stroke-dasharray="${2 * Math.PI * PROGRESS_R}" stroke-dashoffset="${2 * Math.PI * PROGRESS_R}"/>
        </svg>
      </div>
      <div id="prompt"><div class="main"></div><div class="sub"></div></div>
      <div id="title"><div class="big"></div><div class="small"></div></div>
      <div id="flash"></div>
    `;
    this.el = {
      count: root.querySelector('#basketCount'),
      num: root.querySelector('#basketCount .num'),
      gesture: root.querySelector('#gesture'),
      progress: root.querySelector('#progress'),
      arc: root.querySelector('#progressArc'),
      prompt: root.querySelector('#prompt'),
      main: root.querySelector('#prompt .main'),
      sub: root.querySelector('#prompt .sub'),
      title: root.querySelector('#title'),
      titleBig: root.querySelector('#title .big'),
      titleSmall: root.querySelector('#title .small'),
      flash: root.querySelector('#flash'),
      rotate: root.querySelector('#rotate'),
    };
    this.circumference = 2 * Math.PI * PROGRESS_R;
    this._gestureKind = null;
    this._prompt = '';
    setTimeout(() => { this.el.rotate.style.opacity = '0'; }, 6000);
  }

  setPrompt(main, sub = '') {
    const key = main + '|' + sub;
    if (key === this._prompt) return;
    this._prompt = key;
    if (!main) {
      this.el.prompt.classList.remove('show');
      return;
    }
    this.el.main.textContent = main;
    this.el.sub.textContent = sub;
    this.el.prompt.classList.add('show');
  }

  /** @param {null|'tap'|'swipe'|'circle'|'cut'|'pull'} kind */
  setGesture(kind, pos = null) {
    if (kind !== this._gestureKind) {
      this._gestureKind = kind;
      this.el.gesture.className = kind ? kind + ' show' : '';
    }
    if (pos) {
      this.el.gesture.style.left = pos.x + 'px';
      this.el.gesture.style.top = pos.y + 'px';
    }
  }

  setProgress(v) {
    if (v === null || v === undefined) {
      this.el.progress.classList.remove('show');
      return;
    }
    this.el.progress.classList.add('show');
    this.el.arc.setAttribute('stroke-dashoffset', String(this.circumference * (1 - Math.min(1, Math.max(0, v)))));
  }

  setCount(n) {
    if (this.el.num.textContent === String(n)) return;
    this.el.num.textContent = String(n);
    this.el.count.classList.remove('bump');
    void this.el.count.offsetWidth;
    this.el.count.classList.add('bump');
  }

  flash(text) {
    this.el.flash.textContent = text;
    this.el.flash.classList.remove('pop');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('pop');
  }

  showTitle(big, small) {
    if (!big) {
      this.el.title.classList.remove('show');
      return;
    }
    this.el.titleBig.textContent = big;
    this.el.titleSmall.textContent = small || '';
    this.el.title.classList.add('show');
  }
}
