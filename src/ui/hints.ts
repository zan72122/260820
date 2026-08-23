import * as THREE from 'three';

/**
 * Wordless guidance: after some idle time a soft touch-ring pulses at the
 * screen position of the active control and drifts along the expected
 * gesture. Pure DOM overlay - not an object glow.
 */

export class TouchHint {
  private el: HTMLDivElement;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; left: 0; top: 0; width: 72px; height: 72px;
      margin: -36px 0 0 -36px; pointer-events: none;
      border-radius: 50%;
      border: 5px solid rgba(255,255,255,0.85);
      box-shadow: 0 2px 14px rgba(0,0,0,0.35), inset 0 0 12px rgba(255,255,255,0.4);
      opacity: 0; transition: opacity 0.4s;
      will-change: transform, opacity;
    `;
    parent.appendChild(this.el);
  }

  /**
   * show at ndc position with a gesture drift.
   * from/to are NDC (-1..1). t is 0..1 phase of the loop.
   */
  show(from: THREE.Vector2, to: THREE.Vector2, t: number, w: number, h: number) {
    const k = t < 0.5 ? (t * 2) * (t * 2) * (3 - 2 * t * 2) : 1;
    const hold = t >= 0.5;
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k;
    const px = (x * 0.5 + 0.5) * w;
    const py = (-y * 0.5 + 0.5) * h;
    this.el.style.transform = `translate(${px}px, ${py}px) scale(${hold ? 0.86 : 1})`;
    if (!this.visible) { this.el.style.opacity = '1'; this.visible = true; }
    this.el.style.opacity = String(hold && t > 0.82 ? (1 - (t - 0.82) / 0.18) : 1);
  }

  hide() {
    if (this.visible) { this.el.style.opacity = '0'; this.visible = false; }
  }
}
