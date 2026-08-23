import * as THREE from 'three';
import { MoldField, fbm, hash2, makeCanvasTexture } from './moldField';

/**
 * Foundry sand as a CPU heightfield.
 * Local space: plane in XZ, +Y up, centred at origin, size FLASK_W x FLASK_D.
 * The mesh is only rewritten during animations (press / crumble), never
 * every frame while idle.
 */

export const FLASK_W = 0.72;
export const FLASK_D = 0.72;
export const PRESS_DEPTH = 0.055;   // how deep the pattern sinks
export const SAND_BASE_ROUGH = 0.0022;

export class SandBed {
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  private res: number;
  private field: MoldField | null = null;
  private pressAmount = 0;   // 0..1 (persistent max)
  private crumble = 0;       // 0..1
  private crumbleDelay: Float32Array | null = null;
  private colors: THREE.BufferAttribute;
  private dirty = true;

  constructor(res = 128) {
    this.res = res;
    this.geo = new THREE.PlaneGeometry(FLASK_W, FLASK_D, res - 1, res - 1);
    this.geo.rotateX(-Math.PI / 2);
    const count = this.geo.attributes.position.count;
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.geo.setAttribute('color', this.colors);

    const sandTex = makeCanvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#8a7154';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 14000; i++) {
        const x = hash2(i, 1, 11) * s, y = hash2(i, 2, 12) * s;
        const l = hash2(i, 3, 13);
        const g = 96 + l * 90;
        ctx.fillStyle = `rgb(${g + 18 | 0},${g * 0.86 | 0},${g * 0.62 | 0})`;
        ctx.fillRect(x, y, 1 + hash2(i, 4, 14), 1 + hash2(i, 5, 15));
      }
      // a few darker damp specks
      for (let i = 0; i < 900; i++) {
        const x = hash2(i, 6, 16) * s, y = hash2(i, 7, 17) * s;
        ctx.fillStyle = 'rgba(52,40,28,0.5)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    });
    sandTex.repeat.set(5, 5);
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: sandTex,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.rebuild();
  }

  setField(f: MoldField | null) {
    this.field = f;
    this.pressAmount = 0;
    this.crumble = 0;
    this.crumbleDelay = null;
    this.dirty = true;
  }

  /** 0..1 - driven by the press lever. Sand keeps the max depth it saw. */
  setPress(v: number) {
    const nv = Math.max(this.pressAmount, Math.min(1, Math.max(0, v)));
    if (nv !== this.pressAmount) {
      this.pressAmount = nv;
      this.dirty = true;
    }
  }

  get press() { return this.pressAmount; }

  setCrumble(v: number) {
    const nv = Math.min(1, Math.max(0, v));
    if (nv !== this.crumble) {
      this.crumble = nv;
      if (!this.crumbleDelay) {
        const n = this.res;
        this.crumbleDelay = new Float32Array(n * n);
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            // collapse spreads from the front-left corner with noise
            const u = i / (n - 1), v2 = j / (n - 1);
            this.crumbleDelay[j * n + i] = Math.min(0.85, (u * 0.35 + v2 * 0.3) + fbm(u * 6, v2 * 6, 2, 41) * 0.45);
          }
        }
      }
      this.dirty = true;
    }
  }

  /** height of the (possibly deformed) sand surface at local x,z */
  heightAt(x: number, z: number): number {
    const u = x / FLASK_W + 0.5;
    const v = z / FLASK_D + 0.5;
    return this.computeHeight(u, v);
  }

  private computeHeight(u: number, v: number): number {
    let h = fbm(u * 34, v * 34, 3, 7) * SAND_BASE_ROUGH * 2 - SAND_BASE_ROUGH;
    if (this.field) {
      const d = this.field.sample(this.field.depress, u, v);
      h -= d * this.pressAmount * PRESS_DEPTH;
    }
    if (this.crumble > 0 && this.crumbleDelay) {
      const n = this.res;
      const i = Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
      const j = Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))));
      const delay = this.crumbleDelay[j * n + i];
      const t = Math.min(1, Math.max(0, (this.crumble - delay) / 0.35));
      const s = t * t * (3 - 2 * t);
      // rubble: lumpy, generally lower, islands and walls collapse
      const rubble = -0.030 + fbm(u * 12 + 3, v * 12 + 9, 3, 23) * 0.030 - 0.008;
      h = h * (1 - s) + rubble * s;
    }
    return h;
  }

  /** rewrite vertex heights + colors. Call only while animating. */
  rebuild() {
    if (!this.dirty) return;
    this.dirty = false;
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const col = this.colors;
    const n = this.res;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const u = i / (n - 1), v = j / (n - 1);
        const h = this.computeHeight(u, v);
        pos.setY(idx, h);

        // colour: compressed / damp sand is darker; cavity floor darkest
        let d = 0;
        if (this.field) d = this.field.sample(this.field.depress, u, v) * this.pressAmount;
        const damp = 1 - d * 0.38;
        // slight ambient occlusion near cavity walls
        const grain = 0.92 + fbm(u * 60, v * 60, 2, 5) * 0.16;
        const r = 0.98 * damp * grain;
        col.setXYZ(idx, r, r * 0.97, r * 0.95);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  markDirty() { this.dirty = true; }
}
