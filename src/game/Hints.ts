import * as THREE from 'three';

const TRAIL = 12;

/**
 * The only thing on screen that is not part of the world: a short, translucent
 * trail showing the shape of one gesture. It is shown at most once per step,
 * only after the child has hesitated, and it never demonstrates the outcome.
 *
 * It is drawn as a handful of DOM circles rather than a second WebGL pass —
 * it costs nothing, it cannot fight the renderer's state, and it is exactly
 * what the browser is good at.
 */
export class Hints {
  private root: HTMLDivElement;
  private dots: HTMLDivElement[] = [];
  private finger: HTMLDivElement;
  private path: THREE.Vector2[] = [];
  private t = 0;
  private duration = 1.9;
  private active = false;
  private fade = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: '5',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(this.root);

    const make = (size: number) => {
      const d = document.createElement('div');
      Object.assign(d.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0) 72%)',
        opacity: '0',
        willChange: 'transform, opacity',
      } satisfies Partial<CSSStyleDeclaration>);
      this.root.appendChild(d);
      return d;
    };

    for (let i = 0; i < TRAIL; i++) this.dots.push(make(46));
    this.finger = make(88);
  }

  /** Kept for symmetry with the renderer; the overlay is laid out by CSS. */
  resize(_w: number, _h: number) {
    void _w;
    void _h;
  }

  get playing() {
    return this.active;
  }

  play(path: THREE.Vector2[], duration = 1.9) {
    if (path.length < 2) return;
    this.path = path;
    this.t = 0;
    this.duration = duration;
    this.active = true;
    this.fade = 0;
  }

  stop() {
    this.active = false;
    this.fade = 0;
    this.finger.style.opacity = '0';
    for (const d of this.dots) d.style.opacity = '0';
  }

  private sample(u: number, out: THREE.Vector2) {
    const n = this.path.length - 1;
    const f = Math.min(0.9999, Math.max(0, u)) * n;
    const i = Math.floor(f);
    out.copy(this.path[i]).lerp(this.path[i + 1], f - i);
    return out;
  }

  update(dt: number) {
    if (!this.active) return;
    this.t += dt;
    const u = this.t / this.duration;
    if (u >= 1) {
      this.stop();
      return;
    }
    // ease in and out so the hint never snaps into existence
    this.fade = Math.min(1, Math.min(u / 0.18, (1 - u) / 0.22));
    const p = new THREE.Vector2();
    this.sample(u, p);
    this.finger.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.finger.style.opacity = String(0.7 * this.fade);
    for (let i = 0; i < TRAIL; i++) {
      const tu = u - (i + 1) * 0.045;
      const d = this.dots[i];
      if (tu < 0) {
        d.style.opacity = '0';
        continue;
      }
      this.sample(tu, p);
      const k = 1 - i / TRAIL;
      d.style.transform = `translate(${p.x}px, ${p.y}px) scale(${0.45 + k * 0.4})`;
      d.style.opacity = String(0.42 * k * this.fade);
    }
  }

  debug() {
    return {
      active: this.active,
      fade: Number(this.fade.toFixed(2)),
      opacity: this.finger.style.opacity,
      transform: this.finger.style.transform,
    };
  }
}

/* ---------------------------------------------------- gesture path shapes */

export function leverPath(from: THREE.Vector2, h: number): THREE.Vector2[] {
  const drop = Math.min(h * 0.24, 190);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(new THREE.Vector2(from.x + Math.sin(u * Math.PI) * 10, from.y + drop * u));
  }
  return pts;
}

export function forwardPath(w: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const x = w * 0.5;
  const y0 = h * 0.86;
  const y1 = h * 0.55;
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(new THREE.Vector2(x + Math.sin(u * Math.PI) * 6, y0 + (y1 - y0) * u));
  }
  return pts;
}

export function shakePath(center: THREE.Vector2, w: number): THREE.Vector2[] {
  const amp = Math.min(w * 0.16, 130);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new THREE.Vector2(center.x + Math.sin(u * Math.PI * 4) * amp, center.y + Math.cos(u * Math.PI * 4) * 8));
  }
  return pts;
}

export function arcPath(center: THREE.Vector2, w: number, h: number): THREE.Vector2[] {
  const r = Math.min(w, h) * 0.28;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI * 0.92 - (i / 18) * Math.PI * 1.02;
    pts.push(new THREE.Vector2(center.x + Math.cos(a) * r, center.y - Math.sin(a) * r * 0.62 + r * 0.3));
  }
  return pts;
}
