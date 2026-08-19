import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { mergeGeometries } from '../gfx/geo';
import { makeRng, ValueNoise, lerp } from '../gfx/noise';
import { CFG, bedTopY, plantY, rowX, daikonZ, rowEndZ } from '../game/config';
import { buildLeafClumpGeometry } from './DaikonModel';

const RIDGE_Z0 = -8;
const RIDGE_Z1 = 15;
const RIDGE_SEGS = 104;
/** decorative ridges either side of the nine playable ones */
const ROW_MIN = -7;
const ROW_MAX = CFG.rowCount + 6;

const RIDGE_PROFILE: Array<[number, number]> = [
  [-0.47, 0.0],
  [-0.42, 0.042],
  [-0.34, 0.128],
  [-0.19, 0.179],
  [0.0, 0.19],
  [0.19, 0.179],
  [0.34, 0.128],
  [0.42, 0.042],
  [0.47, 0.0],
];

function buildRidges(): THREE.BufferGeometry {
  const n = new ValueNoise(88);
  const parts: THREE.BufferGeometry[] = [];
  const w = RIDGE_PROFILE.length;
  for (let r = ROW_MIN; r < ROW_MAX; r++) {
    const x0 = rowX(r);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let s = 0; s <= RIDGE_SEGS; s++) {
      const t = s / RIDGE_SEGS;
      const z = lerp(RIDGE_Z0, RIDGE_Z1, t);
      for (let i = 0; i < w; i++) {
        const [px, py] = RIDGE_PROFILE[i];
        const wob = (n.fbm(t * 4 + r, i / w, 9, 3) - 0.5) * 0.07;
        const wob2 = (n.fbm(t * 9 + r * 3, i / w + 3, 17, 2) - 0.5) * 0.03;
        const edge = Math.abs(px) > 0.41 ? 0.25 : 1;
        pos.push(x0 + px + wob2 * 0.5, Math.max(0, py + wob * edge * (py > 0.01 ? 1 : 0.2)), z);
        uv.push(i / (w - 1), t);
      }
    }
    for (let s = 0; s < RIDGE_SEGS; s++) {
      for (let i = 0; i < w - 1; i++) {
        const a = s * w + i;
        idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeGeometries(parts, false)!;
}

function buildConifer(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.19, 2.4, 5);
  trunk.translate(0, 1.2, 0);
  parts.push(trunk);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const c = new THREE.ConeGeometry(1.5 - t * 0.95, 2.3 - t * 0.5, 7);
    c.translate(0, 2.0 + t * 1.55, 0);
    parts.push(c);
  }
  return mergeGeometries(parts, false)!;
}

export interface CropSlot {
  row: number;
  index: number;
  yaw: number;
  scale: number;
  tilt: number;
  x: number;
  z: number;
  visible: boolean;
}

export class Field {
  readonly group = new THREE.Group();
  readonly slots: CropSlot[][] = [];
  private crop!: THREE.InstancedMesh;
  private decor!: THREE.InstancedMesh;
  private holes!: THREE.InstancedMesh;
  private holeCount = 0;
  private holeLog: Array<{ row: number; x: number; z: number; seed: number }> = [];
  private dummy = new THREE.Object3D();
  private clouds: THREE.Sprite[] = [];

  constructor(private mats: Materials) {
    this.buildGround();
    this.buildRidges();
    this.buildHoles();
    this.buildCrop();
    this.buildDecorCrop();
    this.buildDistance();
  }

  /* ------------------------------------------------------------- */

