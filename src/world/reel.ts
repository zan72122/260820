import * as THREE from 'three';
import { brushedMetalTexture, plasticTexture, rubberTexture } from './textures';
import { damp } from '../util/math';

/**
 * 小型電動リール。射出成形樹脂ボディ、ゴム押し面、金属スプールを材質で区別する。
 * 用途不明の装飾発光は付けない。
 */
export class Reel {
  root = new THREE.Group();
  private spool: THREE.Mesh;
  private pad: THREE.Mesh;
  private padBaseY: number;
  /** 糸が出ていく点（スプール前縁） */
  lineExit = new THREE.Object3D();
  spinSpeed = 0; // rad/s
  pressed = false;

  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({
      map: plasticTexture('#2b3036'),
      roughness: 0.52,
      metalness: 0.06
    });
    const bodyMat2 = new THREE.MeshStandardMaterial({
      map: plasticTexture('#3a4048'),
      roughness: 0.6,
      metalness: 0.04
    });

    // 本体（前が低く、後ろが高い実機らしい楔形）
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.036, 0.1), bodyMat);
    body.position.set(0, 0.024, 0.012);
    body.castShadow = true;
    this.root.add(body);
    const bodyTop = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.03, 0.062), bodyMat2);
    bodyTop.position.set(0, 0.052, 0.03);
    bodyTop.castShadow = true;
    this.root.add(bodyTop);
    // パーティングラインに相当する境目
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.089, 0.0016, 0.101),
      new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.7 })
    );
    seam.position.set(0, 0.041, 0.012);
    this.root.add(seam);

    // カウンター窓（発光させない暗いガラス）
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.004, 0.024),
      new THREE.MeshPhysicalMaterial({
        color: 0x11181d,
        roughness: 0.12,
        metalness: 0.0,
        clearcoat: 1,
        clearcoatRoughness: 0.08
      })
    );
    counter.position.set(0, 0.0685, 0.048);
    counter.rotation.x = -0.22;
    this.root.add(counter);

    // ゴムの大きな押し面（巻き上げボタン）
    this.pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0225, 0.024, 0.009, 20),
      new THREE.MeshStandardMaterial({ map: rubberTexture(), roughness: 0.92, metalness: 0 })
    );
    this.pad.position.set(0, 0.0715, 0.008);
    this.padBaseY = this.pad.position.y;
    this.root.add(this.pad);

    // 金属スプール（前面、横軸）＋巻かれた糸
    const spoolMat = new THREE.MeshStandardMaterial({
      map: brushedMetalTexture(),
      roughness: 0.32,
      metalness: 0.9
    });
    this.spool = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.03, 22), spoolMat);
    this.spool.geometry.rotateZ(Math.PI / 2);
    this.spool.position.set(0, 0.028, -0.043);
    this.spool.castShadow = true;
    this.root.add(this.spool);
    const lineCoil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0145, 0.0145, 0.026, 20),
      new THREE.MeshStandardMaterial({ color: 0xcfd3c4, roughness: 0.75 })
    );
    lineCoil.geometry.rotateZ(Math.PI / 2);
    this.spool.add(lineCoil);
    // スプールの回転が読める切り欠き
    const notch = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.004, 0.004),
      new THREE.MeshStandardMaterial({ color: 0x4b5158, roughness: 0.4, metalness: 0.8 })
    );
    this.spool.add(notch);
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.003, 22), spoolMat);
    flange.geometry.rotateZ(Math.PI / 2);
    flange.position.x = 0.016;
    this.spool.add(flange);
    const flange2 = flange.clone();
    flange2.position.x = -0.016;
    this.spool.add(flange2);

    // 竿差し込み口（前面）
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.03, 12), bodyMat2);
    seat.geometry.rotateX(Math.PI / 2);
    seat.position.set(0, 0.05, -0.052);
    this.root.add(seat);

    this.lineExit.position.set(0, 0.047, -0.052);
    this.root.add(this.lineExit);
  }

  /** ヒント用：押し面がひとりでにごく小さく沈む */
  hintNudge() {
    this.pad.position.y = this.padBaseY - 0.0035;
  }

  update(dt: number, elapsed: number) {
    this.spool.rotation.x += this.spinSpeed * dt;
    const padTarget = this.pressed ? this.padBaseY - 0.004 : this.padBaseY;
    this.pad.position.y = damp(this.pad.position.y, padTarget, 22, dt);
  }
}
