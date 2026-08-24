import type { AudioSession } from '../audio/AudioSession';

/**
 * The only screen furniture in the piece: a sound button in the corner and a
 * short line of text for the adult sitting next to the child.
 *
 * There is no score, no timer, no star rating, no progress bar and no readout
 * of which areas have been found — the tiles on the stand are that record, and
 * they are objects in the room.
 */
export class Hud {
  private root: HTMLDivElement;
  private caption: HTMLDivElement;
  private panel: HTMLDivElement;
  private soundBtn: HTMLButtonElement;
  private volume: HTMLInputElement;
  private modeBtn: HTMLButtonElement;
  private open = false;

  constructor(
    container: HTMLElement,
    private audio: AudioSession,
  ) {
    this.root = document.createElement('div');
    this.root.setAttribute('data-hud', '');
    this.root.style.cssText = `
      position:fixed; inset:0; pointer-events:none;
      font-family:inherit; color:var(--ink);
      padding: env(safe-area-inset-top) env(safe-area-inset-right)
               env(safe-area-inset-bottom) env(safe-area-inset-left);
    `;

    this.soundBtn = document.createElement('button');
    this.soundBtn.type = 'button';
    this.soundBtn.setAttribute('aria-label', 'おと の せってい');
    this.soundBtn.style.cssText = `
      position:absolute; top:12px; right:12px; width:46px; height:46px;
      border-radius:23px; border:1px solid rgba(238,230,216,0.28);
      background:rgba(28,25,20,0.52); color:var(--ink);
      backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
      font-size:20px; line-height:1; pointer-events:auto; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
    `;
    this.soundBtn.textContent = '🔊';
    this.soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position:absolute; top:66px; right:12px; width:190px;
      border-radius:14px; border:1px solid rgba(238,230,216,0.22);
      background:rgba(28,25,20,0.72); backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px); padding:12px 13px;
      pointer-events:auto; display:none; gap:10px; flex-direction:column;
      font-size:13px; letter-spacing:0.02em;
    `;
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    const muteRow = document.createElement('button');
    muteRow.type = 'button';
    muteRow.style.cssText = buttonCss();
    muteRow.textContent = 'おとを けす';
    muteRow.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.setMuted(!this.audio.isMuted());
      muteRow.textContent = this.audio.isMuted() ? 'おとを だす' : 'おとを けす';
      this.soundBtn.textContent = this.audio.isMuted() ? '🔇' : '🔊';
    });

    this.volume = document.createElement('input');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '1';
    this.volume.step = '0.01';
    this.volume.value = '1';
    this.volume.style.cssText = 'width:100%; pointer-events:auto; accent-color:#c8b79c;';
    this.volume.addEventListener('input', () => {
      this.audio.setVolume(parseFloat(this.volume.value));
    });

    this.modeBtn = document.createElement('button');
    this.modeBtn.type = 'button';
    this.modeBtn.style.cssText = buttonCss();
    this.modeBtn.textContent = 'スピーカー';
    this.modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = this.audio.getOutputMode() === 'speaker' ? 'headphone' : 'speaker';
      this.audio.setOutputMode(next);
      this.modeBtn.textContent = next === 'speaker' ? 'スピーカー' : 'ヘッドホン';
    });

    this.panel.append(muteRow, this.volume, this.modeBtn);

    this.caption = document.createElement('div');
    this.caption.style.cssText = `
      position:absolute; left:0; right:0; bottom:16px; text-align:center;
      font-size:16px; letter-spacing:0.08em; color:rgba(240,232,219,0.9);
      text-shadow:0 1px 6px rgba(0,0,0,0.65); opacity:0;
      transition:opacity 480ms ease; pointer-events:none; padding:0 24px;
    `;

    this.root.append(this.soundBtn, this.panel, this.caption);
    container.appendChild(this.root);
  }

  private setOpen(v: boolean): void {
    this.open = v;
    this.panel.style.display = v ? 'flex' : 'none';
  }

  setCaption(text: string): void {
    if (this.caption.textContent !== text) this.caption.textContent = text;
    this.caption.style.opacity = text ? '1' : '0';
  }
}

function buttonCss(): string {
  return `
    width:100%; padding:9px 10px; border-radius:10px;
    border:1px solid rgba(238,230,216,0.22); background:rgba(60,54,45,0.6);
    color:var(--ink); font-size:13px; font-family:inherit; cursor:pointer;
    pointer-events:auto;
  `;
}
