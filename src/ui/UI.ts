/**
 * The DOM layer is deliberately thin: a hint bubble, the dye swatches, one big button, a
 * mute toggle and the picture menu at the end. Everything else — the switch, the rope, the
 * brush — lives in the 3D scene where the child can touch the thing itself.
 *
 * Every control is at least 72 CSS px, which is why the icon buttons carry an invisible
 * expanded hit area.
 */

import './ui.css';
import { DYES } from '../nebuta/artwork';

export type ReplayChoice = 'parade' | 'remake' | 'paper';

export class UI {
  private readonly root: HTMLElement;
  private readonly hint: HTMLDivElement;
  private readonly hintGlyph: HTMLSpanElement;
  private readonly hintText: HTMLSpanElement;
  private readonly palette: HTMLDivElement;
  private readonly swatches: HTMLButtonElement[] = [];
  private readonly bigBtn: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private readonly steps: HTMLDivElement;
  private readonly dots: HTMLDivElement[] = [];
  private readonly muteBtn: HTMLButtonElement;
  private hintTimer = 0;

  onDye: (index: number) => void = () => {};
  onBig: () => void = () => {};
  onReplay: (choice: ReplayChoice) => void = () => {};
  onMute: (muted: boolean) => void = () => {};

  constructor(stepCount: number) {
    const root = document.getElementById('ui');
    if (!root) throw new Error('#ui missing');
    this.root = root;

    this.hint = document.createElement('div');
    this.hint.className = 'hint';
    this.hintGlyph = document.createElement('span');
    this.hintGlyph.className = 'glyph';
    this.hintText = document.createElement('span');
    this.hint.append(this.hintGlyph, this.hintText);
    root.appendChild(this.hint);

    this.steps = document.createElement('div');
    this.steps.className = 'steps';
    for (let i = 0; i < stepCount; i++) {
      const d = document.createElement('div');
      d.className = 'step-dot';
      this.steps.appendChild(d);
      this.dots.push(d);
    }
    root.appendChild(this.steps);

    this.palette = document.createElement('div');
    this.palette.className = 'palette';
    DYES.forEach((dye, i) => {
      const b = document.createElement('button');
      b.className = 'swatch tappable';
      b.style.background = `radial-gradient(60% 60% at 38% 32%, ${dye.hex}ee, ${dye.hex})`;
      b.setAttribute('aria-label', dye.label);
      b.dataset.selected = i === 0 ? 'true' : 'false';
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.selectDye(i);
        this.onDye(i);
      });
      this.palette.appendChild(b);
      this.swatches.push(b);
    });
    root.appendChild(this.palette);

    this.bigBtn = document.createElement('button');
    this.bigBtn.className = 'bigbtn tappable';
    this.bigBtn.textContent = 'できた！';
    this.bigBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onBig();
    });
    root.appendChild(this.bigBtn);

    const corner = document.createElement('div');
    corner.className = 'corner';
    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'icon-btn tappable';
    this.muteBtn.textContent = '🔊';
    this.muteBtn.setAttribute('aria-label', 'おと');
    let muted = false;
    this.muteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      muted = !muted;
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
      this.onMute(muted);
    });
    corner.appendChild(this.muteBtn);
    root.appendChild(corner);

    this.menu = document.createElement('div');
    this.menu.className = 'menu';
    const title = document.createElement('h1');
    title.textContent = 'もういちど あそぶ？';
    const cards = document.createElement('div');
    cards.className = 'cards';
    const defs: { key: ReplayChoice; label: string; draw: (c: CanvasRenderingContext2D) => void }[] = [
      { key: 'parade', label: 'もういちど ひく', draw: drawParadeCard },
      { key: 'remake', label: 'いろを かえて つくる', draw: drawRemakeCard },
      { key: 'paper', label: 'かみを はって あそぶ', draw: drawPaperCard },
    ];
    for (const def of defs) {
      const card = document.createElement('button');
      card.className = 'card tappable';
      const cv = document.createElement('canvas');
      cv.width = 260;
      cv.height = 150;
      const ctx = cv.getContext('2d');
      if (ctx) def.draw(ctx);
      const span = document.createElement('span');
      span.textContent = def.label;
      card.append(cv, span);
      card.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.showMenu(false);
        this.onReplay(def.key);
      });
      cards.appendChild(card);
    }
    this.menu.append(title, cards);
    root.appendChild(this.menu);
  }

  selectDye(index: number): void {
    this.swatches.forEach((s, i) => (s.dataset.selected = i === index ? 'true' : 'false'));
  }

  setHint(glyph: string, text: string): void {
    if (this.hintText.textContent === text && this.hintGlyph.textContent === glyph) {
      this.hint.classList.add('show');
      return;
    }
    this.hintGlyph.textContent = glyph;
    this.hintText.textContent = text;
    this.hint.classList.add('show');
    this.hintTimer = 0;
  }

  hideHint(): void {
    this.hint.classList.remove('show');
  }

  showPalette(v: boolean): void {
    this.palette.classList.toggle('show', v);
    this.root.classList.toggle('palette-open', v);
  }

  private bigLabel = '';

  showBig(v: boolean, label = 'できた！'): void {
    if (this.bigLabel !== label) {
      this.bigLabel = label;
      this.bigBtn.textContent = label;
    }
    this.bigBtn.classList.toggle('show', v);
  }

  showSteps(v: boolean, active = 0): void {
    this.steps.classList.toggle('show', v);
    this.dots.forEach((d, i) => (d.dataset.on = i <= active ? 'true' : 'false'));
  }

  showMenu(v: boolean): void {
    this.menu.classList.toggle('show', v);
  }

  /** Everything off — used for the light-up, which must be nothing but the nebuta. */
  clearAll(): void {
    this.hideHint();
    this.showPalette(false);
    this.showBig(false);
    this.showSteps(false);
    this.showMenu(false);
    this.root.style.opacity = '0';
    this.root.style.transition = 'opacity 0.6s ease';
  }

  restore(): void {
    this.root.style.opacity = '1';
  }

  update(dt: number): void {
    this.hintTimer += dt;
  }
}

