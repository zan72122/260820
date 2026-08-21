import { clamp } from '../core/util';
import type { StepId } from '../game/defects';
import {
  iconBrush,
  iconCrawler,
  iconDrop,
  iconHand,
  iconNext,
  iconNozzle,
  iconPad,
  iconPlay,
  iconScraper,
  iconSpatula,
} from './icons';

const TOOL_ICON: Record<StepId, string> = {
  peel: iconScraper,
  brush: iconBrush,
  fill: iconNozzle,
  smooth: iconSpatula,
  polish: iconPad,
};

export interface HintPath {
  kind: 'swipe' | 'circle' | 'tap' | 'knob';
  from: { x: number; y: number };
  to?: { x: number; y: number };
  radius?: number;
  period?: number;
}

/**
 * Every on-screen control is a large physical looking object placed clear of the
 * work area, plus a silent ghost-finger that demonstrates a gesture when a young
 * player stalls. Nothing here needs to be read.
 */
export class Hud {
  onStart: (() => void) | null = null;
  onKnob: ((x: number, y: number) => void) | null = null;
  onLeverFire: (() => void) | null = null;
  onTool: ((id: StepId) => void) | null = null;
  onWaterAgain: (() => void) | null = null;
  onNextFault: (() => void) | null = null;

  private boot: HTMLElement;
  private bootBar: HTMLElement;
  private knob: HTMLElement;
  private knobCap: HTMLElement;
  private lever: HTMLElement;
  private leverGrip: HTMLElement;
  private tray: HTMLElement;
  private trayButtons = new Map<StepId, HTMLButtonElement>();
  private hand: HTMLElement;
  private endbar: HTMLElement;
  private beads: HTMLElement;
  private veil: HTMLElement;

  private knobX = 0;
  private knobY = 0.62;
  private knobId: number | null = null;
  private leverId: number | null = null;
  private leverStartY = 0;
  private leverPull = 0;

