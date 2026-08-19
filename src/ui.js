/* ------------------------------------------------------------------
   Wordless overlay: a fill gauge shaped like the truck, two animated
   hand hints, and one big lever that must be held down.
------------------------------------------------------------------- */

export class UI {
  constructor() {
    this.gauge = document.getElementById('gauge');
    this.gaugeFill = document.getElementById('gaugeFill');
    this.hintGo = document.getElementById('hintGo');
    this.hintAim = document.getElementById('hintAim');
    this.lever = document.getElementById('lever');
    this.leverProgress = document.getElementById('leverProgress');
    this.start = document.getElementById('start');
    this.loading = document.getElementById('loading');

    this.holding = false;
    this.hold = 0;
    this.holdNeeded = 0.55;
    this.onHoldComplete = null;
    this._lastFill = -1;

    const press = (on) => (e) => {
      e.preventDefault();
      if (this.lever.classList.contains('hidden')) return;
      this.holding = on;
      this.lever.classList.toggle('pressing', on);
      if (!on) this.hold = 0;
    };
    this.lever.addEventListener('pointerdown', press(true));
    window.addEventListener('pointerup', press(false));
    window.addEventListener('pointercancel', press(false));
    this.lever.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  hideLoading() { this.loading.classList.add('gone'); }

  showStart(cb) {
    const go = (e) => {
      e.preventDefault();
      this.start.classList.add('gone');
      this.start.removeEventListener('pointerdown', go);
      cb();
    };
    this.start.addEventListener('pointerdown', go);
  }

  setFill(f) {
    if (Math.abs(f - this._lastFill) < 0.004) return;
    this._lastFill = f;
    const h = 34 * f;
    this.gaugeFill.setAttribute('y', String(44 - h));
    this.gaugeFill.setAttribute('height', String(h));
  }

  popGauge() {
    this.gauge.classList.add('pop');
    clearTimeout(this._popT);
    this._popT = setTimeout(() => this.gauge.classList.remove('pop'), 130);
  }

  gaugeFullCheer(on) {
    this.gauge.classList.toggle('full', on);
  }

  showHint(which) {
    this.hintGo.classList.toggle('hidden', which !== 'go');
    this.hintAim.classList.toggle('hidden', which !== 'aim');
  }

  showLever(on) {
    this.lever.classList.toggle('hidden', !on);
    if (!on) { this.holding = false; this.hold = 0; this._setRing(0); }
  }

  _setRing(t) {
    this.leverProgress.style.strokeDashoffset = String(264 * (1 - t));
  }

  update(dt) {
    if (this.holding && !this.lever.classList.contains('hidden')) {
      this.hold += dt;
      const t = Math.min(1, this.hold / this.holdNeeded);
      this._setRing(t);
      if (t >= 1) {
        this.holding = false;
        this.hold = 0;
        this._setRing(0);
        this.lever.classList.remove('pressing');
        if (this.onHoldComplete) this.onHoldComplete();
      }
    } else if (this.hold === 0) {
      this._setRing(0);
    }
  }
}
