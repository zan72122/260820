import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Points,
  PointsMaterial,
  SpotLight,
  Vector3,
} from 'three/webgpu';
import { LAYOUT } from '../core/config';
import { Rng, clamp01, damp } from '../core/mathx';
import type { Materials } from '../art/materials';
import type { QualityProfile } from '../core/quality';

export type Mood = 'prevAct' | 'between' | 'ourAct' | 'bow';

interface Target {
  hemi: number;
  wingWork: number;
  spill: number;
  key: number;
  wash: number;
  side: number;
  house: number;
  exposure: number;
  shafts: number;
  audience: number;
}

const MOODS: Record<Mood, Target> = {
  // Someone else's turn: the stage is warm, the wing is a cold pocket.
  prevAct: {
    hemi: 0.13, wingWork: 5.5, spill: 5.5, key: 40, wash: 30, side: 12,
    house: 30, exposure: 1.04, shafts: 1, audience: 0.45,
  },
  // The act has ended, the 緞帳 is in. Almost nothing but the work light.
  between: {
    hemi: 0.12, wingWork: 7, spill: 2.4, key: 11, wash: 4.5, side: 3,
    house: 24, exposure: 1.2, shafts: 0.35, audience: 0.36,
  },
  // Our turn. Everything opens.
  ourAct: {
    hemi: 0.2, wingWork: 4, spill: 8, key: 60, wash: 34, side: 15,
    house: 11, exposure: 0.9, shafts: 1, audience: 0.34,
  },
  bow: {
    hemi: 0.24, wingWork: 3.6, spill: 7, key: 56, wash: 32, side: 14,
    house: 15, exposure: 0.94, shafts: 0.8, audience: 0.44,
  },
};

/**
 * A theatre is defined by its exposure differences: the wing must be genuinely
 * dark and the stage genuinely bright, without either turning into a flat
 * silhouette. Nothing here is a full-scene shadow: exactly one spotlight casts,
 * and it is always the one pointing at whoever the player is watching.
 */
export class Lighting {
  readonly group = new Group();
  readonly keySpot: SpotLight;
  readonly keyTarget = new Object3D();
  private hemi: HemisphereLight;
  private wingWork: PointLight;
  /** Warm light bleeding through the gap into the wing. */
  private spill: PointLight;
  private wash: SpotLight;
  private washTarget = new Object3D();
  private side: SpotLight[] = [];
  private house: PointLight;
  private wingBounce!: PointLight;
  private shafts: Group;
  private dust: Points | null = null;
  private dustVel: Float32Array | null = null;
  private current: Target;
  private target: Target;
  private mats: Materials;
  audienceLevel = 0.16;

  constructor(mats: Materials, rng: Rng) {
    this.mats = mats;
    this.current = { ...MOODS.prevAct };
    this.target = { ...MOODS.prevAct };

    this.hemi = new HemisphereLight(0x6b7a92, 0x2a201c, this.current.hemi);
    this.group.add(this.hemi);

    // 舞台袖照明: a cold blue work light, the only practical in the wing.
    this.wingWork = new PointLight(0x8fb2e0, this.current.wingWork, 9, 2);
    this.wingWork.position.set(4.88, LAYOUT.stageY + 1.84, 2.86);
    this.group.add(this.wingWork);

    // Warmth leaking round the leg curtain. This is what makes the dark wing
    // legible, and it grows as the child opens the gap.
    this.spill = new PointLight(0xffbe80, this.current.spill, 11, 1.7);
    this.spill.position.set(4.6, LAYOUT.stageY + 1.75, 1.85);
    this.group.add(this.spill);

    // The one shadow-casting light in the game.
    this.keySpot = new SpotLight(0xffd7a6, this.current.key, 22, 0.62, 0.55, 1.4);
    this.keySpot.position.set(0, 5.1, 3.1);
    this.keyTarget.position.set(0, LAYOUT.stageY, 2.2);
    this.keySpot.target = this.keyTarget;
    this.keySpot.castShadow = true;
    this.keySpot.shadow.mapSize.set(1024, 1024);
    this.keySpot.shadow.camera.near = 0.6;
    this.keySpot.shadow.camera.far = 16;
    this.keySpot.shadow.bias = -0.0016;
    this.keySpot.shadow.normalBias = 0.03;
    this.group.add(this.keySpot, this.keyTarget);

    // Front wash from the FOH bar: fills faces, casts nothing.
    this.wash = new SpotLight(0xffe0b8, this.current.wash, 30, 0.86, 0.75, 1.15);
    this.wash.position.set(0, 5.3, -2.6);
    this.washTarget.position.set(0, LAYOUT.stageY + 0.6, 1.1);
    this.wash.target = this.washTarget;
    this.group.add(this.wash, this.washTarget);

    for (const s of [-1, 1]) {
      const sp = new SpotLight(s < 0 ? 0xffcf9a : 0xbcd4ff, this.current.side, 20, 0.8, 0.8, 1.4);
      sp.position.set(s * 4.6, 4.6, 1.2);
      const t = new Object3D();
      t.position.set(-s * 0.8, LAYOUT.stageY + 0.7, 2.0);
      sp.target = t;
      this.side.push(sp);
      this.group.add(sp, t);
    }

    // The house: barely there, but enough that a parent is a person.
    this.wingBounce = new PointLight(0xa9b6c9, 1, 11, 1.5);
    this.wingBounce.position.set(6.4, LAYOUT.stageY + 2.4, 4.1);
    this.group.add(this.wingBounce);

    this.house = new PointLight(0x6f7fa8, this.current.house, 34, 1.7);
    this.house.position.set(0, 4.6, -6.5);
    this.group.add(this.house);

    this.shafts = this.buildShafts(mats);
    this.group.add(this.shafts);
    this.buildDust(rng, 340);
  }

