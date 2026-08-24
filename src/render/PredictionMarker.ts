import * as THREE from 'three';
import { MaterialSet } from './materials';

export type Prediction = 'open' | 'closed';

/**
 * 物理的な予想マーカー。
 * 「開く」= 開いた小さな扉の模型 / 「開かない」= 閉じた模型 を
 * 扉の前の小さな台へ置いて予想する。文字ボタンは使わない。
 */
export class PredictionMarker {
  group = new THREE.Group();
  private pedestal: THREE.Mesh;
  private openModel: THREE.Group;
  private closedModel: THREE.Group;
  choice: Prediction | null = null;

  static readonly PEDESTAL_POS = new THREE.Vector3(0.85, 0, 3.3);

  constructor(mats: MaterialSet) {
    // 小さな丸い台(点検用スツール風)
    this.pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.42, 20),
      new THREE.MeshStandardMaterial({ color: 0x7c8388, roughness: 0.6, metalness: 0.3 }),
    );
    this.pedestal.position.copy(PredictionMarker.PEDESTAL_POS).setY(0.21);
    this.pedestal.castShadow = true;
    this.group.add(this.pedestal);

    this.openModel = this.makeMiniDoor(mats, true);
    this.closedModel = this.makeMiniDoor(mats, false);
    this.openModel.visible = false;
    this.closedModel.visible = false;
    for (const m of [this.openModel, this.closedModel]) {
      m.position.copy(PredictionMarker.PEDESTAL_POS).setY(0.42);
      this.group.add(m);
    }
    this.group.visible = false;
  }

  private makeMiniDoor(mats: MaterialSet, open: boolean): THREE.Group {
    const g = new THREE.Group();
    const s = 0.16; // ミニチュアの半幅
    const frame = new THREE.Mesh(new THREE.BoxGeometry(s * 2.4, 0.02, 0.05), mats.aluminum);
    frame.position.y = 0.24;
    g.add(frame);
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.05), mats.aluminum);
      jamb.position.set(sx * s * 1.15, 0.12, 0);
      g.add(jamb);
    }
    const panelW = s * 0.55;
    const gap = open ? s * 0.62 : 0;
    for (const sx of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(panelW, 0.21, 0.012),
        new THREE.MeshStandardMaterial({
          color: 0xcfe0da,
          roughness: 0.2,
          transparent: true,
          opacity: 0.55,
        }),
      );
      panel.position.set(sx * (panelW / 2 + gap), 0.115, 0);
      g.add(panel);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(s * 2.6, 0.015, 0.12), mats.steel);
    base.position.y = 0.008;
    g.add(base);
    return g;
  }

  showPedestal(show: boolean): void {
    this.group.visible = show;
    if (!show) this.clear();
  }

  place(p: Prediction): void {
    this.choice = p;
    this.openModel.visible = p === 'open';
    this.closedModel.visible = p === 'closed';
  }

  clear(): void {
    this.choice = null;
    this.openModel.visible = false;
    this.closedModel.visible = false;
  }
}
