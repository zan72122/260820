/**
 * Deliberately thin: five dots for the acts, one animated pictogram for the
 * verb of the moment, one big confirm button and a two-way colour choice.
 * No sentences, no score.
 */
export type HintKind = 'none' | 'drag' | 'press' | 'draw' | 'lift' | 'place';

const ICONS: Record<Exclude<HintKind, 'none'>, string> = {
  drag: `<svg viewBox="0 0 64 64" fill="none" stroke="#fff3df" stroke-width="3" stroke-linecap="round">
    <rect x="8" y="12" width="26" height="26" rx="3" fill="rgba(255,243,223,.25)"/>
    <path d="M36 24h16M46 18l6 6-6 6"/>
    <circle cx="46" cy="44" r="7" fill="rgba(255,243,223,.5)" stroke="none"/></svg>`,
  press: `<svg viewBox="0 0 64 64" fill="none" stroke="#fff3df" stroke-width="3" stroke-linecap="round">
    <circle cx="32" cy="32" r="10" fill="rgba(255,243,223,.55)" stroke="none"/>
    <circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="24" opacity=".45"/></svg>`,
  draw: `<svg viewBox="0 0 64 64" fill="none" stroke="#fff3df" stroke-width="3" stroke-linecap="round">
    <path d="M12 42c6-18 34-18 40 0"/>
    <circle cx="12" cy="42" r="6" fill="rgba(255,243,223,.55)" stroke="none"/>
    <path d="M46 36l6 6-8 4"/></svg>`,
  lift: `<svg viewBox="0 0 64 64" fill="none" stroke="#fff3df" stroke-width="3" stroke-linecap="round">
    <path d="M32 46V16M24 24l8-8 8 8"/>
    <path d="M14 50h36" opacity=".6"/></svg>`,
  place: `<svg viewBox="0 0 64 64" fill="none" stroke="#fff3df" stroke-width="3" stroke-linecap="round">
    <ellipse cx="32" cy="44" rx="18" ry="7" opacity=".6"/>
    <path d="M32 14v18M26 26l6 6 6-6"/></svg>`,
};

const CHECK = `<svg viewBox="0 0 48 48" fill="none" stroke="#7a4a12" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 25l10 10 18-22"/></svg>`;
const SOUND_ON = `<svg viewBox="0 0 24 24" fill="#ffe8cd"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 010 8" stroke="#ffe8cd" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const SOUND_OFF = `<svg viewBox="0 0 24 24" fill="#ffe8cd"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ffe8cd" stroke-width="2" stroke-linecap="round"/></svg>`;

function flowerSvg(hex: number, open: number): string {
  const c = '#' + hex.toString(16).padStart(6, '0');
  const petals: string[] = [];
  const n = 5 + Math.round(open * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360;
    petals.push(
      `<ellipse cx="32" cy="17" rx="9" ry="13" fill="${c}" transform="rotate(${a} 32 32)" opacity="0.95"/>`,
    );
  }
  return `<svg class="petals" viewBox="0 0 64 64">${petals.join('')}<circle cx="32" cy="32" r="8" fill="${c}" /></svg>`;
}

export class Hud {
  private root: HTMLElement;
  private steps: HTMLElement;
  private hint: HTMLElement;
  private doneBtn: HTMLButtonElement;
  private choices: HTMLElement;
  private soundBtn: HTMLButtonElement;
  onDone: (() => void) | null = null;
  onChoice: ((sameColour: boolean) => void) | null = null;
  onMute: ((muted: boolean) => void) | null = null;
  private muted = false;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <div class="steps">${'<i></i>'.repeat(5)}</div>
      <div class="hint"></div>
      <button class="done" aria-label="できた">${CHECK}</button>
      <div class="choices">
        <button data-same="1"></button>
        <button data-same="0"></button>
      </div>
      <button class="sound" aria-label="おと">${SOUND_ON}</button>`;
    this.steps = this.root.querySelector('.steps')!;
    this.hint = this.root.querySelector('.hint')!;
    this.doneBtn = this.root.querySelector('.done')!;
    this.choices = this.root.querySelector('.choices')!;
    this.soundBtn = this.root.querySelector('.sound')!;

    this.doneBtn.addEventListener('click', () => this.onDone?.());
    this.choices.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => this.onChoice?.((b as HTMLElement).dataset.same === '1')),
    );
    this.soundBtn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.soundBtn.innerHTML = this.muted ? SOUND_OFF : SOUND_ON;
      this.onMute?.(this.muted);
    });
  }

  setStep(i: number) {
    this.steps.querySelectorAll('i').forEach((el, k) => el.classList.toggle('on', k === i));
  }

  setHint(kind: HintKind) {
    if (kind === 'none') {
      this.hint.classList.remove('show');
      return;
    }
    this.hint.innerHTML = ICONS[kind];
    this.hint.classList.add('show');
  }

  showDone(show: boolean) {
    this.doneBtn.classList.toggle('show', show);
  }

  showChoices(sameHex: number, otherHex: number, show: boolean) {
    const [a, b] = Array.from(this.choices.querySelectorAll('button')) as HTMLButtonElement[];
    a.style.background = `radial-gradient(circle at 35% 30%, #fff8ee, #${sameHex.toString(16).padStart(6, '0')})`;
    b.style.background = `radial-gradient(circle at 35% 30%, #fff8ee, #${otherHex.toString(16).padStart(6, '0')})`;
    a.innerHTML = flowerSvg(sameHex, 0.4);
    b.innerHTML = flowerSvg(otherHex, 1);
    this.choices.classList.toggle('show', show);
  }
}
