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

    const trail = document.createElementNS(NS, 'path');
    trail.setAttribute('fill', 'none');
    trail.setAttribute('stroke', 'url(#strokeFade)');
    trail.setAttribute('stroke-linecap', 'round');
    trail.setAttribute('stroke-linejoin', 'round');
    trail.setAttribute('stroke-width', '9');
    trail.setAttribute('opacity', '0');
    svg.appendChild(trail);

    const tip = document.createElementNS(NS, 'circle');
    tip.setAttribute('r', '7');
    tip.setAttribute('fill', '#fff8e8');
    tip.setAttribute('opacity', '0');
    svg.appendChild(tip);

    root.appendChild(svg);
    this.svg = svg; this.trail = trail; this.tip = tip;
    this.alpha = 0;
  }

  update(path, dt) {
    const live = path && path.length > 1;
    this.alpha += ((live ? 1 : 0) - this.alpha) * (1 - Math.exp(-(live ? 14 : 4.5) * dt));
    if (this.alpha < 0.003) {
      this.trail.setAttribute('opacity', '0');
      this.tip.setAttribute('opacity', '0');
      return;
    }
    if (live) {
      const take = path.slice(Math.max(0, path.length - 34));
      let d = `M ${take[0].x.toFixed(1)} ${take[0].y.toFixed(1)}`;
      for (let i = 1; i < take.length; i++) {
        const p = take[i], q = take[i - 1];
        d += ` Q ${q.x.toFixed(1)} ${q.y.toFixed(1)} ${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
      }
      this.trail.setAttribute('d', d);
      const last = take[take.length - 1];
      this.tip.setAttribute('cx', last.x);
      this.tip.setAttribute('cy', last.y);
    }
    this.trail.setAttribute('opacity', (this.alpha * 0.9).toFixed(3));
    this.tip.setAttribute('opacity', (this.alpha * 0.55).toFixed(3));
  }
}
