/** Hand drawn inline SVG icons. No icon fonts, no emoji stand-ins. */

const wrap = (inner: string, vb = '0 0 100 100'): string =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const iconPlay = wrap(
  `<path d="M34 22 L78 50 L34 78 Z" fill="#5a3210" opacity="0.9"/>`,
);

export const iconScraper = wrap(`
  <g>
    <rect x="14" y="60" width="52" height="9" rx="3" fill="#b9c2c8"/>
    <rect x="18" y="55" width="44" height="7" rx="3" fill="#dfe6ea"/>
    <rect x="52" y="34" width="15" height="30" rx="6" fill="#f2b23a"/>
    <rect x="60" y="16" width="13" height="26" rx="6" fill="#2f3a40"/>
  </g>`);

export const iconBrush = wrap(`
  <g>
    <rect x="16" y="56" width="52" height="12" rx="4" fill="#59c3d8"/>
    <g fill="#efdcb4">
      <rect x="19" y="66" width="5" height="18" rx="2"/>
      <rect x="28" y="66" width="5" height="20" rx="2"/>
      <rect x="37" y="66" width="5" height="18" rx="2"/>
      <rect x="46" y="66" width="5" height="20" rx="2"/>
      <rect x="55" y="66" width="5" height="18" rx="2"/>
    </g>
    <rect x="58" y="26" width="14" height="34" rx="6" fill="#59c3d8"/>
    <rect x="60" y="12" width="12" height="20" rx="6" fill="#2f3a40"/>
  </g>`);

export const iconNozzle = wrap(`
  <g>
    <path d="M22 74 L34 58 L44 64 L32 80 Z" fill="#f0f2ea"/>
    <rect x="36" y="40" width="18" height="26" rx="5" fill="#c9d1d6" transform="rotate(35 45 53)"/>
    <rect x="50" y="18" width="20" height="38" rx="8" fill="#b9c2c8" transform="rotate(35 60 37)"/>
    <rect x="63" y="12" width="12" height="18" rx="6" fill="#2f3a40" transform="rotate(35 69 21)"/>
    <circle cx="26" cy="79" r="5" fill="#eef0e6"/>
  </g>`);

export const iconSpatula = wrap(`
  <g>
    <path d="M14 68 L62 52 L66 62 L18 78 Z" fill="#dfe6ea"/>
    <rect x="58" y="34" width="14" height="26" rx="5" fill="#c9d1d6" transform="rotate(20 65 47)"/>
    <rect x="64" y="14" width="14" height="28" rx="7" fill="#e4643c" transform="rotate(20 71 28)"/>
  </g>`);

export const iconPad = wrap(`
  <g>
    <ellipse cx="42" cy="70" rx="30" ry="13" fill="#f7e9c9"/>
    <ellipse cx="42" cy="64" rx="19" ry="8" fill="#9b6ce0"/>
    <rect x="54" y="26" width="14" height="30" rx="6" fill="#9b6ce0" transform="rotate(22 61 41)"/>
    <rect x="62" y="10" width="13" height="20" rx="6" fill="#2f3a40" transform="rotate(22 68 20)"/>
  </g>`);

export const iconDrop = wrap(`
  <path d="M50 14 C64 36 76 48 76 62 a26 26 0 0 1 -52 0 C24 48 36 36 50 14 Z"
        fill="#f2fdff" opacity="0.95"/>
  <ellipse cx="40" cy="60" rx="8" ry="11" fill="#ffffff" opacity="0.6"/>`);

export const iconNext = wrap(`
  <g fill="#5a3210" opacity="0.92">
    <rect x="18" y="44" width="38" height="12" rx="6"/>
    <path d="M52 32 L80 50 L52 68 Z"/>
  </g>`);

export const iconCrawler = wrap(`
  <g>
    <rect x="18" y="46" width="64" height="22" rx="8" fill="#ffc247"/>
    <rect x="26" y="34" width="42" height="16" rx="7" fill="#e8eef0"/>
    <circle cx="32" cy="72" r="11" fill="#25292d"/>
    <circle cx="68" cy="72" r="11" fill="#25292d"/>
    <circle cx="32" cy="72" r="4.5" fill="#b9c2c8"/>
    <circle cx="68" cy="72" r="4.5" fill="#b9c2c8"/>
    <path d="M70 30 L94 18 L94 44 Z" fill="#fff0c9" opacity="0.85"/>
    <circle cx="70" cy="32" r="7" fill="#2f3a40"/>
  </g>`, '0 0 100 90');

export const iconHand = wrap(`
  <circle cx="50" cy="50" r="30" fill="rgba(255,255,255,0.34)"/>
  <circle cx="50" cy="50" r="17" fill="rgba(255,255,255,0.85)"/>
  <circle cx="50" cy="50" r="17" fill="none" stroke="rgba(20,60,80,0.35)" stroke-width="3"/>`);
