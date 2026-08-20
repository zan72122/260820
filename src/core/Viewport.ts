/**
 * Orientation, safe areas and the render resolution budget.
 *
 * iPhone and iPad are handled as four distinct layouts rather than one cropped design:
 * phone-portrait, phone-landscape, tablet-portrait and tablet-landscape each get their own
 * framing weights, which the camera director and the UI both read.
 */

export type LayoutKind = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'tablet-landscape';

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export class Viewport {
  width = 1;
  height = 1;
  aspect = 1;
  dpr = 1;
  portrait = true;
  layout: LayoutKind = 'phone-portrait';
  readonly safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

  private probe: HTMLDivElement;
  private listeners: ((v: Viewport) => void)[] = [];

  constructor(private readonly maxDpr: number) {
    this.probe = document.createElement('div');
    this.probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;visibility:hidden;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
    document.body.appendChild(this.probe);
    this.measure();
  }

  onChange(fn: (v: Viewport) => void): void {
    this.listeners.push(fn);
  }

  measure(): boolean {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
    const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const cs = getComputedStyle(this.probe);
    const top = parseFloat(cs.paddingTop) || 0;
    const right = parseFloat(cs.paddingRight) || 0;
    const bottom = parseFloat(cs.paddingBottom) || 0;
    const left = parseFloat(cs.paddingLeft) || 0;

    const changed =
      w !== this.width ||
      h !== this.height ||
      dpr !== this.dpr ||
      top !== this.safe.top ||
      bottom !== this.safe.bottom ||
      left !== this.safe.left ||
      right !== this.safe.right;

    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.aspect = w / h;
    this.portrait = h >= w;
    this.safe.top = top;
    this.safe.right = right;
    this.safe.bottom = bottom;
    this.safe.left = left;

    // >=740 CSS px on the short edge is the practical iPad / large-tablet threshold.
    const shortEdge = Math.min(w, h);
    const tablet = shortEdge >= 700;
    this.layout = tablet
      ? this.portrait
        ? 'tablet-portrait'
        : 'tablet-landscape'
      : this.portrait
        ? 'phone-portrait'
        : 'phone-landscape';

    if (changed) for (const l of this.listeners) l(this);
    return changed;
  }

  /** CSS-pixel rectangle that excludes the notch / home indicator. */
  safeRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.safe.left,
      y: this.safe.top,
      w: Math.max(1, this.width - this.safe.left - this.safe.right),
      h: Math.max(1, this.height - this.safe.top - this.safe.bottom),
    };
  }

  dispose(): void {
    this.probe.remove();
    this.listeners.length = 0;
  }
}
