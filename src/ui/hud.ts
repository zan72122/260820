/** 画面の上に置くのは最小限。中央に矢印も説明文も置かない。 */
import type { AudioSettings } from '../audio/engine';

const CSS = `
.hud-btn {
  position: fixed; z-index: 20;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: calc(env(safe-area-inset-right, 0px) + 12px);
  width: 42px; height: 42px; border-radius: 21px;
  border: 1px solid rgba(240,244,236,0.30);
  background: rgba(38,42,34,0.34);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  color: #eef2e6; font-size: 17px; line-height: 1;
  display: grid; place-items: center; cursor: pointer;
  transition: background 200ms ease, opacity 400ms ease;
}
.hud-btn:active { background: rgba(38,42,34,0.55); }
.hud-panel {
  position: fixed; z-index: 21;
  top: calc(env(safe-area-inset-top, 0px) + 62px);
  right: calc(env(safe-area-inset-right, 0px) + 12px);
  width: 226px; padding: 14px 15px 12px;
  border-radius: 14px; border: 1px solid rgba(240,244,236,0.22);
  background: rgba(30,34,28,0.80);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  color: #e8ece0; font-size: 13px; letter-spacing: 0.06em;
  opacity: 0; transform: translateY(-6px); pointer-events: none;
  transition: opacity 220ms ease, transform 220ms ease;
}
.hud-panel.open { opacity: 1; transform: none; pointer-events: auto; }
.hud-row { display: flex; align-items: center; justify-content: space-between; margin: 9px 0; }
.hud-row label { opacity: 0.86; }
.hud-panel input[type=range] {
  -webkit-appearance: none; appearance: none; width: 112px; height: 22px; background: transparent;
}
.hud-panel input[type=range]::-webkit-slider-runnable-track {
  height: 3px; background: rgba(232,236,224,0.35); border-radius: 2px;
}
.hud-panel input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 17px; height: 17px; margin-top: -7px;
  border-radius: 9px; background: #dfe4d6; border: none;
}
.hud-panel input[type=range]::-moz-range-track { height: 3px; background: rgba(232,236,224,0.35); }
.hud-panel input[type=range]::-moz-range-thumb { width: 17px; height: 17px; border: none; border-radius: 9px; background: #dfe4d6; }
.hud-toggle {
  min-width: 58px; padding: 5px 10px; border-radius: 12px;
  border: 1px solid rgba(232,236,224,0.28); background: transparent;
  color: #e8ece0; font-size: 12px; font-family: inherit; cursor: pointer;
}
.hud-toggle[data-on="1"] { background: rgba(226,232,214,0.86); color: #23281f; }
.kid-line {
  position: fixed; z-index: 18; left: 0; right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 22px);
  text-align: center; color: #f2f4ea; font-size: 15px; letter-spacing: 0.1em;
  text-shadow: 0 1px 10px rgba(20,24,18,0.75), 0 0 2px rgba(20,24,18,0.9);
  opacity: 0; transition: opacity 1200ms ease; pointer-events: none; padding: 0 22px;
}
.kid-line.show { opacity: 0.95; }
.cut-frame {
  position: fixed; z-index: 12; pointer-events: none;
  border: 1px solid rgba(238,242,230,0.34);
  border-radius: 12px;
  box-shadow: 0 5px 26px rgba(12,16,10,0.42);
  opacity: 0; transition: opacity 320ms ease;
}
`;

export interface HudHooks {
  get(): AudioSettings;
  set(s: Partial<AudioSettings>): void;
}

export class Hud {
  private panel: HTMLDivElement;
  private kid: HTMLDivElement;
  private frame: HTMLDivElement;
  private muteBtn: HTMLButtonElement;
  private quietBtn: HTMLButtonElement;
  private vol: HTMLInputElement;
  private kidTimer = 0;
  private kidShown = false;

  constructor(hooks: HudHooks) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.setAttribute('aria-label', '音の設定');
    btn.textContent = '⌁';
    document.body.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'hud-panel';
    this.panel.innerHTML = `
      <div class="hud-row"><label>音量</label><input type="range" min="0" max="100" step="1" /></div>
      <div class="hud-row"><label>ミュート</label><button class="hud-toggle" data-k="mute">切</button></div>
      <div class="hud-row"><label>静かな音</label><button class="hud-toggle" data-k="quiet">切</button></div>
    `;
    document.body.appendChild(this.panel);

    this.vol = this.panel.querySelector('input')!;
    this.muteBtn = this.panel.querySelector('[data-k="mute"]')!;
    this.quietBtn = this.panel.querySelector('[data-k="quiet"]')!;

    const s = hooks.get();
    this.vol.value = String(Math.round(s.volume * 100));
    this.reflect(s);

    btn.addEventListener('click', () => this.panel.classList.toggle('open'));
    this.vol.addEventListener('input', () => {
      hooks.set({ volume: Number(this.vol.value) / 100 });
      this.reflect(hooks.get());
    });
    this.muteBtn.addEventListener('click', () => {
      hooks.set({ muted: !hooks.get().muted });
      this.reflect(hooks.get());
    });
    this.quietBtn.addEventListener('click', () => {
      hooks.set({ quiet: !hooks.get().quiet });
      this.reflect(hooks.get());
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.panel.contains(e.target as Node) && e.target !== btn) this.panel.classList.remove('open');
    });

    this.kid = document.createElement('div');
    this.kid.className = 'kid-line';
    this.kid.textContent = 'お水がいっぱいになると、竹が倒れて、戻るとコンと鳴る';
    document.body.appendChild(this.kid);

    this.frame = document.createElement('div');
    this.frame.className = 'cut-frame';
    document.body.appendChild(this.frame);
  }

  private reflect(s: AudioSettings): void {
    this.muteBtn.dataset.on = s.muted ? '1' : '0';
    this.muteBtn.textContent = s.muted ? '入' : '切';
    this.quietBtn.dataset.on = s.quiet ? '1' : '0';
    this.quietBtn.textContent = s.quiet ? '入' : '切';
  }

  /** 最初の「コン」のあとにだけ、一度出す。 */
  showKidLine(): void {
    if (this.kidShown) return;
    this.kidShown = true;
    this.kidTimer = 9.5;
    this.kid.classList.add('show');
  }

  setCutawayRect(r: { x: number; y: number; w: number; h: number } | null, opacity: number): void {
    if (!r || opacity < 0.02) {
      this.frame.style.opacity = '0';
      return;
    }
    this.frame.style.left = `${r.x}px`;
    this.frame.style.top = `${r.y}px`;
    this.frame.style.width = `${r.w}px`;
    this.frame.style.height = `${r.h}px`;
    this.frame.style.opacity = String(opacity * 0.9);
  }

  update(dt: number): void {
    if (this.kidTimer > 0) {
      this.kidTimer -= dt;
      if (this.kidTimer <= 0) this.kid.classList.remove('show');
    }
  }
}
