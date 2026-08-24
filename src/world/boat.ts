import * as THREE from 'three';
import {
  clothTexture,
  tentTexture,
  woodFloorTexture,
  woodRoughnessTexture
} from './textures';
import { WATER_Y } from './underwater';
import { damp } from '../util/math';

export const HOLE_RADIUS = 0.14;

/** ドーム天幕テクスチャに窓の切り抜き（alpha=0）を焼き込む */
function tentTextureWithWindows(): THREE.CanvasTexture {
  const base = tentTexture();
  const src = base.image as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  // 窓帯：v(下から)0.10-0.30 → キャンバスy 0.70S-0.90S
  const S = 512;
  const y0 = S * 0.62;
  const wh = S * 0.17;
  for (let k = 0; k < 6; k++) {
    const u = 0.06 + k * 0.16;
    const x0 = u * S;
    const ww = S * 0.09;
    // 白い窓枠（縫い付けの縁）
    ctx.fillStyle = '#e8ebe6';
    ctx.fillRect(x0 - 5, y0 - 5, ww + 10, wh + 10);
    ctx.clearRect(x0, y0, ww, wh);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class DomeBoat {
  /** 揺れの変換を受けるグループ（船体・床・道具すべて） */
  root = new THREE.Group();
  /** カットアウェイで切られる材質 */
  clippable: THREE.Material[] = [];

  table = new THREE.Group();
  private tableBaseY = 0;
  private attendantHead: THREE.Group | null = null;
  private attendantLookT = 0;
  bucket = new THREE.Group();
  bucketWaterY = 0.1;
  heaterLight: THREE.PointLight;
  lampLight: THREE.PointLight;
  private lamp: THREE.Group;

  constructor() {
    const clip = (m: THREE.Material) => {
      this.clippable.push(m);
      return m;
    };

    // ---- 床（釣り口の穴あき） ----
    const floorShape = new THREE.Shape();
    floorShape.moveTo(-2.3, -3.1);
    floorShape.lineTo(2.3, -3.1);
    floorShape.lineTo(2.3, 3.1);
    floorShape.lineTo(-2.3, 3.1);
    floorShape.closePath();
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, HOLE_RADIUS + 0.012, 0, Math.PI * 2, true);
    floorShape.holes.push(holePath);
    const lidHole = new THREE.Path();
    lidHole.absarc(-1.15, -0.62, 0.13, 0, Math.PI * 2, true);
    floorShape.holes.push(lidHole);
    // 厚みのある床板（カットアウェイで木口が見える）
    const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
      depth: 0.045,
      bevelEnabled: false,
      curveSegments: 40
    });
    floorGeo.rotateX(Math.PI / 2); // 押し出し方向を下へ
    floorGeo.translate(0, 0, 0);
    // UVは座標そのまま → スケールして木目を張る
    {
      const uv = floorGeo.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.45, uv.getY(i) * 0.45);
    }
    const floorMat = clip(
      new THREE.MeshStandardMaterial({
        map: woodFloorTexture(),
        roughnessMap: woodRoughnessTexture(),
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.DoubleSide // カットアウェイで下面からも見える
      })
    );
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.root.add(floor);

    // 釣り口まわりの濡れ・使用痕（非対称な放射デカール）
    const wetC = document.createElement('canvas');
    wetC.width = wetC.height = 256;
    {
      const ctx = wetC.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 120, 30, 132, 126, 122);
      g.addColorStop(0, 'rgba(18,12,8,0.55)');
      g.addColorStop(0.45, 'rgba(22,16,10,0.34)');
      g.addColorStop(1, 'rgba(22,16,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      // 飛沫の染み（片側に寄せる）
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 60;
        const x = 128 + Math.cos(a) * r * (a < Math.PI ? 1.15 : 0.8);
        const y = 120 + Math.sin(a) * r * 0.9;
        ctx.fillStyle = `rgba(20,14,9,${0.12 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const wetTex = new THREE.CanvasTexture(wetC);
    const wet = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 32),
      clip(
        new THREE.MeshStandardMaterial({
          map: wetTex,
          transparent: true,
          roughness: 0.15,
          metalness: 0.0,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      )
    );
    wet.rotation.x = -Math.PI / 2;
    wet.position.y = 0.002;
    this.root.add(wet);

    // 釣り口の筒（床から水面下まで）
    // 濡れて黒ずんだ筒
    const collarMat = clip(
      new THREE.MeshStandardMaterial({ color: 0x14100b, roughness: 0.35, side: THREE.DoubleSide })
    );
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(HOLE_RADIUS + 0.006, HOLE_RADIUS + 0.006, 0.02 - (WATER_Y - 0.04), 28, 1, true),
      collarMat
    );
    collar.position.y = (0.02 + WATER_Y - 0.04) / 2;
    this.root.add(collar);
    // 釣り口の縁（すり減った枠）
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(HOLE_RADIUS + 0.012, 0.011, 10, 30),
      clip(new THREE.MeshStandardMaterial({ color: 0x4c3a26, roughness: 0.75 }))
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.012;
    rim.castShadow = true;
    this.root.add(rim);

    // 使っていない釣り口の蓋
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.145, 0.02, 24),
      clip(new THREE.MeshStandardMaterial({ color: 0x5a4732, roughness: 0.85 }))
    );
    lid.position.set(-1.15, 0.008, -0.62);
    this.root.add(lid);

    // ---- 船体（喫水下も含む） ----
    const hullMat = clip(
      new THREE.MeshStandardMaterial({ color: 0x27343c, roughness: 0.7, side: THREE.DoubleSide })
    );
    // 床下の船体。喫水の浅いバージ。カットアウェイで内部が大きく開かない厚み
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.22, 6.5), hullMat);
    hull.position.y = -0.31;
    this.root.add(hull);
    // 喫水線の縁（周囲のフレームだけ。床は覆わない）
    const gwMat = clip(new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.6 }));
    for (const sx of [-2.45, 2.45]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 6.6), gwMat);
      g.position.set(sx, -0.06, 0);
      this.root.add(g);
    }
    for (const sz of [-3.25, 3.25]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, 0.12), gwMat);
      g.position.set(0, -0.06, sz);
      this.root.add(g);
    }
    // 床とハル天面の間の幕板（カットアウェイの断面を閉じる）
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.18, 0.04), hullMat);
    skirt.position.set(0, -0.12, 3.23);
    this.root.add(skirt);
    const skirt2 = skirt.clone();
    skirt2.position.z = -3.23;
    this.root.add(skirt2);
    for (const sx of [-2.42, 2.42]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 6.45), hullMat);
      s.position.set(sx, -0.12, 0);
      this.root.add(s);
    }

    // ---- ドーム天幕 ----
    const tentTex = tentTextureWithWindows();
    const domeGeoIn = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMatIn = clip(
      new THREE.MeshStandardMaterial({
        map: tentTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.BackSide,
        roughness: 0.9,
        color: 0xd9dcd6
      })
    );
    const domeIn = new THREE.Mesh(domeGeoIn, domeMatIn);
    domeIn.scale.set(2.45, 2.25, 3.35);
    domeIn.position.y = 0;
    this.root.add(domeIn);
    const domeMatOut = clip(
      new THREE.MeshStandardMaterial({
        map: tentTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.FrontSide,
        roughness: 0.85,
        color: 0xcdd4d8
      })
    );
    const domeOut = new THREE.Mesh(domeGeoIn.clone(), domeMatOut);
    domeOut.scale.set(2.47, 2.27, 3.37);
    this.root.add(domeOut);

    // 骨組みのリブ（アーチ）
    const ribMat = clip(new THREE.MeshStandardMaterial({ color: 0x7c828a, roughness: 0.5, metalness: 0.6 }));
    for (const z of [-2.4, -1.2, 0, 1.2, 2.4]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 8, 30, Math.PI), ribMat);
      rib.scale.set(2.35, 2.16, 1);
      rib.position.set(0, 0.02, z);
      this.root.add(rib);
    }

    // ---- 叩き台（安定した小さな台）＋腰掛け ----
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodFloorTexture(),
      roughness: 0.8
    });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.22), woodMat);
    tableTop.position.y = 0.36;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.table.add(tableTop);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3c3630, roughness: 0.7 });
    for (const [sx, sz] of [
      [-0.14, -0.08],
      [0.14, -0.08],
      [-0.14, 0.08],
      [0.14, 0.08]
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.36, 0.024), legMat);
      leg.position.set(sx, 0.18, sz);
      this.table.add(leg);
    }
    // 天板の滑り止めマット
    const matPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.004, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x2a3b34, roughness: 0.95 })
    );
    matPad.position.y = 0.374;
    this.table.add(matPad);
    this.table.position.set(0, 0, 0.66);
    this.tableBaseY = 0;
    this.root.add(this.table);

    // プレイヤーの腰掛け（画面ではほぼ見えないが接地感のため）
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 14), legMat);
    stool.position.set(0.05, 0.15, 1.25);
    this.root.add(stool);
    const cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.165, 0.05, 14),
      new THREE.MeshStandardMaterial({ map: clothTexture('#54342c'), roughness: 0.95 })
    );
    cushion.position.set(0.05, 0.33, 1.25);
    this.root.add(cushion);

    // ---- ベンチ（左右の壁沿い） ----
    const benchMat = clip(new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.85 }));
    for (const sx of [-1.85, 1.85]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 4.6), benchMat);
      bench.position.set(sx, 0.38, 0);
      this.root.add(bench);
      for (const z of [-2.0, 0, 2.0]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.05), legMat);
        leg.position.set(sx, 0.18, z);
        this.root.add(leg);
      }
    }

    // ---- 石油ストーブ（暖房） ----
    const heater = new THREE.Group();
    const hBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.46, 18),
      new THREE.MeshStandardMaterial({ color: 0x424b50, roughness: 0.45, metalness: 0.35 })
    );
    hBody.position.y = 0.23;
    hBody.castShadow = true;
    heater.add(hBody);
    const hTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.16, 0.05, 18),
      new THREE.MeshStandardMaterial({ color: 0x333a3e, roughness: 0.4, metalness: 0.5 })
    );
    hTop.position.y = 0.48;
    heater.add(hTop);
    // 燃焼窓（実在の用途がある発光）
    const flame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.145, 0.1, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x2a2222,
        emissive: 0xff7b33,
        emissiveIntensity: 0.85,
        roughness: 0.6
      })
    );
    flame.position.y = 0.3;
    heater.add(flame);
    // やかん
    const kettle = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x8f9498, roughness: 0.35, metalness: 0.8 })
    );
    kettle.scale.y = 0.8;
    kettle.position.y = 0.56;
    heater.add(kettle);
    heater.position.set(-1.1, 0, 1.35);
    this.root.add(heater);
    this.heaterLight = new THREE.PointLight(0xff9950, 6.5, 2.6, 2);
    this.heaterLight.position.set(-1.1, 0.42, 1.35);
    this.root.add(this.heaterLight);

    // ---- 吊りランプ（振り子として揺れる） ----
    this.lamp = new THREE.Group();
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.8 })
    );
    cord.position.y = -0.225;
    this.lamp.add(cord);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.11, 0.09, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x35424a, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide })
    );
    shade.position.y = -0.48;
    this.lamp.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffdf9e, emissiveIntensity: 1.6, roughness: 0.3 })
    );
    bulb.position.y = -0.5;
    this.lamp.add(bulb);
    this.lamp.position.set(0.3, 2.05, 0.3);
    this.root.add(this.lamp);
    this.lampLight = new THREE.PointLight(0xffe0b0, 10, 3.6, 2);
    this.lampLight.position.set(0.3, 1.5, 0.3);
    this.root.add(this.lampLight);

    // ---- 係員（成人）。中景に座って見守る ----
    this.buildAttendant();

    // ---- 透明バケツ（釣れた魚が泳ぐ） ----
    const bucketWall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.1, 0.17, 20, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xdfe8ec,
        roughness: 0.15,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    bucketWall.position.y = 0.085;
    this.bucket.add(bucketWall);
    const bucketBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20),
      new THREE.MeshStandardMaterial({ color: 0x77878e, roughness: 0.45 })
    );
    bucketBottom.position.y = 0.006;
    this.bucket.add(bucketBottom);
    const bucketWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.112, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0x3d626d,
        roughness: 0.08,
        transparent: true,
        opacity: 0.3
      })
    );
    bucketWater.rotation.x = -Math.PI / 2;
    bucketWater.position.y = this.bucketWaterY;
    this.bucket.add(bucketWater);
    const rimB = new THREE.Mesh(
      new THREE.TorusGeometry(0.115, 0.007, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x8fa0a8, roughness: 0.35 })
    );
    rimB.rotation.x = Math.PI / 2;
    rimB.position.y = 0.17;
    this.bucket.add(rimB);
    this.bucket.position.set(-0.52, 0, 0.3);
    this.root.add(this.bucket);

    // ---- 小物：魔法瓶・タオル ----
    const thermos = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.2, 14),
      new THREE.MeshStandardMaterial({ color: 0x7d2f2a, roughness: 0.35, metalness: 0.25 })
    );
    thermos.position.set(-0.42, 0.1, 0.82);
    thermos.rotation.z = 0.02;
    thermos.castShadow = true;
    this.root.add(thermos);
    const towel = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.014, 0.08),
      new THREE.MeshStandardMaterial({ map: clothTexture('#46525c'), roughness: 1 })
    );
    towel.position.set(0.11, 0.383, 0.06);
    towel.rotation.y = 0.4;
    this.table.add(towel);
  }

  private buildAttendant() {
    const g = new THREE.Group();
    const parka = new THREE.MeshStandardMaterial({ map: clothTexture('#3c4438'), roughness: 0.95 });
    const pants = new THREE.MeshStandardMaterial({ map: clothTexture('#2e3438'), roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99f83, roughness: 0.7 });

    // 座った胴体
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 12), parka);
    torso.position.y = 0.62;
    torso.castShadow = true;
    g.add(torso);
    // 腿
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 5, 10), pants);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(s * 0.1, 0.42, 0.2);
      g.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 5, 10), pants);
      shin.position.set(s * 0.1, 0.2, 0.36);
      g.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x1d2124, roughness: 0.8 }));
      boot.position.set(s * 0.1, 0.045, 0.42);
      g.add(boot);
      // 腕（膝の上）
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 5, 10), parka);
      arm.rotation.x = 1.1;
      arm.rotation.z = s * 0.35;
      arm.position.set(s * 0.19, 0.62, 0.1);
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0x30383c, roughness: 0.9 }));
      hand.position.set(s * 0.14, 0.5, 0.26);
      g.add(hand);
    }
    // 頭（ニット帽・うつむき加減で顔は陰に）
    const head = new THREE.Group();
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.093, 14, 12), skin);
    head.add(face);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ map: clothTexture('#8a4a3a'), roughness: 1 }));
    cap.position.y = 0.025;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 16), new THREE.MeshStandardMaterial({ map: clothTexture('#8a4a3a'), roughness: 1 }));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = -0.01;
    head.add(brim);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.4 }));
      eye.position.set(s * 0.032, -0.005, 0.082);
      head.add(eye);
    }
    head.position.y = 0.95;
    head.rotation.x = 0.18;
    g.add(head);
    this.attendantHead = head;

    g.position.set(-1.72, 0.35, -1.3);
    g.rotation.y = Math.PI / 3;
    this.root.add(g);
    this.attendantGroup = g;
  }
  private attendantGroup!: THREE.Group;

  /** 迷いヒント：叩き台がごく小さく沈み、係員が手元を見る */
  hintNudge() {
    this.table.position.y = this.tableBaseY - 0.006;
    this.attendantLookT = 2.2;
  }

  update(dt: number, time: number, swayRollZ: number) {
    // 叩き台の沈み込み復帰
    this.table.position.y = damp(this.table.position.y, this.tableBaseY, 6, dt);
    // ランプの振り子（船の揺れに追従して遅れて揺れる）
    this.lamp.rotation.z = damp(this.lamp.rotation.z, -swayRollZ * 6, 1.6, dt);
    this.lamp.rotation.x = Math.sin(time * 0.47) * 0.012;
    // 係員：呼吸と、ヒント時だけ手元へ視線
    if (this.attendantHead) {
      this.attendantGroup.position.y = 0.35 + Math.sin(time * 0.9) * 0.004;
      this.attendantLookT = Math.max(0, this.attendantLookT - dt);
      const lookTarget = this.attendantLookT > 0 ? -0.75 : 0;
      this.attendantHead.rotation.y = damp(this.attendantHead.rotation.y, lookTarget, 2.5, dt);
    }
    // ストーブの火のごく小さなちらつき
    this.heaterLight.intensity = 6.5 + Math.sin(time * 9.1) * 0.35 + Math.sin(time * 23.7) * 0.2;
  }
}
