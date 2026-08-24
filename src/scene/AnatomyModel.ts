import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { CardiacClock } from '../core/CardiacClock';
import { clamp01, damp, lerp } from '../core/mathutil';
import { HEART_CENTRE, axisYAt, halfDepthAt, halfWidthAt } from './ChestSurface';
import type { MaterialLibrary } from './materials';

interface Wave {
  mesh: Mesh;
  age: number;
  life: number;
  spread: Vector3;
  strength: number;
}

/**
 * What is inside the chest, shown only after the child has already heard the
 * difference.
 *
 * Two things this model is careful about: the heart is one organ sitting
 * behind the sternum and slightly to the manikin's left — not four organs
 * under four spots — and the sound reaches the surface as a broad vibration
 * carried through the chest wall along the direction blood is thrown, not as
 * a beam from a valve to a point on the skin.
 */
export class AnatomyModel {
  readonly root = new Group();
  private heart = new Group();
  private chambers: Mesh[] = [];
  private valveLeaflets: Array<{ mesh: Mesh; phase: 's1' | 's2' }> = [];
  private waves: Wave[] = [];
  private wavePool: Mesh[] = [];
  private ribcage = new Group();
  private opacity = 0;
  private lastS1Beat = -1;
  private lastS2Beat = -1;
  private waveMaterial: MeshStandardMaterial;

  constructor(private mats: MaterialLibrary) {
    this.waveMaterial = mats.vibration;
    this.buildHeart();
    this.buildRibcage();
    this.root.add(this.heart);
    this.root.add(this.ribcage);
    this.root.visible = false;
  }

  private buildHeart(): void {
    const t = this.mats.heartTissue;

    // Ventricular mass: one body, tilted so the apex points to the manikin's
    // left and towards the abdomen, as it does in life.
    const ventricles = new Mesh(new SphereGeometry(0.048, 30, 22), t);
    ventricles.scale.set(0.86, 0.82, 1.22);
    ventricles.position.set(-0.004, -0.004, 0.012);
    this.heart.add(ventricles);
    this.chambers.push(ventricles);

    const rightVent = new Mesh(new SphereGeometry(0.036, 24, 18), t);
    rightVent.scale.set(0.9, 0.78, 1.1);
    rightVent.position.set(0.024, 0.006, 0.008);
    this.heart.add(rightVent);
    this.chambers.push(rightVent);

    const atria = new Mesh(new SphereGeometry(0.033, 24, 18), t);
    atria.scale.set(1.25, 0.72, 0.78);
    atria.position.set(0.004, 0.016, -0.042);
    this.heart.add(atria);

    // Great vessels, which is what actually carries the second sound upward.
    const aorta = new Mesh(new TorusGeometry(0.026, 0.0105, 12, 26, Math.PI * 0.95), t);
    aorta.position.set(-0.004, 0.036, -0.05);
    aorta.rotation.set(0.2, 0.1, -0.35);
    this.heart.add(aorta);
    const pulmTrunk = new Mesh(new SphereGeometry(0.0125, 16, 12), t);
    pulmTrunk.scale.set(1, 2.4, 1);
    pulmTrunk.position.set(-0.026, 0.03, -0.046);
    pulmTrunk.rotation.z = 0.28;
    this.heart.add(pulmTrunk);

    // Valve planes. They only move at the instant they close; the point of the
    // reveal is the timing, not a map.
    const leafletMat = new MeshPhysicalMaterial({
      color: 0xd8c2b6,
      roughness: 0.42,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      side: 2,
    });
    const defs: Array<[Vector3, 's1' | 's2', number]> = [
      [new Vector3(-0.014, 0.012, -0.024), 's1', 0.019],
      [new Vector3(0.02, 0.012, -0.026), 's1', 0.017],
      [new Vector3(-0.006, 0.03, -0.044), 's2', 0.013],
      [new Vector3(-0.026, 0.026, -0.044), 's2', 0.012],
    ];
    for (const [pos, phase, r] of defs) {
      const leaf = new Mesh(new SphereGeometry(r, 14, 8), leafletMat);
      leaf.scale.set(1, 0.22, 1);
      leaf.position.copy(pos);
      this.heart.add(leaf);
      this.valveLeaflets.push({ mesh: leaf, phase });
    }

    this.heart.position.copy(HEART_CENTRE);
    this.heart.rotation.set(0.22, 0.34, -0.3);
  }

