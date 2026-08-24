import * as THREE from 'three';
import { clamp } from '../util/math';

/**
 * 穂先。実ジオメトリとして先細りする複合材の棒。
 * 根元は硬く、先端ほど柔らかい非一様な曲がりを、関節チェーンで表現する。
 * たわみ量は damped spring で駆動し、
 * ・船の低周波揺れ（連続、ゆるい）
 * ・魚のbite impulse（短い、鋭い）
 * を別の入力として受け取る。
 */
export class Rod {
  root = new THREE.Group();
  private joints: THREE.Group[] = [];
  private weights: number[] = [];
  private tipObj = new THREE.Object3D();
  private guideObjs: THREE.Object3D[] = [];

  /** たわみ（正 = 先端が下がる）。スプリング状態。 */
  deflection = 0;
  private velocity = 0;
  /** スプリング目標。糸の張り・巻き上げ負荷・誘い駆動の合計。 */
  target = 0;
  /** 根元ごと持ち上げる角度（合わせ・誘いで使用、rad） */
  lift = 0;
  /** 横方向のごく小さな揺れ */
  lateral = 0;

  static readonly SEGMENTS = 14;
  static readonly LENGTH = 0.6;

  constructor() {
    const N = Rod.SEGMENTS;
    const segLen = Rod.LENGTH / N;
    // 柔らかさの分布：先端ほど大きく曲がる
    let wSum = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.pow((i + 1) / N, 1.5);
      this.weights.push(w);
      wSum += w;
    }
    this.weights = this.weights.map((w) => w / wSum);

    const carbon = new THREE.MeshStandardMaterial({
      color: 0x23211d,
      roughness: 0.42,
      metalness: 0.12
    });
    const paintedTip = new THREE.MeshStandardMaterial({
      color: 0xf2ead6,
      roughness: 0.5,
      metalness: 0.0
    });
    const marker = new THREE.MeshStandardMaterial({
      color: 0xd4482a,
      roughness: 0.5,
      metalness: 0.0
    });
    const guideMat = new THREE.MeshStandardMaterial({
      color: 0x8d939b,
      roughness: 0.35,
      metalness: 0.85
    });

    // 根元半径3.1mm → 先端0.75mm の実テーパー
    const r0 = 0.0031;
    const r1 = 0.00075;
    let parent: THREE.Object3D = this.root;
    for (let i = 0; i < N; i++) {
      const joint = new THREE.Group();
      joint.position.z = i === 0 ? 0 : -segLen;
      const ra = r0 + (r1 - r0) * (i / N);
      const rb = r0 + (r1 - r0) * ((i + 1) / N);
      const geo = new THREE.CylinderGeometry(ra, rb, segLen, 8, 1);
      geo.rotateX(Math.PI / 2); // yなが → zなが（-z方向へ）
      geo.translate(0, 0, -segLen / 2);
      let mat = carbon;
      if (i >= N - 4) mat = paintedTip;
      if (i === N - 1) mat = marker;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      joint.add(mesh);
      parent.add(joint);
      this.joints.push(joint);
      parent = joint;

      // 釣り糸ガイド（現実的な厚みの小さなリング）
      if ([1, 4, 7, 10, 13].includes(i)) {
        const gr = 0.0042 - i * 0.00018;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(gr, 0.0007, 6, 14), guideMat);
        ring.position.set(0, -gr - rb - 0.0006, -segLen * 0.55);
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0006, 0.0006, gr + rb, 5),
          guideMat
        );
        stem.position.set(0, (gr + rb) / 2, 0);
        ring.add(stem);
        joint.add(ring);
        const anchor = new THREE.Object3D();
        anchor.position.set(0, -gr - rb - 0.0006, -segLen * 0.55);
        joint.add(anchor);
        this.guideObjs.push(anchor);
      }
    }
    // 先端アンカー
    this.tipObj.position.set(0, 0, -segLen);
    parent.add(this.tipObj);

    // 根元の握り（リールへ差し込むグリップ）
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.007, 0.07, 10),
      new THREE.MeshStandardMaterial({ color: 0x37302a, roughness: 0.8 })
    );
    grip.geometry.rotateX(Math.PI / 2);
    grip.position.z = 0.032;
    this.root.add(grip);
  }

  /** bite impulse。速度として直接注入する（短い「ピクッ」）。 */
  impulse(v: number) {
    this.velocity += v;
  }

  update(dt: number) {
    // damped spring（先端が柔らかい竿の戻り）
    const k = 170;
    const c = 9.5;
    const acc = -k * (this.deflection - this.target) - c * this.velocity;
    this.velocity += acc * dt;
    this.deflection += this.velocity * dt;
    this.deflection = clamp(this.deflection, -0.5, 0.75);

    const N = Rod.SEGMENTS;
    for (let i = 0; i < N; i++) {
      const joint = this.joints[i];
      // たわみを柔らかさ分布に従って各関節へ配分（ゴム棒のような均一曲がりを避ける）
      // 正のたわみ = 先端が下がる（rotation.x 正は先端を上げるため符号反転）
      joint.rotation.x = -this.deflection * this.weights[i] * 2.0;
      joint.rotation.y = this.lateral * this.weights[i] * 1.4;
    }
    this.root.rotation.x = this.lift;
  }

  getTipWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.tipObj.getWorldPosition(out);
  }

  getGuideWorlds(): THREE.Vector3[] {
    return this.guideObjs.map((g) => g.getWorldPosition(new THREE.Vector3()));
  }
}
