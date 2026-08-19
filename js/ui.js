/* The only words on screen are a few kana, and every instruction is also
   shown as an animated finger so a pre-reader can copy it. */

const GLYPH = {
  circle: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"
              stroke-linecap="round" stroke-dasharray="150 40" opacity=".95"/>
      <g class="gFinger circleAnim"><g transform="translate(50,20)">
        <circle r="10.5" fill="#ffd23f" stroke="#fff" stroke-width="3.5"/>
      </g></g>
    </svg>`,
  scoop: `<svg viewBox="0 0 100 100">
      <path d="M18 55 Q50 82 82 55" fill="none" stroke="#fff" stroke-width="7"
            stroke-linecap="round" opacity=".95"/>
      <g class="gFinger scoopAnim">
        <circle cx="50" cy="47" r="11" fill="#ffd23f" stroke="#fff" stroke-width="3.5"/>
      </g>
    </svg>`,
  updown: `<svg viewBox="0 0 100 100">
      <path d="M50 16 L50 84" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>
      <path d="M38 27 L50 14 L62 27" fill="none" stroke="#fff" stroke-width="6.5"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M38 73 L50 86 L62 73" fill="none" stroke="#fff" stroke-width="6.5"
            stroke-linecap="round" stroke-linejoin="round"/>
      <g class="gFinger swipeAnim">
        <circle cx="50" cy="50" r="11.5" fill="#ffd23f" stroke="#fff" stroke-width="3.5"/>
      </g>
    </svg>`,
  pull: `<svg viewBox="0 0 100 100">
      <path d="M34 24 L50 8 L66 24" fill="none" stroke="#fff" stroke-width="8"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50 12 L50 62" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
      <g class="gFinger pullAnim">
        <circle cx="50" cy="72" r="13" fill="#ff5a3c" stroke="#fff" stroke-width="4"/>
      </g>
    </svg>`,
  tap: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="5" opacity=".55"/>
      <g class="gFinger tapAnim">
        <circle cx="50" cy="50" r="15" fill="#ffd23f" stroke="#fff" stroke-width="4"/>
      </g>
    </svg>`,
  none: '',
};

export class UI {
  constructor() {
    this.coach = document.getElementById('coach');
    this.coachArt = document.getElementById('coachArt');
    this.coachText = document.getElementById('coachText');
    this.ring = document.getElementById('ring');
    this.ringFg = document.getElementById('ringFg');
    this.tally = document.getElementById('tally');
    this.tallyNum = document.getElementById('tallyNum');
    this.flash = document.getElementById('flash');
    this.start = document.getElementById('start');
    this.startBtn = document.getElementById('startBtn');
    this.sndBtn = document.getElementById('sndBtn');
    this.againBtn = document.getElementById('againBtn');
    this._glyph = null;
    this._text = null;
  }

  say(text, glyph = 'none', big = false) {
    if (text === this._text && glyph === this._glyph && this.coach.classList.contains('shown')) return;
    this._text = text; this._glyph = glyph;
    if (!text) { this.coach.classList.add('hidden'); this.coach.classList.remove('shown'); return; }
    this.coachText.textContent = text;
    this.coachArt.innerHTML = GLYPH[glyph] ?? '';
    this.coach.classList.toggle('hideArt', !GLYPH[glyph]);
    this.coach.classList.toggle('big', big);
    this.coach.classList.remove('hidden');
    this.coach.classList.add('shown');
  }
  hideSay() { this.coach.classList.add('hidden'); this.coach.classList.remove('shown'); this._text = null; }

  showRing(on) { this.ring.classList.toggle('hidden', !on); }
  setRing(p) {
    const C = 2 * Math.PI * 52;
    this.ringFg.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, p))));
  }
  ringAt(xPx, yPx) {
    this.ring.style.left = xPx + 'px';
    this.ring.style.top = yPx + 'px';
  }

  setTally(n) {
    this.tally.classList.remove('hidden');
    this.tallyNum.textContent = String(n);
    this.tally.classList.remove('pop');
    void this.tally.offsetWidth;
    this.tally.classList.add('pop');
  }

  doFlash() {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }

  hideStart() {
    this.start.classList.add('away');
    setTimeout(() => this.start.classList.add('hidden'), 600);
    this.sndBtn.classList.remove('hidden');
    this.againBtn.classList.remove('hidden');
  }
}