  private buildRibcage(): void {
    const bone = this.mats.boneTissue.clone();
    bone.transparent = true;
    bone.opacity = 0.34;
    bone.depthWrite = false;
    for (let i = 0; i < 8; i++) {
      const z = -0.32 + i * 0.062;
      const W = halfWidthAt(z) * 0.92;
      const H = halfDepthAt(z) * 0.92;
      const rib = new Mesh(new TorusGeometry(1, 0.05, 8, 40, Math.PI * 1.25), bone);
      rib.scale.set(W, H, 0.0085 / 0.05);
      rib.position.set(0, axisYAt(z), z + 0.012 * i * 0.2);
      rib.rotation.set(0.16, 0, Math.PI * 0.875);
      this.ribcage.add(rib);
    }
    const sternum = new Mesh(new BoxGeometry(0.032, 0.012, 0.2), bone);
    sternum.position.set(0, axisYAt(-0.09) + halfDepthAt(-0.09) - 0.016, -0.09);
    sternum.rotation.x = -0.1;
    this.ribcage.add(sternum);
  }

  setOpacity(v: number): void {
    this.opacity = clamp01(v);
    this.root.visible = this.opacity > 0.01;
    this.heart.traverse((o) => {
      const m = (o as Mesh).material as MeshPhysicalMaterial | undefined;
      if (m && 'opacity' in m) {
        m.transparent = true;
        m.opacity = this.opacity * (m === this.mats.heartTissue ? 1 : 0.92);
        m.depthWrite = this.opacity > 0.85;
      }
    });
    this.ribcage.traverse((o) => {
      const m = (o as Mesh).material as MeshPhysicalMaterial | undefined;
      if (m && 'opacity' in m) m.opacity = this.opacity * 0.36;
    });
    this.waveMaterial.opacity = this.opacity * 0.14;
  }

  update(dt: number, clock: CardiacClock): void {
    if (!this.root.visible) return;

    const contraction = clock.contractionEnvelope();
    for (const c of this.chambers) {
      const k = 1 - contraction * 0.075;
      c.scale.setScalar(1);
      c.scale.set(0.86 * k, 0.82 * k, 1.22 * (1 + contraction * 0.02));
    }
    this.heart.position.y = HEART_CENTRE.y + contraction * 0.0016;

    for (const v of this.valveLeaflets) {
      const e = clock.soundEnvelope(v.phase === 's1' ? 1 : 2);
      v.mesh.scale.y = lerp(0.22, 0.1, e);
      const m = v.mesh.material as MeshPhysicalMaterial;
      m.opacity = this.opacity * lerp(0.55, 0.95, e);
    }

    // One broad wave per sound, launched from the whole heart mass and spread
    // through the chest wall — up and to the right for the second sound, down
    // and to the left for the first, following where the blood is thrown.
    const idx = clock.beatIndex();
    if (clock.soundEnvelope(1) > 0.85 && this.lastS1Beat !== idx) {
      this.lastS1Beat = idx;
      this.spawnWave(new Vector3(1.25, 0.85, 1.0), 1.0);
    }
    if (clock.soundEnvelope(2) > 0.85 && this.lastS2Beat !== idx) {
      this.lastS2Beat = idx;
      this.spawnWave(new Vector3(0.9, 1.0, 1.35), 0.82);
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      const t = clamp01(w.age / w.life);
      const r = lerp(0.03, 0.19, t ** 0.62);
      w.mesh.scale.set(r * w.spread.x, r * w.spread.y, r * w.spread.z);
      const mat = w.mesh.material as MeshStandardMaterial;
      mat.opacity = this.opacity * 0.16 * w.strength * (1 - t) * Math.sin(t * Math.PI) * 1.6;
      if (t >= 1) {
        w.mesh.visible = false;
        this.wavePool.push(w.mesh);
        this.waves.splice(i, 1);
      }
    }
  }

  private spawnWave(spread: Vector3, strength: number): void {
    if (this.waves.length > 5) return;
    let mesh = this.wavePool.pop();
    if (!mesh) {
      mesh = new Mesh(new SphereGeometry(1, 20, 14), this.waveMaterial.clone());
      this.root.add(mesh);
    }
    mesh.visible = true;
    // Launched from the heart as a whole, offset a little towards the wall the
    // sound has to cross — never from a single valve to a single spot.
    mesh.position.copy(HEART_CENTRE).add(new Vector3(0, 0.006, 0));
    this.waves.push({ mesh, age: 0, life: 0.85, spread: spread.clone(), strength });
  }

  /** Slow drift used while the reveal is on screen, so it reads as a volume. */
  drift(dt: number, amount: number): void {
    this.heart.rotation.y = damp(this.heart.rotation.y, 0.34 + amount * 0.18, 1.4, dt);
  }
}
