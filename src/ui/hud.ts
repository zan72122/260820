import { settings } from '../core/settings';
import { clamp01 } from '../core/util';

export type Pt = { x: number; y: number };

/**
 * The only on-screen instruction the game ever gives: a finger, moving once,
 * along the path the player could take. No words, no arrows, no scoring.
 */
export class FingerHint {
  private el = document.getElementById('finger') as HTMLDivElement;
  private svg = document.getElementById('trail') as unknown as SVGSVGElement;
  private path: Pt[] = [];
  private t = 0;
  private duration = 1.5;
  private gap = 1.1;
  private visible = false;
  private loops = 0;
  private maxLoops = 1;

  show(path: Pt[], duration = 1.5, loops = 1) {
    if (path.length < 2) return;
    this.path = path;
    this.duration = duration;
    this.t = 0;
    this.loops = 0;
    this.maxLoops = loops;
    this.visible = true;
    this.el.style.opacity = '0.95';
    this.drawTrail();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.style.opacity = '0';
    this.svg.style.opacity = '0';
  }

  get isVisible() {
    return this.visible;
  }

  private drawTrail() {
    const d = this.path.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    this.svg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(255,250,238,0.5)" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 9"/>`;
    this.svg.style.opacity = '0.8';
  }

  update(dt: number) {
    if (!this.visible) return;
    this.t += dt;
    const cycle = this.duration + this.gap;
    const local = this.t % cycle;
    const done = Math.floor(this.t / cycle);
    if (done > this.loops) {
      this.loops = done;
      if (this.loops >= this.maxLoops) {
        this.hide();
        return;
      }
    }
    const k = clamp01(local / this.duration);
    const eased = k * k * (3 - 2 * k);
    const idx = eased * (this.path.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(this.path.length - 1, i0 + 1);
    const f = idx - i0;
    const x = this.path[i0].x + (this.path[i1].x - this.path[i0].x) * f;
    const y = this.path[i0].y + (this.path[i1].y - this.path[i0].y) * f;
    const fade = local > this.duration ? Math.max(0, 1 - (local - this.duration) / this.gap) : 1;
    this.el.style.transform = `translate(${x}px, ${y}px) scale(${0.9 + 0.12 * Math.sin(k * Math.PI)})`;
    this.el.style.opacity = String(0.95 * fade);
    this.svg.style.opacity = String(0.8 * fade);
  }
}

/** Volume, reduced motion and haptics. Three controls, no menus. */
export function setupSettingsPanel(onFirstTouch: () => void) {
  const gear = document.getElementById('gearBtn') as HTMLButtonElement;
  const panel = document.getElementById('panel') as HTMLDivElement;
  const vol = document.getElementById('vol') as HTMLInputElement;
  const motionToggle = document.getElementById('motionToggle') as HTMLDivElement;
  const motionSwitch = document.getElementById('motionSwitch') as HTMLDivElement;
  const hapticToggle = document.getElementById('hapticToggle') as HTMLDivElement;
  const hapticSwitch = document.getElementById('hapticSwitch') as HTMLDivElement;

  const sync = () => {
    vol.value = String(Math.round(settings.state.volume * 100));
    motionSwitch.classList.toggle('on', settings.state.reduceMotion);
    hapticSwitch.classList.toggle('on', settings.state.haptics);
  };
  sync();

  gear.addEventListener('click', (e) => {
    e.stopPropagation();
    onFirstTouch();
    panel.classList.toggle('open');
  });
  vol.addEventListener('input', () => {
    onFirstTouch();
    settings.set({ volume: Number(vol.value) / 100 });
  });
  motionToggle.addEventListener('click', () => {
    settings.set({ reduceMotion: !settings.state.reduceMotion });
    sync();
  });
  hapticToggle.addEventListener('click', () => {
    settings.set({ haptics: !settings.state.haptics });
    sync();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target as Node) || gear.contains(e.target as Node)) return;
    panel.classList.remove('open');
  });
  settings.onChange(sync);
}

export function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 800);
}