/* ------------------------------------------------------------------ card art */

function bg(c: CanvasRenderingContext2D, from: string, to: string): void {
  const g = c.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  c.fillStyle = g;
  c.fillRect(0, 0, 260, 150);
}

function fish(c: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, glow: boolean): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (glow) {
    c.shadowColor = 'rgba(255,170,80,0.95)';
    c.shadowBlur = 26;
  }
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(0, 0, 40, 30, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-32, 0);
  c.quadraticCurveTo(-64, -34, -78, -6);
  c.quadraticCurveTo(-62, 4, -70, 28);
  c.quadraticCurveTo(-50, 24, -32, 6);
  c.closePath();
  c.fill();
  c.shadowBlur = 0;
  c.fillStyle = '#1d1a19';
  c.beginPath();
  c.arc(16, -8, 7.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff8ec';
  c.beginPath();
  c.arc(18.5, -10.5, 2.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function waves(c: CanvasRenderingContext2D, y: number, color: string): void {
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let r = 0; r < 3; r++) {
    c.beginPath();
    for (let x = -10; x <= 270; x += 10) {
      const yy = y + r * 13 + Math.sin((x + r * 30) * 0.05) * 6;
      if (x === -10) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
}

function drawParadeCard(c: CanvasRenderingContext2D): void {
  bg(c, '#1a1733', '#3a2338');
  waves(c, 108, 'rgba(120,150,220,0.5)');
  fish(c, 150, 62, 1, '#ff8a4a', true);
  c.strokeStyle = '#f0e2c4';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(112, 92);
  c.quadraticCurveTo(70, 116, 26, 104);
  c.stroke();
  c.fillStyle = 'rgba(255,205,130,0.28)';
  c.beginPath();
  c.ellipse(150, 128, 88, 16, 0, 0, Math.PI * 2);
  c.fill();
}

function drawRemakeCard(c: CanvasRenderingContext2D): void {
  bg(c, '#f6ecd8', '#e3d3b4');
  const cols = ['#d0203a', '#e8701d', '#ef8ba6', '#efc02c', '#2f6fb5', '#264a7a'];
  cols.forEach((col, i) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(38 + i * 37, 116, 15, 0, Math.PI * 2);
    c.fill();
  });
  fish(c, 140, 58, 0.86, '#ef8ba6', false);
  c.strokeStyle = '#7a6a52';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(196, 40);
  c.lineTo(224, 68);
  c.stroke();
}

function drawPaperCard(c: CanvasRenderingContext2D): void {
  bg(c, '#efe6d2', '#cdbe9f');
  c.strokeStyle = '#9c8a63';
  c.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(40 + i * 32, 30);
    c.lineTo(48 + i * 26, 122);
    c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.ellipse(130, 42 + i * 32, 96 - i * 6, 14, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = 'rgba(252,247,236,0.94)';
  c.beginPath();
  c.moveTo(58, 44);
  c.quadraticCurveTo(150, 26, 206, 58);
  c.quadraticCurveTo(150, 96, 62, 84);
  c.closePath();
  c.fill();
}
