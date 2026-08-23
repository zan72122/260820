import { getGlyph } from '../core/glyphs';

/**
 * Minimal DOM overlay, no text during play:
 *  - a large water-valve wheel (bottom corner) that starts a test
 *  - a "next pair" plate showing the coming letter pair, after a success
 * Controls live in the screen corners so a finger never covers the
 * negative space between the letters.
 */
export interface UiCallbacks {
  onValve: () => void;
  onNext: () => void;
}

export class Ui {
  private root: HTMLElement;
  private valve: HTMLButtonElement;
  private valveWheel: SVGElement;
  private next: HTMLButtonElement;
  private title: HTMLDivElement;
  private valveAngle = 0;
  private cb: UiCallbacks;

  constructor(parent: HTMLElement, cb: UiCallbacks) {
    this.cb = cb;
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:10;font-family:system-ui,sans-serif;';
    parent.appendChild(this.root);

    // ---- valve wheel ---------------------------------------------------
    this.valve = document.createElement('button');
    this.valve.setAttribute('aria-label', 'water valve');
    this.valve.style.cssText = [
      'position:absolute',
      'right:max(10px, env(safe-area-inset-right))',
      'bottom:max(12px, env(safe-area-inset-bottom))',
      'width:min(24vw,108px);height:min(24vw,108px)',
      'border:none;background:none;padding:0;pointer-events:auto',
      '-webkit-tap-highlight-color:transparent;cursor:pointer',
      'filter:drop-shadow(0 3px 5px rgba(20,24,28,0.45))',
      'transition:opacity 0.4s,transform 0.3s',
    ].join(';');
    this.valve.innerHTML = `
      <svg viewBox="0 0 100 100" style="width:100%;height:100%">
        <defs>
          <radialGradient id="kcv" cx="38%" cy="34%">
            <stop offset="0%" stop-color="#c8d0d6"/>
            <stop offset="70%" stop-color="#8d959c"/>
            <stop offset="100%" stop-color="#666d74"/>
          </radialGradient>
        </defs>
        <rect x="44" y="72" width="12" height="24" rx="2" fill="#6a7178"/>
        <g class="kc-wheel" style="transform-origin:50px 50px">
          <circle cx="50" cy="50" r="34" fill="none" stroke="url(#kcv)" stroke-width="11"/>
          <circle cx="50" cy="50" r="9" fill="url(#kcv)"/>
          <g stroke="url(#kcv)" stroke-width="7" stroke-linecap="round">
            <line x1="50" y1="50" x2="50" y2="20"/>
            <line x1="50" y1="50" x2="76" y2="65"/>
            <line x1="50" y1="50" x2="24" y2="65"/>
          </g>
          <path d="M50 8 a42 42 0 0 1 29 12" fill="none" stroke="#4d79a8" stroke-width="5" stroke-linecap="round"/>
        </g>
      </svg>`;
    this.valveWheel = this.valve.querySelector('.kc-wheel')!;
    this.valve.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.cb.onValve();
    });
    this.root.appendChild(this.valve);

    // ---- next-pair plate ----------------------------------------------
    this.next = document.createElement('button');
    this.next.setAttribute('aria-label', 'next pair');
    this.next.style.cssText = [
      'position:absolute',
      'left:max(10px, env(safe-area-inset-left))',
      'bottom:max(12px, env(safe-area-inset-bottom))',
      'width:min(30vw,132px);height:min(22vw,96px)',
      'border:none;border-radius:12px;padding:6px',
      'background:linear-gradient(160deg,#9aa0a6,#767d84)',
      'box-shadow:0 4px 8px rgba(20,24,28,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
      'pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent',
      'opacity:0;transform:translateY(130%);transition:opacity 0.5s,transform 0.5s',
    ].join(';');
    this.next.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.cb.onNext();
    });
    this.root.appendChild(this.next);

    // ---- quiet title, intro only --------------------------------------
    this.title = document.createElement('div');
    this.title.textContent = 'KERNING CANYON';
    this.title.style.cssText = [
      'position:absolute;top:max(14px, env(safe-area-inset-top));left:0;right:0',
      'text-align:center;color:rgba(240,242,240,0.85)',
      'font-size:clamp(14px,3.4vw,22px);letter-spacing:0.42em;font-weight:600',
      'text-shadow:0 1px 3px rgba(30,34,38,0.5)',
      'transition:opacity 1.2s;pointer-events:none',
    ].join(';');
    this.root.appendChild(this.title);
  }

  hideTitle(): void {
    this.title.style.opacity = '0';
  }

  spinValve(dt: number, speed: number): void {
    this.valveAngle += speed * dt * 240;
    (this.valveWheel as unknown as HTMLElement).style.transform = `rotate(${this.valveAngle}deg)`;
  }

  setValveEnabled(on: boolean): void {
    this.valve.style.opacity = on ? '1' : '0.25';
    this.valve.style.pointerEvents = on ? 'auto' : 'none';
  }

  /** Show the plate with the coming pair rendered from the same glyph set. */
  showNext(left: string, right: string): void {
    this.next.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 160;
    c.style.cssText = 'width:100%;height:100%';
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e8e6df';
    const drawGlyph = (name: string, ox: number) => {
      const g = getGlyph(name);
      const s = 104;
      ctx.beginPath();
      for (const loop of g.contours) {
        loop.forEach((p, i) => {
          const x = ox + p.x * s;
          const y = 132 - p.y * s;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    };
    const gl = getGlyph(left);
    const gr = getGlyph(right);
    const total = (gl.width + gr.width) * 104 + 18;
    drawGlyph(left, (218 - total) / 2);
    drawGlyph(right, (218 - total) / 2 + gl.width * 104 + 18);
    // small chevron so the plate reads as "go on", not as a counter
    ctx.strokeStyle = 'rgba(232,230,223,0.9)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(206, 56);
    ctx.lineTo(226, 80);
    ctx.lineTo(206, 104);
    ctx.stroke();
    this.next.appendChild(c);
    this.next.style.opacity = '1';
    this.next.style.transform = 'translateY(0)';
  }

  hideNext(): void {
    this.next.style.opacity = '0';
    this.next.style.transform = 'translateY(130%)';
  }
}
