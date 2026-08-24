import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * 糸。完全なロープシミュレーションではなく、少数のcontrol pointのsplineで管理する。
 * Line2 のscreen-space幅で、画面上から消えないことを保証する。
 * 常時発光はさせず、水滴と環境の反射（明るめの色）で読ませる。
 */
export class FishingLine {
  root = new THREE.Group();
  private line: Line2;
  private geo: LineGeometry;
  private mat: LineMaterial;
  private posBuf: number[] = [];

  /** 餌の吊り下がり深さ（水面からの深さ、m、正） */
  baitDepth = 2.2;
  /** 糸の張り 0..1（垂れ具合に効く） */
  tension = 0.25;
  /** 水中部分の横ドリフト */
  drift = new THREE.Vector2(0, 0);

  bait: THREE.Group;
  baitWorld = new THREE.Vector3();
  waterEntryWorld = new THREE.Vector3();

  /** 巻き上げ中の水滴・水面を割るときの飛沫 */
  private drops: THREE.Points;
  private dropData: { p: THREE.Vector3; v: number; vx: number; vz: number; life: number }[] = [];
  dropsActive = false;

  private static readonly UNDER_SEG = 8;
  private static readonly HANG_SEG = 6;

  constructor() {
    this.mat = new LineMaterial({
      color: 0xc9cec2,
      linewidth: 2.0, // px
      worldUnits: false,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    this.geo = new LineGeometry();
    const total = 5 + FishingLine.HANG_SEG + FishingLine.UNDER_SEG + 2;
    for (let i = 0; i < total; i++) this.posBuf.push(0, -i * 0.01, 0);
    this.geo.setPositions(this.posBuf);
    this.line = new Line2(this.geo, this.mat);
    this.line.frustumCulled = false;
    this.root.add(this.line);

    // 仕掛け：小さなオモリと餌（紅サシ）。露出した針先は描かない。
    this.bait = new THREE.Group();
    const sinker = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a6f6a, roughness: 0.45, metalness: 0.75 })
    );
    sinker.scale.set(0.7, 1.35, 0.7);
    this.bait.add(sinker);
    const baitMat = new THREE.MeshPhysicalMaterial({
      color: 0xc23f38,
      roughness: 0.35,
      clearcoat: 0.8,
      clearcoatRoughness: 0.3
    });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 8), baitMat);
    b1.scale.set(1, 1.6, 1);
    b1.position.set(0.006, 0.012, 0.002);
    this.bait.add(b1);
    const b2 = b1.clone();
    b2.position.set(-0.005, 0.028, -0.003);
    this.bait.add(b2);
    // 枝糸
    const branchMat = new THREE.MeshBasicMaterial({ color: 0xb9beb2, transparent: true, opacity: 0.5 });
    const br1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.012, 4), branchMat);
    br1.position.set(0.003, 0.014, 0.001);
    br1.rotation.z = 0.9;
    this.bait.add(br1);
    const br2 = br1.clone();
    br2.position.set(-0.0025, 0.03, -0.002);
    br2.rotation.z = -0.9;
    this.bait.add(br2);
    this.root.add(this.bait);

    // 水滴
    const dropGeo = new THREE.BufferGeometry();
    const maxDrops = 40;
    dropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDrops * 3), 3));
    this.drops = new THREE.Points(
      dropGeo,
      new THREE.PointsMaterial({
        color: 0xcfe0e8,
        size: 0.004,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      })
    );
    this.drops.frustumCulled = false;
    this.root.add(this.drops);
  }

  setResolution(w: number, h: number) {
    this.mat.resolution.set(w, h);
  }

  /** 魚が水面を割る瞬間の小さな飛沫 */
  splashBurst(center: THREE.Vector3) {
    for (let i = 0; i < 16 && this.dropData.length < 38; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.03;
      this.dropData.push({
        p: new THREE.Vector3(center.x + Math.cos(a) * r, center.y + 0.01, center.z + Math.sin(a) * r),
        v: -(0.5 + Math.random() * 0.9), // 上向きに飛ぶ
        vx: Math.cos(a) * (0.1 + Math.random() * 0.25),
        vz: Math.sin(a) * (0.1 + Math.random() * 0.25),
        life: 0.7
      });
    }
  }

  /**
   * @param exit スプールの糸出口（world）
   * @param guides ガイド位置（world）
   * @param tip 穂先先端（world）
   * @param holeCenter 釣り口の水面中心（world）
   * @param waterY 水面の高さ
   */
  update(
    dt: number,
    time: number,
    exit: THREE.Vector3,
    guides: THREE.Vector3[],
    tip: THREE.Vector3,
    holeCenter: THREE.Vector3,
    waterY: number
  ) {
    const pts: THREE.Vector3[] = [];
    pts.push(exit);
    for (const g of guides) pts.push(g);
    pts.push(tip);

    // 穂先から水面入水点まで（張りで垂れが変わる）
    const entry = new THREE.Vector3(
      holeCenter.x + this.drift.x * 0.12,
      waterY,
      holeCenter.z + this.drift.y * 0.12
    );
    this.waterEntryWorld.copy(entry);
    const sag = (1 - this.tension) * 0.035;
    for (let i = 1; i <= FishingLine.HANG_SEG; i++) {
      const t = i / (FishingLine.HANG_SEG + 1);
      const p = new THREE.Vector3().lerpVectors(tip, entry, t);
      p.x += Math.sin(t * Math.PI) * sag * 0.35 * Math.sin(time * 0.8);
      p.z += Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    pts.push(entry);

    // 水中：わずかにドリフトした緩いカーブで餌まで
    const baitPos = new THREE.Vector3(
      holeCenter.x + this.drift.x,
      waterY - this.baitDepth,
      holeCenter.z + this.drift.y
    );
    for (let i = 1; i <= FishingLine.UNDER_SEG; i++) {
      const t = i / (FishingLine.UNDER_SEG + 1);
      const p = new THREE.Vector3().lerpVectors(entry, baitPos, t);
      const bow = Math.sin(t * Math.PI) * (1 - this.tension);
      p.x += bow * this.drift.x * 0.4 + Math.sin(time * 0.5 + t * 6) * 0.006 * bow;
      p.z += bow * this.drift.y * 0.4 + Math.cos(time * 0.42 + t * 5) * 0.006 * bow;
      pts.push(p);
    }
    pts.push(baitPos);
    this.baitWorld.copy(baitPos);
    this.bait.position.copy(baitPos);
    this.bait.rotation.y = time * 0.3;
    this.bait.rotation.z = Math.sin(time * 1.7) * 0.12;

    // バッファへ書き込み
    const needed = pts.length * 3;
    if (this.posBuf.length !== needed) this.posBuf = new Array(needed).fill(0);
    for (let i = 0; i < pts.length; i++) {
      this.posBuf[i * 3] = pts[i].x;
      this.posBuf[i * 3 + 1] = pts[i].y;
      this.posBuf[i * 3 + 2] = pts[i].z;
    }
    this.geo.setPositions(this.posBuf);

    // 水滴：巻き上げ中、入水点近くの糸から生まれて落ちる
    if (this.dropsActive && Math.random() < dt * 22 && this.dropData.length < 38) {
      const t = Math.random();
      const p = new THREE.Vector3().lerpVectors(entry, tip, t * 0.5);
      p.x += (Math.random() - 0.5) * 0.004;
      p.z += (Math.random() - 0.5) * 0.004;
      this.dropData.push({ p, v: 0, vx: 0, vz: 0, life: 0.9 });
    }
    const attr = this.drops.geometry.getAttribute('position') as THREE.BufferAttribute;
    let n = 0;
    for (let i = this.dropData.length - 1; i >= 0; i--) {
      const d = this.dropData[i];
      d.v += 9.8 * dt;
      d.p.y -= d.v * dt;
      d.p.x += d.vx * dt;
      d.p.z += d.vz * dt;
      d.life -= dt;
      if (d.life <= 0 || d.p.y < waterY) {
        this.dropData.splice(i, 1);
        continue;
      }
      attr.setXYZ(n++, d.p.x, d.p.y, d.p.z);
    }
    this.drops.geometry.setDrawRange(0, n);
    attr.needsUpdate = true;
  }
}
