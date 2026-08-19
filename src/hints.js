// ---------------------------------------------------------------------------
// Wordless guidance. The game has no text at all, so every instruction is a
// picture: a glowing ring on the snow ("dig here"), a hand miming the gesture,
// and an arrow for the direction to pull.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ringSprite, handSprite, arrowSprite, sparkleSprite } from './textures.js';
import { clamp01, lerp, smoothstep } from './util.js';

/** Soft pulsing ring laid on the snow over an undiscovered carrot. */
export class SpotMarker {
  constructor(scene) {
    const tex = ringSprite(256);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    scene.add(this.mesh);

    const sMat = new THREE.SpriteMaterial({
      map: sparkleSprite(128), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0, fog: false,
    });
    this.stars = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(sMat.clone());
      s.scale.setScalar(0.07);
      s.renderOrder = 4;
      s.visible = false;
      scene.add(s);
      this.stars.push(s);
    }
    this.t = Math.random() * 6;
    this.strength = 0;
  }
  setAt(x, y, z) {
    this.mesh.position.set(x, y + 0.012, z);
    this.base = new THREE.Vector3(x, y, z);
  }
  show(v, strength = 1) { this.target = v ? strength : 0; }
  update(dt) {
    this.t += dt;
    this.strength = lerp(this.strength, this.target || 0, 1 - Math.exp(-6 * dt));
    const vis = this.strength > 0.01;
    this.mesh.visible = vis;
    if (!vis) { this.stars.forEach((s) => (s.visible = false)); return; }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.3);
    this.mesh.material.opacity = this.strength * (0.30 + pulse * 0.42);
    const sc = 0.44 + pulse * 0.11;
    this.mesh.scale.set(sc, sc, sc);
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.visible = true;
      const a = this.t * (0.8 + i * 0.27) + i * 2.1;
      const r = 0.10 + 0.05 * Math.sin(this.t * 1.7 + i);
      s.position.set(
        this.base.x + Math.cos(a) * r,
        this.base.y + 0.05 + 0.045 * Math.sin(this.t * 2.2 + i * 1.9),
        this.base.z + Math.sin(a) * r
      );
      s.material.opacity = this.strength * (0.35 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 3 + i * 2)));
      s.scale.setScalar(0.05 + 0.02 * (0.5 + 0.5 * Math.sin(this.t * 2.6 + i)));
    }
  }
}

/**
 * Screen-space gesture hints drawn as DOM images over the canvas: crisp at any
 * resolution and free of any 3D sorting worries.
 */
export class GestureHint {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'hint-layer';
    container.appendChild(this.el);

    this.hand = document.createElement('img');
    this.hand.src = handSprite(256).image.toDataURL();
    this.hand.className = 'hint hint-hand';
    this.el.appendChild(this.hand);

    this.arrow = document.createElement('img');
    this.arrow.src = arrowSprite(256).image.toDataURL();
    this.arrow.className = 'hint hint-arrow';
    this.el.appendChild(this.arrow);

    this.mode = 'none';
    this.t = 0;
    this.anchor = { x: 0, y: 0 };
    this.opacity = 0;
    this.target = 0;
  }

  /** mode: 'none' | 'sweep' | 'pull' | 'carry' | 'tap' */
  set(mode, anchor) {
    if (anchor) this.anchor = anchor;
    if (mode !== this.mode) { this.mode = mode; this.t = 0; }
    this.target = mode === 'none' ? 0 : 1;
  }
  setAnchor(x, y) { this.anchor.x = x; this.anchor.y = y; }
  setSecondary(x, y) { this.secondary = { x, y }; }

  update(dt) {
    this.t += dt;
    this.opacity = lerp(this.opacity, this.target, 1 - Math.exp(-5 * dt));
    if (this.opacity < 0.02) {
      this.hand.style.opacity = '0';
      this.arrow.style.opacity = '0';
      return;
    }
    const a = this.anchor;
    let hx = a.x, hy = a.y, rot = 0, scale = 1, arrowOn = false;
    let ax = a.x, ay = a.y, arot = 0, ascale = 1;
    const cyc = (period) => (this.t % period) / period;

    if (this.mode === 'sweep') {
      const p = cyc(1.9);
      const s = Math.sin(p * Math.PI * 2);
      const ramp = smoothstep(0, 0.12, p) * (1 - smoothstep(0.88, 1, p));
      hx = a.x + s * 62;
      hy = a.y + Math.abs(Math.cos(p * Math.PI * 2)) * 8;
      rot = s * 14;
      scale = 0.95 + 0.06 * Math.cos(p * Math.PI * 4);
      this.hand.style.opacity = String(this.opacity * (0.35 + ramp * 0.6));
      this.arrow.style.opacity = '0';
    } else if (this.mode === 'pull') {
      const p = cyc(1.5);
      const rise = smoothstep(0.08, 0.72, p);
      hy = a.y - rise * 92;
      hx = a.x;
      scale = 1.0 - rise * 0.06;
      this.hand.style.opacity = String(this.opacity * (0.35 + (1 - Math.abs(p * 2 - 1)) * 0.6));
      arrowOn = true;
      ay = a.y - 132 - Math.sin(p * Math.PI) * 18;
      ascale = 0.78;
      this.arrow.style.opacity = String(this.opacity * (0.55 + 0.35 * Math.sin(p * Math.PI * 2)));
    } else if (this.mode === 'carry') {
      const s = this.secondary || a;
      const p = cyc(1.8);
      const e = smoothstep(0.1, 0.85, p);
      hx = lerp(a.x, s.x, e);
      hy = lerp(a.y, s.y, e);
      this.hand.style.opacity = String(this.opacity * (0.3 + (1 - Math.abs(p * 2 - 1)) * 0.6));
      arrowOn = true;
      ax = s.x; ay = s.y - 76;
      arot = 180;
      ascale = 0.66;
      this.arrow.style.opacity = String(this.opacity * 0.6);
    } else if (this.mode === 'tap') {
      const p = cyc(1.3);
      const press = Math.max(0, Math.sin(p * Math.PI * 2));
      scale = 1 - press * 0.13;
      hy = a.y + press * 10;
      this.hand.style.opacity = String(this.opacity * 0.85);
      this.arrow.style.opacity = '0';
    } else {
      // dismissed: keep fading rather than hanging at the last frame's alpha
      this.hand.style.opacity = String(this.opacity * 0.5);
      this.arrow.style.opacity = String(this.opacity * 0.4);
    }

    // the glyph's fingertip is what should sit on the anchor point
    this.hand.style.transform =
      `translate(${hx - 44}px, ${hy - 8}px) rotate(${rot}deg) scale(${scale})`;
    if (arrowOn) {
      this.arrow.style.transform =
        `translate(${ax - 40}px, ${ay - 40}px) rotate(${arot}deg) scale(${ascale})`;
    }
  }
}
