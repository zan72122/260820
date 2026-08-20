import { Color } from 'three';
import { loadCollection, type CollectedGeode } from '../game/Collection';
import { varietyById } from '../world/varieties';

export type ChoiceId = 'again' | 'new' | 'gallery';

const ICONS: Record<ChoiceId, string> = {
  // Re-open the same stone.
  again: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M38 24a14 14 0 1 1-4.4-10.2" stroke="currentColor" stroke-width="4"
      stroke-linecap="round"/>
    <path d="M38 8v9h-9" stroke="currentColor" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  // A different, still-muddy stone.
  new: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M9 27 15 13l12-4 12 8 -3 15 -13 6z" fill="currentColor" opacity=".38"/>
    <path d="M9 27 15 13l12-4 12 8 -3 15 -13 6z" stroke="currentColor" stroke-width="3.2"
      stroke-linejoin="round"/>
    <path d="M15 13 27 19l12-2M27 19l-4 19" stroke="currentColor" stroke-width="2.6"
      stroke-linejoin="round" opacity=".8"/>
  </svg>`,
  // The shelf of everything opened so far.
  gallery: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="7" y="9" width="15" height="15" rx="3.5" stroke="currentColor" stroke-width="3.2"/>
    <rect x="26" y="9" width="15" height="15" rx="3.5" stroke="currentColor" stroke-width="3.2"/>
    <rect x="7" y="28" width="15" height="11" rx="3.5" stroke="currentColor" stroke-width="3.2"/>
    <rect x="26" y="28" width="15" height="11" rx="3.5" stroke="currentColor" stroke-width="3.2"/>
  </svg>`,
};

const CLOSE_ICON = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M9 9l14 14M23 9L9 23" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>
</svg>`;

const LABELS: Record<ChoiceId, string> = {
  again: 'この石をもう一度ひらく',
  new: 'ちがう石をひらく',
  gallery: 'あつめた石をみる',
};

/**
 * The only DOM chrome in the game: three wordless choices at the end of a run,
 * and the shelf they lead to. Everything else is diegetic.
 */
export class Overlay {
  private root: HTMLElement;
  private choices: HTMLDivElement;
  private gallery: HTMLDivElement | null = null;
  private onChoice: (id: ChoiceId) => void;

  constructor(root: HTMLElement, onChoice: (id: ChoiceId) => void) {
    this.root = root;
    this.onChoice = onChoice;

    this.choices = document.createElement('div');
    this.choices.className = 'choices';
    for (const id of ['again', 'new', 'gallery'] as ChoiceId[]) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.type = 'button';
      b.innerHTML = ICONS[id];
      // Visually wordless; screen readers still get a name.
      b.setAttribute('aria-label', LABELS[id]);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.onChoice(id);
      });
      this.choices.appendChild(b);
    }
    root.appendChild(this.choices);
  }

  showChoices(): void {
    this.choices.classList.add('on');
  }

  hideChoices(): void {
    this.choices.classList.remove('on');
  }

  get choicesVisible(): boolean {
    return this.choices.classList.contains('on');
  }

  openGallery(): void {
    if (this.gallery) return;
    const el = document.createElement('div');
    el.className = 'gallery';
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    const items = loadCollection();
    if (items.length === 0) {
      grid.innerHTML = '<div class="gem" aria-hidden="true"></div>'.repeat(6);
    } else {
      for (const item of items) grid.appendChild(gemTile(item));
    }
    el.appendChild(grid);

    const close = document.createElement('button');
    close.className = 'gallery-close';
    close.type = 'button';
    close.innerHTML = CLOSE_ICON;
    close.setAttribute('aria-label', 'とじる');
    close.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeGallery();
    });
    el.appendChild(close);

    this.root.appendChild(el);
    this.gallery = el;
    requestAnimationFrame(() => el.classList.add('on'));
  }

  closeGallery(): void {
    const el = this.gallery;
    if (!el) return;
    this.gallery = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 400);
  }

  get galleryOpen(): boolean {
    return this.gallery !== null;
  }

  dispose(): void {
    this.choices.remove();
    this.gallery?.remove();
  }
}

/** A little SVG portrait of a collected stone, drawn from its own seed so the
 *  shelf shows the actual variety and roughly the shape that was opened. */
function gemTile(item: CollectedGeode): HTMLElement {
  const v = varietyById(item.variety);
  const c = new Color().copy(v.hue);
  const hex = `#${c.getHexString()}`;
  const dim = `#${c.clone().multiplyScalar(0.45).getHexString()}`;
  const bright = `#${c.clone().lerp(new Color(1, 1, 1), 0.55).getHexString()}`;

  let seed = item.seed >>> 0 || 1;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let spikes = '';
  const n = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const r = 8 + rnd() * 13;
    const cx = 32 + Math.cos(a) * (6 + rnd() * 12);
    const cy = 40 + Math.sin(a) * 4;
    const w = 2.6 + rnd() * 3.4;
    spikes += `<path d="M${cx - w} ${cy} L${cx} ${cy - r} L${cx + w} ${cy} Z" fill="${
      rnd() > 0.5 ? bright : hex}" opacity="${(0.65 + rnd() * 0.35).toFixed(2)}"/>`;
  }

  const el = document.createElement('div');
  el.className = 'gem';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${item.variety} のジオード`);
  el.innerHTML = `<svg viewBox="0 0 64 64">
    <defs>
      <radialGradient id="g${item.seed >>> 0}" cx="45%" cy="35%">
        <stop offset="0" stop-color="${bright}" stop-opacity=".9"/>
        <stop offset="1" stop-color="${dim}" stop-opacity=".95"/>
      </radialGradient>
    </defs>
    <path d="M6 42 C6 22 20 10 32 10 C44 10 58 22 58 42 Z" fill="#3a2f28"/>
    <path d="M11 42 C11 26 21 15 32 15 C43 15 53 26 53 42 Z" fill="url(#g${item.seed >>> 0})"/>
    ${spikes}
    <rect x="4" y="42" width="56" height="7" rx="3.2" fill="#241c22"/>
  </svg>`;
  el.style.opacity = String(0.55 + item.care * 0.45);
  return el;
}
