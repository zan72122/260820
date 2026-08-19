/** Wordless overlay: a tap hint, a drag hint, a running count, and a mute pip. */
export class UI {
  private hint: HTMLElement;
  private swipe: HTMLElement;
  private counter: HTMLElement;
  private countValue: HTMLElement;
  private next: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private bumpTimer = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hint" id="ui-hint">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle class="ripple" cx="32" cy="30" r="16" fill="none" stroke="#fff8e8" stroke-width="3"/>
          <g class="finger">
            <path d="M28 18c0-2.6 2-4.6 4.4-4.6S37 15.4 37 18v12l4.6 1.6c3 1 4.8 4 4.3 7.1l-1.5 9.2c-.5 3.3-3.4 5.7-6.7 5.7h-8.3c-2.2 0-4.3-1-5.6-2.8l-6.4-8.6c-1.2-1.7-.8-4 .8-5.2 1.5-1.1 3.6-.9 4.9.4l3.9 4V18z"
              fill="#fff4e0" stroke="#5a4a34" stroke-width="1.6" stroke-linejoin="round"/>
          </g>
        </svg>
      </div>

      <div class="swipe" id="ui-swipe">
        <svg viewBox="0 0 150 66" aria-hidden="true">
          <path d="M14 33h22M136 33h-22" stroke="#fff8e8" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
          <path d="M8 33l10-7v14zM142 33l-10-7v14z" fill="#fff8e8" opacity="0.85"/>
          <g class="hand">
            <path d="M67 18c0-2.2 1.7-4 3.8-4s3.8 1.8 3.8 4v10l4 1.4c2.6.9 4.1 3.4 3.7 6.1l-1.3 7.9c-.4 2.8-2.9 4.9-5.7 4.9h-7.1c-1.9 0-3.7-.9-4.8-2.4l-5.5-7.4c-1-1.4-.7-3.4.7-4.4 1.3-1 3.1-.8 4.2.3l3.3 3.4V18z"
              fill="#fff4e0" stroke="#5a4a34" stroke-width="1.5" stroke-linejoin="round"/>
          </g>
        </svg>
      </div>

      <div class="counter" id="ui-counter">
        <svg viewBox="0 0 40 52" aria-hidden="true">
          <path d="M20 12c-2-5-6-7.5-11-8 .5 5 3.5 8.5 8 10-5-1.5-8.5-.5-11 2 4 3 8.5 3 12.5 1" fill="#5f9e42"/>
          <path d="M20 12c2-5 6-7.5 11-8-.5 5-3.5 8.5-8 10 5-1.5 8.5-.5 11 2-4 3-8.5 3-12.5 1" fill="#6cae4c"/>
          <path d="M20 13c4.4 0 7.2 3.2 7.2 8C27.2 30 23.6 50 20 50s-7.2-20-7.2-29c0-4.8 2.8-8 7.2-8z" fill="#f7f5ee"/>
        </svg>
        <span id="ui-count">0</span>
      </div>

      <button class="sound" id="ui-sound" aria-label="sound">
        <svg id="ui-sound-icon" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 2v2a8 8 0 010 16v2a10 10 0 000-20z"/></svg>
      </button>

      <div class="next" id="ui-next">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <g class="pulse">
            <circle cx="50" cy="50" r="34" fill="rgba(24,18,12,0.42)"/>
            <path d="M40 30l26 20-26 20z" fill="#fff6e6"/>
          </g>
        </svg>
      </div>`;

    this.hint = root.querySelector('#ui-hint')!;
    this.swipe = root.querySelector('#ui-swipe')!;
    this.counter = root.querySelector('#ui-counter')!;
    this.countValue = root.querySelector('#ui-count')!;
    this.next = root.querySelector('#ui-next')!;
    this.soundBtn = root.querySelector('#ui-sound')!;
  }

  onSound(cb: (muted: boolean) => void) {
    let muted = false;
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      muted = !muted;
      this.soundBtn.style.opacity = muted ? '0.3' : '0.55';
      const icon = this.soundBtn.querySelector('path')!;
      icon.setAttribute(
        'd',
        muted
          ? 'M4 9v6h4l5 4V5L8 9H4zm14.6-1.4l-1.4 1.4L19.8 12l-2.6 2.6 1.4 1.4L21.2 13l2.6 2.6 1.4-1.4L22.6 12l2.6-2.6-1.4-1.4L21.2 11z'
          : 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 2v2a8 8 0 010 16v2a10 10 0 000-20z',
      );
      cb(muted);
    });
  }

  showTapHint(v: boolean) {
    this.hint.classList.toggle('show', v);
  }

  showSwipeHint(v: boolean) {
    this.swipe.classList.toggle('show', v);
  }

  showNext(v: boolean) {
    this.next.classList.toggle('show', v);
  }

  setCount(n: number) {
    if (this.countValue.textContent === String(n)) return;
    this.countValue.textContent = String(n);
    this.counter.classList.add('bump');
    this.bumpTimer = 0.18;
  }

  update(dt: number) {
    if (this.bumpTimer > 0) {
      this.bumpTimer -= dt;
      if (this.bumpTimer <= 0) this.counter.classList.remove('bump');
    }
  }
}
