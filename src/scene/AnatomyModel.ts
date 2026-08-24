import {
  BoxGeometry,
  FrontSide,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
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
import { HEART_CENTRE, axisYAt, halfDepthAt, halfWidthAt, trunkPoint } from './ChestSurface';
import { setMaterialOpacity, type MaterialLibrary } from './materials';

interface Wave {
  mesh: Mesh;
  material: MeshStandardMaterial;
  age: number;
  life: number;
  spread: Vector3;
  strength: number;
}

/**
 * What is inside the chest, shown only after the child has already heard the
 * difference.
 *
 * Three things this model is careful about. The heart is one organ sitting
 * behind the sternum and a little to the manikin's left — not four organs
 * under four spots. The chest wall is a real thickness that the sound has to
 * cross, so it is drawn. And the sound leaves the whole heart as a broad
 * swell that spreads through that wall along the direction the blood is
 * thrown — there is no beam from a valve to a place on the skin, because
 * there is no such beam.
 */
export class AnatomyModel {
  readonly root = new Group();
  private heart = new Group();
  private ventricles: Mesh;
  private rightVent: Mesh;
  private valveLeaflets: Array<{ mesh: Mesh; phase: 's1' | 's2'; base: number }> = [];
  private waves: Wave[] = [];
  private wavePool: Wave[] = [];
  private ribcage = new Group();
  private wallMesh: Mesh;
  private wallMaterial: MeshPhysicalMaterial;
  private boneMaterial: MeshPhysicalMaterial;
  private leafletMaterial: MeshPhysicalMaterial;
  private opacity = 0;
  private lastS1Beat = -1;
  private lastS2Beat = -1;
  private wallGlow = 0;

  constructor(private mats: MaterialLibrary) {
    this.boneMaterial = mats.boneTissue.clone();
    this.boneMaterial.transparent = true;
    this.boneMaterial.depthWrite = false;

    this.leafletMaterial = new MeshPhysicalMaterial({
      color: 0xcbb6a8,
      roughness: 0.5,
      metalness: 0,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: 2,
    });

    // The chest wall itself: the thickness the sound has to cross.
    this.wallMaterial = new MeshPhysicalMaterial({
      color: 0xc2806a,
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: DoubleSide,
      emissive: 0x511b13,
      emissiveIntensity: 0,
    });
    this.wallMesh = new Mesh(buildChestWall(), this.wallMaterial);
    this.root.add(this.wallMesh);

    this.ventricles = new Mesh(new SphereGeometry(0.048, 30, 22), mats.heartTissue);
    this.rightVent = new Mesh(new SphereGeometry(0.036, 24, 18), mats.heartTissue);
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
    this.ventricles.scale.set(0.86, 0.82, 1.22);
    this.ventricles.position.set(-0.004, -0.004, 0.012);
    this.heart.add(this.ventricles);

    this.rightVent.scale.set(0.9, 0.78, 1.1);
    this.rightVent.position.set(0.024, 0.006, 0.008);
    this.heart.add(this.rightVent);

    const atria = new Mesh(new SphereGeometry(0.033, 24, 18), t);
    atria.scale.set(1.25, 0.72, 0.78);
    atria.position.set(0.004, 0.016, -0.042);
    this.heart.add(atria);

    // Great vessels: what actually carries the second sound up the chest.
    const aorta = new Mesh(new TorusGeometry(0.026, 0.0105, 12, 26, Math.PI * 0.95), t);
    aorta.position.set(-0.004, 0.036, -0.05);
    aorta.rotation.set(0.2, 0.1, -0.35);
    this.heart.add(aorta);
    const pulmTrunk = new Mesh(new SphereGeometry(0.0125, 16, 12), t);
    pulmTrunk.scale.set(1, 2.4, 1);
    pulmTrunk.position.set(-0.026, 0.03, -0.046);
    pulmTrunk.rotation.z = 0.28;
    this.heart.add(pulmTrunk);

    // Valve planes: small, and they only move at the instant they close. The
    // point of the reveal is the timing, not a map of four places.
    const defs: Array<[Vector3, 's1' | 's2', number, number]> = [
      [new Vector3(-0.014, 0.012, -0.024), 's1', 0.0125, -0.35],
      [new Vector3(0.02, 0.012, -0.026), 's1', 0.0115, 0.25],
      [new Vector3(-0.006, 0.03, -0.044), 's2', 0.0092, -0.1],
      [new Vector3(-0.026, 0.026, -0.044), 's2', 0.0085, 0.3],
    ];
    for (const [pos, phase, r, tilt] of defs) {
      const leaf = new Mesh(new SphereGeometry(r, 14, 8), this.leafletMaterial);
      leaf.scale.set(1, 0.2, 1);
      leaf.position.copy(pos);
      leaf.rotation.z = tilt;
      this.heart.add(leaf);
      this.valveLeaflets.push({ mesh: leaf, phase, base: 0.2 });
    }

    this.heart.position.copy(HEART_CENTRE);
    this.heart.rotation.set(0.22, 0.34, -0.3);
  }

  private buildRibcage(): void {
    for (let i = 0; i < 10; i++) {
      const z = -0.34 + i * 0.058;
      const W = halfWidthAt(z) * 0.9;
      const H = halfDepthAt(z) * 0.88;
      const rib = new Mesh(new TorusGeometry(1, 0.05, 8, 44, Math.PI * 1.2), this.boneMaterial);
      rib.scale.set(W, H, 0.0075 / 0.05);
      rib.position.set(0, axisYAt(z), z);
      rib.rotation.set(0.14, 0, Math.PI * 0.9);
      this.ribcage.add(rib);
    }
    const sternumZ = -0.16;
    const sternum = new Mesh(new BoxGeometry(0.03, 0.011, 0.19), this.boneMaterial);
    sternum.position.set(
      0,
      axisYAt(sternumZ) + halfDepthAt(sternumZ) - 0.017,
      sternumZ + 0.03,
    );
    sternum.rotation.x = -0.14;
    this.ribcage.add(sternum);
  }

  setOpacity(v: number): void {
    this.opacity = clamp01(v);
    this.root.visible = this.opacity > 0.01;
    setMaterialOpacity(this.mats.heartTissue, this.opacity, 0.6);
    this.boneMaterial.opacity = this.opacity * 0.78;
    this.leafletMaterial.opacity = this.opacity * 0.7;
    this.wallMaterial.opacity = this.opacity * 0.24;
  }

  update(dt: number, clock: CardiacClock): void {
    if (!this.root.visible) return;

    const contraction = clock.contractionEnvelope();
    const k = 1 - contraction * 0.075;
    this.ventricles.scale.set(0.86 * k, 0.82 * k, 1.22 * (1 + contraction * 0.02));
    this.rightVent.scale.set(0.9 * k, 0.78 * k, 1.1 * (1 + contraction * 0.02));
    this.heart.position.y = HEART_CENTRE.y + contraction * 0.0016;

    for (const v of this.valveLeaflets) {
      const e = clock.soundEnvelope(v.phase === 's1' ? 1 : 2);
      v.mesh.scale.y = lerp(v.base, v.base * 0.45, e);
    }

    // One broad swell per sound, launched from the whole heart mass: down and
    // out towards the apex for the first, up along the great vessels for the
    // second.
    // Edge-triggered off the clock, not off a narrow envelope threshold: a
    // dropped frame must never swallow a beat.
    const idx = clock.beatIndex();
    const intoCycle = clock.phase() * clock.period;
    if (this.lastS1Beat !== idx) {
      this.lastS1Beat = idx;
      this.spawnWave(new Vector3(1.3, 0.9, 1.0), new Vector3(0.012, -0.008, 0.014), 1.0);
    }
    if (this.lastS2Beat !== idx && intoCycle >= clock.systole) {
      this.lastS2Beat = idx;
      this.spawnWave(new Vector3(0.95, 1.0, 1.35), new Vector3(-0.006, 0.014, -0.02), 0.85);
    }

    let glow = 0;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      const t = clamp01(w.age / w.life);
      const r = lerp(0.035, 0.155, t ** 0.6);
      w.mesh.scale.set(r * w.spread.x, r * w.spread.y, r * w.spread.z);
      const shape = Math.sin(t * Math.PI) ** 0.7;
      w.material.opacity = this.opacity * 0.12 * w.strength * shape;
      // The wall lights faintly as the swell reaches it, which is the whole
      // point: the vibration arrives through the wall, not down a tube.
      glow = Math.max(glow, w.strength * shape * clamp01((t - 0.35) / 0.5));
      if (t >= 1) {
        w.mesh.visible = false;
        this.wavePool.push(w);
        this.waves.splice(i, 1);
      }
    }
    this.wallGlow = damp(this.wallGlow, glow, 16, dt);
    this.wallMaterial.emissiveIntensity = this.wallGlow * 0.5 * this.opacity;
  }

  private spawnWave(spread: Vector3, offset: Vector3, strength: number): void {
    // A couple of swells in flight reads as spreading; a stack of them just
    // fogs the chest.
    if (this.waves.length >= 3) return;
    let w = this.wavePool.pop();
    if (!w) {
      const material = this.mats.vibration.clone();
      material.side = FrontSide;
      const mesh = new Mesh(new SphereGeometry(1, 24, 16), material);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      w = { mesh, material, age: 0, life: 0.9, spread: new Vector3(), strength: 1 };
    }
    w.mesh.visible = true;
    w.age = 0;
    w.life = 0.9;
    w.strength = strength;
    w.spread.copy(spread);
    w.mesh.position.copy(HEART_CENTRE).add(offset);
    this.waves.push(w);
  }

  /** Slow drift while the reveal is on screen, so it reads as a volume. */
  drift(dt: number, amount: number): void {
    this.heart.rotation.y = damp(this.heart.rotation.y, 0.34 + amount * 0.2, 1.4, dt);
  }
}