  private hint: HintPath | null = null;
  private hintTime = 0;
  landscape = false;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="boot">
        <div class="boot__title"><b>スライダー・ドクター</b><span>つるつる大作戦</span></div>
        <div class="boot__mark">${iconCrawler}</div>
        <button class="boot__go" type="button" aria-label="はじめる">${iconPlay}</button>
        <div class="boot__load"><i></i></div>
      </div>
      <div class="beads"></div>
      <div class="knob"><div class="knob__cap"></div></div>
      <div class="lever"><div class="lever__slot"></div><div class="lever__grip"></div></div>
      <div class="tray"></div>
      <div class="hand">${iconHand}</div>
      <div class="endbar">
        <button class="endbar__btn endbar__btn--water" type="button" aria-label="もういちど水をながす">${iconDrop}</button>
        <button class="endbar__btn endbar__btn--next" type="button" aria-label="つぎのばしょへ">${iconNext}</button>
      </div>
      <div class="veil"></div>
    `;
    const q = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
    this.boot = q('.boot');
    this.bootBar = q('.boot__load i');
    this.knob = q('.knob');
    this.knobCap = q('.knob__cap');
    this.lever = q('.lever');
    this.leverGrip = q('.lever__grip');
    this.tray = q('.tray');
    this.hand = q('.hand');
    this.endbar = q('.endbar');
    this.beads = q('.beads');
    this.veil = q('.veil');

    q<HTMLButtonElement>('.boot__go').addEventListener('click', () => this.onStart?.());
    q<HTMLButtonElement>('.endbar__btn--water').addEventListener('click', () => this.onWaterAgain?.());
    q<HTMLButtonElement>('.endbar__btn--next').addEventListener('click', () => this.onNextFault?.());

    this.bindKnob();
    this.bindLever();
    this.applyKnob();
  }

  // ---- boot ------------------------------------------------------------

  setLoading(p: number): void {
    this.bootBar.style.width = `${clamp(p, 0.05, 1) * 100}%`;
  }

  hideBoot(): void {
    this.boot.classList.add('gone');
    window.setTimeout(() => {
      this.boot.style.display = 'none';
    }, 700);
  }

  setVeil(on: boolean): void {
    this.veil.classList.toggle('on', on);
  }

  // ---- light knob ------------------------------------------------------

  private bindKnob(): void {
    const move = (e: PointerEvent): void => {
      const r = this.knob.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const rad = r.width * 0.34;
      let dx = (e.clientX - cx) / rad;
      let dy = (e.clientY - cy) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.knobX = clamp(dx, -1, 1);
      // screen down should sweep the beam further away down the pipe
      this.knobY = clamp(-dy, -1, 1);
      this.applyKnob();
      this.onKnob?.(this.knobX, this.knobY);
    };
    this.knob.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.knobId = e.pointerId;
      this.knob.setPointerCapture(e.pointerId);
      this.clearHint();
      move(e);
    });
    this.knob.addEventListener('pointermove', (e) => {
      if (this.knobId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      move(e);
    });
    const end = (e: PointerEvent): void => {
      if (this.knobId !== e.pointerId) return;
      e.preventDefault();
      this.knobId = null;
    };
    this.knob.addEventListener('pointerup', end);
    this.knob.addEventListener('pointercancel', end);
  }

  private applyKnob(): void {
    const r = this.knob.getBoundingClientRect().width * 0.34 || 40;
    this.knobCap.style.transform = `translate(${this.knobX * r}px, ${-this.knobY * r}px)`;
  }

  setKnob(x: number, y: number): void {
    this.knobX = clamp(x, -1, 1);
    this.knobY = clamp(y, -1, 1);
    this.applyKnob();
  }

  get knobValue(): { x: number; y: number } {
    return { x: this.knobX, y: this.knobY };
  }

  showKnob(on: boolean): void {
    this.knob.classList.toggle('on', on);
    this.knob.style.pointerEvents = on ? 'auto' : 'none';
    if (on) this.applyKnob();
  }

  // ---- water lever -----------------------------------------------------

  private bindLever(): void {
    const set = (v: number): void => {
      this.leverPull = clamp(v, 0, 1);
      const r = this.lever.getBoundingClientRect();
      this.leverGrip.style.transform = `translateX(-50%) translateY(${this.leverPull * r.height * 0.5}px)`;
    };
    this.lever.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.leverId = e.pointerId;
      this.lever.setPointerCapture(e.pointerId);
      this.leverStartY = e.clientY;
      this.clearHint();
    });
    this.lever.addEventListener('pointermove', (e) => {
      if (this.leverId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const r = this.lever.getBoundingClientRect();
      set((e.clientY - this.leverStartY) / (r.height * 0.5));
    });
    const end = (e: PointerEvent): void => {
      if (this.leverId !== e.pointerId) return;
      e.preventDefault();
      this.leverId = null;
      const fired = this.leverPull > 0.6;
      set(0);
      if (fired) this.onLeverFire?.();
    };
    this.lever.addEventListener('pointerup', end);
    this.lever.addEventListener('pointercancel', end);
  }

  showLever(on: boolean): void {
    this.lever.classList.toggle('on', on);
    this.lever.style.pointerEvents = on ? 'auto' : 'none';
  }

  get leverValue(): number {
    return this.leverPull;
  }

  // ---- tool tray -------------------------------------------------------

  showTray(ids: StepId[] | null, highlight: StepId | null = null): void {
    if (!ids || ids.length === 0) {
      this.tray.classList.remove('on');
      this.tray.innerHTML = '';
      this.trayButtons.clear();
      return;
    }
    this.tray.innerHTML = '';
    this.trayButtons.clear();
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'tray__btn';
      b.type = 'button';
      b.innerHTML = TOOL_ICON[id];
      b.dataset.tool = id;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.onTool?.(id);
      });
      this.tray.appendChild(b);
      this.trayButtons.set(id, b);
    }
    if (highlight) this.trayButtons.get(highlight)?.classList.add('picked');
    this.tray.classList.add('on');
  }

  markTool(id: StepId, cls: 'wrong' | 'hint' | 'picked', on: boolean): void {
    const b = this.trayButtons.get(id);
    if (!b) return;
    b.classList.toggle(cls, on);
    if (cls === 'wrong' && on) window.setTimeout(() => b.classList.remove('wrong'), 400);
  }

  clearToolMarks(): void {
    for (const b of this.trayButtons.values()) {
      b.classList.remove('hint', 'wrong', 'picked');
    }
  }

  // ---- round beads -----------------------------------------------------

  setBeads(total: number, done: number): void {
    if (total <= 0) {
      this.beads.classList.remove('on');
      this.beads.innerHTML = '';
      return;
    }
    if (this.beads.children.length !== total) {
      this.beads.innerHTML = '';
      for (let i = 0; i < total; i++) this.beads.appendChild(document.createElement('i'));
    }
    for (let i = 0; i < total; i++) {
      const el = this.beads.children[i] as HTMLElement;
      el.classList.toggle('done', i < done);
      el.classList.toggle('now', i === done);
    }
    this.beads.classList.add('on');
  }

  // ---- end controls ----------------------------------------------------

  showEnd(on: boolean): void {
    this.endbar.classList.toggle('on', on);
  }

  // ---- ghost finger ----------------------------------------------------

  showHint(h: HintPath | null): void {
    this.hint = h;
    this.hintTime = 0;
    this.hand.classList.toggle('on', !!h);
  }

  clearHint(): void {
    this.hint = null;
    this.hand.classList.remove('on');
  }

  get hinting(): boolean {
    return this.hint !== null;
  }

  update(dt: number): void {
    if (!this.hint) return;
    this.hintTime += dt;
    const period = this.hint.period ?? 2.0;
    const k = (this.hintTime % period) / period;
    let x = this.hint.from.x;
    let y = this.hint.from.y;
    let fade = 1;
    if (this.hint.kind === 'swipe' && this.hint.to) {
      const e = clamp(k * 1.45, 0, 1);
      const s = e * e * (3 - 2 * e);
      x += (this.hint.to.x - this.hint.from.x) * s;
      y += (this.hint.to.y - this.hint.from.y) * s;
      fade = k < 0.08 ? k / 0.08 : k > 0.78 ? clamp((1 - k) / 0.22, 0, 1) : 1;
    } else if (this.hint.kind === 'circle' || this.hint.kind === 'knob') {
      const r = this.hint.radius ?? 46;
      x += Math.cos(k * Math.PI * 2) * r;
      y += Math.sin(k * Math.PI * 2) * r * 0.72;
    } else if (this.hint.kind === 'tap') {
      fade = 0.45 + 0.55 * Math.abs(Math.sin(k * Math.PI * 2));
    }
    this.hand.style.transform = `translate(${x}px, ${y}px) scale(${0.9 + fade * 0.16})`;
    this.hand.style.opacity = String(0.25 + fade * 0.7);
  }

  setLandscape(on: boolean): void {
    this.landscape = on;
    this.knob.classList.toggle('landscape', on);
    this.tray.classList.toggle('landscape', on);
    this.applyKnob();
  }

  /** Screen rectangle that HUD furniture occupies, so shots can avoid it. */
  reservedBottom(): number {
    return this.landscape ? 0.1 : 0.26;
  }
}
