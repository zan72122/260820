import * as THREE from 'three';
import type { QualityProfile } from '../core/Quality';
import {
  makeBlobTexture, makeContactShadowTexture, makeGlassWearMap, makeGroundMaps,
  makeNetMaps, makeSoftRectTexture, makeUmeMaps, makeWallMaps, makeWeaveMaps,
  makeWoodMaps, type PbrMaps, type UmeMaps,
} from './textures';
import { makeSaltCrystalGeometry, makeUmeGeometry } from './geometry';

/**
 * Lazily builds and caches every generated asset. Hero surfaces get the full
 * texture budget; anything in the background is deliberately starved so the
 * total memory stays well inside a phone's comfort zone.
 */
export class AssetLibrary {
  private q: QualityProfile;
  private disposables: { dispose(): void }[] = [];

  private _ume: UmeMaps[] | null = null;
  private _wood: PbrMaps | null = null;
  private _woodFine: PbrMaps | null = null;
  private _ground: PbrMaps | null = null;
  private _wall: PbrMaps | null = null;
  private _net: { map: THREE.Texture; alphaMap: THREE.Texture } | null = null;
  private _glassWear: THREE.Texture | null = null;
  private _contact: THREE.Texture | null = null;
  private _blob: THREE.Texture | null = null;
  private _sharp: THREE.Texture | null = null;
  private _softRect: THREE.Texture | null = null;
  private _weave: { map: THREE.Texture; normalMap: THREE.Texture } | null = null;
  private _bark: PbrMaps | null = null;
  private _umeGeo = new Map<string, THREE.BufferGeometry>();
  private _saltGeo: THREE.BufferGeometry[] | null = null;

  constructor(quality: QualityProfile) {
    this.q = quality;
  }

  private track<T extends { dispose(): void }>(v: T): T {
    this.disposables.push(v);
    return v;
  }

  /** Three skin variations: greener, mid, and fully ripened gold. */
  get umeMaps(): UmeMaps[] {
    if (!this._ume) {
      const size = this.q.heroTexture;
      this._ume = [0.55, 0.78, 0.97].map((ripe, i) => {
        const m = makeUmeMaps(size, 0x51ce + i * 977, ripe);
        m.map.anisotropy = this.q.anisotropy;
        this.track(m.map);
        this.track(m.roughnessMap);
        this.track(m.normalMap);
        return m;
      });
    }
    return this._ume;
  }

  get wood(): PbrMaps {
    if (!this._wood) {
      const m = makeWoodMaps(this.q.heroTexture, 0x7011, 1);
      m.map.anisotropy = this.q.anisotropy;
      this._wood = m;
      this.track(m.map);
      this.track(m.roughnessMap);
      this.track(m.normalMap);
    }
    return this._wood;
  }

  /** Smaller-scale wood for the scoop and tray slats. */
  get woodFine(): PbrMaps {
    if (!this._woodFine) {
      const m = makeWoodMaps(Math.max(256, this.q.bgTexture), 0x3355, 2);
      this._woodFine = m;
      this.track(m.map);
      this.track(m.roughnessMap);
      this.track(m.normalMap);
    }
    return this._woodFine;
  }

  get ground(): PbrMaps {
    if (!this._ground) {
      const m = makeGroundMaps(this.q.bgTexture, 0x2244, 12);
      m.map.anisotropy = this.q.anisotropy;
      this._ground = m;
      this.track(m.map);
      this.track(m.roughnessMap);
      this.track(m.normalMap);
    }
    return this._ground;
  }

  get wall(): PbrMaps {
    if (!this._wall) {
      const m = makeWallMaps(Math.max(256, this.q.bgTexture / 2), 0x8899, 3);
      this._wall = m;
      this.track(m.map);
      this.track(m.roughnessMap);
      this.track(m.normalMap);
    }
    return this._wall;
  }

  get net(): { map: THREE.Texture; alphaMap: THREE.Texture } {
    if (!this._net) {
      const m = makeNetMaps(Math.max(256, this.q.heroTexture / 2));
      m.map.anisotropy = this.q.anisotropy;
      m.alphaMap.anisotropy = this.q.anisotropy;
      this._net = m;
      this.track(m.map);
      this.track(m.alphaMap);
    }
    return this._net;
  }

  /** Dark, coarse bark for the plum trunk and limbs. */
  get bark(): PbrMaps {
    if (!this._bark) {
      const m = makeWoodMaps(Math.max(256, this.q.bgTexture), 0x5c33, 4);
      this._bark = m;
      this.track(m.map);
      this.track(m.roughnessMap);
      this.track(m.normalMap);
    }
    return this._bark;
  }

  /** Coarse basketry for baskets and hampers. */
  get weave(): { map: THREE.Texture; normalMap: THREE.Texture } {
    if (!this._weave) {
      const m = makeWeaveMaps(Math.max(256, this.q.bgTexture), 0x9a3f);
      this._weave = m;
      this.track(m.map);
      this.track(m.normalMap);
    }
    return this._weave;
  }

  /** Soft-edged rectangle used for the shaft of window light. */
  get softRect(): THREE.Texture {
    if (!this._softRect) this._softRect = this.track(makeSoftRectTexture(128));
    return this._softRect;
  }

  get glassWear(): THREE.Texture {
    if (!this._glassWear) {
      this._glassWear = this.track(makeGlassWearMap(Math.max(256, this.q.bgTexture), 0x1a2b));
    }
    return this._glassWear;
  }

  get contactShadow(): THREE.Texture {
    if (!this._contact) this._contact = this.track(makeContactShadowTexture(128));
    return this._contact;
  }

  get blob(): THREE.Texture {
    if (!this._blob) this._blob = this.track(makeBlobTexture(64, 0.3));
    return this._blob;
  }

  /** Tighter falloff: used for specular glints and droplet cores. */
  get sharpBlob(): THREE.Texture {
    if (!this._sharp) this._sharp = this.track(makeBlobTexture(64, 0.72));
    return this._sharp;
  }

  umeGeometry(seed: number, radius: number, ripeness: number, hero: boolean): THREE.BufferGeometry {
    const detail = hero ? (this.q.tier === 'low' ? 3 : 4) : 2;
    const key = `${seed}|${radius.toFixed(3)}|${ripeness.toFixed(2)}|${detail}`;
    let g = this._umeGeo.get(key);
    if (!g) {
      g = makeUmeGeometry({ seed, radius, ripeness, detail });
      this._umeGeo.set(key, g);
      this.track(g);
    }
    return g;
  }

  get saltGeometries(): THREE.BufferGeometry[] {
    if (!this._saltGeo) {
      this._saltGeo = [];
      for (let i = 0; i < 6; i++) {
        this._saltGeo.push(this.track(makeSaltCrystalGeometry(0x600d + i * 131, 1)));
      }
    }
    return this._saltGeo;
  }

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* already gone */
      }
    }
    this.disposables = [];
    this._ume = null;
    this._wood = null;
    this._woodFine = null;
    this._ground = null;
    this._wall = null;
    this._net = null;
    this._glassWear = null;
    this._contact = null;
    this._blob = null;
    this._sharp = null;
    this._softRect = null;
    this._weave = null;
    this._bark = null;
    this._umeGeo.clear();
    this._saltGeo = null;
  }
}