/**
 * The anterior chest wall over the listening area — the thickness the sound
 * crosses on its way out. Built from the same surface function as the skin.
 */
function buildChestWall(): BufferGeometry {
  return buildTorsoShell(-0.42, 0.28, 0.018, -1.25, 1.25);
}

/** A shell offset inwards from the trunk surface. */
function buildTorsoShell(
  zMin: number,
  zMax: number,
  inset: number,
  phiMin = -Math.PI,
  phiMax = Math.PI,
): BufferGeometry {
  const zSegs = 34;
  const phiSegs = 40;
  const verts: number[] = [];
  const norms: number[] = [];
  const idx: number[] = [];
  const sp = { position: new Vector3(), normal: new Vector3() };
  const sign = -1;
  for (let i = 0; i <= zSegs; i++) {
    const z = zMin + (i / zSegs) * (zMax - zMin);
    for (let j = 0; j <= phiSegs; j++) {
      const phi = phiMin + (j / phiSegs) * (phiMax - phiMin);
      trunkPoint(z, phi, sp);
      verts.push(
        sp.position.x - sp.normal.x * inset,
        sp.position.y - sp.normal.y * inset,
        sp.position.z - sp.normal.z * inset,
      );
      norms.push(sign * sp.normal.x, sign * sp.normal.y, sign * sp.normal.z);
    }
  }
  const row = phiSegs + 1;
  for (let i = 0; i < zSegs; i++) {
    for (let j = 0; j < phiSegs; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(norms), 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
