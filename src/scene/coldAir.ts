import * as THREE from 'three';
import { Rng, clamp, damp } from '../core/rng';
import { glowTexture } from './textures';

/**
 * The cold is shown, not stated: no blue glow, just a faint sag of chilled air
 * that drifts off the frozen dome and slides down onto the worktop.
 */
export class ColdAir {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private seeds: Array<{ a: number; r: number; t: number; speed: number; scale: number }> = [];
  private level = 0;
  private target = 0;
  private tex: THREE.Texture;

  constructor(count = 7) {
    this.tex = glowTexture(96, 0.95);
    const rng = new Rng(0xc01da12);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex,
        color: 0xdfe9f2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const s = new THREE.Sprite(mat);
      s.renderOrder = 3;
      this.sprites.push(s);
      this.seeds.push({
        a: rng.range(0, Math.PI * 2),
        r: rng.range(0.75, 1.35),
        t: rng.next(),
        speed: rng.range(0.09, 0.18),
        scale: rng.range(0.5, 1.05),
      });
      this.group.add(s);
    }
    this.group.visible = false;
  }

  setActive(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  update(dt: number): void {
    this.level = damp(this.level, this.target, 2.4, dt);
    if (this.level < 0.005) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.seeds[i];
      s.t += dt * s.speed;
      if (s.t > 1) s.t -= 1;
      const spread = s.t;
      const y = 0.42 - spread * 0.42;
      const r = s.r + spread * 0.55;
      const sp = this.sprites[i];
      sp.position.set(Math.cos(s.a) * r, y, Math.sin(s.a) * r);
      sp.scale.setScalar(s.scale * (0.55 + spread * 0.8));
      const fade = Math.sin(spread * Math.PI);
      (sp.material as THREE.SpriteMaterial).opacity = clamp(fade * 0.09 * this.level, 0, 1);
    }
  }

  dispose(): void {
    this.tex.dispose();
    for (const s of this.sprites) (s.material as THREE.SpriteMaterial).dispose();
  }
}
