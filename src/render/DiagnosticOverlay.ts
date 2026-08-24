import * as THREE from 'three';
import { ActivationField } from '../sim/ActivationField';
import { SafetyCurtain } from '../sim/SafetyCurtain';
import { TrafficActor } from '../sim/TrafficActor';

/**
 * 診断モードの可視化。実物の設置調整を助ける「試験用オーバーレイ」という設定。
 * - 接近検知領域: 床上の低密度なセル(点)と、外縁の弱い照度差
 * - 検知されたセルだけ一瞬明るくなる
 * - 安全カーテン: 床へ並ぶ検知セル(通常運転では描かない)
 * - 対象の進行ベクトル: 短い軌跡
 *
 * 描画は ActivationField / SafetyCurtain の同じセルデータを読むだけで、
 * 判定に影響する値は一切持たない。
 */
const MAX_ACT_CELLS = 600;

export class DiagnosticOverlay {
  group = new THREE.Group();
  private actCells: THREE.InstancedMesh;
  private curCells: THREE.InstancedMesh;
  private outline: THREE.LineLoop;
  private trails = new Map<string, { line: THREE.Line; pts: THREE.Vector3[] }>();
  private dummy = new THREE.Object3D();
  /** 表示強度(フェードイン/アウト) */
  private fade = 0;
  visibleTarget = false;

  private baseColor = new THREE.Color(0x5f7d78); // 落ち着いた青灰
  private hotColor = new THREE.Color(0xd8c37a); // 検知時の暖色(控えめ)
  private curtainBase = new THREE.Color(0x6e6a58);
  private curtainHot = new THREE.Color(0xd8a05c);

  constructor(
    private field: ActivationField,
    private curtain: SafetyCurtain,
  ) {
    const disc = new THREE.CircleGeometry(0.075, 10);
    disc.rotateX(-Math.PI / 2);
    const actMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.actCells = new THREE.InstancedMesh(disc, actMat, MAX_ACT_CELLS);
    this.actCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.actCells);

    const sq = new THREE.PlaneGeometry(0.11, 0.11);
    sq.rotateX(-Math.PI / 2);
    const curMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.curCells = new THREE.InstancedMesh(sq, curMat, this.curtain.cells.length);
    this.curCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.curCells);

    const outlineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.outline = new THREE.LineLoop(
      outlineGeo,
      new THREE.LineBasicMaterial({
        color: 0x9db8b2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.group.add(this.outline);

    this.group.visible = false;
  }

  setVisible(v: boolean): void {
    this.visibleTarget = v;
  }

  get shown(): boolean {
    return this.fade > 0.02;
  }

  clearTrails(): void {
    for (const t of this.trails.values()) {
      this.group.remove(t.line);
      t.line.geometry.dispose();
    }
    this.trails.clear();
  }

  update(dt: number, actors: TrafficActor[]): void {
    this.fade += ((this.visibleTarget ? 1 : 0) - this.fade) * Math.min(1, dt * 5);
    if (this.fade < 0.02 && !this.visibleTarget) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 接近検知セル
    const cells = this.field.cells;
    const n = Math.min(cells.length, MAX_ACT_CELLS);
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      this.dummy.position.set(c.x, 0.012, c.z);
      const s = 1 + c.hot * 0.5;
      this.dummy.scale.set(s, 1, s);
      this.dummy.updateMatrix();
      this.actCells.setMatrixAt(i, this.dummy.matrix);
      color.copy(this.baseColor).lerp(this.hotColor, c.hot);
      this.actCells.setColorAt(i, color);
    }
    // 余剰インスタンスは縮退させる
    this.dummy.scale.set(0.0001, 0.0001, 0.0001);
    this.dummy.updateMatrix();
    for (let i = n; i < MAX_ACT_CELLS; i++) this.actCells.setMatrixAt(i, this.dummy.matrix);
    this.actCells.count = MAX_ACT_CELLS;
    this.actCells.instanceMatrix.needsUpdate = true;
    if (this.actCells.instanceColor) this.actCells.instanceColor.needsUpdate = true;
    (this.actCells.material as THREE.MeshBasicMaterial).opacity = 0.34 * this.fade;

    // 外縁(弱い照度差の線)
    const o = this.field.outline();
    const pos = this.outline.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 4; i++) pos.setXYZ(i, o[i].x, 0.016, o[i].z);
    pos.needsUpdate = true;
    (this.outline.material as THREE.LineBasicMaterial).opacity = 0.5 * this.fade;

    // 安全カーテンセル
    for (let i = 0; i < this.curtain.cells.length; i++) {
      const c = this.curtain.cells[i];
      this.dummy.position.set(c.x, 0.014, c.z);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.curCells.setMatrixAt(i, this.dummy.matrix);
      color.copy(this.curtainBase).lerp(this.curtainHot, c.hot);
      this.curCells.setColorAt(i, color);
    }
    this.curCells.instanceMatrix.needsUpdate = true;
    if (this.curCells.instanceColor) this.curCells.instanceColor.needsUpdate = true;
    (this.curCells.material as THREE.MeshBasicMaterial).opacity = 0.4 * this.fade;

    // 進行ベクトル: 車輪方向は実体側、ここでは短い軌跡
    for (const a of actors) {
      if (!a.started) continue;
      let t = this.trails.get(a.id);
      if (!t) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: 0xc7d2cd,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        t = { line, pts: [] };
        this.trails.set(a.id, t);
        this.group.add(line);
      }
      const last = t.pts[t.pts.length - 1];
      const cur = new THREE.Vector3(a.pos.x, 0.02, a.pos.z);
      if (!last || last.distanceTo(cur) > 0.12) {
        t.pts.push(cur);
        if (t.pts.length > 30) t.pts.shift();
        const posAttr = t.line.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < 30; i++) {
          const p = t.pts[Math.min(i, t.pts.length - 1)] ?? cur;
          posAttr.setXYZ(i, p.x, p.y, p.z);
        }
        posAttr.needsUpdate = true;
      }
      (t.line.material as THREE.LineBasicMaterial).opacity = 0.55 * this.fade;
    }
  }
}
