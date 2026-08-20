import {
  drawBack,
  drawCardFree,
  drawCardNew,
  drawCardSame,
  drawDigTool,
  drawGhostHand,
  drawMenuGlyph,
  drawMudTool,
  drawSound,
  drawStart,
  drawVibration,
  makeIconCanvas,
} from './icons';

export type Tool = 'dig' | 'mud';
export type MenuChoice = 'same' | 'new' | 'free';

function iconButton(cls: string, id: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const b = document.createElement('button');
  b.className = cls;
  b.id = id;
  b.type = 'button';
  const { canvas, ctx, s } = makeIconCanvas(size);
  draw(ctx, s);
  b.appendChild(canvas);
  return { el: b, ctx, s, canvas };
}

export class UI {
  onStart: () => void = () => {};
  onTool: (t: Tool) => void = () => {};
  onChoice: (c: MenuChoice) => void = () => {};
  onSound: (on: boolean) => void = () => {};
  onHaptics: (on: boolean) => void = () => {};

  private root: HTMLElement;
  private startEl!: HTMLElement;
  private bootBar!: HTMLElement;
  private dock!: HTMLElement;
  private tools: Record<Tool, HTMLElement> = {} as Record<Tool, HTMLElement>;
  private soundBtn!: { el: HTMLElement; ctx: CanvasRenderingContext2D; s: number };
  private menuEl!: HTMLElement;
  private ghost!: HTMLElement;
  private debugEl!: HTMLElement;
  private debugMap!: HTMLCanvasElement;
  private soundToggle!: { el: HTMLElement; ctx: CanvasRenderingContext2D; s: number };

  soundOn = true;
  hapticsOn = true;

  constructor(root: HTMLElement) {
    this.root = root;
    try {
      this.soundOn = localStorage.getItem('doronko.sound') !== '0';
      this.hapticsOn = localStorage.getItem('doronko.haptics') !== '0';
    } catch {
      /* private mode: defaults are fine */
    }
    this.buildStart();
    this.buildDock();
    this.buildCorners();
    this.buildMenu();
    this.buildGhost();
    this.buildDebug();
    this.applySettings();
  }

  private applySettings() {
    drawSound(this.soundBtn.ctx, this.soundBtn.s, this.soundOn);
    drawSound(this.soundToggle.ctx, this.soundToggle.s, this.soundOn);
    this.soundToggle.el.classList.toggle('off', !this.soundOn);
    const vt = this.root.querySelector('#tg-vibe') as HTMLElement | null;
    if (vt) {
      const c = vt.querySelector('canvas') as HTMLCanvasElement;
      drawVibration(c.getContext('2d')!, 58, this.hapticsOn);
      vt.classList.toggle('off', !this.hapticsOn);
    }
  }

  /* ---------------- start ---------------- */

  private buildStart() {
    const wrap = document.createElement('div');
    wrap.id = 'start';
    const btn = document.createElement('button');
    btn.id = 'start-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'はじめる');
    const { canvas, ctx, s } = makeIconCanvas(340);
    drawStart(ctx, s);
    btn.appendChild(canvas);
    const boot = document.createElement('div');
    boot.id = 'boot';
    const bar = document.createElement('i');
    boot.appendChild(bar);
    this.bootBar = bar;
    wrap.appendChild(btn);
    wrap.appendChild(boot);
    this.root.appendChild(wrap);
    this.startEl = wrap;
    btn.addEventListener('click', () => this.onStart());
  }

  setProgress(p: number) {
    this.bootBar.style.width = `${Math.round(p * 100)}%`;
  }

  hideStart() {
    this.startEl.classList.add('hidden');
    setTimeout(() => this.startEl.remove(), 800);
  }

  /* ---------------- tools ---------------- */

  private buildDock() {
    const dock = document.createElement('div');
    dock.id = 'dock';
    const dig = iconButton('tool sel', 'tool-dig', 74, drawDigTool);
    const mud = iconButton('tool', 'tool-mud', 74, drawMudTool);
    dig.el.setAttribute('aria-label', 'みぞをほる');
    mud.el.setAttribute('aria-label', 'どろでふさぐ');
    dock.appendChild(dig.el);
    dock.appendChild(mud.el);
    this.tools.dig = dig.el;
    this.tools.mud = mud.el;
    dig.el.addEventListener('click', () => this.onTool('dig'));
    mud.el.addEventListener('click', () => this.onTool('mud'));
    this.root.appendChild(dock);
    this.dock = dock;
  }

  showDock(on: boolean) {
    this.dock.classList.toggle('on', on);
  }

  setTool(t: Tool) {
    (Object.keys(this.tools) as Tool[]).forEach((k) => this.tools[k].classList.toggle('sel', k === t));
  }

  /* ---------------- corner buttons ---------------- */

