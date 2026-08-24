/**
 * The only 2D UI: one wordless tool chip in the corner showing what is in
 * hand right now. No scores, no timers, no text. It pulses softly when the
 * child has been idle for a while.
 */

const ICONS: Record<string, string> = {
  lamp: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M20 46 L36 22" stroke="#cfd6da" stroke-width="4" stroke-linecap="round"/>
    <path d="M36 22 L30 12 L46 14 Z" fill="#5a646b" stroke="#cfd6da" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="38" cy="17" r="3.5" fill="#ffe9b8"/>
    <path d="M44 24 L52 32 M40 28 L46 38 M34 26 L36 36" stroke="#ffe9b8" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
    <rect x="14" y="44" width="12" height="8" rx="2" fill="#5a646b"/>
  </svg>`,
  rinse: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="28" y="10" width="8" height="22" rx="3" fill="#b9c2c7"/>
    <path d="M32 32 L32 40" stroke="#b9c2c7" stroke-width="4" stroke-linecap="round"/>
    <path d="M32 42 C32 46 30 48 30 51 a2.5 2.5 0 0 0 5 0 C35 48 32 46 32 42Z" fill="#9fd4e8"/>
    <path d="M25 48 a2 2 0 1 0 0.01 0 M40 50 a1.8 1.8 0 1 0 0.01 0" fill="#9fd4e8" opacity="0.8"/>
  </svg>`,
  resin: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="26" y="8" width="12" height="6" rx="2" fill="#8d7a5f"/>
    <rect x="29" y="14" width="6" height="10" fill="#8d7a5f"/>
    <rect x="24" y="24" width="16" height="20" rx="3" fill="#dfe9ee" stroke="#b9c2c7" stroke-width="2"/>
    <rect x="27" y="30" width="10" height="12" rx="2" fill="#c3d8e2" opacity="0.9"/>
    <path d="M32 44 L32 52" stroke="#b9c2c7" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="55" r="2.5" fill="#dfe9ee"/>
  </svg>`,
  mirror: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="30" cy="26" r="12" fill="#e6eef2" stroke="#a08b62" stroke-width="3"/>
    <path d="M30 38 L30 48 M22 52 h16" stroke="#8d7a5f" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M44 14 L52 8 M46 22 L56 20 M40 10 L44 2" stroke="#ffe9b8" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  cloth: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M14 34 q10 -12 18 -6 q10 6 18 -2 l-4 14 q-10 8 -16 4 q-8 -6 -18 0 Z" fill="#ded5c4" stroke="#b8ad98" stroke-width="2" stroke-linejoin="round"/>
    <path d="M20 30 q6 -4 10 -1" stroke="#c9bfae" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  play: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M18 44 L34 16 L38 44 Z" fill="#dfe9ee" stroke="#b9c2c7" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>
    <path d="M40 30 l12 6 M40 34 l11 9 M40 26 l12 2" stroke-width="3" stroke-linecap="round"
      stroke="#e8b8c8"/>
    <path d="M40 30 l12 6" stroke="#f5d79a" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 26 l12 2" stroke="#9fd4e8" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
};

let chipEl: HTMLElement | null = null;

function el(): HTMLElement {
  if (!chipEl) chipEl = document.getElementById('tool-chip')!;
  return chipEl;
}

export function setToolChip(name: string | null): void {
  const chip = el();
  if (!name) {
    chip.classList.remove('visible');
    return;
  }
  chip.innerHTML = ICONS[name] ?? '';
  chip.classList.add('visible');
}

export function pulseChip(on: boolean): void {
  el().classList.toggle('pulse', on);
}
