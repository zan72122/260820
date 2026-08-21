import type { FrameView } from '../game/scoring';

const CSS = `
#hud {
  position: fixed; inset: 0; pointer-events: none;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', system-ui, sans-serif;
  color: #e8e4da;
}
#scorecard {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 2px; padding: 6px; border-radius: 6px;
  background: rgba(12, 12, 14, 0.78);
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.frame { width: 44px; text-align: center; }
.frame.tenth { width: 60px; }
.frame .no { font-size: 10px; color: #9a938a; padding-bottom: 2px; }
.frame .rolls {
  display: flex; height: 18px; border: 1px solid #3a3733; border-bottom: none;
  background: #17171a; font-size: 12px; line-height: 18px;
}
.frame .rolls span { flex: 1; border-left: 1px solid #3a3733; }
.frame .rolls span:first-child { border-left: none; }
.frame .cum {
  height: 20px; border: 1px solid #3a3733; background: #101012;
  font-size: 13px; line-height: 20px; font-weight: 600;
}
.frame.active .rolls, .frame.active .cum { border-color: #b08d4f; }
#message {
  position: absolute; bottom: 12%; left: 50%; transform: translateX(-50%);
  font-size: 30px; font-weight: 700; letter-spacing: 0.06em;
  text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  opacity: 0; transition: opacity 0.25s;
}
#message.show { opacity: 1; }
#hint {
  position: absolute; bottom: 4%; left: 50%; transform: translateX(-50%);
  font-size: 14px; color: #b5aea3; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}
`;

/** 投球マークの表記（X, /, ‒, 数字） */
function markFor(frameRolls: number[], idx: number, isTenth: boolean): string {
  const v = frameRolls[idx];
  if (v === undefined) return '';
  if (v === 10 && (idx === 0 || isTenth)) {
    if (!isTenth && idx > 0) return '/';
    // 10フレーム目: 直前がストライク/再ラックならX、残りピン取り切りは/
    if (idx > 0 && frameRolls[idx - 1]! !== 10 && frameRolls[idx - 1]! + v === 10) return '/';
    return 'X';
  }
  if (idx > 0 && frameRolls[idx - 1]! !== 10 && frameRolls[idx - 1]! + v === 10) return '/';
  return v === 0 ? '‒' : String(v);
}

export class Hud {
  private scorecard: HTMLElement;
  private message: HTMLElement;
  private hint: HTMLElement;
  private msgTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `<div id="scorecard"></div><div id="message"></div><div id="hint"></div>`;
    parent.appendChild(root);
    this.scorecard = root.querySelector('#scorecard')!;
    this.message = root.querySelector('#message')!;
    this.hint = root.querySelector('#hint')!;
  }

  update(frames: FrameView[], activeFrame: number): void {
    this.scorecard.innerHTML = frames
      .map((f, i) => {
        const isTenth = i === 9;
        const slots = isTenth ? 3 : 2;
        const marks = Array.from({ length: slots }, (_, r) => {
          if (!isTenth && f.rolls[0] === 10) return r === 0 ? 'X' : '';
          return markFor(f.rolls, r, isTenth);
        });
        return `<div class="frame${isTenth ? ' tenth' : ''}${i === activeFrame ? ' active' : ''}">
          <div class="no">${i + 1}</div>
          <div class="rolls">${marks.map((m) => `<span>${m}</span>`).join('')}</div>
          <div class="cum">${f.cumulative ?? ''}</div>
        </div>`;
      })
      .join('');
  }

  showMessage(text: string, ms = 1800): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.message.classList.remove('show'), ms);
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }
}
