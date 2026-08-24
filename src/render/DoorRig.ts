import * as THREE from 'three';
import { MaterialSet } from './materials';

/**
 * 自動引戸一式。
 * - 両引きの可動パネル2枚(アルマイトアルミ框 + 合わせガラス)
 * - 袖固定ガラス、無目(トランサム)、敷居ガイド
 * - 無目下面・通路側にセンサー筐体(黒ポリカ)
 *   - 下部に機械式角度調整リング
 *   - 誤作動後に開く点検レンズハッチ
 *   - ハッチ内に俯角アンテナ板(リングと連動して傾く)
 */
export class DoorRig {
  group = new THREE.Group();
  private panelL!: THREE.Group;
  private panelR!: THREE.Group;
  ring!: THREE.Mesh;
  hatch!: THREE.Group;
  antenna!: THREE.Mesh;
  sensorHousing!: THREE.Group;
  /** ハッチ開度 0..1 */
  hatchOpen = 0;
  private hatchTarget = 0;
  /** リング回転角(見た目) */
  ringAngle = 0;

  static readonly PANEL_W = 1.08;
  static readonly PANEL_H = 2.12;
  static readonly TRAVEL = 1.0;

  constructor(private mats: MaterialSet) {
    this.build();
  }

  private makePanel(): THREE.Group {
    const m = this.mats;
    const g = new THREE.Group();
    const W = DoorRig.PANEL_W;
    const H = DoorRig.PANEL_H;
    const stile = 0.055; // 縦框幅
    const railB = 0.16; // 下框(蹴られやすいので太い)
    const railT = 0.07;
    const t = 0.042; // パネル厚

    const mk = (w: number, h: number, x: number, y: number): void => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), m.aluminum);
      box.position.set(x, y, 0);
      box.castShadow = true;
      g.add(box);
    };
    mk(stile, H, -W / 2 + stile / 2, H / 2); // 左縦框
    mk(stile, H, W / 2 - stile / 2, H / 2); // 右縦框
    mk(W - 2 * stile, railT, 0, H - railT / 2); // 上框
    mk(W - 2 * stile, railB, 0, railB / 2); // 下框

    // 框の細い面取り(ガラス留め縁): ガラス周囲の細いアルミ押縁
    const beadH = H - railB - railT;
    for (const sx of [-1, 1]) {
      const bead = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, beadH, t * 0.55),
        this.mats.aluminumDark,
      );
      bead.position.set(sx * (W / 2 - stile - 0.006), railB + beadH / 2, 0);
      g.add(bead);
    }

    // 合わせガラス(厚みを持つ薄い箱)
    const glassW = W - 2 * stile - 0.01;
    const glassH = H - railB - railT - 0.01;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.012), m.glass);
    glass.position.set(0, railB + glassH / 2 + 0.005, 0);
    g.add(glass);
    // ガラス小口(縦框との境に淡い緑)
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, glassH, 0.013), m.glassEdge);
      edge.position.set(sx * (glassW / 2 - 0.003), railB + glassH / 2 + 0.005, 0);
      g.add(edge);
    }
    // 視認マーク(ドット帯、高さ約1.15m)
    const dots = new THREE.Mesh(new THREE.PlaneGeometry(glassW, 0.34), m.glassDots);
    dots.position.set(0, 1.15, 0.008);
    g.add(dots);
    const dots2 = dots.clone();
    dots2.rotation.y = Math.PI;
    dots2.position.z = -0.008;
    g.add(dots2);

    // 扉下部シール(戸先まで届くゴム)
    const seal = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, t + 0.008), m.doorSeal);
    seal.position.set(0, 0.015, 0);
    g.add(seal);

    return g;
  }

  private build(): void {
    const m = this.mats;
    const g = this.group;
    g.name = 'doorRig';
    const H = DoorRig.PANEL_H;

    // 縦枠(方立)
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.09, H + 0.32, 0.14), m.aluminum);
      jamb.position.set(sx * 2.72, (H + 0.32) / 2, 0);
      jamb.castShadow = true;
      g.add(jamb);
      const midJamb = new THREE.Mesh(new THREE.BoxGeometry(0.07, H, 0.12), m.aluminum);
      midJamb.position.set(sx * 1.32, H / 2, 0);
      midJamb.castShadow = true;
      g.add(midJamb);
    }

    // 袖固定ガラス
    for (const sx of [-1, 1]) {
      const fixW = 2.72 - 1.32 - 0.08;
      const fx = sx * (1.32 + 0.035 + fixW / 2);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(fixW, H - 0.2, 0.012), m.glass);
      glass.position.set(fx, (H - 0.2) / 2 + 0.1, 0);
      g.add(glass);
      const railB = new THREE.Mesh(new THREE.BoxGeometry(fixW, 0.2, 0.05), m.aluminum);
      railB.position.set(fx, 0.1, 0);
      g.add(railB);
      const dots = new THREE.Mesh(new THREE.PlaneGeometry(fixW, 0.3), m.glassDots);
      dots.position.set(fx, 1.15, 0.02);
      g.add(dots);
    }

    // 無目(トランサム): 駆動装置の収まる梁
    const transom = new THREE.Mesh(new THREE.BoxGeometry(5.45, 0.34, 0.2), m.aluminum);
    transom.position.set(0, H + 0.17, 0);
    transom.castShadow = true;
    g.add(transom);
    const transomLine = new THREE.Mesh(new THREE.BoxGeometry(5.45, 0.02, 0.21), m.aluminumDark);
    transomLine.position.set(0, H + 0.03, 0);
    g.add(transomLine);

    // 敷居: 床ガイドの薄いステンレス帯
    const sill = new THREE.Mesh(new THREE.BoxGeometry(5.44, 0.012, 0.14), m.steel);
    sill.position.set(0, 0.006, 0);
    sill.receiveShadow = true;
    g.add(sill);
    const guide = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.008, 0.02), m.aluminumDark);
    guide.position.set(0, 0.013, 0);
    g.add(guide);

    // 可動パネル
    this.panelL = this.makePanel();
    this.panelL.position.set(-DoorRig.PANEL_W / 2 + 0.02, 0, 0);
    g.add(this.panelL);
    this.panelR = this.makePanel();
    this.panelR.position.set(DoorRig.PANEL_W / 2 - 0.02, 0, 0);
    g.add(this.panelR);

    // ---- センサー筐体(無目の通路側、扉中央上) ----
    const housing = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.07), m.housing);
    body.castShadow = true;
    housing.add(body);
    // 射出成形の合わせ(パーティングライン)
    const parting = new THREE.Mesh(new THREE.BoxGeometry(0.342, 0.004, 0.071), m.aluminumDark);
    parting.position.y = -0.012;
    housing.add(parting);
    // 前面の検知窓(濃い半透明)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x151719,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.94,
    });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.008), windowMat);
    win.position.set(0, -0.005, 0.037);
    housing.add(win);

    // 角度調整リング(下面の機械式ノブ、ローレット付き)
    const ringGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.026, 28);
    this.ring = new THREE.Mesh(ringGeo, m.steel);
    this.ring.position.set(0.1, -0.058, 0.012);
    housing.add(this.ring);
    // ローレット(つまみの刻み)
    for (let i = 0; i < 10; i++) {
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 0.01), m.aluminumDark);
      const a = (i / 10) * Math.PI * 2;
      notch.position.set(Math.cos(a) * 0.047, 0, Math.sin(a) * 0.047);
      notch.rotation.y = -a;
      this.ring.add(notch);
    }
    // 指標マーク
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.004, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xd8b23c, roughness: 0.5 }),
    );
    mark.position.set(0, -0.015, 0.04);
    this.ring.add(mark);

    // 点検レンズハッチ(下面、ヒンジで開く小蓋)
    this.hatch = new THREE.Group();
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.006, 0.05), m.housing);
    flap.position.set(0, 0, 0.025); // ヒンジは奥側
    this.hatch.add(flap);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.004, 16),
      new THREE.MeshStandardMaterial({
        color: 0x3a4b52,
        roughness: 0.15,
        metalness: 0.3,
      }),
    );
    lens.position.set(0, -0.004, 0.03);
    this.hatch.add(lens);
    this.hatch.position.set(-0.09, -0.046, -0.01);
    housing.add(this.hatch);

    // 俯角アンテナ板(ハッチ内に見える小さな機構)
    this.antenna = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.004, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x8c7f5a, metalness: 0.6, roughness: 0.45 }),
    );
    this.antenna.position.set(-0.09, -0.035, -0.005);
    housing.add(this.antenna);

    housing.position.set(0, H + 0.05 + 0.09, 0.14);
    this.sensorHousing = housing;
    g.add(housing);
  }

  /** ワールド座標でのリング中心(タッチ判定・カメラ用) */
  ringWorldPos(): THREE.Vector3 {
    const v = new THREE.Vector3();
    this.ring.getWorldPosition(v);
    return v;
  }

  openHatch(open: boolean): void {
    this.hatchTarget = open ? 1 : 0;
  }

  /**
   * @param doorPos 扉開度 0..1
   * @param depth 現在の領域奥行き(アンテナ俯角の見た目に使う)
   */
  update(dt: number, doorPos: number, depth: number): void {
    const x = doorPos * DoorRig.TRAVEL;
    this.panelL.position.x = -DoorRig.PANEL_W / 2 + 0.02 - x;
    this.panelR.position.x = DoorRig.PANEL_W / 2 - 0.02 + x;

    // ハッチ開閉(機械的にゆっくり)
    const speed = 2.2;
    if (this.hatchOpen < this.hatchTarget) {
      this.hatchOpen = Math.min(this.hatchTarget, this.hatchOpen + dt * speed);
    } else if (this.hatchOpen > this.hatchTarget) {
      this.hatchOpen = Math.max(this.hatchTarget, this.hatchOpen - dt * speed);
    }
    this.hatch.rotation.x = (-Math.PI * 0.62) * this.hatchOpen;

    // リング角度の見た目 → アンテナ俯角(奥行きが深い=俯角が浅い)
    this.ring.rotation.y = this.ringAngle;
    // 奥行きが深い=俯角が浅い(アンテナが起きる)
    const t = (depth - 0.9) / (4.2 - 0.9); // 0..1
    this.antenna.rotation.x = THREE.MathUtils.lerp(0.72, 0.18, t);
  }
}
