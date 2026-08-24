import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MaterialSet } from './materials';
import { TrafficActor, ActorKind } from '../sim/TrafficActor';

/**
 * 試験対象の3D表現。TrafficActor の運動学に追従し、
 * 車輪はオドメーターで回転、向きは進行方向を向く。
 */
export class ActorMesh {
  group = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private wheelRadius = 0.08;

  constructor(kind: ActorKind, mats: MaterialSet) {
    switch (kind) {
      case 'deliveryRobot':
        this.buildDeliveryRobot(mats);
        break;
      case 'wheelchairRig':
        this.buildWheelchairRig(mats);
        break;
      case 'lowCart':
        this.buildLowCart(mats);
        break;
      case 'foamBody':
        this.buildFoamBody(mats);
        break;
    }
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  private wheel(mats: MaterialSet, r: number, w: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(r, r, w, 18);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, mats.rubber);
    // ハブ
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.006, 12).rotateZ(Math.PI / 2),
      mats.steel,
    );
    m.add(hub);
    return m;
  }

  private buildDeliveryRobot(mats: MaterialSet): void {
    const g = this.group;
    // 白い樹脂シェル
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.72, 0.58, 4, 0.07), mats.robotShell);
    body.position.y = 0.5;
    g.add(body);
    // 上部の配送ボックス蓋
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.06, 0.5, 3, 0.02), mats.robotAccent);
    lid.position.y = 0.9;
    g.add(lid);
    // 前面センサーバンド(発光しない、暗色)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.015), mats.housing);
    band.position.set(0, 0.62, 0.3);
    g.add(band);
    // 車輪4
    this.wheelRadius = 0.09;
    for (const [x, z] of [
      [-0.2, 0.2],
      [0.2, 0.2],
      [-0.2, -0.2],
      [0.2, -0.2],
    ] as const) {
      const w = this.wheel(mats, 0.09, 0.05);
      w.position.set(x, 0.09, z);
      g.add(w);
      this.wheels.push(w);
    }
    // 底部シャーシ
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.54), mats.housing);
    chassis.position.y = 0.13;
    g.add(chassis);
  }

  private buildWheelchairRig(mats: MaterialSet): void {
    const g = this.group;
    const tube = (
      len: number,
      pos: [number, number, number],
      rot: [number, number, number],
    ): void => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 8), mats.steel);
      m.position.set(...pos);
      m.rotation.set(...rot);
      g.add(m);
    };
    // 大車輪2
    for (const sx of [-1, 1]) {
      const w = this.wheel(mats, 0.28, 0.03);
      w.position.set(sx * 0.29, 0.28, -0.05);
      g.add(w);
      this.wheels.push(w);
    }
    this.wheelRadius = 0.28;
    // 前キャスター
    for (const sx of [-1, 1]) {
      const c = this.wheel(mats, 0.07, 0.025);
      c.position.set(sx * 0.22, 0.07, 0.28);
      g.add(c);
      this.wheels.push(c);
    }
    // 座面 + 背もたれ + 試験ウェイト
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.42), mats.rubber);
    seat.position.set(0, 0.52, 0.05);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.04), mats.rubber);
    back.position.set(0, 0.75, -0.16);
    back.rotation.x = -0.12;
    g.add(back);
    const weight = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.24, 0.3, 3, 0.04), mats.foam);
    weight.position.set(0, 0.66, 0.05);
    g.add(weight);
    tube(0.5, [0.23, 0.35, 0.05], [Math.PI / 2, 0, 0]);
    tube(0.5, [-0.23, 0.35, 0.05], [Math.PI / 2, 0, 0]);
    tube(0.36, [0.23, 0.34, 0.28], [0, 0, 0]);
    tube(0.36, [-0.23, 0.34, 0.28], [0, 0, 0]);
  }

  private buildLowCart(mats: MaterialSet): void {
    const g = this.group;
    // 低い荷台
    const deck = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.05, 0.66, 3, 0.015), mats.steel);
    deck.position.y = 0.14;
    g.add(deck);
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.18, 0.5, 3, 0.02), mats.foam);
    box.position.y = 0.26;
    g.add(box);
    this.wheelRadius = 0.055;
    for (const [x, z] of [
      [-0.2, 0.26],
      [0.2, 0.26],
      [-0.2, -0.26],
      [0.2, -0.26],
    ] as const) {
      const w = this.wheel(mats, 0.055, 0.03);
      w.position.set(x, 0.055, z);
      g.add(w);
      this.wheels.push(w);
    }
    // 低い押しバー(それでも全高0.38m)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), mats.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.37, -0.3);
    g.add(bar);
  }

  private buildFoamBody(mats: MaterialSet): void {
    const g = this.group;
    // 走行ベース
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 20), mats.housing);
    base.position.y = 0.1;
    g.add(base);
    this.wheelRadius = 0.05;
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const w = this.wheel(mats, 0.05, 0.025);
      w.position.set(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17);
      g.add(w);
      this.wheels.push(w);
    }
    // 支柱(ベースとフォームをつなぐ)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 10), mats.steel);
    post.position.y = 0.38;
    g.add(post);
    // 成人型フォーム: 胴体・頭(柔らかい試験体らしい単純形状)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 12), mats.foam);
    torso.position.y = 0.95;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mats.foam);
    head.position.y = 1.55;
    g.add(head);
    // 固定ベルト
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 6, 20), mats.rubber);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.95;
    g.add(belt);
  }

  sync(actor: TrafficActor): void {
    this.group.position.set(actor.pos.x, 0, actor.pos.z);
    const yaw = Math.atan2(actor.heading.x, actor.heading.z);
    this.group.rotation.y = yaw;
    const spin = actor.odometer / this.wheelRadius;
    for (const w of this.wheels) w.rotation.x = spin % (Math.PI * 2);
  }
}