  private buildGround() {
    const g = new THREE.PlaneGeometry(90, 90, 44, 44);
    g.rotateX(-Math.PI / 2);
    const n = new ValueNoise(3);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const h = (n.fbm(x / 90 + 0.5, z / 90 + 0.5, 6, 3) - 0.5) * 0.1 * Math.min(1, d / 3);
      pos.setY(i, h - 0.002);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.mats.ground);
    mesh.position.z = 3;
    mesh.receiveShadow = true;
    mesh.renderOrder = -3;
    this.group.add(mesh);
  }

  private buildRidges() {
    const mesh = new THREE.Mesh(buildRidges(), this.mats.bed);
    mesh.receiveShadow = true;
    mesh.renderOrder = -2;
    this.group.add(mesh);
  }

  private buildCrop() {
    const geo = buildLeafClumpGeometry('low', 20240819);
    const total = CFG.rowCount * CFG.daikonPerRow;
    this.crop = new THREE.InstancedMesh(geo, this.mats.leaf, total);
    this.crop.castShadow = true;
    this.crop.receiveShadow = true;
    this.crop.frustumCulled = false;
    this.crop.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.crop);
    this.reseed();
  }

  /**
   * The crop that surrounds the playable strip. Never harvested, never animated,
   * one draw call — it exists so the field reads as a real field in every direction.
   */
  private buildDecorCrop() {
    const geo = buildLeafClumpGeometry('far', 99331);
    const rng = makeRng(70707);
    const spacing = CFG.daikonSpacing;
    const zCount = Math.floor((RIDGE_Z1 - 1.2 - (RIDGE_Z0 + 1.2)) / spacing);
    const items: Array<[number, number, number, number, number]> = [];
    for (let r = ROW_MIN; r < ROW_MAX; r++) {
      const playable = r >= 0 && r < CFG.rowCount;
      const x0 = rowX(r);
      for (let i = 0; i < zCount; i++) {
        const z = RIDGE_Z0 + 1.2 + i * spacing;
        if (playable && z > CFG.rowStartZ - 0.6 && z < rowEndZ + 0.6) continue;
        items.push([x0 + (rng() - 0.5) * 0.04, z + (rng() - 0.5) * 0.04, rng() * 6.28, 0.85 + rng() * 0.3, (rng() - 0.5) * 0.22]);
      }
    }
    this.decor = new THREE.InstancedMesh(geo, this.mats.leaf, items.length);
    this.decor.castShadow = false;
    this.decor.receiveShadow = false;
    this.decor.frustumCulled = false;
    for (let i = 0; i < items.length; i++) {
      const [x, z, yaw, sc, tilt] = items[i];
      this.dummy.position.set(x, plantY, z);
      this.dummy.rotation.set(tilt, yaw, tilt * 0.6);
      this.dummy.scale.setScalar(sc);
      this.dummy.updateMatrix();
      this.decor.setMatrixAt(i, this.dummy.matrix);
    }
    this.decor.instanceMatrix.needsUpdate = true;
    this.group.add(this.decor);
  }

  private buildHoles() {
    const g = new THREE.PlaneGeometry(0.36, 0.36);
    g.rotateX(-Math.PI / 2);
    this.holes = new THREE.InstancedMesh(g, this.mats.crackDecal.clone(), CFG.rowCount * CFG.daikonPerRow);
    (this.holes.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.holes.count = 0;
    this.holes.frustumCulled = false;
    this.holes.renderOrder = 2;
    this.group.add(this.holes);
  }

  /** Distant farmland, windbreak belt, sheds and poles: all pure silhouette + haze. */
  private buildDistance() {
    const rng = makeRng(5150);

    // neighbouring fields as broad low strips of colour
    const stripColours = [0x6f7a4a, 0x8a7a56, 0x5d6d40, 0x94875f, 0x77804c];
    for (let i = 0; i < 9; i++) {
      const w = 40 + rng() * 60;
      const d = 12 + rng() * 22;
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({
        color: stripColours[i % stripColours.length],
        roughness: 1,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set((rng() - 0.5) * 90, 0.01 + i * 0.004, 36 + i * 9 + rng() * 6);
      this.group.add(mesh);
    }

    // windbreak belt
    const coniferGeo = buildConifer();
    const trees = new THREE.InstancedMesh(coniferGeo, this.mats.foliage, 132);
    trees.frustumCulled = false;
    let ti = 0;
    const place = (x: number, z: number, s: number) => {
      if (ti >= 132) return;
      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set(0, rng() * 6.28, 0);
      this.dummy.scale.set(s * (0.85 + rng() * 0.3), s, s * (0.85 + rng() * 0.3));
      this.dummy.updateMatrix();
      trees.setMatrixAt(ti++, this.dummy.matrix);
    };
    for (let i = 0; i < 64; i++) place(-72 + i * 2.3 + rng() * 1.4, 44 + rng() * 3.5, 1.5 + rng() * 0.9);
    for (let i = 0; i < 30; i++) place(-34 - rng() * 4, 4 + i * 2.4, 1.2 + rng() * 0.8);
    for (let i = 0; i < 30; i++) place(34 + rng() * 5, 2 + i * 2.5, 1.2 + rng() * 0.9);
    trees.count = ti;
    trees.castShadow = false;
    this.group.add(trees);

    // trunks read warmer than the canopy
    const trunkStrip = new THREE.Mesh(new THREE.BoxGeometry(150, 0.9, 2.0), this.mats.trunk);
    trunkStrip.position.set(-8, 0.45, 45.5);
    this.group.add(trunkStrip);

    // farm buildings
    const shedMat = new THREE.MeshStandardMaterial({ color: 0xa9a49b, roughness: 0.85, metalness: 0.15 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9d8778, roughness: 0.86, metalness: 0.12 });
    for (const [x, z, w, h, d] of [
      [22, 34, 11, 4.2, 7],
      [-26, 30, 8, 3.4, 6],
      [30, 21, 6, 3, 5],
    ] as Array<[number, number, number, number, number]>) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shedMat);
      b.position.set(x, h / 2, z);
      this.group.add(b);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1, false, 0, Math.PI), roofMat);
      r.rotation.z = Math.PI / 2;
      r.position.set(x, h, z);
      this.group.add(r);
    }
    // greenhouse arcs, kept small and well back so they read as scale cues
    const ghMat = new THREE.MeshStandardMaterial({
      color: 0xdfe7e6,
      roughness: 0.42,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const gh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 13, 9, 1, true, 0, Math.PI), ghMat);
      gh.rotation.z = Math.PI / 2;
      gh.position.set(-30 + i * 4.6, 0, 36);
      this.group.add(gh);
    }

    // utility poles with sagging wires
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b8175, roughness: 0.95 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x4a4640, transparent: true, opacity: 0.6 });
    const poleXs = [-19.5];
    for (const px of poleXs) {
      for (let i = 0; i < 5; i++) {
        const z = 6 + i * 13;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6), poleMat);
        p.position.set(px, 3.75, z);
        this.group.add(p);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), poleMat);
        arm.position.set(px, 7.0, z);
        this.group.add(arm);
        if (i < 4) {
          for (const dx of [-0.6, 0.6]) {
            const pts: THREE.Vector3[] = [];
            for (let k = 0; k <= 8; k++) {
              const t = k / 8;
              pts.push(new THREE.Vector3(px + dx, 6.95 - Math.sin(t * Math.PI) * 0.55, z + t * 13));
            }
            this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
          }
        }
      }
    }

    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x7f93a0, roughness: 1, metalness: 0 });
    for (let i = 0; i < 5; i++) {
      const h = 9 + rng() * 13;
      const cone = new THREE.ConeGeometry(28 + rng() * 22, h, 7);
      const m = new THREE.Mesh(cone, hillMat);
      m.position.set(-90 + i * 46 + rng() * 15, h * 0.5 - 2.5, 92 + rng() * 24);
      m.scale.y = 0.55;
      this.group.add(m);
    }

    // soft cloud cards for parallax overhead
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.mats.dustTex,
          transparent: true,
          opacity: 0.34,
          color: 0xffffff,
          depthWrite: false,
          fog: false,
        }),
      );
      const sc = 26 + rng() * 34;
      s.scale.set(sc, sc * 0.42, 1);
      s.position.set((rng() - 0.5) * 150, 26 + rng() * 16, 40 + rng() * 70);
      this.clouds.push(s);
      this.group.add(s);
    }
  }

  /* ------------------------------------------------------------- */

  /** Re-grow the whole field. */
  reseed() {
    const rng = makeRng(20240819);
    this.slots.length = 0;
    for (let r = 0; r < CFG.rowCount; r++) {
      const row: CropSlot[] = [];
      for (let i = 0; i < CFG.daikonPerRow; i++) {
        row.push({
          row: r,
          index: i,
          yaw: rng() * Math.PI * 2,
          scale: 0.88 + rng() * 0.28,
          tilt: (rng() - 0.5) * 0.2,
          x: rowX(r) + (rng() - 0.5) * 0.035,
          z: daikonZ(i) + (rng() - 0.5) * 0.03,
          visible: true,
        });
      }
      this.slots.push(row);
    }
    for (let r = 0; r < CFG.rowCount; r++)
      for (let i = 0; i < CFG.daikonPerRow; i++) this.writeInstance(r, i);
    this.crop.count = CFG.rowCount * CFG.daikonPerRow;
    this.crop.instanceMatrix.needsUpdate = true;
    this.holeCount = 0;
    this.holes.count = 0;
    this.holeLog = [];
  }

  private writeInstance(r: number, i: number) {
    const s = this.slots[r][i];
    const k = r * CFG.daikonPerRow + i;
    if (!s.visible) {
      this.dummy.position.set(s.x, -50, s.z);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.rotation.set(0, 0, 0);
    } else {
      this.dummy.position.set(s.x, plantY, s.z);
      this.dummy.rotation.set(s.tilt, s.yaw, s.tilt * 0.6);
      this.dummy.scale.setScalar(s.scale);
    }
    this.dummy.updateMatrix();
    this.crop.setMatrixAt(k, this.dummy.matrix);
  }

  setCropVisible(r: number, i: number, visible: boolean) {
    const s = this.slots[r][i];
    if (s.visible === visible) return;
    s.visible = visible;
    this.writeInstance(r, i);
    this.crop.instanceMatrix.needsUpdate = true;
  }

  /** Leave a torn hole in the ridge where a root came out. */
  addHole(row: number, x: number, z: number, seed: number) {
    this.holeLog.push({ row, x, z, seed });
    this.writeHole(x, z, seed);
  }

  private writeHole(x: number, z: number, seed: number) {
    if (this.holeCount >= this.holes.instanceMatrix.count) return;
    const rng = makeRng(seed | 1);
    this.dummy.position.set(x, bedTopY + 0.006, z);
    this.dummy.rotation.set(0, rng() * 6.28, 0);
    this.dummy.scale.setScalar(0.85 + rng() * 0.4);
    this.dummy.updateMatrix();
    this.holes.setMatrixAt(this.holeCount, this.dummy.matrix);
    this.holeCount++;
    this.holes.count = this.holeCount;
    this.holes.instanceMatrix.needsUpdate = true;
  }

  /**
   * Bring every row back except the ones named. The field is never allowed to
   * run out of work: whichever ridge the player steers onto has daikon on it.
   * The row just finished stays bare, so the last run is still visible.
   */
  regrowExcept(keepBare: number[]) {
    for (let r = 0; r < CFG.rowCount; r++) {
      if (keepBare.includes(r)) continue;
      for (let i = 0; i < CFG.daikonPerRow; i++) {
        const s = this.slots[r][i];
        if (!s.visible) {
          s.visible = true;
          this.writeInstance(r, i);
        }
      }
    }
    this.crop.instanceMatrix.needsUpdate = true;
    const kept = this.holeLog.filter((h) => keepBare.includes(h.row));
    this.holeLog = [];
    this.holeCount = 0;
    this.holes.count = 0;
    for (const h of kept) this.addHole(h.row, h.x, h.z, h.seed);
  }

  update(dt: number) {
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += dt * (0.1 + i * 0.03);
      if (this.clouds[i].position.x > 90) this.clouds[i].position.x = -90;
    }
  }
}
