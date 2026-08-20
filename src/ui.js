import { PH } from './chapter.js';

const $ = (id) => document.getElementById(id);

const LINES = {
  [PH.ESTABLISH]: '信濃川 ― 長生橋。よるの かわは まっくろ。',
  [PH.WAIT_NIAGARA]: 'まず、はしに ひを つけよう',
  [PH.NIAGARA]: 'はしから ひかりが おちてくる！　ひかりの たき',
  [PH.CUE]: 'まもなく ―― 正三尺玉。そらを みて！',
  [PH.RISE]: 'あがれー！',
  [PH.BURST]: 'ドーン！！',
  [PH.WIDE]: 'したは ひかりの たき。うえは おおきな はなび。',
  [PH.AFTERGLOW]: 'けむりが ながれていく…',
};

const RESULT = {
  perfect: {
    title: 'だいせいこう！',
    body: 'したは キラキラの たき、うえは おおきな はなび。\nふたつ とも きみが おこしたよ。',
  },
  early: {
    title: 'できた！',
    body: 'ちょっと はやかったけど、ちゃんと ふたつ そろったね。\nつぎは たきを みてから あげてみよう。',
  },
  late: {
    title: 'きれい！',
    body: 'よく まってから あげたね。\nしたの たきと うえの はなびが かさなったよ。',
  },
};

export class UI {
  constructor(chapter) {
    this.ch = chapter;
    this.title = $('title');
    this.result = $('result');
    this.btnStart = $('btnStart');
    this.btnNiagara = $('btnNiagara');
    this.btnShell = $('btnShell');
    this.btnReplay = $('btnReplay');
    this.btnSound = $('btnSound');
    this.announce = $('announce');
    this.loading = $('loading');
    this._annT = 0;

    this.btnStart.addEventListener('click', () => this.onStart());
    this.btnNiagara.addEventListener('click', () => this.ch.lightNiagara());
    this.btnShell.addEventListener('click', () => this.ch.fireShell());
    this.btnReplay.addEventListener('click', () => this.onReplay());
    this.btnSound.addEventListener('click', () => this.toggleSound());

    // タイトルと結果は、どこを触っても進む
    this.title.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      this.advance();
    });
    this.result.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      this.advance();
    });

    // 画面のどこを触っても進む（4歳児向けの保険）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); }
    });
  }

  onStart() {
    if (this.ch.started) return;
    this.title.classList.add('fade-out');
    setTimeout(() => { this.title.hidden = true; }, 620);
    this.ch.begin();
  }

  onReplay() {
    if (this.ch.phase !== PH.RESULT) return;
    this.result.classList.add('fade-out');
    setTimeout(() => { this.result.hidden = true; this.result.classList.remove('fade-out'); }, 500);
    this.ch.reset();
    this.ch.begin();
    this._last = null;
  }

  /** キーボード／画面タップで、いまの段階を進める（章の状態を正とする） */
  advance() {
    const ch = this.ch;
    if (!ch.started) this.onStart();
    else if (ch.phase === PH.WAIT_NIAGARA) ch.lightNiagara();
    else if (ch.phase === PH.CUE) ch.fireShell();
    else if (ch.phase === PH.RESULT) this.onReplay();
  }

  toggleSound() {
    const on = this.btnSound.getAttribute('aria-pressed') !== 'true';
    this.btnSound.setAttribute('aria-pressed', String(on));
    $('soundIco').textContent = on ? '🔊' : '🔇';
    this.ch.snd.init();
    this.ch.snd.setEnabled(on);
  }

  showButton(btn, on) {
    if (on && btn.hidden) {
      btn.hidden = false;
      btn.classList.add('enter');
    } else if (!on && !btn.hidden) {
      btn.hidden = true;
      btn.classList.remove('enter');
    }
  }

  say(text, hold = 3.6) {
    if (this._last === text) return;
    this._last = text;
    this.announce.textContent = text;
    this.announce.classList.add('show');
    this._annT = hold;
  }

  onPhase(p) {
    const line = LINES[p];
    if (line) this.say(line, p === PH.WIDE ? 5.5 : 3.6);
    if (p === PH.RESULT) this.showResult();
  }

  showResult() {
    const g = this.ch.grade || { stars: 3, key: 'perfect' };
    const r = RESULT[g.key] || RESULT.perfect;
    $('resultStars').textContent = '★'.repeat(g.stars) + '☆'.repeat(3 - g.stars);
    $('resultTitle').textContent = r.title;
    $('resultBody').textContent = r.body;
    this.result.hidden = false;
    this.result.classList.remove('fade-out');
  }

  update(dt) {
    const ch = this.ch;
    this.showButton(this.btnNiagara, ch.phase === PH.WAIT_NIAGARA);
    this.showButton(this.btnShell, ch.phase === PH.CUE);
    document.body.classList.toggle('cinema', ch.cinema);
    const low = ch.phase === PH.BURST || ch.phase === PH.WIDE || ch.phase === PH.AFTERGLOW;
    this.announce.classList.toggle('caption', low);
    if (this._annT > 0) {
      this._annT -= dt;
      if (this._annT <= 0) this.announce.classList.remove('show');
    }
  }

  hideLoading() {
    if (!this.loading) return;
    this.loading.classList.add('gone');
    setTimeout(() => this.loading.remove(), 600);
  }
}
