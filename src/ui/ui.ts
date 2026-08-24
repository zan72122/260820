/**
 * DOMウィジェット層。3Dへの参照は持たず、コールバックでゲームへ通知する。
 * 常時浮遊するUIは置かず、必要な場面だけ表示する。
 */
export interface UICallbacks {
  onStart(): void;
  onWidthSlider(t: number): void; // 0..1
  onLever(): void;
  onMarkerDrop(kind: 'open' | 'closed'): void;
  onRetry(): void;
  onNext(): void;
  onLensButton(): void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export class UI {
  private caption = $('caption');
  private captionTimer: number | undefined;
  private titleCard = $('title-card');
  private hintSwipe = $('hint-swipe');
  private ringHint = $('ring-hint');
  private widthSlider = $('width-slider');
  private widthTrack = $('width-track');
  private widthKnob = $('width-knob');
  private lever = $('lever');
  private leverTrack = $('lever-track');
  private leverHandle = $('lever-handle');
  private markerDock = $('marker-dock');
  private btnRow = $('btn-row');
  private btnRetry = $('btn-retry');
  private btnNext = $('btn-next');
  private btnLens = $('btn-lens');

  constructor(private cb: UICallbacks) {
    $('title-start').addEventListener('click', () => {
      this.titleCard.style.opacity = '0';
      window.setTimeout(() => this.titleCard.classList.add('hidden'), 800);
      cb.onStart();
    });
    this.btnRetry.addEventListener('click', () => cb.onRetry());
    this.btnNext.addEventListener('click', () => cb.onNext());
    this.btnLens.addEventListener('click', () => cb.onLensButton());
    this.initSlider();
    this.initLever();
    this.initMarkers();
  }

  // ---------- 字幕 ----------
  say(text: string, holdSec = 0): void {
    window.clearTimeout(this.captionTimer);
    if (!text) {
      this.caption.classList.add('hidden');
      return;
    }
    this.caption.textContent = text;
    this.caption.classList.remove('hidden');
    if (holdSec > 0) {
      this.captionTimer = window.setTimeout(() => this.caption.classList.add('hidden'), holdSec * 1000);
    }
  }

  // ---------- スワイプヒント ----------
  showSwipeHint(x: number, y: number, dir: 'down' | 'up'): void {
    this.hintSwipe.classList.remove('hidden');
    this.hintSwipe.classList.toggle('up', dir === 'up');
    this.hintSwipe.style.left = `${x - 27}px`;
    this.hintSwipe.style.top = `${y}px`;
  }
  hideSwipeHint(): void {
    this.hintSwipe.classList.add('hidden');
  }

  showRingHint(x: number, y: number): void {
    this.ringHint.classList.remove('hidden');
    this.ringHint.style.left = `${x - 55}px`;
    this.ringHint.style.top = `${y - 55}px`;
  }
  hideRingHint(): void {
    this.ringHint.classList.add('hidden');
  }

  // ---------- 幅スライダー ----------
  private initSlider(): void {
    let dragging = false;
    const move = (clientX: number): void => {
      const r = this.widthTrack.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      this.widthKnob.style.left = `${t * 100}%`;
      this.cb.onWidthSlider(t);
    };
    this.widthTrack.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.widthTrack.setPointerCapture(e.pointerId);
      move(e.clientX);
    });
    this.widthTrack.addEventListener('pointermove', (e) => {
      if (dragging) move(e.clientX);
    });
    this.widthTrack.addEventListener('pointerup', () => (dragging = false));
    this.widthTrack.addEventListener('pointercancel', () => (dragging = false));
  }
  showWidthSlider(value01: number): void {
    this.widthKnob.style.left = `${value01 * 100}%`;
    this.widthSlider.classList.remove('hidden');
  }
  hideWidthSlider(): void {
    this.widthSlider.classList.add('hidden');
  }

  // ---------- レバー ----------
  private leverFired = false;
  private initLever(): void {
    let dragging = false;
    const reset = (): void => {
      this.leverHandle.style.top = '0px';
    };
    this.leverTrack.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.leverFired = false;
      this.leverTrack.setPointerCapture(e.pointerId);
    });
    this.leverTrack.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = this.leverTrack.getBoundingClientRect();
      const max = r.height - 40;
      const y = Math.min(max, Math.max(0, e.clientY - r.top - 20));
      this.leverHandle.style.top = `${y}px`;
      if (!this.leverFired && y > max * 0.78) {
        this.leverFired = true;
        this.cb.onLever();
      }
    });
    const up = (): void => {
      dragging = false;
      reset();
    };
    this.leverTrack.addEventListener('pointerup', up);
    this.leverTrack.addEventListener('pointercancel', up);
  }
  showLever(): void {
    this.leverFired = false;
    this.leverHandle.style.top = '0px';
    this.lever.classList.remove('hidden');
  }
  hideLever(): void {
    this.lever.classList.add('hidden');
  }

  // ---------- 予想マーカー ----------
  private initMarkers(): void {
    const cards = this.markerDock.querySelectorAll<HTMLElement>('.marker-card');
    cards.forEach((card) => {
      let ghost: HTMLElement | null = null;
      card.addEventListener('pointerdown', (e) => {
        card.setPointerCapture(e.pointerId);
        ghost = card.cloneNode(true) as HTMLElement;
        ghost.id = 'marker-ghost';
        ghost.classList.remove('marker-card');
        ghost.className = '';
        ghost.id = 'marker-ghost';
        document.body.appendChild(ghost);
        const mv = (ev: PointerEvent): void => {
          if (ghost) {
            ghost.style.left = `${ev.clientX - 45}px`;
            ghost.style.top = `${ev.clientY - 40}px`;
          }
        };
        mv(e);
        const move = (ev: PointerEvent): void => mv(ev);
        const up = (): void => {
          card.removeEventListener('pointermove', move);
          card.removeEventListener('pointerup', up);
          card.removeEventListener('pointercancel', up);
          ghost?.remove();
          ghost = null;
          cards.forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          this.cb.onMarkerDrop(card.dataset.kind as 'open' | 'closed');
        };
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerup', up);
        card.addEventListener('pointercancel', up);
      });
    });
  }
  showMarkers(): void {
    this.markerDock.classList.remove('hidden');
    this.markerDock
      .querySelectorAll('.marker-card')
      .forEach((c) => c.classList.remove('selected'));
  }
  hideMarkers(): void {
    this.markerDock.classList.add('hidden');
  }

  // ---------- 結果ボタン ----------
  showButtons(showLens: boolean): void {
    this.btnRow.classList.remove('hidden');
    this.btnLens.classList.toggle('hidden', !showLens);
  }
  hideButtons(): void {
    this.btnRow.classList.add('hidden');
  }
  setNextLabel(label: string): void {
    this.btnNext.textContent = label;
  }
  setLensLabel(label: string): void {
    this.btnLens.textContent = label;
  }
}
