import { clamp } from '../core/Easing';

export type HintKind = 'tap' | 'drag' | 'scrub' | 'lift';

export interface HintPath {
  kind: HintKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
}

/**
 * The only tutorial in the game: a ghost fingertip that does the gesture for
 * you if you hesitate. No words, no arrows pointing at UI — it touches the
 * thing you should touch, the way you should touch it.
 */
export class Hint {
  private el: HTMLDivElement;
  private path: HintPath | null = null;
  private t = 0;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hint-finger';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = '<span class="ring"></span><span class="dot"></span>';
    parent.appendChild(this.el);
  }

  show(path: HintPath): void {
    const same = this.path
      && this.path.kind === path.kind
      && Math.abs(this.path.x - path.x) < 2
      && Math.abs(this.path.y - path.y) < 2;
    this.path = path;
    if (!same) this.t = 0;
    if (!this.visible) {
      this.visible = true;
      this.el.classList.add('on');
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.remove('on');
  }

  get isVisible(): boolean { return this.visible; }

  update(dt: number): void {
    if (!this.visible || !this.path) return;
    this.t += dt;
    const p = this.path;
    let x = p.x, y = p.y;
    let scale: number;

    if (p.kind === 'tap') {
      const cycle = 1.25;
      const u = (this.t % cycle) / cycle;
      // Press down, hold, release, pause.
      scale = u < 0.22 ? 1 - u / 0.22 * 0.34
        : u < 0.4 ? 0.66
        : u < 0.6 ? 0.66 + ((u - 0.4) / 0.2) * 0.34
        : 1;
      y += Math.sin(clamp(u / 0.4) * Math.PI) * 5;
    } else if (p.kind === 'scrub') {
      const r = p.radius ?? 34;
      const a = this.t * 2.3;
      x += Math.cos(a) * r;
      y += Math.sin(a * 2) * r * 0.42;
      scale = 0.84;
    } else {
      // drag / lift: travel from start to end, then reset.
      const cycle = 1.75;
      const u = (this.t % cycle) / cycle;
      const e = u < 0.72 ? easeInOut(u / 0.72) : 0;
      const fade = u < 0.72 ? 1 : 0.0;
      x += ((p.x2 ?? p.x) - p.x) * e;
      y += ((p.y2 ?? p.y) - p.y) * e;
      scale = 0.86;
      this.el.style.opacity = String(0.92 * (u < 0.72 ? 1 : Math.max(0, 1 - (u - 0.72) / 0.18)) * fade || 0.15);
    }

    this.el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    if (p.kind === 'tap' || p.kind === 'scrub') this.el.style.opacity = '';
  }

  dispose(): void {
    this.el.remove();
  }
}

function easeInOut(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