  private buildCorners() {
    const snd = iconButton('corner', 'btn-sound', 54, (c, s) => drawSound(c, s, true));
    snd.el.setAttribute('aria-label', 'おと');
    snd.el.addEventListener('click', () => this.toggleSound());
    this.root.appendChild(snd.el);
    this.soundBtn = snd;

    const menu = iconButton('corner', 'btn-menu', 54, drawMenuGlyph);
    menu.el.setAttribute('aria-label', 'えらぶ');
    menu.el.addEventListener('click', () => this.showMenu(true));
    this.root.appendChild(menu.el);
  }

  showCorners(on: boolean) {
    this.root.querySelectorAll('.corner').forEach((e) => e.classList.toggle('on', on));
  }

  private remember(key: string, on: boolean) {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {
      /* private mode: the choice simply does not persist */
    }
  }

  private toggleSound() {
    this.soundOn = !this.soundOn;
    this.remember('doronko.sound', this.soundOn);
    drawSound(this.soundBtn.ctx, this.soundBtn.s, this.soundOn);
    drawSound(this.soundToggle.ctx, this.soundToggle.s, this.soundOn);
    this.soundToggle.el.classList.toggle('off', !this.soundOn);
    this.onSound(this.soundOn);
  }

  /* ---------------- picture menu ---------------- */

  private buildMenu() {
    const menu = document.createElement('div');
    menu.id = 'menu';

    const mk = (
      draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
      choice: MenuChoice,
      label: string,
    ) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.type = 'button';
      b.setAttribute('aria-label', label);
      const c = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = 340;
      const h = 260;
      c.width = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      draw(ctx, w, h);
      b.appendChild(c);
      b.addEventListener('click', () => {
        this.showMenu(false);
        this.onChoice(choice);
      });
      return b;
    };

    menu.appendChild(mk(drawCardSame, 'same', 'おなじすなば'));
    menu.appendChild(mk(drawCardNew, 'new', 'ちがうすなば'));
    menu.appendChild(mk(drawCardFree, 'free', 'みずだけ'));

    const close = iconButton('', 'menu-close', 56, drawBack);
    close.el.setAttribute('aria-label', 'もどる');
    close.el.addEventListener('click', () => this.showMenu(false));
    menu.appendChild(close.el);

    const toggles = document.createElement('div');
    toggles.id = 'menu-toggles';
    const st = iconButton('toggle', 'tg-sound', 58, (c, s) => drawSound(c, s, true));
    st.el.addEventListener('click', () => this.toggleSound());
    const vt = iconButton('toggle', 'tg-vibe', 58, (c, s) => drawVibration(c, s, true));
    vt.el.addEventListener('click', () => {
      this.hapticsOn = !this.hapticsOn;
      this.remember('doronko.haptics', this.hapticsOn);
      drawVibration(vt.ctx, vt.s, this.hapticsOn);
      vt.el.classList.toggle('off', !this.hapticsOn);
      this.onHaptics(this.hapticsOn);
    });
    toggles.appendChild(st.el);
    toggles.appendChild(vt.el);
    menu.appendChild(toggles);
    this.soundToggle = st;

    this.root.appendChild(menu);
    this.menuEl = menu;
  }

  showMenu(on: boolean) {
    this.menuEl.classList.toggle('on', on);
  }

  get menuOpen() {
    return this.menuEl.classList.contains('on');
  }

  /* ---------------- ghost hand ---------------- */

  private buildGhost() {
    const g = document.createElement('div');
    g.id = 'ghost';
    const { canvas, ctx, s } = makeIconCanvas(96);
    drawGhostHand(ctx, s);
    g.appendChild(canvas);
    this.root.appendChild(g);
    this.ghost = g;
  }

  setGhost(on: boolean, x = 0, y = 0) {
    this.ghost.classList.toggle('on', on);
    if (on) {
      this.ghost.style.left = `${x}px`;
      this.ghost.style.top = `${y}px`;
    }
  }

  /* ---------------- debug ---------------- */

  private buildDebug() {
    const d = document.createElement('div');
    d.id = 'debug';
    this.root.appendChild(d);
    this.debugEl = d;
    const c = document.createElement('canvas');
    c.id = 'debugmap';
    this.root.appendChild(c);
    this.debugMap = c;
  }

  enableDebug(w: number, h: number, scale: number) {
    this.debugEl.classList.add('on');
    this.debugMap.classList.add('on');
    this.debugMap.width = w;
    this.debugMap.height = h;
    this.debugMap.style.width = `${w * scale}px`;
    this.debugMap.style.height = `${h * scale}px`;
  }

  setDebugText(t: string) {
    this.debugEl.textContent = t;
  }

  get debugCtx() {
    return this.debugMap.getContext('2d');
  }
}