  private trapezoid(topW: number, botW: number, height: number): BufferGeometry {
    const g = new BufferGeometry();
    const h = height;
    const pos = new Float32Array([
      -topW / 2, 0, 0, topW / 2, 0, 0, -botW / 2, -h, 0, botW / 2, -h, 0,
    ]);
    const uv = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    return g;
  }

  /**
   * Fake volumetrics: two crossed tapered cards per beam. Far cheaper than a
   * raymarch and, at these angles, indistinguishable from one.
   */
  private buildShafts(mats: Materials): Group {
    const g = new Group();
    const beams: [number, number, number, number, number, number][] = [
      // x, y, z, topWidth, bottomWidth, height
      [0, 5.05, 3.05, 0.3, 2.6, 4.4],
      [-2.6, 5.05, 0.9, 0.28, 2.2, 4.4],
      [2.6, 5.05, 0.9, 0.28, 2.2, 4.4],
      [0, 5.05, 0.9, 0.3, 2.8, 4.4],
    ];
    for (const [x, y, z, tw, bw, h] of beams) {
      const pair = new Group();
      for (let i = 0; i < 2; i++) {
        const m = new Mesh(this.trapezoid(tw, bw, h), mats.shaft);
        m.rotation.y = i * Math.PI * 0.5;
        m.renderOrder = 5;
        pair.add(m);
      }
      pair.position.set(x, y, z);
      g.add(pair);
    }
    return g;
  }

  private buildDust(rng: Rng, count: number): void {
    if (count <= 0) return;
    const pos = new Float32Array(count * 3);
    this.dustVel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Concentrated where the light actually is: around the gap and downstage.
      pos[i * 3] = rng.range(-4.5, 7.6);
      pos[i * 3 + 1] = rng.range(0.7, 4.4);
      pos[i * 3 + 2] = rng.range(-0.6, 4.6);
      this.dustVel[i * 3] = rng.range(-0.02, 0.02);
      this.dustVel[i * 3 + 1] = rng.range(-0.035, -0.008);
      this.dustVel[i * 3 + 2] = rng.range(-0.02, 0.02);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    // The node pipeline asks every material for uv; points have none of their own.
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
    const mat = new PointsMaterial({
      map: this.mats.glowTexture,
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0.34,
      color: 0xffe6c4,
      toneMapped: false,
    });
    this.dust = new Points(geo, mat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  setMood(m: Mood): void {
    this.target = { ...MOODS[m] };
  }

  /** Lets the director push the exposure past the mood preset for the reveal. */
  exposureBias = 0;
  /** 0..1 as the child clears the proscenium: the house comes up with them. */
  revealBoost = 0;
  /** Small round-to-round re-dressing of the room. */
  roundBias = 0;

  applyQuality(p: QualityProfile): void {
    this.keySpot.castShadow = p.shadows;
    this.keySpot.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    this.keySpot.shadow.map?.dispose();
    this.keySpot.shadow.map = null;
    this.shafts.visible = p.lightShafts;
    if (this.dust) this.dust.visible = p.dust > 0;
    for (const s of this.side) s.visible = p.fillLights;
  }

  /** Aim the shadow-casting key light at whatever matters right now. */
  aimKey(at: Vector3, from?: Vector3): void {
    this.keyTarget.position.copy(at);
    if (from) this.keySpot.position.copy(from);
  }

  update(dt: number, gapOpenness: number, time: number): number {
    const k = 0.001;
    const c = this.current;
    const t = this.target;
    for (const key of Object.keys(t) as (keyof Target)[]) {
      c[key] = damp(c[key], t[key], k, dt);
    }

    this.hemi.intensity = c.hemi;
    this.wingWork.intensity = c.wingWork * (0.96 + Math.sin(time * 9.3) * 0.04);
    this.wingBounce.intensity = c.wingWork * 0.42 + c.spill * 0.12;
    // Opening the gap physically lets more light into the wing.
    this.spill.intensity = c.spill * (0.4 + clamp01(gapOpenness) * 1.05);
    this.spill.position.z = 1.85 - clamp01(gapOpenness) * 0.45;
    this.keySpot.intensity = c.key;
    this.wash.intensity = c.wash;
    for (const s of this.side) s.intensity = c.side;
    this.house.intensity = c.house * (1 + this.revealBoost * 1.8) * (0.85 + this.roundBias * 0.4);
    this.house.color.setHSL(0.6 - this.roundBias * 0.08, 0.2 + this.roundBias * 0.12, 0.55);
    (this.mats.shaft as MeshBasicMaterial).opacity = 0.135 * c.shafts;
    this.audienceLevel = c.audience * (0.55 + this.revealBoost * 0.75);

    if (this.dust && this.dust.visible && this.dustVel) {
      const arr = (this.dust.geometry.attributes.position as BufferAttribute).array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += (this.dustVel[i] + Math.sin(time * 0.6 + arr[i + 1] * 3) * 0.012) * dt;
        arr[i + 1] += this.dustVel[i + 1] * dt;
        arr[i + 2] += this.dustVel[i + 2] * dt;
        if (arr[i + 1] < 0.5) arr[i + 1] = 4.5;
      }
      (this.dust.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    }

    return c.exposure + this.exposureBias - this.revealBoost * 0.1;
  }
}
