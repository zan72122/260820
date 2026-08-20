/**
 * DOM layer.
 *
 * Text is kept to a minimum and never says which way to go — direction is the
 * ears' job. What little text there is exists to teach the three gestures the
 * first time round, and to caption the voices for a grown-up sitting alongside.
 */
export class UI {
  constructor() {
    this.captionEl = document.getElementById('caption');
    this.hintEl = document.getElementById('hint');
    this.loadingEl = document.getElementById('loading');
    this.startEl = document.getElementById('start');
    this.againEl = document.getElementById('again');
    this.startBtn = document.getElementById('startBtn');
    this.againBtn = document.getElementById('againBtn');
    this._capTimer = 0;
    this._hintTimer = 0;
    this._hintQueue = [];
  }

  ready() {
    this.loadingEl.classList.add('hidden');
    this.startEl.classList.remove('hidden');
  }

  hideStart() {
    this.startEl.classList.add('fade');
    setTimeout(() => this.startEl.classList.add('hidden'), 460);
  }

  caption(text) {
    if (!text) return;
    this.captionEl.textContent = text;
    this.captionEl.classList.add('on');
    clearTimeout(this._capTimer);
    this._capTimer = setTimeout(() => this.captionEl.classList.remove('on'), 1500);
  }

  hint(text, ms = 4200) {
    clearTimeout(this._hintTimer);
    if (!text) { this.hintEl.classList.remove('on'); return; }
    this.hintEl.textContent = text;
    this.hintEl.classList.add('on');
    this._hintTimer = setTimeout(() => this.hintEl.classList.remove('on'), ms);
  }

  onPhase(phase, round) {
    switch (phase) {
      case 'show':
        this.againEl.classList.add('hidden');
        this.againEl.classList.remove('on');
        this.hint('スイカを よーく みてね', 2800);
        break;
      case 'tie':
        this.hint('めかくし！ もう みえないよ', 1600);
        break;
      case 'search':
        if (round === 0) {
          this.hint('よこに ドラッグ → むきをかえる', 4000);
          setTimeout(() => this.hint('うえに スッ → すすむ', 3600), 4300);
        }
        break;
      case 'aim':
        this.hint('した に おおきく スワイプ！', 6000);
        break;
      case 'reveal':
        this.hint('', 0);
        break;
      case 'again':
        this.againEl.classList.remove('hidden');
        this.againEl.classList.add('on');
        break;
      default:
        break;
    }
  }

  onBreak() {
    // nothing should compete with the reveal
    this.captionEl.classList.remove('on');
    this.hint('', 0);
  }
}
