const NS = 'http://www.w3.org/2000/svg';

/**
 * The only overlay in the game. No words, no buttons, no tutorial.
 * It draws the stroke the finger is making — the same line the net will fly
 * along — and a soft vignette so the eye lands on the water.
 */
export class Hud {
  constructor(root) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="strokeFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#f3e6c8" stop-opacity="0"/>
        <stop offset="0.5" stop-color="#f7ecd4" stop-opacity="0.42"/>
        <stop offset="1"   stop-color="#ffffff" stop-opacity="0.68"/>
      </linearGradient>
      <radialGradient id="vig" cx="50%" cy="46%" r="72%">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1"    stop-color="#04121a" stop-opacity="0.38"/>
      </radialGradient>
    `;
    svg.appendChild(defs);

    const vig = document.createElementNS(NS, 'rect');
    vig.setAttribute('width', '100%');
    vig.setAttribute('height', '100%');
    vig.setAttribute('fill', 'url(#vig)');
    svg.appendChild(vig);

    // The stroke is drawn as a stack of shortening segments rather than one
    // gradient-filled path, so it tapers correctly whichever way the hand goes.
    const SEGMENTS = 7;
    const trails = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#efe2c4');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('opacity', '0');
      svg.appendChild(p);
      trails.push(p);
    }

    const tip = document.createElementNS(NS, 'circle');
    tip.setAttribute('r', '3.4');
    tip.setAttribute('fill', '#f6ecd6');
    tip.setAttribute('opacity', '0');
    svg.appendChild(tip);

    root.appendChild(svg);
    this.svg = svg; this.trails = trails; this.tip = tip;
    this.segments = SEGMENTS;
    this.alpha = 0;
  }

  update(path, dt) {
    const live = path && path.length > 1;
    this.alpha += ((live ? 1 : 0) - this.alpha) * (1 - Math.exp(-(live ? 14 : 4.5) * dt));
    if (this.alpha < 0.004) {
      for (const t of this.trails) t.setAttribute('opacity', '0');
      this.tip.setAttribute('opacity', '0');
      return;
    }
    if (live) {
      const take = path.slice(Math.max(0, path.length - 22));
      const n = take.length;
      for (let s = 0; s < this.segments; s++) {
        // Segment 0 is the whole visible tail; each later one is a shorter,
        // brighter, wider piece nearer the fingertip.
        const from = Math.floor((s / this.segments) * (n - 1));
        const pts = take.slice(from);
        if (pts.length < 2) { this.trails[s].setAttribute('opacity', '0'); continue; }
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i], q = pts[i - 1];
          d += ` Q ${q.x.toFixed(1)} ${q.y.toFixed(1)} ${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
        }
        this.trails[s].setAttribute('d', d);
        // Stacked segments: the tip is covered by all of them, the tail by one,
        // so the alpha ramps without needing per-vertex opacity. Kept low —
        // this is a damp fingermark on glass, not a beam.
        this.trails[s].setAttribute('stroke-width', (1.7 + s * 0.55).toFixed(1));
        this.trails[s].setAttribute('opacity', (this.alpha * 0.032).toFixed(3));
      }
      const last = take[n - 1];
      this.tip.setAttribute('cx', last.x);
      this.tip.setAttribute('cy', last.y);
    } else {
      for (const t of this.trails) {
        t.setAttribute('opacity', (this.alpha * 0.032).toFixed(3));
      }
    }
    this.tip.setAttribute('opacity', (this.alpha * 0.26).toFixed(3));
  }
}
